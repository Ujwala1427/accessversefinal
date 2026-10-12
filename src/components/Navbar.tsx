import React, { useState } from 'react';
import { Plus, History, Navigation, X, Volume2, VolumeX, Radio, ShieldCheck, Compass, Eye } from 'lucide-react';
import { ambientAudio } from '../utils/ambientAudio';

interface NavbarProps {
  currentTab: 'home' | 'map' | 'planner' | 'archive';
  onSelectTab: (tab: 'home' | 'map' | 'planner' | 'archive') => void;
  selectedModel: 'gemma-4-26b-a4b-it' | 'gemma-4-31b-it';
  onSelectModel: (model: 'gemma-4-26b-a4b-it' | 'gemma-4-31b-it') => void;
  onOpenReportModal: () => void;
  activeCount: number;
  resolvedCount: number;
  isNavigating?: boolean;
  onEndNavigation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  selectedModel,
  onSelectModel,
  onOpenReportModal,
  activeCount,
  resolvedCount,
  isNavigating = false,
  onEndNavigation,
}) => {
  const [isAudioActive, setIsAudioActive] = useState(false);

  const handleToggleAudio = () => {
    const active = ambientAudio.toggle();
    setIsAudioActive(active);
  };

  return (
    <header className="border-b border-cyan-500/20 bg-[#020713]/90 backdrop-blur-2xl sticky top-0 z-40 transition-all font-hud">
      {/* Top Hairline Telemetry Beam */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

      {/* Main HUD Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Zone 1: Brand Wordmark (The Sea We Breathe Monogram & Title) */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 shrink-0 cursor-pointer group"
          title="Return to Journeys Overview"
        >
          <div className="relative w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-500/40 group-hover:border-cyan-300 flex items-center justify-center text-cyan-300 font-mono text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all group-hover:scale-105">
            <span className="tracking-tighter">AV</span>
            {/* Corner Crosshair Ticks */}
            <span className="absolute -top-1 -left-1 text-[8px] text-cyan-400/80 font-mono">+</span>
            <span className="absolute -bottom-1 -right-1 text-[8px] text-cyan-400/80 font-mono">+</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-[0.18em] text-white uppercase group-hover:text-cyan-200 transition-colors">
                ACCESSVERSE
              </span>
              <span className="hidden lg:inline text-[9px] font-mono text-cyan-400/70 border border-cyan-500/30 px-1.5 py-0.5 rounded tracking-widest uppercase">
                JOURNEYS
              </span>
            </div>
            <span className="text-[10px] text-slate-400 tracking-[0.2em] uppercase font-mono hidden sm:inline">
              URBAN ACCESSIBILITY // CIVIC OCEAN
            </span>
          </div>
        </div>

        {/* Zone 2: Chapters / Journeys Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs uppercase tracking-wider font-medium">
          <button
            onClick={() => onSelectTab('home')}
            className={`whitespace-nowrap shrink-0 transition-all px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'home'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="text-[10px] font-mono text-cyan-400/60">01 //</span>
            <span>Journeys</span>
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`whitespace-nowrap shrink-0 transition-all px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'map' && !isNavigating
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="text-[10px] font-mono text-cyan-400/60">02 //</span>
            <span>Cartography</span>
          </button>

          <button
            onClick={() => onSelectTab('planner')}
            className={`whitespace-nowrap shrink-0 transition-all px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'planner' || isNavigating
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="text-[10px] font-mono text-emerald-400/60">03 //</span>
            <Navigation className={`w-3.5 h-3.5 ${isNavigating ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
            <span>Passage</span>
            {isNavigating && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('archive')}
            className={`whitespace-nowrap shrink-0 transition-all px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'archive'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="text-[10px] font-mono text-cyan-400/60">04 //</span>
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Deep Memory</span>
          </button>
        </nav>

        {/* Zone 3: HUD Audio Soundscape, AI Core & CTA Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Ambient Oceanic Sound Controller (Signature feature of The Sea We Breathe) */}
          <button
            onClick={handleToggleAudio}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
              isAudioActive
                ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'bg-black/40 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            }`}
            title={isAudioActive ? 'Mute ambient oceanic soundscape' : 'Enable ambient oceanic soundscape'}
          >
            {isAudioActive ? (
              <div className="flex items-end gap-0.5 h-3 w-3">
                <span className="w-0.5 bg-cyan-400 animate-eq-1 inline-block" />
                <span className="w-0.5 bg-cyan-400 animate-eq-2 inline-block" />
                <span className="w-0.5 bg-cyan-400 animate-eq-3 inline-block" />
                <span className="w-0.5 bg-cyan-400 animate-eq-4 inline-block" />
              </div>
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline text-[10px] tracking-wider uppercase">
              {isAudioActive ? 'Sound On' : 'Sound'}
            </span>
          </button>

          {/* Model Switcher */}
          <div className="hidden lg:flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => onSelectModel('gemma-4-26b-a4b-it')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                selectedModel === 'gemma-4-26b-a4b-it'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fast inference model"
            >
              GEMMA 26B
            </button>
            <button
              onClick={() => onSelectModel('gemma-4-31b-it')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                selectedModel === 'gemma-4-31b-it'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dense reasoning model"
            >
              GEMMA 31B
            </button>
          </div>

          {isNavigating && onEndNavigation && (
            <button
              onClick={onEndNavigation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-rose-300 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
              title="End active navigation session"
            >
              <X className="w-3.5 h-3.5" />
              <span>TERMINATE NAV</span>
            </button>
          )}

          {/* Primary Action Button */}
          <button
            onClick={onOpenReportModal}
            className="group relative flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-400 hover:from-cyan-200 hover:to-teal-200 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all whitespace-nowrap cursor-pointer active:scale-95 border border-cyan-200/60"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="tracking-wider uppercase">Report Barrier</span>
            {/* Ambient Pulse Dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
          </button>
        </div>
      </div>

      {/* Atmospheric Telemetry Readout Strip */}
      <div className="border-t border-cyan-500/10 bg-[#020713]/80 backdrop-blur-md py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="text-slate-400">ACTIVE HAZARDS:</span>
              <span className="tabular-nums text-rose-300 font-semibold">{activeCount}</span>
            </div>
            <span className="text-slate-700" aria-hidden="true">//</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-400">RESOLVED IN MEMORY:</span>
              <span className="tabular-nums text-emerald-300 font-semibold">{resolvedCount}</span>
            </div>
            <span className="text-slate-700 hidden sm:inline" aria-hidden="true">//</span>
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">VERIFICATIONS:</span>
              <span className="tabular-nums text-cyan-300 font-semibold">112</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500 shrink-0">
            <span className="hidden md:inline">SYSTEM:</span>
            <span className="text-cyan-400/90 font-semibold">GEMMA 4 MULTIMODAL</span>
            <span aria-hidden="true" className="text-slate-700">//</span>
            <span className="text-emerald-400">TELEMETRY LIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
};
