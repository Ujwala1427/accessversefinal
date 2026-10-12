/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CityMap } from './components/CityMap';
import { BarrierMemoryDrawer } from './components/BarrierMemoryDrawer';
import { ReportBarrierModal } from './components/ReportBarrierModal';
import { VerifyResolutionModal } from './components/VerifyResolutionModal';
import { RoutePlannerModal } from './components/RoutePlannerModal';
import { BarrierArchiveView } from './components/BarrierArchiveView';
import { INITIAL_BARRIERS, CITY_LANDMARKS } from './data/initialBarriers';
import { MOBILITY_PROFILES } from './data/mobilityProfiles';
import { BarrierItem, MobilityProfileId, CityLandmark, RoutePoint, PlannedRoute, ActiveNavigationSession, RouteAlternative } from './types/barrier';
import { ActiveNavigationHUD } from './components/ActiveNavigationHUD';
import { InteractiveHomePage } from './components/InteractiveHomePage';
import {
  Compass,
  Plus,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldCheck,
  History,
  RotateCcw,
} from 'lucide-react';

export default function App() {
  // Primary State
  const [barriers, setBarriers] = useState<BarrierItem[]>(() => {
    try {
      const saved = localStorage.getItem('accessverse_barriers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((b: any) => b.id?.startsWith('bar_ind'))) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load barriers from localStorage:', e);
    }
    return INITIAL_BARRIERS;
  });

  const [landmarks] = useState<CityLandmark[]>(CITY_LANDMARKS);
  const [currentTab, setCurrentTab] = useState<'home' | 'map' | 'planner' | 'archive'>('home');
  const [selectedModel, setSelectedModel] = useState<'gemma-4-26b-a4b-it' | 'gemma-4-31b-it'>('gemma-4-26b-a4b-it');

  // Filters & Profile
  const [activeMobilityFilter, setActiveMobilityFilter] = useState<MobilityProfileId | 'all'>('all');
  const [showResolved, setShowResolved] = useState<boolean>(true);

  // Selected Barrier for Drawer
  const [selectedBarrier, setSelectedBarrier] = useState<BarrierItem | null>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledLocation, setPrefilledLocation] = useState<{
    lat?: number;
    lng?: number;
    address: string;
    nearestLandmark: string;
    city?: string;
    state?: string;
  } | null>(null);

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [barrierToResolve, setBarrierToResolve] = useState<BarrierItem | null>(null);

  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Active Route, Live Navigation & Interactive Map Picking State
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [activeNavigation, setActiveNavigation] = useState<ActiveNavigationSession | null>(null);
  const [pickMode, setPickMode] = useState<'none' | 'origin' | 'destination'>('none');
  const [currentOriginPoint, setCurrentOriginPoint] = useState<RoutePoint | null>(null);
  const [currentDestPoint, setCurrentDestPoint] = useState<RoutePoint | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('accessverse_barriers', JSON.stringify(barriers));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [barriers]);

  // Keep selected barrier synchronized with updated state
  useEffect(() => {
    if (selectedBarrier) {
      const updated = barriers.find((b) => b.id === selectedBarrier.id);
      if (updated) setSelectedBarrier(updated);
    }
  }, [barriers]);

  // Handlers
  const handleSelectBarrier = (barrier: BarrierItem) => {
    setSelectedBarrier(barrier);
  };

  const handleMapClickToReport = (loc: {
    lat: number;
    lng: number;
    address: string;
    nearestLandmark: string;
    city?: string;
    state?: string;
  }) => {
    setPrefilledLocation(loc);
    setIsReportModalOpen(true);
  };

  const handleSubmitNewBarrier = (newBarrier: BarrierItem) => {
    setBarriers((prev) => [newBarrier, ...prev]);
    setSelectedBarrier(newBarrier);
  };

  const handleVerifyStillBlocked = (barrierId: string) => {
    const timestamp = new Date().toISOString();
    setBarriers((prev) =>
      prev.map((b) => {
        if (b.id !== barrierId) return b;
        return {
          ...b,
          verifications: b.verifications + 1,
          history: [
            ...b.history,
            {
              id: `evt_verify_${Date.now()}`,
              timestamp,
              eventType: 'COMMUNITY_VERIFIED',
              author: 'You (Citizen Auditor)',
              role: 'Community Auditor',
              note: 'Confirmed obstacle remains impassable for wheelchairs in person.',
            },
          ],
        };
      })
    );
  };

  const handleConfirmResolution = (
    barrierId: string,
    resolutionData: { imageUrl: string; notes: string; gemmaVerification: any }
  ) => {
    const timestamp = new Date().toISOString();
    setBarriers((prev) =>
      prev.map((b) => {
        if (b.id !== barrierId) return b;
        return {
          ...b,
          status: 'RESOLVED',
          severity: 1,
          resolutionImageUrl: resolutionData.imageUrl,
          history: [
            ...b.history,
            {
              id: `evt_res_sub_${Date.now()}`,
              timestamp,
              eventType: 'RESOLUTION_SUBMITTED',
              author: 'Citizen Contributor',
              role: 'Citizen',
              note: resolutionData.notes || 'Submitted repair evidence.',
              imageUrl: resolutionData.imageUrl,
            },
            {
              id: `evt_res_conf_${Date.now() + 1000}`,
              timestamp: new Date(Date.now() + 1000).toISOString(),
              eventType: 'RESOLVED',
              author: `Gemma 4 (${selectedModel})`,
              role: 'Gemma 4 AI',
              note: `Gemma 4 verified resolution: ${
                resolutionData.gemmaVerification?.summary || 'Hazard cleared and verified accessible.'
              } Confidence: ${resolutionData.gemmaVerification?.confidenceScore || 95}%. Permanent Barrier Memory record preserved.`,
              resolutionVerification: resolutionData.gemmaVerification,
            },
          ],
        };
      })
    );
  };

  const handleSetOriginPoint = (point: RoutePoint) => {
    setCurrentOriginPoint(point);
    if (plannedRoute) {
      setPlannedRoute((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          origin: point,
        };
      });
    }
  };

  const handleSetDestPoint = (point: RoutePoint) => {
    setCurrentDestPoint(point);
    if (plannedRoute) {
      setPlannedRoute((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          destination: point,
        };
      });
    }
  };

  const handleStartLiveNavigation = (route: RouteAlternative, origin: RoutePoint, dest: RoutePoint) => {
    setActiveNavigation({
      route,
      origin,
      destination: dest,
      currentStepIndex: 0,
      isVoiceMuted: false,
      isTracking: true,
      userLat: origin.lat,
      userLng: origin.lng,
    });
    setPlannedRoute({
      origin,
      destination: dest,
      accessiblePath: route.coordinates,
      distanceKm: route.distanceKm,
      estimatedTimeMin: route.durationMinutes,
      alternatives: [route],
    });
    setCurrentTab('map');
    setIsPlannerOpen(false);
  };

  const handleEndNavigation = () => {
    setActiveNavigation(null);
  };

  const handleNavigationStepChange = (newStepIndex: number) => {
    setActiveNavigation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentStepIndex: newStepIndex,
      };
    });
  };

  const handleRerouteRequest = async () => {
    if (!activeNavigation) return;
    const currentLoc = {
      lat: activeNavigation.userLat || activeNavigation.origin.lat,
      lng: activeNavigation.userLng || activeNavigation.origin.lng,
      name: 'Current Live GPS Location',
      address: 'Current Location',
    };
    try {
      const res = await fetch('/api/navigation/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: currentLoc,
          destination: activeNavigation.destination,
          barriers,
          profile: activeMobilityFilter === 'all' ? 'manual_wheelchair' : activeMobilityFilter,
        }),
      });
      const data = await res.json();
      if (data.alternatives && data.alternatives.length > 0) {
        const bestAlt = data.alternatives.find((a: RouteAlternative) => a.isRecommended) || data.alternatives[0];
        setActiveNavigation({
          route: bestAlt,
          origin: currentLoc,
          destination: activeNavigation.destination,
          currentStepIndex: 0,
          isVoiceMuted: activeNavigation.isVoiceMuted,
          isTracking: true,
          userLat: currentLoc.lat,
          userLng: currentLoc.lng,
        });
      }
    } catch (e) {
      console.warn('Rerouting request failed:', e);
    }
  };

  const handleResetToDefaultBarriers = () => {
    if (confirm('Reset city barriers to initial default database?')) {
      setBarriers(INITIAL_BARRIERS);
      localStorage.removeItem('accessverse_barriers');
      setSelectedBarrier(null);
      setPlannedRoute(null);
      setActiveNavigation(null);
      setCurrentOriginPoint(null);
      setCurrentDestPoint(null);
    }
  };

  const activeCount = barriers.filter((b) => b.status !== 'RESOLVED').length;
  const resolvedCount = barriers.filter((b) => b.status === 'RESOLVED').length;

  return (
    <div className="min-h-screen bg-[#020713] ocean-abyss-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar Contract Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'planner') {
            setIsPlannerOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isNavigating={Boolean(activeNavigation)}
        onEndNavigation={handleEndNavigation}
        onOpenReportModal={() => {
          setPrefilledLocation(null);
          setIsReportModalOpen(true);
        }}
        activeCount={activeCount}
        resolvedCount={resolvedCount}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {currentTab === 'home' && (
          <InteractiveHomePage
            barriers={barriers}
            onOpenMap={(_targetCoords) => {
              setCurrentTab('map');
            }}
            onOpenRoutePlanner={(initOrig, initDest) => {
              if (initOrig) setCurrentOriginPoint(initOrig);
              if (initDest) setCurrentDestPoint(initDest);
              setIsPlannerOpen(true);
            }}
            onOpenReportModal={(prefill) => {
              setPrefilledLocation(prefill || null);
              setIsReportModalOpen(true);
            }}
            onOpenArchive={() => setCurrentTab('archive')}
            onSelectBarrier={(barrier) => {
              setSelectedBarrier(barrier);
              setCurrentTab('map');
            }}
            activeCount={activeCount}
            resolvedCount={resolvedCount}
          />
        )}

        {currentTab === 'map' && (
          <div className="space-y-4">
            {/* Filter & Mobility Profile Toolbar */}
            <div className="bg-[#030914]/90 backdrop-blur-2xl border border-cyan-500/20 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xl hud-frame font-hud">
              {/* Mobility Profile Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-cyan-400 font-mono uppercase mr-1 hidden sm:inline">Mobility Lens:</span>
                <button
                  onClick={() => setActiveMobilityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition-all cursor-pointer uppercase ${
                    activeMobilityFilter === 'all'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'bg-[#020713] text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
                  }`}
                >
                  All Profiles
                </button>
                {MOBILITY_PROFILES.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => setActiveMobilityFilter(prof.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition-all cursor-pointer uppercase ${
                      activeMobilityFilter === prof.id
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : 'bg-[#020713] text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {prof.shortLabel}
                  </button>
                ))}
              </div>

              {/* Toggles & Secondary Actions */}
              <div className="flex items-center gap-3 ml-auto font-mono">
                {/* Show Resolved Memory Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={(e) => setShowResolved(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#020713] border-cyan-500/40 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-xs uppercase">Barrier Memory (Resolved)</span>
                </label>

                <div className="h-4 w-px bg-cyan-500/20" />

                {/* Open Route Planner CTA */}
                <button
                  onClick={() => setIsPlannerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold rounded-lg border border-emerald-500/40 transition-all cursor-pointer shadow-sm uppercase text-xs"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Plan Route</span>
                </button>

                {/* Reset Mock DB */}
                <button
                  onClick={handleResetToDefaultBarriers}
                  className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Reset to default obstacles"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Active Route Notification Strip (if route is projected) */}
            {plannedRoute && (
              <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-teal-950/70 border border-cyan-500/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-cyan-200 shadow-xl shadow-cyan-950/30">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    <strong>Projected Route:</strong> {plannedRoute.origin.name} → {plannedRoute.destination.name}.
                    Direct shortest path is blocked by active obstacles; displaying verified accessible detour (cyan).
                  </span>
                </div>
                <button
                  onClick={() => setPlannedRoute(null)}
                  className="text-xs text-slate-400 hover:text-white underline shrink-0"
                >
                  Clear Route
                </button>
              </div>
            )}

            {/* Active Turn-by-Turn Voice Navigation HUD */}
            {activeNavigation && (
              <ActiveNavigationHUD
                session={activeNavigation}
                allBarriers={barriers}
                onEndNavigation={handleEndNavigation}
                onStepChange={handleNavigationStepChange}
                onReportBarrierAtCurrentLocation={(loc) => {
                  setPrefilledLocation(loc);
                  setIsReportModalOpen(true);
                }}
                onRerouteRequest={handleRerouteRequest}
                onLocationUpdate={(coords) => {
                  setActiveNavigation((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      userLat: coords.lat,
                      userLng: coords.lng,
                    };
                  });
                }}
              />
            )}

            {/* City Map Component with Interactive Route Picking & Markers */}
            <CityMap
              barriers={barriers}
              landmarks={landmarks}
              selectedBarrierId={selectedBarrier?.id || null}
              onSelectBarrier={handleSelectBarrier}
              onMapClickToReport={handleMapClickToReport}
              activeMobilityFilter={activeMobilityFilter}
              showResolved={showResolved}
              plannedRoute={plannedRoute}
              activeNavigation={activeNavigation}
              onStartLiveNavigation={handleStartLiveNavigation}
              onSetOriginPoint={handleSetOriginPoint}
              onSetDestPoint={handleSetDestPoint}
              onOpenRoutePlanner={() => setIsPlannerOpen(true)}
              onClearRoute={() => {
                setPlannedRoute(null);
                setActiveNavigation(null);
              }}
              pickMode={pickMode}
              onCancelPickMode={() => setPickMode('none')}
            />
          </div>
        )}

        {currentTab === 'archive' && (
          <BarrierArchiveView
            barriers={barriers}
            onSelectBarrier={handleSelectBarrier}
            onOpenReportModal={() => {
              setPrefilledLocation(null);
              setIsReportModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Flagship Barrier Memory Drawer */}
      <BarrierMemoryDrawer
        barrier={selectedBarrier}
        onClose={() => setSelectedBarrier(null)}
        onVerifyStillBlocked={handleVerifyStillBlocked}
        onOpenResolveModal={(b) => {
          setBarrierToResolve(b);
          setIsResolveModalOpen(true);
        }}
      />

      {/* Report Barrier Modal */}
      <ReportBarrierModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitNewBarrier={handleSubmitNewBarrier}
        prefilledLocation={prefilledLocation}
        existingBarriers={barriers}
        defaultModel={selectedModel}
      />

      {/* Verify Resolution Modal */}
      <VerifyResolutionModal
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false);
          setBarrierToResolve(null);
        }}
        barrier={barrierToResolve}
        onConfirmResolution={handleConfirmResolution}
      />

      {/* Route Planner Modal with Freeform Any-Location Entry, Route Comparison & Live Navigation */}
      <RoutePlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        barriers={barriers}
        activeProfile={activeMobilityFilter === 'all' ? 'manual_wheelchair' : activeMobilityFilter}
        onChangeProfile={(p) => setActiveMobilityFilter(p)}
        onSetRouteOnMap={(r) => {
          setPlannedRoute(r);
          setCurrentOriginPoint(r.origin);
          setCurrentDestPoint(r.destination);
        }}
        onStartLiveNavigation={handleStartLiveNavigation}
        onPickOnMapRequest={(target) => {
          setPickMode(target);
          setCurrentTab('map');
        }}
        initialOrigin={currentOriginPoint}
        initialDestination={currentDestPoint}
      />
    </div>
  );
}
