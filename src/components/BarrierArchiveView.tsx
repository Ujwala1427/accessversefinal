import React, { useState } from 'react';
import { BarrierItem, BarrierCategory } from '../types/barrier';
import {
  History,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Calendar,
  FileDown,
  ArrowRight,
  ShieldCheck,
  Plus,
} from 'lucide-react';

interface BarrierArchiveViewProps {
  barriers: BarrierItem[];
  onSelectBarrier: (barrier: BarrierItem) => void;
  onOpenReportModal: () => void;
}

export const BarrierArchiveView: React.FC<BarrierArchiveViewProps> = ({
  barriers,
  onSelectBarrier,
  onOpenReportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'ACTIVE' | 'RESOLVED'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredBarriers = barriers.filter((b) => {
    if (selectedStatusFilter !== 'all' && b.status !== selectedStatusFilter) return false;
    if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.location.address.toLowerCase().includes(q) ||
        (b.location.nearestLandmark?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(barriers, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `accessverse_barrier_memory_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 font-hud">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#030914] border border-cyan-500/20 p-6 sm:p-8 rounded-2xl hud-frame shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded tracking-widest uppercase">
              JOURNEY // 04
            </span>
            <span className="text-slate-600 font-mono">//</span>
            <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono uppercase tracking-wider">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Civic Sediment Archive</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">The Barrier Memory Archive</h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Permanent civic memory of all urban mobility barriers. When obstacles are resolved, they transition to
            verified status while preserving before/after visual proof, community audits, and municipal work orders for
            transparent accountability.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 bg-[#020713] hover:bg-[#071328] border border-cyan-500/30 transition-colors uppercase cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-cyan-400" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all uppercase cursor-pointer border border-cyan-200/50"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Report Barrier</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#030914] border border-cyan-500/20 p-3 rounded-xl shadow-lg">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400/70 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by street, landmark, or obstacle type..."
            className="w-full bg-[#020713] border border-cyan-500/20 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center bg-[#020713] p-1 rounded-lg border border-cyan-500/20 text-xs font-mono">
          <button
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors uppercase ${
              selectedStatusFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({barriers.length})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('ACTIVE')}
            className={`px-3 py-1 rounded-md font-medium transition-colors uppercase ${
              selectedStatusFilter === 'ACTIVE'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active ({barriers.filter((b) => b.status !== 'RESOLVED').length})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('RESOLVED')}
            className={`px-3 py-1 rounded-md font-medium transition-colors uppercase ${
              selectedStatusFilter === 'RESOLVED'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Resolved ({barriers.filter((b) => b.status === 'RESOLVED').length})
          </button>
        </div>
      </div>

      {/* Barrier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBarriers.map((barrier) => {
          const isResolved = barrier.status === 'RESOLVED';

          return (
            <div
              key={barrier.id}
              onClick={() => onSelectBarrier(barrier)}
              className="bg-[#030914] border border-cyan-500/20 hover:border-cyan-400 hover:bg-[#07152d] rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] group hud-frame"
            >
              <div className="space-y-3">
                {/* Card Top Image & Status Tag */}
                <div className="relative aspect-16/9 rounded-xl overflow-hidden bg-slate-950 border border-cyan-500/20">
                  <img
                    src={isResolved && barrier.resolutionImageUrl ? barrier.resolutionImageUrl : barrier.initialImageUrl}
                    alt={barrier.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-md ${
                        isResolved
                          ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60'
                          : barrier.severity > 3
                          ? 'bg-rose-950/90 text-rose-300 border border-rose-500/60'
                          : 'bg-amber-950/90 text-amber-300 border border-amber-500/60'
                      }`}
                    >
                      {barrier.status}
                    </span>
                  </div>

                  {isResolved && (
                    <div className="absolute bottom-2 left-2 bg-emerald-950/90 border border-emerald-500/40 text-[10px] text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Resolution Proof Saved
                    </div>
                  )}
                </div>

                {/* Barrier Information */}
                <div>
                  <div className="text-[10px] font-mono text-cyan-400 mb-1 flex items-center justify-between uppercase">
                    <span>{barrier.category.replace('_', ' ')} // ID: {barrier.id}</span>
                    {barrier.isDemo && (
                      <span className="text-[9px] text-amber-400 font-semibold px-1.5 py-0.2 bg-amber-950/60 rounded border border-amber-800/60">
                        SAMPLE
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {barrier.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      {barrier.location.address}
                      {barrier.location.lat == null && ' (GPS Unverified)'}
                    </span>
                  </div>
                </div>

                {/* Physical Diagnostics Summary */}
                <div className="grid grid-cols-3 gap-2 bg-[#020713]/90 p-2.5 rounded-xl border border-cyan-500/15 text-center text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Severity</span>
                    <span className="font-mono font-bold text-rose-400">{barrier.severity}/5</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Step Lip</span>
                    <span className="font-mono text-slate-200">
                      {barrier.dimensions.stepHeightCm ? `${barrier.dimensions.stepHeightCm}cm` : 'Flush'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Events</span>
                    <span className="font-mono text-cyan-400">{barrier.history.length}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Action */}
              <div className="border-t border-cyan-500/15 pt-3 mt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="text-[11px] text-slate-500">
                  {barrier.verifications} Verifications
                </span>
                <span className="text-cyan-300 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 uppercase">
                  <span>View Memory</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
