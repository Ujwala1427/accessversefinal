import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveNavigationSession,
  NavigationStep,
  BarrierItem,
  RouteAlternative,
} from '../types/barrier';
import { speechService } from '../utils/speech';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Navigation,
  AlertTriangle,
  Flag,
  X,
  ChevronRight,
  ShieldAlert,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpRight,
  CornerUpLeft,
  CheckCircle,
  Camera,
  RefreshCw,
} from 'lucide-react';

interface ActiveNavigationHUDProps {
  session: ActiveNavigationSession;
  allBarriers: BarrierItem[];
  onEndNavigation: () => void;
  onStepChange: (newStepIndex: number) => void;
  onReportBarrierAtCurrentLocation: (location: {
    lat: number;
    lng: number;
    address: string;
    nearestLandmark: string;
    city?: string;
    state?: string;
  }) => void;
  onRerouteRequest?: () => void;
  onLocationUpdate?: (coords: { lat: number; lng: number }) => void;
}

// Calculate distance in meters
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const ActiveNavigationHUD: React.FC<ActiveNavigationHUDProps> = ({
  session,
  allBarriers,
  onEndNavigation,
  onStepChange,
  onReportBarrierAtCurrentLocation,
  onRerouteRequest,
  onLocationUpdate,
}) => {
  const [isMuted, setIsMuted] = useState(speechService.getIsMuted());
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(
    session.userLat && session.userLng ? { lat: session.userLat, lng: session.userLng } : null
  );
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);

  const steps = session.route.steps || [];
  const currentStep = steps[session.currentStepIndex] || steps[0] || {
    instruction: 'Follow route path',
    distanceMeters: 0,
    durationSeconds: 0,
    lat: session.origin.lat,
    lng: session.origin.lng,
  };
  const nextStep = steps[session.currentStepIndex + 1];

  // Speak when step changes
  useEffect(() => {
    if (currentStep) {
      const textToSpeak = `${currentStep.instruction}. ${
        currentStep.distanceMeters > 0 ? `Continue for ${currentStep.distanceMeters} meters.` : ''
      }`;
      const spoken = speechService.speak(textToSpeak);
      if (spoken) {
        setVoiceToast(`Speaking: "${currentStep.instruction}"`);
        const timer = setTimeout(() => setVoiceToast(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [session.currentStepIndex, currentStep.instruction]);

  // Start live GPS tracking if supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });
          onLocationUpdate?.({ lat, lng });
          setGpsError(null);

          // Auto-advance step if within 25 meters of step target
          if (steps.length > session.currentStepIndex + 1) {
            const stepTarget = steps[session.currentStepIndex];
            if (stepTarget) {
              const dist = distanceMeters(lat, lng, stepTarget.lat, stepTarget.lng);
              if (dist < 25) {
                onStepChange(session.currentStepIndex + 1);
              }
            }
          }
        },
        (err) => {
          console.warn('Live navigation GPS warning:', err.message);
          setGpsError('GPS signal limited. Using step manual progress.');
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
      setGpsWatchId(watchId);

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [session.currentStepIndex, steps, onStepChange]);

  const handleToggleMute = () => {
    const newMuted = speechService.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) {
      speechService.speak(currentStep.instruction);
    }
  };

  const handleRepeatVoice = () => {
    speechService.speak(
      `${currentStep.instruction}. In ${currentStep.distanceMeters} meters, next action is ${
        nextStep?.instruction || 'arrival'
      }.`
    );
    setVoiceToast(`Replaying instruction`);
    setTimeout(() => setVoiceToast(null), 2500);
  };

  // Check if any reported barrier is near current user position or current step
  const referencePoint = userCoords || { lat: currentStep.lat, lng: currentStep.lng };
  const nearbyHazard = allBarriers.find((b) => {
    if (b.status !== 'ACTIVE' || b.location?.lat == null || b.location?.lng == null) return false;
    return distanceMeters(referencePoint.lat, referencePoint.lng, b.location.lat, b.location.lng) <= 90;
  });

  // Calculate icon based on modifier or instruction
  const renderTurnIcon = (step: NavigationStep) => {
    const mod = (step.modifier || '').toLowerCase();
    const inst = step.instruction.toLowerCase();

    if (inst.includes('arrive') || inst.includes('destination')) {
      return <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />;
    }
    if (mod.includes('left') || inst.includes('left')) {
      return <ArrowLeft className="w-8 h-8 text-white" />;
    }
    if (mod.includes('right') || inst.includes('right')) {
      return <ArrowRight className="w-8 h-8 text-white" />;
    }
    if (mod.includes('slight left')) {
      return <CornerUpLeft className="w-8 h-8 text-white" />;
    }
    if (mod.includes('slight right')) {
      return <CornerUpRight className="w-8 h-8 text-white" />;
    }
    return <ArrowUp className="w-8 h-8 text-white" />;
  };

  const handleSafeReportClick = () => {
    // Hands-free safety notice: stop moving before taking photos
    setShowSafetyDialog(true);
  };

  const confirmReportBarrier = () => {
    setShowSafetyDialog(false);
    const loc = userCoords || { lat: currentStep.lat, lng: currentStep.lng };
    onReportBarrierAtCurrentLocation({
      lat: loc.lat,
      lng: loc.lng,
      address: currentStep.name ? `${currentStep.name}, route corridor` : `${session.route.summary}`,
      nearestLandmark: session.destination.name,
      city: session.destination.city || session.origin.city,
      state: session.destination.state || session.origin.state,
    });
  };

  return (
    <>
      {/* Top Floating Turn-by-Turn Card (Google Maps style) */}
      <div className="absolute top-4 left-3 right-3 sm:left-6 sm:right-auto sm:w-[460px] z-[500] pointer-events-auto">
        <div className="bg-emerald-950/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden transition-all text-white">
          {/* Main Top Header Strip */}
          <div className="p-4 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-950">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-xl bg-emerald-600/90 border border-emerald-400 flex items-center justify-center shrink-0 shadow-lg">
                {renderTurnIcon(currentStep)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/50">
                    {currentStep.distanceMeters > 0 ? `In ${currentStep.distanceMeters}m` : 'Step Action'}
                  </span>
                  <span className="text-xs text-emerald-300/80">
                    Step {session.currentStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug mt-1 line-clamp-2">
                  {currentStep.instruction}
                </h2>
                {currentStep.name && (
                  <p className="text-xs text-emerald-200/70 truncate mt-0.5">
                    {currentStep.name}
                  </p>
                )}
              </div>
            </div>

            {/* End Navigation Action */}
            <button
              onClick={onEndNavigation}
              className="p-2 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700/70 transition-colors shadow-md shrink-0 cursor-pointer"
              title="End Navigation Session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Voice & Step Control Strip */}
          <div className="px-4 py-2.5 bg-slate-950/80 border-t border-emerald-800/40 flex items-center justify-between gap-2 text-xs">
            {/* Voice Mute / Repeat */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : 'bg-emerald-900/60 text-emerald-200 border-emerald-700 hover:bg-emerald-800'
                }`}
                title={isMuted ? 'Unmute Voice Directions' : 'Mute Voice Directions'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
                <span>{isMuted ? 'Muted' : 'Voice On'}</span>
              </button>

              <button
                onClick={handleRepeatVoice}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                title="Repeat Spoken Direction"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Repeat</span>
              </button>
            </div>

            {/* Step Advance / Back buttons */}
            <div className="flex items-center gap-1">
              <button
                disabled={session.currentStepIndex === 0}
                onClick={() => onStepChange(Math.max(0, session.currentStepIndex - 1))}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-300 border border-slate-700 text-xs"
              >
                Prev
              </button>
              <button
                disabled={session.currentStepIndex >= steps.length - 1}
                onClick={() => onStepChange(Math.min(steps.length - 1, session.currentStepIndex + 1))}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Next Step Preview */}
          {nextStep && (
            <div className="px-4 py-1.5 bg-slate-900/60 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
              <span className="text-slate-400">Then:</span>
              <span className="truncate ml-2 text-right font-medium text-slate-200">
                {nextStep.instruction} {nextStep.distanceMeters > 0 ? `(${nextStep.distanceMeters}m)` : ''}
              </span>
            </div>
          )}

          {/* Active Obstacle Warning if near a known barrier */}
          {nearbyHazard && (
            <div className="px-4 py-2.5 bg-rose-950/90 border-t border-rose-600/70 flex items-center gap-2.5 text-xs text-rose-200 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-rose-100 block truncate">
                  CAUTION: {nearbyHazard.title} reported ahead!
                </span>
                <span className="text-[10px] text-rose-300/80 block">
                  Severity {nearbyHazard.severity}/5 · {nearbyHazard.category} · Proceed safely with caution.
                </span>
              </div>
            </div>
          )}

          {/* GPS status if limited */}
          {gpsError && (
            <div className="px-4 py-1 bg-amber-950/80 border-t border-amber-800 text-[10px] text-amber-200">
              {gpsError}
            </div>
          )}
        </div>
      </div>

      {/* Spoken voice visual toast feedback */}
      {voiceToast && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-[510] pointer-events-none bg-slate-900/95 border border-sky-500/50 text-sky-200 text-xs px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in">
          <Volume2 className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>{voiceToast}</span>
        </div>
      )}

      {/* Bottom Floating Bar: Quick Report Obstacle & Journey Progress */}
      <div className="absolute bottom-5 left-3 right-3 sm:left-auto sm:right-6 sm:w-auto z-[500] pointer-events-auto">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Quick Metrics */}
          <div className="flex items-center gap-3 pr-2 border-r border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Distance</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {session.route.distanceKm} km
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">ETA</span>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">
                {session.route.durationMinutes} min
              </span>
            </div>
          </div>

          {/* Quick Report Barrier Action */}
          <button
            onClick={handleSafeReportClick}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
            title="Report an obstacle encountered right here"
          >
            <Camera className="w-4 h-4 text-slate-950" />
            <span>Report Barrier Here</span>
          </button>

          {/* Reroute Button */}
          {onRerouteRequest && (
            <button
              onClick={onRerouteRequest}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors cursor-pointer"
              title="Recalculate route"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reroute</span>
            </button>
          )}

          {/* End Button */}
          <button
            onClick={onEndNavigation}
            className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 font-semibold text-xs transition-colors cursor-pointer"
          >
            End
          </button>
        </div>
      </div>

      {/* Safety Notice Modal: Stop safely before reporting */}
      {showSafetyDialog && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hands-Free Safety Notice</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Please stop your wheelchair or cane movement completely and ensure you are in a safe, non-traffic position before operating camera controls or typing obstacle details.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <p>✓ Current GPS coordinates will be automatically recorded.</p>
              <p>✓ Gemma 4 AI will inspect your barrier photo on submission.</p>
              <p>✓ Your report will be immediately preserved in Barrier Memory.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSafetyDialog(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReportBarrier}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>I am in a safe spot — Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
