import React, { useState, useRef } from 'react';
import { BarrierItem, BarrierCategory, MobilityProfileId } from '../types/barrier';
import { CURATED_SAMPLES } from '../data/initialBarriers';
import {
  X,
  Upload,
  Sparkles,
  Camera,
  MapPin,
  AlertTriangle,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Crosshair,
} from 'lucide-react';

interface ReportBarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNewBarrier: (newBarrier: BarrierItem) => void;
  prefilledLocation?: {
    lat?: number;
    lng?: number;
    address: string;
    nearestLandmark: string;
    city?: string;
    state?: string;
  } | null;
  existingBarriers: BarrierItem[];
  defaultModel: 'gemma-4-26b-a4b-it' | 'gemma-4-31b-it';
}

export const ReportBarrierModal: React.FC<ReportBarrierModalProps> = ({
  isOpen,
  onClose,
  onSubmitNewBarrier,
  prefilledLocation,
  existingBarriers,
  defaultModel,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState(prefilledLocation?.address || 'MG Road Corridor, Bengaluru');
  const [landmark, setLandmark] = useState(prefilledLocation?.nearestLandmark || 'Metro Transit Gate 2');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: prefilledLocation?.lat ?? 12.9716,
    lng: prefilledLocation?.lng ?? 77.5946,
  });
  const [model, setModel] = useState<'gemma-4-26b-a4b-it' | 'gemma-4-31b-it'>(defaultModel);
  const [thinkingLevel, setThinkingLevel] = useState<'high' | 'minimal'>('high');

  // Gemma Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAcquireGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by browser');
      return;
    }
    setIsAcquiringGps(true);
    setGpsStatus('Acquiring high-accuracy GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setCoords({ lat, lng });
        setIsAcquiringGps(false);
        setGpsStatus(`GPS lock: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (±${Math.round(pos.coords.accuracy || 10)}m)`);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'ACCESSVERSE-Accessibility-India/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              setAddress(data.display_name.split(',').slice(0, 3).join(', '));
              if (data.address?.suburb || data.address?.road) {
                setLandmark(data.address.suburb || data.address.road || 'Near GPS pin');
              }
            }
          }
        } catch {
          // Keep coords intact even if reverse geocoding is slow
        }
      },
      (err) => {
        setIsAcquiringGps(false);
        setGpsStatus(`GPS error (${err.message}). Enter location manually.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  if (!isOpen) return null;

  const handleSelectSample = (sample: (typeof CURATED_SAMPLES)[0]) => {
    setSelectedImage(sample.imageUrl);
    setDescription(sample.description);
    setAddress(sample.location.address);
    setLandmark(sample.location.nearestLandmark);
    setCoords({ lat: sample.location.lat, lng: sample.location.lng });
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setAnalysisResult(null);
      setAnalysisError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunGemmaAnalysis = async () => {
    if (!selectedImage && !description) {
      setAnalysisError('Please provide an obstacle photo or text description.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (selectedImage && selectedImage.startsWith('data:')) {
        const parts = selectedImage.split(',');
        mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        base64Data = parts[1];
      } else if (selectedImage) {
        // If it's a static imported image path, fetch and convert to base64
        const res = await fetch(selectedImage);
        const blob = await res.blob();
        mimeType = blob.type;
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/api/gemma/analyze-barrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data ? { data: base64Data, mimeType } : undefined,
          description,
          location: {
            lat: coords.lat ?? 12.9716,
            lng: coords.lng ?? 77.5946,
            address,
          },
          model,
          thinkingLevel,
          nearbyBarriers: existingBarriers,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze obstacle with Gemma 4');
      }

      setAnalysisResult(data.data || data.fallbackData);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Error executing Gemma 4 analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublishBarrier = () => {
    const timestamp = new Date().toISOString();
    const barrierId = `bar_${Date.now().toString().slice(-4)}`;

    const title = analysisResult?.title || 'Reported Urban Obstacle';
    const category = (analysisResult?.category as BarrierCategory) || 'sidewalk_damaged';
    const severity = analysisResult?.severity || 3;
    const bypassRecommendation =
      analysisResult?.bypassRecommendation ||
      'Detour via the nearest signaled intersection with flush curb transitions.';

    const newBarrier: BarrierItem = {
      id: barrierId,
      title,
      category,
      severity,
      status: 'ACTIVE',
      isDemo: false, // Honest civic data: newly submitted citizen report is not sample data
      isVerifiedLocation: Boolean(coords.lat && coords.lng),
      location: {
        lat: coords.lat,
        lng: coords.lng,
        address,
        nearestLandmark: landmark,
      },
      dimensions: {
        stepHeightCm: analysisResult?.stepHeightCm || null,
        clearanceWidthCm: analysisResult?.clearanceWidthCm || null,
        surfaceCondition: analysisResult?.surfaceCondition || 'Cracked concrete',
      },
      bypassRecommendation,
      reportedAt: timestamp,
      initialImageUrl: selectedImage || CURATED_SAMPLES[0].imageUrl,
      reporterName: 'Community Contributor',
      verifications: 1,
      downvotes: 0,
      passableProfiles: (analysisResult?.passableFor as MobilityProfileId[]) || [],
      history: [
        {
          id: `evt_${Date.now()}_1`,
          timestamp,
          eventType: 'REPORTED',
          author: 'Citizen Reporter',
          role: 'Citizen',
          note: description || 'Reported sidewalk obstacle blocking pedestrian right-of-way.',
          imageUrl: selectedImage || CURATED_SAMPLES[0].imageUrl,
        },
        {
          id: `evt_${Date.now()}_2`,
          timestamp: new Date(Date.now() + 1000).toISOString(),
          eventType: 'AI_ANALYZED',
          author: `Gemma 4 (${model})`,
          role: 'Gemma 4 AI',
          note: `Gemma 4 performed multi-step visual reasoning (Thinking: ${thinkingLevel}). Categorized as ${category} (Severity ${severity}/5). Step Lip: ${
            analysisResult?.stepHeightCm ? `${analysisResult.stepHeightCm}cm` : 'N/A'
          }, Clearance: ${
            analysisResult?.clearanceWidthCm ? `${analysisResult.clearanceWidthCm}cm` : 'N/A'
          }.`,
          diagnostics: analysisResult,
        },
      ],
    };

    onSubmitNewBarrier(newBarrier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-hud">
      <div className="bg-[#030914] border border-cyan-500/20 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(2,6,23,0.95)] hud-frame">
        {/* Modal Header */}
        <div className="p-4 border-b border-cyan-500/20 bg-[#020713]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">EXPEDITION LOG //</span>
                <span className="text-xs font-mono text-slate-400 uppercase">CIVIC AUDIT</span>
              </div>
              <h2 className="text-base font-bold text-white">Report Urban Barrier with Gemma 4</h2>
              <p className="text-xs text-slate-400">
                Multimodal photo analysis, duplicate check, and Barrier Memory creation
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Curated Sample Selector for Rapid Prototyping */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Curated Test Sample (Or upload your own below):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURATED_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    selectedImage === sample.imageUrl
                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="aspect-4/3 rounded-lg overflow-hidden mb-1.5 bg-slate-900">
                    <img
                      src={sample.imageUrl}
                      alt={sample.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-200 block truncate">{sample.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Dropzone & Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Barrier Photo Evidence
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {selectedImage ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 max-h-56 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Selected barrier"
                  referrerPolicy="no-referrer"
                  className="max-h-56 object-contain"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1 bg-slate-900/90 hover:bg-slate-800 text-white text-xs rounded-lg border border-slate-700 backdrop-blur-md"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-sky-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/50"
              >
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <span className="text-xs font-semibold text-slate-300 block">
                  Click to upload photo of curb, ramp, sidewalk, or entrance
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">PNG, JPG, WebP up to 15MB</span>
              </div>
            )}
          </div>

          {/* Location & Citizen Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Street Address / Cross Street
                </label>
                <button
                  type="button"
                  onClick={handleAcquireGps}
                  disabled={isAcquiringGps}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
                  title="Acquire current device GPS position"
                >
                  <Crosshair className={`w-3 h-3 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                  <span>{isAcquiringGps ? 'Locating...' : 'Use My GPS'}</span>
                </button>
              </div>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 4th St & Market Blvd"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              {gpsStatus && (
                <div className="mt-1 text-[10px] text-sky-300/90 font-mono">
                  {gpsStatus}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nearest Civic Landmark / Transit
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Central Metro Station"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Citizen Notes / Context (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Describe what you observed (e.g., wheelchair users having to reverse onto street, broken asphalt chunk)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Gemma 4 Engine Settings Bar */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-slate-200">Gemma 4 Engine:</span>
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setModel('gemma-4-26b-a4b-it')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    model === 'gemma-4-26b-a4b-it'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  26B (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setModel('gemma-4-31b-it')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    model === 'gemma-4-31b-it'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  31B (Dense)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Thinking:</span>
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setThinkingLevel('high')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    thinkingLevel === 'high'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  High (Multi-step)
                </button>
                <button
                  type="button"
                  onClick={() => setThinkingLevel('minimal')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    thinkingLevel === 'minimal'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Minimal
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunGemmaAnalysis}
              disabled={isAnalyzing || (!selectedImage && !description)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-all shadow-md active:scale-95 cursor-pointer ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzing ? 'Gemma Thinking...' : 'Analyze with Gemma 4'}</span>
            </button>
          </div>

          {analysisError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* Gemma 4 Analysis Results Panel */}
          {analysisResult && (
            <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-sky-200 text-xs">Gemma 4 Multimodal Diagnostic Assessment</span>
                </div>
                <span className="text-[11px] font-mono text-sky-300">Severity: {analysisResult.severity}/5</span>
              </div>

              {/* Duplicate Detection Alert */}
              {analysisResult.duplicateDetection?.isPotentialDuplicate && (
                <div className="bg-amber-950/60 border border-amber-500/60 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Potential Duplicate Obstacle Detected!</span>
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      {analysisResult.duplicateDetection.reasoning}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Category</span>
                  <span className="font-semibold text-slate-200 capitalize">
                    {analysisResult.category?.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Step Lip</span>
                  <span className="font-mono text-slate-200">
                    {analysisResult.stepHeightCm ? `${analysisResult.stepHeightCm}cm` : 'Flush / None'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Clearance</span>
                  <span className="font-mono text-slate-200">
                    {analysisResult.clearanceWidthCm ? `${analysisResult.clearanceWidthCm}cm` : 'Standard'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <span className="text-[11px] font-semibold text-sky-300 block">Gemma Visual Derivation:</span>
                <p className="text-[11px] text-slate-300 leading-relaxed italic">
                  "{analysisResult.thinkingSummary}"
                </p>
              </div>

              <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-500/20 p-2 rounded-lg">
                <span className="font-semibold block mb-0.5">Bypass Recommendation:</span>
                <p className="text-[11px] text-slate-200">{analysisResult.bypassRecommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            onClick={handlePublishBarrier}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Publish to Barrier Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
