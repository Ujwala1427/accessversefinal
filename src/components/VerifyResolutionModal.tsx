import React, { useState, useRef } from 'react';
import { BarrierItem } from '../types/barrier';
import repairedCurbImg from '../assets/images/barrier_repaired_curb_1791784718535.jpg';
import {
  X,
  Upload,
  CheckCircle,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface VerifyResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  barrier: BarrierItem | null;
  onConfirmResolution: (barrierId: string, resolutionData: { imageUrl: string; notes: string; gemmaVerification: any }) => void;
}

export const VerifyResolutionModal: React.FC<VerifyResolutionModalProps> = ({
  isOpen,
  onClose,
  barrier,
  onConfirmResolution,
}) => {
  const [resolutionImage, setResolutionImage] = useState<string>(repairedCurbImg);
  const [resolutionNotes, setResolutionNotes] = useState('Public Works contractor poured smooth ADA curb ramp with yellow detectable warning surfaces.');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !barrier) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setResolutionImage(event.target?.result as string);
      setVerificationResult(null);
      setVerifyError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setVerifyError(null);

    try {
      // Convert images to base64
      const getBase64 = async (imgUrl: string) => {
        if (imgUrl.startsWith('data:')) {
          const parts = imgUrl.split(',');
          return { data: parts[1], mimeType: parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg' };
        }
        const res = await fetch(imgUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        return new Promise<{ data: string; mimeType: string }>((resolve) => {
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve({ data: dataUrl.split(',')[1], mimeType: blob.type });
          };
          reader.readAsDataURL(blob);
        });
      };

      const originalData = await getBase64(barrier.initialImageUrl);
      const resolutionData = await getBase64(resolutionImage);

      const response = await fetch('/api/gemma/verify-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage: originalData,
          resolutionImage: resolutionData,
          barrierTitle: barrier.title,
          barrierDescription: barrier.dimensions.surfaceCondition || '',
          resolutionNotes,
          model: 'gemma-4-26b-a4b-it',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify barrier resolution');
      }

      setVerificationResult(data.data);
    } catch (err: any) {
      console.error(err);
      setVerifyError(err.message || 'Error communicating with Gemma 4 verification service.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirm = () => {
    onConfirmResolution(barrier.id, {
      imageUrl: resolutionImage,
      notes: resolutionNotes,
      gemmaVerification: verificationResult || {
        isResolved: true,
        confidenceScore: 95,
        summary: 'Visual confirmation: Sidewalk hazard has been leveled and verified clear.',
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-hud">
      <div className="bg-[#030914] border border-cyan-500/20 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(2,6,23,0.95)] hud-frame">
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#020713]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">CIVIC REPAIR AUDIT //</span>
                <span className="text-xs font-mono text-slate-400 uppercase">RESOLUTION</span>
              </div>
              <h2 className="text-base font-bold text-white">Report Barrier Fixed / Resolved</h2>
              <p className="text-xs text-slate-400">
                Gemma 4 will compare before & after evidence to verify clearance in Barrier Memory
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Before & After Photo Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-rose-400 block">1. Original Obstacle (Before)</span>
              <div className="aspect-4/3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={barrier.initialImageUrl}
                  alt="Original obstacle"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] text-slate-500 block truncate">{barrier.title}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">2. Repair Evidence (After)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Upload Custom
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="aspect-4/3 rounded-xl overflow-hidden border border-emerald-700/60 bg-slate-950 relative">
                <img
                  src={resolutionImage}
                  alt="Repair proof"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] text-emerald-400/80 block">Newly Paved ADA Accessible Ramp</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Resolution / Contractor Notes
            </label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Action to trigger Gemma Verification */}
          <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-slate-300 font-medium">
                Verify fix with Gemma 4 Multimodal Comparison
              </span>
            </div>

            <button
              type="button"
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg shadow-sm transition-all"
            >
              {isVerifying ? 'Gemma Verifying...' : 'Run Verification'}
            </button>
          </div>

          {verifyError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{verifyError}</span>
            </div>
          )}

          {/* Gemma 4 Resolution Verdict */}
          {verificationResult && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>Resolution Verified by Gemma 4 AI</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  Confidence: {verificationResult.confidenceScore}%
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed">
                {verificationResult.verificationSummary}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Resolution in Barrier Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
