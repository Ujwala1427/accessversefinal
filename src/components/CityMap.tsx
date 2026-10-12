import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  BarrierItem,
  CityLandmark,
  MobilityProfileId,
  RoutePoint,
  PlannedRoute,
  ActiveNavigationSession,
  RouteAlternative,
} from '../types/barrier';
import { INDIAN_PLACES, IndianPlace } from '../data/initialBarriers';
import { reverseGeocode } from '../utils/geocoding';
import {
  Search,
  RotateCcw,
  Navigation,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Compass,
  ArrowRight,
  Crosshair,
  X,
  Flag,
  Play,
} from 'lucide-react';

interface CityMapProps {
  barriers: BarrierItem[];
  landmarks: CityLandmark[];
  selectedBarrierId: string | null;
  onSelectBarrier: (barrier: BarrierItem) => void;
  onMapClickToReport: (location: {
    lat: number;
    lng: number;
    address: string;
    nearestLandmark: string;
    city?: string;
    state?: string;
  }) => void;
  activeMobilityFilter: MobilityProfileId | 'all';
  showResolved: boolean;
  plannedRoute?: PlannedRoute | null;
  activeNavigation?: ActiveNavigationSession | null;
  onStartLiveNavigation?: (route: RouteAlternative, origin: RoutePoint, dest: RoutePoint) => void;
  onSetOriginPoint?: (point: RoutePoint) => void;
  onSetDestPoint?: (point: RoutePoint) => void;
  onOpenRoutePlanner?: () => void;
  onClearRoute?: () => void;
  pickMode?: 'none' | 'origin' | 'destination';
  onCancelPickMode?: () => void;
}

export const CityMap: React.FC<CityMapProps> = ({
  barriers,
  landmarks,
  selectedBarrierId,
  onSelectBarrier,
  onMapClickToReport,
  activeMobilityFilter,
  showResolved,
  plannedRoute,
  activeNavigation,
  onStartLiveNavigation,
  onSetOriginPoint,
  onSetDestPoint,
  onOpenRoutePlanner,
  onClearRoute,
  pickMode = 'none',
  onCancelPickMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const clickPopupRef = useRef<L.Popup | null>(null);

  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IndianPlace[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showUnlocatedDrawer, setShowUnlocatedDrawer] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [tileError, setTileError] = useState(false);
  const [lastActionToast, setLastActionToast] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const userGpsMarkerRef = useRef<L.Marker | null>(null);

  // India geographic center bounds
  const INDIA_CENTER: [number, number] = [22.5, 79.0];
  const INDIA_ZOOM = 5;

  const handleLocateUserWithGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingGps(true);
    setSearchError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });

          if (userGpsMarkerRef.current) {
            userGpsMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const gpsIcon = L.divIcon({
              className: 'custom-gps-pin',
              html: `
                <div class="flex flex-col items-center">
                  <div class="px-2 py-0.5 rounded-full bg-sky-600 text-white font-mono text-[9px] font-bold shadow-lg border border-sky-300">
                    YOU ARE HERE
                  </div>
                  <div class="relative w-7 h-7 flex items-center justify-center mt-0.5">
                    <div class="absolute w-7 h-7 rounded-full bg-sky-400/40 animate-ping"></div>
                    <div class="w-4.5 h-4.5 rounded-full bg-sky-500 border-2 border-white shadow-xl flex items-center justify-center">
                      <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                    </div>
                  </div>
                </div>
              `,
              iconSize: [80, 42],
              iconAnchor: [40, 36],
            });
            const marker = L.marker([lat, lng], { icon: gpsIcon, zIndexOffset: 950 }).addTo(mapInstanceRef.current);
            userGpsMarkerRef.current = marker;
          }
        }
        setLastActionToast(`📍 GPS Acquired: ${lat.toFixed(4)}, ${lng.toFixed(4)} (±${Math.round(pos.coords.accuracy || 10)}m)`);
        setTimeout(() => setLastActionToast(null), 4000);
      },
      (err) => {
        setIsLocatingGps(false);
        setSearchError(`GPS access notice: ${err.message}. Please check browser location permissions.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  // Split barriers into located (with valid lat/lng) and unlocated (data integrity requirement)
  const { locatedBarriers, unlocatedBarriers } = useMemo(() => {
    const located: BarrierItem[] = [];
    const unlocated: BarrierItem[] = [];

    barriers.forEach((b) => {
      const hasValidCoords =
        typeof b.location.lat === 'number' &&
        typeof b.location.lng === 'number' &&
        !isNaN(b.location.lat) &&
        !isNaN(b.location.lng);

      if (hasValidCoords) {
        located.push(b);
      } else {
        unlocated.push(b);
      }
    });

    return { locatedBarriers: located, unlocatedBarriers: unlocated };
  }, [barriers]);

  // Filter located barriers based on visibility toggles
  const visibleBarriers = useMemo(() => {
    return locatedBarriers.filter((b) => {
      if (!showResolved && b.status === 'RESOLVED') return false;
      return true;
    });
  }, [locatedBarriers, showResolved]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Map instance centered on India
    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: INDIA_ZOOM,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
    });

    // OpenStreetMap Standard Tiles
    const osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    });

    osmTileLayer.on('tileerror', () => {
      setTileError(true);
    });

    osmTileLayer.addTo(map);

    // Create Layer Groups
    const markersLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    routeLayerRef.current = routeLayer;
    mapInstanceRef.current = map;

    // Track Zoom level
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Map Click based on active Pick Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const roundedLat = Number(lat.toFixed(5));
      const roundedLng = Number(lng.toFixed(5));

      // Resolve approximate address
      const locationInfo = await reverseGeocode(roundedLat, roundedLng);

      // 1. If currently in Pick Origin Mode
      if (pickMode === 'origin') {
        if (onSetOriginPoint) {
          onSetOriginPoint({
            name: locationInfo.name,
            address: locationInfo.address,
            lat: roundedLat,
            lng: roundedLng,
            city: locationInfo.city,
            state: locationInfo.state,
            isCustom: true,
          });
        }
        setLastActionToast(`Start Location set: ${locationInfo.name}`);
        setTimeout(() => setLastActionToast(null), 3500);
        if (onCancelPickMode) onCancelPickMode();
        return;
      }

      // 2. If currently in Pick Destination Mode
      if (pickMode === 'destination') {
        if (onSetDestPoint) {
          onSetDestPoint({
            name: locationInfo.name,
            address: locationInfo.address,
            lat: roundedLat,
            lng: roundedLng,
            city: locationInfo.city,
            state: locationInfo.state,
            isCustom: true,
          });
        }
        setLastActionToast(`Destination set: ${locationInfo.name}`);
        setTimeout(() => setLastActionToast(null), 3500);
        if (onCancelPickMode) onCancelPickMode();
        return;
      }

      // 3. Normal Mode: Open interactive popup offering Set Start, Set Destination, or Report Barrier
      const popupContent = document.createElement('div');
      popupContent.className = 'text-xs space-y-2.5 p-1 min-w-[210px]';

      popupContent.innerHTML = `
        <div class="border-b border-slate-700/80 pb-1.5">
          <span class="font-bold text-white block text-[13px]">${locationInfo.name}</span>
          <span class="text-[10px] text-slate-400 block truncate">${locationInfo.address}</span>
          <span class="text-[9px] font-mono text-slate-500 block mt-0.5">${roundedLat}, ${roundedLng}</span>
        </div>
        <div class="space-y-1.5 pt-0.5">
          <button id="btn-set-start" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 font-semibold text-xs transition-colors cursor-pointer">
            <span>🟢 Set as Journey Start</span>
            <span class="text-[10px] font-mono">Origin</span>
          </button>
          <button id="btn-set-dest" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-800 text-rose-200 border border-rose-700 font-semibold text-xs transition-colors cursor-pointer">
            <span>🏁 Set as Destination</span>
            <span class="text-[10px] font-mono">Dest</span>
          </button>
          <button id="btn-report-barrier" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-800 text-amber-200 border border-amber-700 font-semibold text-xs transition-colors cursor-pointer">
            <span>⚠️ Report Barrier Here</span>
            <span class="text-[10px] font-mono">+Report</span>
          </button>
        </div>
      `;

      const popup = L.popup({
        closeButton: true,
        className: 'custom-map-click-popup',
      })
        .setLatLng([roundedLat, roundedLng])
        .setContent(popupContent)
        .openOn(map);

      clickPopupRef.current = popup;

      // Attach event listeners to popup buttons
      setTimeout(() => {
        const btnStart = document.getElementById('btn-set-start');
        const btnDest = document.getElementById('btn-set-dest');
        const btnReport = document.getElementById('btn-report-barrier');

        if (btnStart) {
          btnStart.onclick = () => {
            if (onSetOriginPoint) {
              onSetOriginPoint({
                name: locationInfo.name,
                address: locationInfo.address,
                lat: roundedLat,
                lng: roundedLng,
                city: locationInfo.city,
                state: locationInfo.state,
                isCustom: true,
              });
              setLastActionToast(`Start Location set: ${locationInfo.name}`);
              setTimeout(() => setLastActionToast(null), 3000);
            }
            map.closePopup();
          };
        }

        if (btnDest) {
          btnDest.onclick = () => {
            if (onSetDestPoint) {
              onSetDestPoint({
                name: locationInfo.name,
                address: locationInfo.address,
                lat: roundedLat,
                lng: roundedLng,
                city: locationInfo.city,
                state: locationInfo.state,
                isCustom: true,
              });
              setLastActionToast(`Destination set: ${locationInfo.name}`);
              setTimeout(() => setLastActionToast(null), 3000);
            }
            map.closePopup();
          };
        }

        if (btnReport) {
          btnReport.onclick = () => {
            onMapClickToReport({
              lat: roundedLat,
              lng: roundedLng,
              address: locationInfo.address,
              nearestLandmark: locationInfo.city ? `${locationInfo.city} Area` : 'India Corridor',
              city: locationInfo.city,
              state: locationInfo.state,
            });
            map.closePopup();
          };
        }
      }, 50);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [pickMode, onSetOriginPoint, onSetDestPoint, onCancelPickMode, onMapClickToReport]);

  // Sync Markers when visibleBarriers, selectedBarrierId, or currentZoom changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Render City Landmarks as subtle reference pins
    landmarks.forEach((lm) => {
      const landmarkIcon = L.divIcon({
        className: 'custom-barrier-marker',
        html: `
          <div class="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 border border-sky-400/80 shadow-md hover:scale-125 transition-transform cursor-pointer">
            <div class="w-2 h-2 rounded-full bg-sky-400"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lm.lat, lm.lng], { icon: landmarkIcon });
      marker.bindTooltip(
        `<strong>${lm.name}</strong><br/><span style="color:#94a3b8">${lm.city}, ${lm.state}</span><br/><span style="color:#38bdf8;font-size:10px;">Click marker to set route point</span>`,
        {
          direction: 'top',
          className: 'bg-slate-900 text-slate-100 text-xs border border-slate-700 p-1.5 rounded-lg shadow-xl',
        }
      );

      marker.on('click', () => {
        if (onSetOriginPoint) {
          onSetOriginPoint({
            name: lm.name,
            address: lm.address,
            lat: lm.lat,
            lng: lm.lng,
            city: lm.city,
            state: lm.state,
          });
          setLastActionToast(`Set ${lm.name} as Route Origin`);
          setTimeout(() => setLastActionToast(null), 3000);
        }
      });

      markersLayer.addLayer(marker);
    });

    // 2. Render Barrier Markers with high-contrast accessibility pins
    visibleBarriers.forEach((barrier) => {
      const lat = barrier.location.lat!;
      const lng = barrier.location.lng!;

      const isSelected = barrier.id === selectedBarrierId;
      const isResolved = barrier.status === 'RESOLVED';
      const isSevere = barrier.severity > 3 && !isResolved;
      const isDemo = barrier.isDemo;

      const bgColor = isResolved ? '#065F46' : isSevere ? '#991B1B' : '#B45309';
      const borderColor = isResolved ? '#10B981' : isSevere ? '#EF4444' : '#F59E0B';
      const pulseRing = isSevere ? 'animate-pulse' : '';

      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
          ${
            isSelected
              ? `<div class="absolute -inset-1 rounded-full border-2 border-dashed border-sky-400 animate-spin"></div>`
              : ''
          }
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xl border-2 ${pulseRing}"
               style="background-color: ${bgColor}; border-color: ${borderColor};">
            ${isResolved ? '✓' : `<span class="font-mono">${barrier.severity}</span>`}
          </div>
          ${
            isDemo
              ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950" title="Sample Data"></div>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-barrier-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupHtml = `
        <div class="text-xs space-y-2 min-w-[210px]">
          <div class="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5">
            <span class="font-bold text-slate-100">${barrier.title}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono ${
              isResolved ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
            }">
              ${barrier.status}
            </span>
          </div>
          ${
            isDemo
              ? `<div class="text-[10px] text-amber-400 bg-amber-950/40 p-1 rounded border border-amber-800/60 font-semibold">
                  ⚠️ Sample Demonstration Data (Not a verified live hazard)
                 </div>`
              : ''
          }
          <div class="text-slate-300 text-[11px]">
            <strong>Location:</strong> ${barrier.location.address || 'India Corridor'}
          </div>
          <div class="grid grid-cols-2 gap-1 text-[11px] bg-slate-950/80 p-1.5 rounded border border-slate-800">
            <div><span class="text-slate-500">Severity:</span> <strong class="text-rose-400 font-mono">${barrier.severity}/5</strong></div>
            <div><span class="text-slate-500">Step Lip:</span> <strong class="text-slate-200 font-mono">${barrier.dimensions.stepHeightCm ? `${barrier.dimensions.stepHeightCm}cm` : 'Flush'}</strong></div>
          </div>
          <button id="view-drawer-${barrier.id}" class="w-full mt-1 px-2.5 py-1.5 text-center text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer">
            Open in Barrier Memory
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        onSelectBarrier(barrier);
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-drawer-${barrier.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectBarrier(barrier);
            map.closePopup();
          };
        }
      });

      markersLayer.addLayer(marker);
    });
  }, [visibleBarriers, selectedBarrierId, landmarks, currentZoom, onSelectBarrier, onSetOriginPoint]);

  // Update Route Polyline Overlay, Pins, Live Navigation State, and Auto-Fit Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();

    // Case A: Active Navigation Session is in progress!
    if (activeNavigation) {
      const orig = activeNavigation.origin;
      const dest = activeNavigation.destination;
      const currentStep = activeNavigation.route.steps[activeNavigation.currentStepIndex] || activeNavigation.route.steps[0];
      const userLat = activeNavigation.userLat ?? currentStep?.lat ?? orig.lat;
      const userLng = activeNavigation.userLng ?? currentStep?.lng ?? orig.lng;

      // 1. Start Origin Pin
      const originIcon = L.divIcon({
        className: 'custom-route-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[9px] shadow border border-emerald-400 whitespace-nowrap">
              START: ${orig.name.split(',')[0]}
            </div>
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow"></div>
          </div>
        `,
        iconSize: [100, 32],
        iconAnchor: [50, 30],
      });
      routeLayer.addLayer(L.marker([orig.lat, orig.lng], { icon: originIcon }));

      // 2. Destination Pin
      const destIcon = L.divIcon({
        className: 'custom-route-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded bg-rose-700 text-white font-bold text-[9px] shadow border border-rose-400 whitespace-nowrap">
              DEST: ${dest.name.split(',')[0]}
            </div>
            <div class="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow"></div>
          </div>
        `,
        iconSize: [100, 32],
        iconAnchor: [50, 30],
      });
      routeLayer.addLayer(L.marker([dest.lat, dest.lng], { icon: destIcon }));

      // 3. Active Route Line (Glowing Emerald)
      const routeWaypoints = activeNavigation.route.coordinates.map((pt) => [pt.lat, pt.lng] as [number, number]);
      if (routeWaypoints.length > 0) {
        routeLayer.addLayer(
          L.polyline(routeWaypoints, {
            color: '#059669',
            weight: 6,
            opacity: 0.9,
          })
        );
        routeLayer.addLayer(
          L.polyline(routeWaypoints, {
            color: '#34d399',
            weight: 2,
            dashArray: '6, 8',
            opacity: 1,
          })
        );
      }

      // 4. Live User Position Pin (Pulsing Sky Blue)
      const userLiveIcon = L.divIcon({
        className: 'custom-user-live-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-full bg-sky-600 text-white font-mono text-[9px] font-bold shadow-lg border border-sky-300">
              YOU (LIVE)
            </div>
            <div class="relative w-7 h-7 flex items-center justify-center mt-0.5">
              <div class="absolute w-7 h-7 rounded-full bg-sky-400/40 animate-ping"></div>
              <div class="w-4.5 h-4.5 rounded-full bg-sky-500 border-2 border-white shadow-xl flex items-center justify-center">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>
          </div>
        `,
        iconSize: [80, 42],
        iconAnchor: [40, 36],
      });
      routeLayer.addLayer(L.marker([userLat, userLng], { icon: userLiveIcon, zIndexOffset: 1000 }));

      // Smoothly pan to live user position
      map.flyTo([userLat, userLng], Math.max(15, currentZoom), { duration: 0.8 });
      return;
    }

    // Case B: Standard Planned Route Preview
    if (plannedRoute?.origin && plannedRoute?.destination) {
      const orig = plannedRoute.origin;
      const dest = plannedRoute.destination;

      const originLatLng: [number, number] = [orig.lat, orig.lng];
      const destLatLng: [number, number] = [dest.lat, dest.lng];

      // 1. Origin Pin Marker (Green)
      const originIcon = L.divIcon({
        className: 'custom-route-pin',
        html: `
          <div class="flex flex-col items-center cursor-pointer group">
            <div class="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] shadow-lg border border-emerald-400 whitespace-nowrap">
              START: ${orig.name.split(',')[0]}
            </div>
            <div class="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center -mt-0.5">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 34],
      });

      const originMarker = L.marker(originLatLng, { icon: originIcon });
      originMarker.bindTooltip(`<strong>Start Origin:</strong> ${orig.name}<br/><span style="color:#94a3b8">${orig.address}</span>`, {
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-emerald-700 p-2 rounded-lg',
      });
      routeLayer.addLayer(originMarker);

      // 2. Destination Pin Marker (Red/Rose)
      const destIcon = L.divIcon({
        className: 'custom-route-pin',
        html: `
          <div class="flex flex-col items-center cursor-pointer group">
            <div class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] shadow-lg border border-rose-400 whitespace-nowrap">
              DEST: ${dest.name.split(',')[0]}
            </div>
            <div class="w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-xl flex items-center justify-center -mt-0.5">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 34],
      });

      const destMarker = L.marker(destLatLng, { icon: destIcon });
      destMarker.bindTooltip(`<strong>Destination:</strong> ${dest.name}<br/><span style="color:#94a3b8">${dest.address}</span>`, {
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-rose-700 p-2 rounded-lg',
      });
      routeLayer.addLayer(destMarker);

      // 3. Alternative routes in subtle gray dashed line if available
      if (plannedRoute.alternatives && plannedRoute.alternatives.length > 1) {
        plannedRoute.alternatives.forEach((alt, idx) => {
          if (idx !== (plannedRoute.selectedAlternativeIndex || 0)) {
            const altPts = alt.coordinates.map((pt) => [pt.lat, pt.lng] as [number, number]);
            if (altPts.length > 0) {
              const altLine = L.polyline(altPts, {
                color: '#64748b',
                weight: 3,
                dashArray: '4, 8',
                opacity: 0.6,
              });
              altLine.bindTooltip(`Alternative: ${alt.summary} (${alt.distanceKm} km)`, {
                className: 'bg-slate-900 text-slate-300 text-xs border border-slate-700 p-1',
              });
              routeLayer.addLayer(altLine);
            }
          }
        });
      }

      // 4. Primary Accessible Route Path (Cyan Glowing Polyline)
      const accessibleWaypoints: Array<[number, number]> = plannedRoute.accessiblePath
        ? plannedRoute.accessiblePath.map((pt) => [pt.lat, pt.lng])
        : [originLatLng, [(orig.lat + dest.lat) / 2, dest.lng], destLatLng];

      const accessiblePolyline = L.polyline(accessibleWaypoints, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.9,
      });

      const dashedPolyline = L.polyline(accessibleWaypoints, {
        color: '#38bdf8',
        weight: 2,
        dashArray: '6, 8',
        opacity: 0.95,
      });

      routeLayer.addLayer(accessiblePolyline);
      routeLayer.addLayer(dashedPolyline);

      // 5. Obstructed direct path (dashed red line showing what was avoided)
      if (plannedRoute.obstructedPath && plannedRoute.obstructedPath.length > 0) {
        const directWaypoints: Array<[number, number]> = plannedRoute.obstructedPath.map((pt) => [pt.lat, pt.lng]);
        const obstructedLine = L.polyline(directWaypoints, {
          color: '#ef4444',
          weight: 2,
          dashArray: '4, 6',
          opacity: 0.6,
        });
        routeLayer.addLayer(obstructedLine);
      }

      // Smoothly zoom and frame the entire route corridor
      try {
        const bounds = L.latLngBounds([originLatLng, destLatLng]);
        map.fitBounds(bounds, {
          padding: [70, 70],
          maxZoom: 15,
          animate: true,
        });
      } catch (e) {
        console.warn('Could not fit bounds to route:', e);
      }
    }
  }, [plannedRoute, activeNavigation, currentZoom]);

  // Pan to selected barrier if user selected it from drawer or archive
  useEffect(() => {
    if (!selectedBarrierId || !mapInstanceRef.current) return;
    const selected = locatedBarriers.find((b) => b.id === selectedBarrierId);
    if (selected && selected.location.lat && selected.location.lng) {
      mapInstanceRef.current.flyTo([selected.location.lat, selected.location.lng], Math.max(14, currentZoom), {
        duration: 1.0,
      });
    }
  }, [selectedBarrierId, locatedBarriers]);

  // Handle Search Input (Instant Indian Places Match)
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const normalized = query.toLowerCase().trim();
    const localMatches = INDIAN_PLACES.filter(
      (p) => p.name.toLowerCase().includes(normalized) || p.state.toLowerCase().includes(normalized)
    );

    setSearchResults(localMatches);
  };

  // Online Nominatim Search fallback if user presses Enter in search box
  const handleOnlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingOnline(true);
    setSearchError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=in&limit=6`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'ACCESSVERSE-Accessibility-India/1.0' },
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Search service temporarily unavailable.');

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: IndianPlace[] = data.map((item: any) => ({
          name: item.display_name.split(',')[0],
          state: item.display_name.split(',').slice(1, 3).join(','),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          zoom: 13,
          type: 'city',
        }));
        setSearchResults(mapped);
      } else {
        setSearchError(`No Indian locations found for "${searchQuery}".`);
      }
    } catch (err: any) {
      setSearchError('Network search error. Try selecting a major Indian city from the quick directory.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Jump to specific place on map
  const handleSelectPlace = (place: IndianPlace) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([place.lat, place.lng], place.zoom, { duration: 1.2 });
    setSearchResults([]);
    setSearchQuery(place.name);
  };

  // Reset to full country-level view of India
  const handleResetToAllIndia = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 1.0 });
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="relative w-full h-[640px] lg:h-[720px] bg-[#020713] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col hud-frame font-hud">
      {/* Pick Mode Active Banner Notification */}
      {pickMode !== 'none' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-[#040e1e]/95 border-2 border-cyan-400 text-white px-4 py-2 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center gap-3 animate-bounce font-mono">
          <Crosshair className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {pickMode === 'origin'
              ? '📍 Click ANYWHERE on the map to place START ORIGIN pin'
              : '🏁 Click ANYWHERE on the map to place DESTINATION pin'}
          </span>
          {onCancelPickMode && (
            <button
              onClick={onCancelPickMode}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 ml-2 uppercase"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Action Confirmation Toast */}
      {lastActionToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#041a14]/95 border border-emerald-400 text-emerald-200 px-4 py-1.5 rounded-xl text-xs font-mono font-semibold shadow-2xl animate-in fade-in uppercase">
          {lastActionToast}
        </div>
      )}

      {/* Top Floating Control Bar: India Search & Full-Country Reset */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Geographic Search Input */}
        <div className="relative w-full max-w-sm pointer-events-auto shadow-xl">
          <form onSubmit={handleOnlineSearch} className="relative">
            <Search className="w-4 h-4 text-cyan-400/70 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search Indian cities, states, or streets..."
              className="w-full bg-[#030914]/95 backdrop-blur-md border border-cyan-500/30 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-lg"
            />
            {isSearchingOnline && (
              <div className="absolute right-2.5 top-2.5 w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            )}
          </form>

          {/* Autocomplete Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-[#030914]/95 backdrop-blur-md border border-cyan-500/30 rounded-xl max-h-56 overflow-y-auto shadow-2xl divide-y divide-white/5 z-40">
              {searchResults.map((place, idx) => (
                <button
                  key={`${place.name}-${idx}`}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  className="w-full px-3 py-2 text-left hover:bg-cyan-500/10 flex items-center justify-between text-xs text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div>
                      <span className="font-semibold block">{place.name}</span>
                      <span className="text-[10px] text-slate-400 block">{place.state}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400/70 capitalize">{place.type}</span>
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <div className="mt-1 p-2 bg-rose-950/90 border border-rose-800 text-[11px] text-rose-300 rounded-lg shadow-lg">
              {searchError}
            </div>
          )}
        </div>

        {/* Quick Geographic Navigation Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto font-mono text-xs">
          {/* Allow GPS / Locate Me Button */}
          <button
            onClick={handleLocateUserWithGps}
            disabled={isLocatingGps}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-950/80 backdrop-blur-md hover:bg-cyan-900 border border-cyan-500/50 text-xs font-semibold text-cyan-200 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer uppercase shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            title="Allow GPS to center map on your live position in India"
          >
            <Crosshair className={`w-3.5 h-3.5 text-cyan-400 ${isLocatingGps ? 'animate-spin' : ''}`} />
            <span>{isLocatingGps ? 'Locating...' : 'Allow GPS'}</span>
          </button>

          {/* Open Full Route Planner CTA */}
          {onOpenRoutePlanner && (
            <button
              onClick={onOpenRoutePlanner}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-xs font-bold text-slate-950 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer uppercase border border-cyan-200/50"
              title="Plan custom accessibility route between any two points"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Route Planner</span>
            </button>
          )}

          {/* Return to Full-India View */}
          <button
            onClick={handleResetToAllIndia}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#030914]/90 backdrop-blur-md hover:bg-[#061226] border border-cyan-500/30 text-xs font-semibold text-cyan-300 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer uppercase"
            title="Reset map view to whole India"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>All India</span>
          </button>

          {/* Unlocated Reports Drawer Toggle */}
          {unlocatedBarriers.length > 0 && (
            <button
              onClick={() => setShowUnlocatedDrawer((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/80 backdrop-blur-md hover:bg-amber-900/90 border border-amber-700/80 text-xs font-semibold text-amber-200 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer uppercase"
              title="View reports without verified GPS coordinates"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Unlocated ({unlocatedBarriers.length})</span>
              {showUnlocatedDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Floating Active Route Card Overlay (When a route is projected on map and navigation not active) */}
      {plannedRoute && !activeNavigation && (
        <div className="absolute top-16 left-3 right-3 z-30 pointer-events-none max-w-2xl mx-auto">
          <div className="bg-slate-900/95 backdrop-blur-md border border-sky-500/50 rounded-2xl p-3 shadow-2xl pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="space-y-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-semibold text-white truncate max-w-xs">{plannedRoute.origin.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                <span className="font-semibold text-white truncate max-w-xs">{plannedRoute.destination.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                <span className="font-mono text-sky-400 font-bold">{plannedRoute.distanceKm} km</span>
                <span>•</span>
                <span>Est. time: ~{plannedRoute.estimatedTimeMin || 15} mins</span>
                <span>•</span>
                <span className="text-emerald-400">Accessible Detour Active</span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {onStartLiveNavigation && (
                <button
                  onClick={() => {
                    const primaryAlt = plannedRoute.alternatives?.[plannedRoute.selectedAlternativeIndex || 0] || {
                      id: 'map_active_route',
                      summary: `Via ${plannedRoute.destination.name}`,
                      distanceKm: plannedRoute.distanceKm,
                      durationMinutes: plannedRoute.estimatedTimeMin || 15,
                      coordinates: plannedRoute.accessiblePath || [
                        { lat: plannedRoute.origin.lat, lng: plannedRoute.origin.lng },
                        { lat: plannedRoute.destination.lat, lng: plannedRoute.destination.lng },
                      ],
                      steps: [
                        {
                          instruction: `Head toward ${plannedRoute.destination.name}`,
                          distanceMeters: Math.round(plannedRoute.distanceKm * 1000),
                          durationSeconds: Math.round((plannedRoute.estimatedTimeMin || 15) * 60),
                          modifier: 'straight',
                          type: 'depart',
                          name: plannedRoute.origin.name,
                          lat: plannedRoute.origin.lat,
                          lng: plannedRoute.origin.lng,
                        },
                        {
                          instruction: 'Arrive at destination',
                          distanceMeters: 0,
                          durationSeconds: 0,
                          type: 'arrive',
                          name: plannedRoute.destination.name,
                          lat: plannedRoute.destination.lat,
                          lng: plannedRoute.destination.lng,
                        },
                      ],
                      barriersOnRoute: [],
                      maxBarrierSeverity: 1,
                      isRecommended: true,
                      recommendationReason: 'Active corridor navigation',
                    };
                    onStartLiveNavigation(primaryAlt, plannedRoute.origin, plannedRoute.destination);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer text-xs"
                  title="Launch Google Maps style voice navigation"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Start Navigation</span>
                </button>
              )}

              {onOpenRoutePlanner && (
                <button
                  onClick={onOpenRoutePlanner}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl border border-slate-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {onClearRoute && (
                <button
                  onClick={onClearRoute}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  title="Clear Route"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Real Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full flex-1 h-full z-10" />

      {/* Unlocated Reports Drawer (Requirement: Data Integrity Guarantee) */}
      {showUnlocatedDrawer && unlocatedBarriers.length > 0 && (
        <div className="absolute top-16 right-3 z-30 w-80 bg-slate-900/95 backdrop-blur-md border border-amber-800/80 rounded-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Unlocated Citizen Reports</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{unlocatedBarriers.length} pending GPS</span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            These submissions lack verified GPS coordinates. To maintain geographic truthfulness, ACCESSVERSE never
            invents coordinates or guesses map markers.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {unlocatedBarriers.map((barrier) => (
              <div
                key={barrier.id}
                onClick={() => onSelectBarrier(barrier)}
                className="p-2.5 bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate">{barrier.title}</span>
                  <span className="text-[10px] text-rose-400 font-mono">Sev {barrier.severity}/5</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{barrier.location.address}</div>
                <div className="text-[10px] text-sky-400 flex items-center gap-1 font-semibold">
                  <span>Inspect Report History</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Bottom Status Bar: Honest Coverage & Geographic Attribution */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none font-mono">
        <div className="bg-[#030914]/90 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs text-slate-300 pointer-events-auto shadow-lg flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-white uppercase">Cartography Survey</span>
          <span className="text-slate-600" aria-hidden="true">//</span>
          <span className="text-cyan-300 tabular-nums">
            {visibleBarriers.length} LOCATED COORDINATES
          </span>
          <span className="text-slate-600" aria-hidden="true">//</span>
          <span className="text-emerald-400 text-[11px] uppercase">Click point to set origin/dest or report</span>
        </div>

        {/* Tile Error Fallback Notice */}
        {tileError && (
          <div className="bg-amber-950/90 border border-amber-800 px-2.5 py-1 rounded-lg text-[11px] text-amber-200 pointer-events-auto shadow-md">
            Notice: Some external map tiles may be slow to render. Markers and coordinates remain fully interactive.
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 right-3 z-20 bg-[#030914]/90 backdrop-blur-md border border-cyan-500/30 p-2.5 rounded-lg text-[10px] font-mono text-slate-400 flex flex-col gap-1.5 shadow-xl pointer-events-auto uppercase tracking-wide">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-400 shadow-sm" />
          <span>Severe Blocker (4-5)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-amber-400 shadow-sm" />
          <span>Caution / Partial (2-3)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-400 shadow-sm" />
          <span>Barrier Memory (Resolved)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white" />
          <span>Journey Origin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 border border-white" />
          <span>Journey Destination</span>
        </div>
      </div>
    </div>
  );
};
