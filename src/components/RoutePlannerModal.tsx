import React, { useState, useEffect } from 'react';
import { MobilityProfileId, BarrierItem, RoutePoint, PlannedRoute, RouteAlternative } from '../types/barrier';
import { MOBILITY_PROFILES } from '../data/mobilityProfiles';
import { INDIAN_PLACES, CITY_LANDMARKS } from '../data/initialBarriers';
import {
  resolveAnyLocation,
  searchLocalIndianPlaces,
  geocodeNominatim,
  parseCoordinates,
  reverseGeocode,
} from '../utils/geocoding';
import {
  X,
  Compass,
  MapPin,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Sparkles,
  Navigation,
  Search,
  Check,
  RotateCcw,
  Locate,
  ArrowUpDown,
  Crosshair,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Volume2,
  Route,
  Zap,
} from 'lucide-react';

interface RoutePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  barriers: BarrierItem[];
  activeProfile: MobilityProfileId;
  onChangeProfile: (profile: MobilityProfileId) => void;
  onSetRouteOnMap: (route: PlannedRoute) => void;
  onStartLiveNavigation?: (route: RouteAlternative, origin: RoutePoint, dest: RoutePoint) => void;
  onPickOnMapRequest?: (target: 'origin' | 'destination') => void;
  initialOrigin?: RoutePoint | null;
  initialDestination?: RoutePoint | null;
}

// Calculate real geographic distance using Haversine formula
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({
  isOpen,
  onClose,
  barriers,
  activeProfile,
  onChangeProfile,
  onSetRouteOnMap,
  onStartLiveNavigation,
  onPickOnMapRequest,
  initialOrigin,
  initialDestination,
}) => {
  // Start (Origin) State
  const [originQuery, setOriginQuery] = useState(
    initialOrigin?.name || 'Kempegowda Bus & Metro Terminal (Majestic), Bengaluru'
  );
  const [originPoint, setOriginPoint] = useState<RoutePoint>(
    initialOrigin || {
      name: 'Kempegowda Bus & Metro Terminal (Majestic)',
      address: 'Gubbi Thotadappa Rd, Majestic, Bengaluru, Karnataka',
      lat: 12.9778,
      lng: 77.5713,
      city: 'Bengaluru',
      state: 'Karnataka',
    }
  );
  const [originSuggestions, setOriginSuggestions] = useState<RoutePoint[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [showManualCoordsOrigin, setShowManualCoordsOrigin] = useState(false);

  // Destination State
  const [destQuery, setDestQuery] = useState(
    initialDestination?.name || '80 Feet Road, Koramangala 4th Block, Bengaluru'
  );
  const [destPoint, setDestPoint] = useState<RoutePoint>(
    initialDestination || {
      name: 'Koramangala 4th Block',
      address: '80 Feet Road, Koramangala, Bengaluru, Karnataka',
      lat: 12.9352,
      lng: 77.6245,
      city: 'Bengaluru',
      state: 'Karnataka',
    }
  );
  const [destSuggestions, setDestSuggestions] = useState<RoutePoint[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showManualCoordsDest, setShowManualCoordsDest] = useState(false);

  // Route Alternatives State
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedAltIndex, setSelectedAltIndex] = useState<number>(0);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState<boolean>(false);

  // Sync with props if updated externally
  useEffect(() => {
    if (initialOrigin) {
      setOriginPoint(initialOrigin);
      setOriginQuery(initialOrigin.name);
    }
  }, [initialOrigin]);

  useEffect(() => {
    if (initialDestination) {
      setDestPoint(initialDestination);
      setDestQuery(initialDestination.name);
    }
  }, [initialDestination]);

  // Geolocation state
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Customizable obstacle tolerances
  const currentProfileObj = MOBILITY_PROFILES.find((p) => p.id === activeProfile) || MOBILITY_PROFILES[0];
  const [maxStepLip, setMaxStepLip] = useState<number>(currentProfileObj.maxStepLipCm);
  const [minClearance, setMinClearance] = useState<number>(currentProfileObj.minWidthCm);

  // Gemma AI Route Advisory State
  const [isRequestingAdvice, setIsRequestingAdvice] = useState<boolean>(false);
  const [gemmaAdvice, setGemmaAdvice] = useState<string | null>(null);
  const [isApplyingRoute, setIsApplyingRoute] = useState<boolean>(false);

  // Real distance between Start and Destination
  const distanceKm = calculateDistanceKm(originPoint.lat, originPoint.lng, destPoint.lat, destPoint.lng);
  const profileSpeedKmH =
    activeProfile === 'power_chair' ? 6.0 : activeProfile === 'walker_cane' ? 2.5 : activeProfile === 'manual_wheelchair' ? 3.5 : 4.0;
  const estimatedTimeMin = Math.max(2, Math.round((distanceKm / profileSpeedKmH) * 60));

  // Fetch real routes and compare barriers
  const fetchAlternatives = async (orig = originPoint, dst = destPoint) => {
    if (!orig?.lat || !dst?.lat) return;
    setIsLoadingAlternatives(true);
    try {
      const res = await fetch('/api/navigation/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: orig,
          destination: dst,
          barriers,
          profile: activeProfile,
        }),
      });
      const data = await res.json();
      if (data.alternatives && data.alternatives.length > 0) {
        setAlternatives(data.alternatives);
        const recIndex = data.alternatives.findIndex((a: RouteAlternative) => a.isRecommended);
        setSelectedAltIndex(recIndex >= 0 ? recIndex : 0);
      }
    } catch (err) {
      console.warn('Failed to query route alternatives:', err);
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  useEffect(() => {
    if (isOpen && originPoint.lat && destPoint.lat) {
      fetchAlternatives(originPoint, destPoint);
    }
  }, [isOpen, originPoint.lat, originPoint.lng, destPoint.lat, destPoint.lng, activeProfile]);

  if (!isOpen) return null;

  // Handle Autocomplete Searching for Origin
  const handleOriginSearch = async (query: string) => {
    setOriginQuery(query);
    if (!query.trim()) {
      setOriginSuggestions([]);
      return;
    }

    // Direct coords check
    const coords = parseCoordinates(query);
    if (coords) {
      setOriginSuggestions([
        {
          name: `GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
          address: `Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
          lat: coords.lat,
          lng: coords.lng,
          isCustom: true,
        },
      ]);
      return;
    }

    // Fast local matches
    const local = searchLocalIndianPlaces(query);
    setOriginSuggestions(local);

    // Online Nominatim query if length > 2
    if (query.trim().length > 2) {
      setIsSearchingOrigin(true);
      try {
        const online = await geocodeNominatim(query);
        if (online.length > 0) {
          setOriginSuggestions((prev) => {
            const combined = [...prev, ...online];
            return combined.filter(
              (v, i, a) =>
                a.findIndex(
                  (t) => Math.abs(t.lat - v.lat) < 0.001 && Math.abs(t.lng - v.lng) < 0.001
                ) === i
            ).slice(0, 7);
          });
        }
      } finally {
        setIsSearchingOrigin(false);
      }
    }
  };

  // Handle Autocomplete Searching for Destination
  const handleDestSearch = async (query: string) => {
    setDestQuery(query);
    if (!query.trim()) {
      setDestSuggestions([]);
      return;
    }

    // Direct coords check
    const coords = parseCoordinates(query);
    if (coords) {
      setDestSuggestions([
        {
          name: `GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
          address: `Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
          lat: coords.lat,
          lng: coords.lng,
          isCustom: true,
        },
      ]);
      return;
    }

    // Fast local matches
    const local = searchLocalIndianPlaces(query);
    setDestSuggestions(local);

    // Online Nominatim query
    if (query.trim().length > 2) {
      setIsSearchingDest(true);
      try {
        const online = await geocodeNominatim(query);
        if (online.length > 0) {
          setDestSuggestions((prev) => {
            const combined = [...prev, ...online];
            return combined.filter(
              (v, i, a) =>
                a.findIndex(
                  (t) => Math.abs(t.lat - v.lat) < 0.001 && Math.abs(t.lng - v.lng) < 0.001
                ) === i
            ).slice(0, 7);
          });
        }
      } finally {
        setIsSearchingDest(false);
      }
    }
  };

  // Explicit locate button / Enter key for Origin
  const handleResolveOrigin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!originQuery.trim()) return;
    setIsSearchingOrigin(true);
    setLocationStatus(null);
    try {
      const resolved = await resolveAnyLocation(originQuery);
      setOriginPoint(resolved);
      setOriginQuery(resolved.name);
      setOriginSuggestions([]);
      setGemmaAdvice(null);
    } catch (err: any) {
      setLocationStatus(`Could not pinpoint "${originQuery}". Try adding a city name or state.`);
    } finally {
      setIsSearchingOrigin(false);
    }
  };

  // Explicit locate button / Enter key for Destination
  const handleResolveDest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!destQuery.trim()) return;
    setIsSearchingDest(true);
    setLocationStatus(null);
    try {
      const resolved = await resolveAnyLocation(destQuery);
      setDestPoint(resolved);
      setDestQuery(resolved.name);
      setDestSuggestions([]);
      setGemmaAdvice(null);
    } catch (err: any) {
      setLocationStatus(`Could not pinpoint "${destQuery}". Try adding a city name or state.`);
    } finally {
      setIsSearchingDest(false);
    }
  };

  // Use Current Device GPS Location
  const handleUseCurrentLocation = (target: 'origin' | 'destination') => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingLocation(true);
    setLocationStatus('Acquiring GPS location...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const info = await reverseGeocode(lat, lng);

        const point: RoutePoint = {
          name: info.name || 'My Current GPS Location',
          address: info.address,
          lat,
          lng,
          city: info.city,
          state: info.state,
          isCustom: true,
        };

        if (target === 'origin') {
          setOriginPoint(point);
          setOriginQuery(point.name);
        } else {
          setDestPoint(point);
          setDestQuery(point.name);
        }

        setIsGettingLocation(false);
        setLocationStatus(`GPS acquired: ${point.name}`);
        setTimeout(() => setLocationStatus(null), 3000);
      },
      (err) => {
        setIsGettingLocation(false);
        setLocationStatus(`Could not access GPS (${err.message}). You can type any location or click 'Pick on Map'.`);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Swap Start and Destination
  const handleSwapPoints = () => {
    const tempPoint = originPoint;
    const tempQuery = originQuery;
    setOriginPoint(destPoint);
    setOriginQuery(destQuery);
    setDestPoint(tempPoint);
    setDestQuery(tempQuery);
    setGemmaAdvice(null);
  };

  // Find active barriers near the route corridor
  const activeBlockers = barriers.filter((b) => {
    if (b.status !== 'ACTIVE' || b.location.lat == null || b.location.lng == null) return false;
    const minLat = Math.min(originPoint.lat, destPoint.lat) - 0.05;
    const maxLat = Math.max(originPoint.lat, destPoint.lat) + 0.05;
    const minLng = Math.min(originPoint.lng, destPoint.lng) - 0.05;
    const maxLng = Math.max(originPoint.lng, destPoint.lng) + 0.05;
    return b.location.lat >= minLat && b.location.lat <= maxLat && b.location.lng >= minLng && b.location.lng <= maxLng;
  });

  // Gemma AI Route Advisory Request
  const handleGetGemmaAdvice = async () => {
    setIsRequestingAdvice(true);
    setGemmaAdvice(null);

    // Ensure points are resolved first
    let currentOrigin = originPoint;
    let currentDest = destPoint;

    if (originQuery.trim() !== originPoint.name && originQuery.trim() !== originPoint.address) {
      try {
        currentOrigin = await resolveAnyLocation(originQuery);
        setOriginPoint(currentOrigin);
      } catch (e) {
        // use existing
      }
    }

    if (destQuery.trim() !== destPoint.name && destQuery.trim() !== destPoint.address) {
      try {
        currentDest = await resolveAnyLocation(destQuery);
        setDestPoint(currentDest);
      } catch (e) {
        // use existing
      }
    }

    try {
      const response = await fetch('/api/gemma/route-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: currentOrigin,
          destination: currentDest,
          profile: currentProfileObj.label,
          barriersOnRoute: activeBlockers.slice(0, 4).map((b) => ({
            title: b.title,
            address: b.location.address,
            severity: b.severity,
            dimensions: b.dimensions,
          })),
        }),
      });

      const data = await response.json();
      setGemmaAdvice(
        data.advisory ||
          `Accessibility advisory for ${currentProfileObj.label}: Corridor distance is ${distanceKm} km between ${currentOrigin.name} and ${currentDest.name}. Proceed along main signalized corridors with flush pedestrian curb cuts.`
      );
    } catch (err) {
      console.error(err);
      setGemmaAdvice(
        `Advisory for ${currentProfileObj.label}: Journey between ${currentOrigin.name} and ${currentDest.name} (${distanceKm} km). Keep to wide pedestrian pathways with compliant gradients.`
      );
    } finally {
      setIsRequestingAdvice(false);
    }
  };

  // Commit and Project Custom Route on Map
  const handleApplyRoute = async () => {
    setIsApplyingRoute(true);

    let activeOrig = originPoint;
    let activeDst = destPoint;

    if (originQuery.trim() && originQuery.trim() !== originPoint.name && originQuery.trim() !== originPoint.address) {
      try {
        activeOrig = await resolveAnyLocation(originQuery);
        setOriginPoint(activeOrig);
      } catch (e) {
        console.warn('Fallback using current origin');
      }
    }

    if (destQuery.trim() && destQuery.trim() !== destPoint.name && destQuery.trim() !== destPoint.address) {
      try {
        activeDst = await resolveAnyLocation(destQuery);
        setDestPoint(activeDst);
      } catch (e) {
        console.warn('Fallback using current destination');
      }
    }

    const dist = calculateDistanceKm(activeOrig.lat, activeOrig.lng, activeDst.lat, activeDst.lng);
    const midLat = (activeOrig.lat + activeDst.lat) / 2;
    const midLng = (activeOrig.lng + activeDst.lng) / 2;

    const selectedAlt = alternatives[selectedAltIndex];

    onSetRouteOnMap({
      origin: activeOrig,
      destination: activeDst,
      obstructedPath: [
        { lat: activeOrig.lat, lng: activeOrig.lng },
        { lat: midLat + 0.002, lng: midLng - 0.002 },
        { lat: activeDst.lat, lng: activeDst.lng },
      ],
      accessiblePath: selectedAlt?.coordinates || [
        { lat: activeOrig.lat, lng: activeOrig.lng },
        { lat: activeOrig.lat, lng: activeDst.lng },
        { lat: activeDst.lat, lng: activeDst.lng },
      ],
      distanceKm: selectedAlt ? selectedAlt.distanceKm : dist,
      estimatedTimeMin: selectedAlt ? selectedAlt.durationMinutes : Math.max(2, Math.round((dist / profileSpeedKmH) * 60)),
      advisory: gemmaAdvice || undefined,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      selectedAlternativeIndex: selectedAltIndex,
    });

    setIsApplyingRoute(false);
    onClose();
  };

  // Start Live Navigation with Turn-by-Turn Voice Guidance & GPS HUD
  const handleStartNavigationClick = async () => {
    let activeOrig = originPoint;
    let activeDst = destPoint;

    if (originQuery.trim() && originQuery.trim() !== originPoint.name && originQuery.trim() !== originPoint.address) {
      try {
        activeOrig = await resolveAnyLocation(originQuery);
        setOriginPoint(activeOrig);
      } catch (e) {}
    }

    if (destQuery.trim() && destQuery.trim() !== destPoint.name && destQuery.trim() !== destPoint.address) {
      try {
        activeDst = await resolveAnyLocation(destQuery);
        setDestPoint(activeDst);
      } catch (e) {}
    }

    const dist = calculateDistanceKm(activeOrig.lat, activeOrig.lng, activeDst.lat, activeDst.lng);
    const chosenAlt = alternatives[selectedAltIndex] || {
      id: 'route_nav_primary',
      summary: `Corridor to ${activeDst.name}`,
      distanceKm: dist,
      durationMinutes: estimatedTimeMin,
      coordinates: [
        { lat: activeOrig.lat, lng: activeOrig.lng },
        { lat: (activeOrig.lat + activeDst.lat) / 2, lng: (activeOrig.lng + activeDst.lng) / 2 },
        { lat: activeDst.lat, lng: activeDst.lng },
      ],
      steps: [
        {
          instruction: `Head forward toward ${activeDst.name}`,
          distanceMeters: Math.round(dist * 1000),
          durationSeconds: Math.round(estimatedTimeMin * 60),
          modifier: 'straight',
          type: 'depart',
          name: activeOrig.name,
          lat: activeOrig.lat,
          lng: activeOrig.lng,
        },
        {
          instruction: 'Arrive at destination',
          distanceMeters: 0,
          durationSeconds: 0,
          type: 'arrive',
          name: activeDst.name,
          lat: activeDst.lat,
          lng: activeDst.lng,
        },
      ],
      barriersOnRoute: activeBlockers,
      maxBarrierSeverity: activeBlockers.reduce((m, b) => Math.max(m, b.severity || 1), 0),
      isRecommended: true,
      recommendationReason: 'Active corridor navigation',
    };

    if (onStartLiveNavigation) {
      onStartLiveNavigation(chosenAlt, activeOrig, activeDst);
    } else {
      handleApplyRoute();
    }
    onClose();
  };

  // Optional quick example corridors across India
  const sampleCorridors = [
    {
      label: 'Bengaluru: Majestic → Koramangala',
      from: { name: 'Majestic Bus & Metro Terminal', address: 'Majestic, Bengaluru', lat: 12.9778, lng: 77.5713, city: 'Bengaluru', state: 'Karnataka' },
      to: { name: 'Koramangala 4th Block', address: '80 Feet Rd, Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245, city: 'Bengaluru', state: 'Karnataka' },
    },
    {
      label: 'Delhi: Rajiv Chowk → India Gate',
      from: { name: 'Rajiv Chowk Metro Interchange', address: 'Connaught Place, New Delhi', lat: 28.6328, lng: 77.2197, city: 'New Delhi', state: 'Delhi' },
      to: { name: 'India Gate & Kartavya Path', address: 'Rajpath, India Gate, New Delhi', lat: 28.6129, lng: 77.2295, city: 'New Delhi', state: 'Delhi' },
    },
    {
      label: 'Mumbai: Dadar Station → Marine Drive',
      from: { name: 'Dadar Western Station', address: 'Senapati Bapat Marg, Dadar, Mumbai', lat: 19.0178, lng: 72.8478, city: 'Mumbai', state: 'Maharashtra' },
      to: { name: 'Marine Drive Promenade', address: 'Netaji Subhash Chandra Bose Rd, Mumbai', lat: 18.9432, lng: 72.8234, city: 'Mumbai', state: 'Maharashtra' },
    },
    {
      label: 'Chennai: Central Station → Guindy Metro',
      from: { name: 'Puratchi Thalaivar Dr. MGR Central Station', address: 'Periyamet, Chennai', lat: 13.0827, lng: 80.2755, city: 'Chennai', state: 'Tamil Nadu' },
      to: { name: 'Guindy Metro Station', address: 'Anna Salai, Guindy, Chennai', lat: 13.0067, lng: 80.2023, city: 'Chennai', state: 'Tamil Nadu' },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-hud">
      <div className="bg-[#030914] border border-cyan-500/20 rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(2,6,23,0.95)] hud-frame">
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#020713]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">JOURNEY // 03</span>
                <span className="text-slate-600 font-mono">//</span>
                <span className="text-xs font-mono text-slate-400 uppercase">PASSAGE ENGINE</span>
              </div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Accessibility Route Planner</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/60">
                  ALL INDIA FREEFORM
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Enter ANY start location and destination address, city, station, or click on the map.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification */}
        {locationStatus && (
          <div className="px-4 py-2 bg-sky-950/80 border-b border-sky-800 text-xs text-sky-200 flex items-center justify-between">
            <span>{locationStatus}</span>
            <button onClick={() => setLocationStatus(null)} className="text-sky-400 hover:text-white ml-2 text-xs">
              ×
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Main Start & Destination Dual Form with Swap */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 relative">
            {/* Swap Button (Desktop & Mobile) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:block">
              <button
                type="button"
                onClick={handleSwapPoints}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-sky-600 border border-slate-700 hover:border-sky-500 text-slate-300 hover:text-white flex items-center justify-center transition-all shadow-lg cursor-pointer"
                title="Swap Start and Destination"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            {/* 1. START ORIGIN INPUT */}
            <div className="relative space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>1. Starting Origin (Enter Any Location)</span>
                </label>

                {/* Quick actions for Origin */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUseCurrentLocation('origin')}
                    disabled={isGettingLocation}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 transition-colors cursor-pointer"
                    title="Use my device's GPS position"
                  >
                    <Locate className="w-3 h-3" />
                    <span>My GPS</span>
                  </button>

                  {onPickOnMapRequest && (
                    <button
                      type="button"
                      onClick={() => {
                        onPickOnMapRequest('origin');
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 transition-colors cursor-pointer"
                      title="Click anywhere on the map to place start pin"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Pick on Map</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManualCoordsOrigin((prev) => !prev)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline ml-1"
                  >
                    {showManualCoordsOrigin ? 'Hide GPS' : 'Lat/Lng'}
                  </button>
                </div>
              </div>

              {/* Freeform Text Box with Search & Clear */}
              <form onSubmit={handleResolveOrigin} className="relative flex items-center">
                <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5 shrink-0" />
                <input
                  type="text"
                  value={originQuery}
                  onChange={(e) => handleOriginSearch(e.target.value)}
                  placeholder="Type any Indian street, station, road, town, village, or landmark..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />

                <div className="absolute right-1.5 flex items-center gap-1">
                  {originQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setOriginQuery('');
                        setOriginSuggestions([]);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200"
                      title="Clear text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSearchingOrigin}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow"
                    title="Pinpoint location"
                  >
                    {isSearchingOrigin ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Search className="w-3 h-3" />
                        <span>Find</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Autocomplete Suggestions Dropdown */}
              {originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl max-h-52 overflow-y-auto shadow-2xl divide-y divide-slate-800 z-40">
                  {originSuggestions.map((pt, idx) => (
                    <button
                      key={`orig-${idx}`}
                      type="button"
                      onClick={() => {
                        setOriginPoint(pt);
                        setOriginQuery(pt.name);
                        setOriginSuggestions([]);
                        setGemmaAdvice(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800 text-xs text-slate-200 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold block text-white">{pt.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-md">{pt.address}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900 shrink-0 ml-2">
                        {pt.city || 'Place'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Manual Direct Coordinates Form (if toggled) */}
              {showManualCoordsOrigin && (
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={originPoint.lat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setOriginPoint((prev) => ({ ...prev, lat: val }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={originPoint.lng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setOriginPoint((prev) => ({ ...prev, lng: val }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Active Selection Details */}
              <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono px-1">
                <span className="truncate">Active Start: <strong className="text-slate-200">{originPoint.name}</strong></span>
                <span className="text-emerald-400 shrink-0 ml-2">
                  {originPoint.lat.toFixed(4)}, {originPoint.lng.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Mobile Swap Button */}
            <div className="flex justify-center md:hidden pt-1">
              <button
                type="button"
                onClick={handleSwapPoints}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-sky-600 text-xs text-slate-300 hover:text-white transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Swap Start & Destination</span>
              </button>
            </div>

            <div className="border-t border-slate-800/80 my-2" />

            {/* 2. DESTINATION INPUT */}
            <div className="relative space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                  <span>2. Destination Place (Enter Any Location)</span>
                </label>

                {/* Quick actions for Destination */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUseCurrentLocation('destination')}
                    disabled={isGettingLocation}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 transition-colors cursor-pointer"
                    title="Use my device's GPS position"
                  >
                    <Locate className="w-3 h-3" />
                    <span>My GPS</span>
                  </button>

                  {onPickOnMapRequest && (
                    <button
                      type="button"
                      onClick={() => {
                        onPickOnMapRequest('destination');
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 transition-colors cursor-pointer"
                      title="Click anywhere on the map to place destination pin"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Pick on Map</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManualCoordsDest((prev) => !prev)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline ml-1"
                  >
                    {showManualCoordsDest ? 'Hide GPS' : 'Lat/Lng'}
                  </button>
                </div>
              </div>

              {/* Freeform Text Box for Destination */}
              <form onSubmit={handleResolveDest} className="relative flex items-center">
                <MapPin className="w-4 h-4 text-rose-400 absolute left-3 top-2.5 shrink-0" />
                <input
                  type="text"
                  value={destQuery}
                  onChange={(e) => handleDestSearch(e.target.value)}
                  placeholder="Type any Indian destination address, hospital, metro, tech park, or city..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors shadow-inner"
                />

                <div className="absolute right-1.5 flex items-center gap-1">
                  {destQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setDestQuery('');
                        setDestSuggestions([]);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200"
                      title="Clear text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSearchingDest}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow"
                    title="Pinpoint destination"
                  >
                    {isSearchingDest ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Search className="w-3 h-3" />
                        <span>Find</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Destination Suggestions Dropdown */}
              {destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl max-h-52 overflow-y-auto shadow-2xl divide-y divide-slate-800 z-40">
                  {destSuggestions.map((pt, idx) => (
                    <button
                      key={`dest-${idx}`}
                      type="button"
                      onClick={() => {
                        setDestPoint(pt);
                        setDestQuery(pt.name);
                        setDestSuggestions([]);
                        setGemmaAdvice(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800 text-xs text-slate-200 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold block text-white">{pt.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-md">{pt.address}</span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-400 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-900 shrink-0 ml-2">
                        {pt.city || 'Place'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Manual Direct Coordinates Form (if toggled) */}
              {showManualCoordsDest && (
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={destPoint.lat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setDestPoint((prev) => ({ ...prev, lat: val }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={destPoint.lng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setDestPoint((prev) => ({ ...prev, lng: val }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Active Selection Details */}
              <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono px-1">
                <span className="truncate">Active Dest: <strong className="text-slate-200">{destPoint.name}</strong></span>
                <span className="text-rose-400 shrink-0 ml-2">
                  {destPoint.lat.toFixed(4)}, {destPoint.lng.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preset Examples (Optional Shortcuts) */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center justify-between">
              <span>Quick Sample Corridors (Optional Shortcuts):</span>
              <span className="text-[10px] text-slate-500 font-normal">You can freely type ANY other place above</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleCorridors.map((trip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setOriginQuery(trip.from.name);
                    setOriginPoint(trip.from);
                    setDestQuery(trip.to.name);
                    setDestPoint(trip.to);
                    setGemmaAdvice(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-500 text-[11px] text-slate-300 hover:text-white transition-colors"
                >
                  {trip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Journey Distance & Corridor Metrics */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Total Distance</span>
              <span className="font-mono text-sm font-bold text-sky-400">{distanceKm} km</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Estimated Travel Time</span>
              <span className="font-mono text-sm font-bold text-slate-200">~{estimatedTimeMin} mins</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Nearby Barrier Reports</span>
              <span className="font-mono text-sm font-bold text-rose-400">{activeBlockers.length} active</span>
            </div>
          </div>

          {/* Mobility Profile Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Choose Mobility Lens:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MOBILITY_PROFILES.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => {
                    onChangeProfile(prof.id);
                    setMaxStepLip(prof.maxStepLipCm);
                    setMinClearance(prof.minWidthCm);
                    setGemmaAdvice(null);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activeProfile === prof.id
                      ? 'bg-sky-950/50 border-sky-500 ring-1 ring-sky-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs text-white block">{prof.shortLabel}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                    Max lip: {prof.maxStepLipCm}cm · Min width: {prof.minWidthCm}cm
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Customizable Obstacle Tolerances */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Physical Barrier Tolerances for This Journey</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Max Step Lip Height</span>
                  <span className="font-mono font-bold text-sky-400">{maxStepLip} cm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={maxStepLip}
                  onChange={(e) => setMaxStepLip(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Min Walkway Clearance</span>
                  <span className="font-mono font-bold text-sky-400">{minClearance} cm</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="120"
                  value={minClearance}
                  onChange={(e) => setMinClearance(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Alternative Routes & Barrier Comparison Section */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">Candidate Route Alternatives & Known Obstacles</span>
              </div>
              {isLoadingAlternatives && (
                <div className="flex items-center gap-1.5 text-[11px] text-sky-400">
                  <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <span>Checking routing network...</span>
                </div>
              )}
            </div>

            {alternatives.length > 0 ? (
              <div className="space-y-2">
                {alternatives.map((alt, idx) => {
                  const isSelected = selectedAltIndex === idx;
                  return (
                    <div
                      key={alt.id}
                      onClick={() => setSelectedAltIndex(idx)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/70 shadow-lg'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-sky-400 bg-sky-500' : 'border-slate-600 bg-transparent'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-white block">{alt.summary}</span>
                            <span className="text-[11px] text-slate-400">
                              {alt.distanceKm} km · ~{alt.durationMinutes} mins · {alt.steps.length} turns
                            </span>
                          </div>
                        </div>

                        {alt.isRecommended ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1 shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Recommended</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 shrink-0">
                            Option {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Obstacle analysis for this alternative */}
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {alt.barriersOnRoute.length === 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>0 reported barriers</span>
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                {alt.barriersOnRoute.length} reported obstacle{alt.barriersOnRoute.length > 1 ? 's' : ''} (Max severity {alt.maxBarrierSeverity}/5)
                              </span>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 truncate max-w-xs ml-2 text-right">
                          {alt.recommendationReason}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="text-[10px] text-slate-500 italic px-1">
                  * Honest Coverage Notice: Missing reports along a path do not guarantee an obstacle-free route. Unsurveyed streets may contain unknown hazards.
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Calculating accessible pedestrian corridors between Start and Destination...</span>
                <button
                  type="button"
                  onClick={() => fetchAlternatives()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                >
                  Refresh Routes
                </button>
              </div>
            )}
          </div>

          {/* Gemma 4 Advisory Section */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">Gemma 4 Real-time Route Briefing</span>
              </div>
              <button
                type="button"
                onClick={handleGetGemmaAdvice}
                disabled={isRequestingAdvice}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {isRequestingAdvice ? 'Analyzing Route...' : 'Generate AI Advisory'}
              </button>
            </div>

            {gemmaAdvice && (
              <p className="text-xs text-sky-200/90 leading-relaxed bg-sky-950/40 p-2.5 rounded-lg border border-sky-500/20 whitespace-pre-line">
                {gemmaAdvice}
              </p>
            )}
          </div>
        </div>

        {/* Footer with dual actions: Start Live Navigation & Preview on Map */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleApplyRoute}
              disabled={isApplyingRoute}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
              title="Preview route geometry on the interactive map"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Preview on Map</span>
            </button>

            <button
              type="button"
              onClick={handleStartNavigationClick}
              disabled={isApplyingRoute}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
              title="Launch active turn-by-turn spoken voice navigation HUD"
            >
              <Navigation className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>Start Navigation</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-emerald-900/40 text-emerald-950 text-[10px] font-mono">
                Voice Guided
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
