import React, { useState } from 'react';
import { BarrierItem } from '../types/barrier';
import {
  X,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  History,
  Sparkles,
  MapPin,
  Clock,
  Compass,
  FileCheck,
  Share2,
  Check,
  Building,
  User,
} from 'lucide-react';

interface BarrierMemoryDrawerProps {
  barrier: BarrierItem | null;
  onClose: () => void;
  onVerifyStillBlocked: (barrierId: string) => void;
  onOpenResolveModal: (barrier: BarrierItem) => void;
}

export const BarrierMemoryDrawer: React.FC<BarrierMemoryDrawerProps> = ({
  barrier,
  onClose,
  onVerifyStillBlocked,
  onOpenResolveModal,
}) => {
  const [copiedDetour, setCopiedDetour] = useState(false);
  const [hasVerifiedLocally, setHasVerifiedLocally] = useState(false);

  if (!barrier) return null;

  const isResolved = barrier.status === 'RESOLVED';

  const handleCopyDetour = () => {
    navigator.clipboard.writeText(barrier.bypassRecommendation);
    setCopiedDetour(true);
    setTimeout(() => setCopiedDetour(false), 2000);
  };

  const handleVerifyClick = () => {
    if (!hasVerifiedLocally) {
      onVerifyStillBlocked(barrier.id);
      setHasVerifiedLocally(true);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#020713] border-l border-cyan-500/30 shadow-[0_0_50px_rgba(2,6,23,0.95)] z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 font-hud">
      {/* Top Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-[#030914]/90 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-semibold">
                BARRIER MEMORY // {barrier.id}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isResolved
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                    : barrier.severity > 3
                    ? 'bg-rose-950 text-rose-300 border border-rose-500/60'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                }`}
              >
                {barrier.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-white truncate">{barrier.title}</h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* Location & Quick Meta */}
        <div className="bg-[#030a16] border border-cyan-500/20 rounded-xl p-3.5 space-y-2">
          <div className="flex items-start gap-2 text-xs text-slate-300">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white block">{barrier.location.address}</span>
              <span className="text-slate-500 block text-[11px] font-mono">
                {barrier.location.nearestLandmark ? `Near ${barrier.location.nearestLandmark} // ` : ''}
                {barrier.location.lat != null && barrier.location.lng != null
                  ? `GPS ${barrier.location.lat.toFixed(5)}, ${barrier.location.lng.toFixed(5)}`
                  : 'Awaiting Geographic Pin (Unlocated)'}
              </span>
              {barrier.isDemo && (
                <span className="inline-block px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-[10px] text-amber-300 font-semibold font-mono uppercase">
                  ⚠️ Sample Demonstration Data
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-2.5 text-center text-xs">
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">Severity</span>
              <span className="font-mono text-sm font-bold text-rose-400">{barrier.severity} / 5</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">Step Lip</span>
              <span className="font-mono text-sm font-bold text-slate-200">
                {barrier.dimensions.stepHeightCm ? `${barrier.dimensions.stepHeightCm}cm` : 'Flush'}
              </span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">Clearance</span>
              <span className="font-mono text-sm font-bold text-slate-200">
                {barrier.dimensions.clearanceWidthCm ? `${barrier.dimensions.clearanceWidthCm}cm` : 'Standard'}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Proof: Before & After (if resolved) or Initial Photo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Photo Evidence Archive</span>
              {isResolved && <span className="text-emerald-400 font-normal">· Before & After Verified</span>}
            </span>
            <span className="text-[11px] text-slate-500">Multimodal Archive</span>
          </div>

          <div className={`grid ${barrier.resolutionImageUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group aspect-4/3">
              <img
                src={barrier.initialImageUrl}
                alt="Original barrier"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute bottom-2 left-2 bg-slate-950/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-rose-400 border border-rose-500/30">
                Reported Obstacle
              </div>
            </div>

            {barrier.resolutionImageUrl && (
              <div className="relative rounded-xl overflow-hidden border border-emerald-800/50 bg-slate-900 group aspect-4/3">
                <img
                  src={barrier.resolutionImageUrl}
                  alt="Verified resolution"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-2 left-2 bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Resolved Proof
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gemma 4 Multimodal Diagnostic Assessment */}
        <div className="bg-sky-950/20 border border-sky-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-sky-200">Gemma 4 Multimodal Diagnostic</span>
            </div>
            <span className="text-[10px] font-mono text-sky-400/80">Thinking Level: High</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {barrier.history.find((h) => h.eventType === 'AI_ANALYZED')?.diagnostics?.thinkingSummary ||
              'Visual reasoning confirmed physical elevation change exceeding safe wheelchair caster clearance. Surface fracture poses rolling-resistance hazard.'}
          </p>

          <div className="border-t border-sky-500/20 pt-2.5">
            <span className="text-[11px] text-sky-300 font-semibold block mb-1">Passability Assessment:</span>
            <div className="flex flex-wrap gap-2 text-xs">
              {barrier.passableProfiles.length > 0 ? (
                barrier.passableProfiles.map((p) => (
                  <span key={p} className="text-emerald-400 text-[11px]">
                    ✓ Passable for {p.replace('_', ' ')}
                  </span>
                ))
              ) : (
                <span className="text-rose-400 text-[11px]">✕ Impassable for all standard mobility devices</span>
              )}
            </div>
          </div>
        </div>

        {/* Immediate Bypass Advice */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Recommended Accessibility Bypass</span>
            </div>
            <button
              onClick={handleCopyDetour}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              {copiedDetour ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedDetour ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{barrier.bypassRecommendation}</p>
        </div>

        {/* Flagship Feature: Barrier Memory Lifecycle Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Barrier Memory Lifecycle</h3>
            </div>
            <span className="text-xs text-slate-500">{barrier.history.length} events recorded</span>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {barrier.history.map((event, idx) => {
              const isAi = event.role === 'Gemma 4 AI';
              const isMunicipal = event.role === 'Municipal Works';
              const isResolvedEvent = event.eventType === 'RESOLVED';

              return (
                <div key={event.id || idx} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isResolvedEvent
                        ? 'bg-emerald-950 border-emerald-400'
                        : isAi
                        ? 'bg-sky-950 border-sky-400'
                        : isMunicipal
                        ? 'bg-purple-950 border-purple-400'
                        : 'bg-slate-900 border-slate-500'
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isResolvedEvent ? 'bg-emerald-400' : isAi ? 'bg-sky-400' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Event Card */}
                  <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 space-y-1.5 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white">{event.author}</span>
                        <span className="text-slate-500 text-[11px]">({event.role})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(event.timestamp).toLocaleDateString()} · {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{event.note}</p>

                    {event.resolutionVerification && (
                      <div className="mt-2 p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Gemma 4 Verification Score: {event.resolutionVerification.confidenceScore}%</span>
                        </div>
                        <p className="text-[11px] text-emerald-200/90">{event.resolutionVerification.summary}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drawer Action Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-3">
        {!isResolved ? (
          <>
            <button
              onClick={handleVerifyClick}
              disabled={hasVerifiedLocally}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                hasVerifiedLocally
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-default'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 active:scale-95'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{hasVerifiedLocally ? 'Verified by You' : `Verify Still Blocked (${barrier.verifications})`}</span>
            </button>

            <button
              onClick={() => onOpenResolveModal(barrier)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Report Cleared / Fixed</span>
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 p-2.5 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">Obstacle Cleared & Preserved in Barrier Memory</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">Status: Permanent Record</span>
          </div>
        )}
      </div>
    </div>
  );
};
