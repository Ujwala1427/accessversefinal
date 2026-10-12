import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Navigation,
  Crosshair,
  MapPin,
  Play,
  Volume2,
  VolumeX,
  Camera,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Footprints,
  Eye,
  Sliders,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Radio,
} from 'lucide-react';
import { BarrierItem, MobilityProfileId, RoutePoint } from '../types/barrier';
import { MOBILITY_PROFILES } from '../data/mobilityProfiles';
import { speechService } from '../utils/speech';

interface InteractiveHomePageProps {
  barriers: BarrierItem[];
  onOpenMap: (targetCoords?: { lat: number; lng: number }) => void;
  onOpenRoutePlanner: (initialOrigin?: RoutePoint, initialDest?: RoutePoint) => void;
  onOpenReportModal: (prefillLocation?: { lat: number; lng: number; address: string; nearestLandmark: string }) => void;
  onOpenArchive: () => void;
  onSelectBarrier: (barrier: BarrierItem) => void;
  activeCount: number;
  resolvedCount: number;
}

// Curated interactive obstacle scenarios for the Live Gemma 4 Vision Scanner
interface ScannerScenario {
  id: string;
  title: string;
  city: string;
  category: string;
  severity: number;
  imageUrl: string;
  stepLipCm: number;
  clearanceWidthCm: number;
  surface: string;
  audioText: string;
  reasoning: string;
  bypass: string;
  passableProfiles: string[];
}

const SCENARIOS: ScannerScenario[] = [
  {
    id: 'scen_1',
    title: '14cm Broken Curb Lip on MG Road',
    city: 'Bengaluru, Karnataka',
    category: 'Broken Curb Transition',
    severity: 4,
    imageUrl:
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    stepLipCm: 14.5,
    clearanceWidthCm: 55,
    surface: 'Cracked concrete & exposed rubble',
    audioText: 'Warning: 14.5 centimeter broken curb lip detected. Impassable for manual wheelchairs. Recommended bypass: Use signaled crossing 45 meters east.',
    reasoning:
      'Visual examination identifies a fractured curb transition with a 14.5 cm vertical lip. This exceeds the 2.5 cm threshold by 480%. Lack of tactile paving also presents a trip hazard for white cane users.',
    bypass: 'Detour 45m east to Metro Gate 2 flush ramp transition.',
    passableProfiles: ['Ambulatory without mobility aids'],
  },
  {
    id: 'scen_2',
    title: 'Unbarricaded Utility Trench on Link Road',
    city: 'Mumbai, Maharashtra',
    category: 'Open Construction Excavation',
    severity: 5,
    imageUrl:
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
    stepLipCm: 85,
    clearanceWidthCm: 25,
    surface: 'Open mud excavation & construction pipes',
    audioText: 'Critical hazard: Open excavation trench blocking pedestrian sidewalk. Total width clearance is only 25 centimeters. Cross to opposite sidewalk.',
    reasoning:
      'Critical urban safety hazard: Unfenced 85 cm excavation trench spanning across the entire pedestrian right-of-way. Wheelchair passage clearance is constricted to 25 cm, causing a complete barrier.',
    bypass: 'Cross safely at pedestrian light to southern sidewalk corridor.',
    passableProfiles: [],
  },
  {
    id: 'scen_3',
    title: 'Discontinuous Tactile Paving & High Step',
    city: 'Connaught Place, Delhi',
    category: 'Missing Accessibility Transition',
    severity: 3,
    imageUrl:
      'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
    stepLipCm: 9.0,
    clearanceWidthCm: 70,
    surface: 'Loose paving stones & severed yellow tactile line',
    audioText: 'Notice: Yellow tactile guidance strip abruptly terminates at a 9 centimeter step. Proceed with caution.',
    reasoning:
      'Visual reasoning highlights incomplete civic tactile paving terminating into a sudden 9 cm drop. Partial passability for power chairs with skilled attendants, but perilous for visually impaired walkers.',
    bypass: 'Follow outer arcade corridor with continuous smooth marble surface.',
    passableProfiles: ['Power Wheelchair (Assisted)', 'Cane Walker'],
  },
  {
    id: 'scen_4',
    title: 'Steep Entrance Threshold Without Ramp',
    city: 'Anna Salai, Chennai',
    category: 'Steep Step Barrier',
    severity: 4,
    imageUrl:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    stepLipCm: 18.0,
    clearanceWidthCm: 80,
    surface: 'Smooth granite threshold with 18cm riser',
    audioText: 'Barrier alert: 18 centimeter vertical step without accessible ramp. Manual wheelchair bypass requires rear accessible elevator.',
    reasoning:
      'High vertical step riser of 18 cm with zero transition ramp or handrails. Power chairs risk high-centering or motor damage. Immediate detour needed to north service elevator.',
    bypass: 'Use rear north service ramp with 1:12 compliant slope.',
    passableProfiles: ['Ambulatory pedestrians'],
  },
];

// Curated Journeys inspired by The Sea We Breathe
interface ThematicJourney {
  index: string;
  title: string;
  subtitle: string;
  quote: string;
  sector: string;
  coordinates: string;
  previewImage: string;
  actionText: string;
  target: 'scanner' | 'map' | 'passage' | 'archive';
}

const THEMATIC_JOURNEYS: ThematicJourney[] = [
  {
    index: '01',
    title: 'The Visual Scanner',
    subtitle: 'Multimodal AI Vision & Surface Geometry',
    quote: 'Deconstructing physical topography into quantifiable sidewalk geometry in real time.',
    sector: 'BENGALURU CORRIDOR',
    coordinates: '12°58′23″ N · 77°35′45″ E',
    previewImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1400&q=80',
    actionText: 'Enter Scanner Journey',
    target: 'scanner',
  },
  {
    index: '02',
    title: 'The Cartographic Ocean',
    subtitle: 'All-India Interactive Accessibility Map',
    quote: 'Surveying impassable reefs, step lips, and flush transitions across civic corridors.',
    sector: 'MUMBAI METROPOLIS',
    coordinates: '18°55′38″ N · 72°49′34″ E',
    previewImage: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1400&q=80',
    actionText: 'Explore Cartography',
    target: 'map',
  },
  {
    index: '03',
    title: 'The Seamless Passage',
    subtitle: 'Autonomous Turn-by-Turn Spoken Navigation',
    quote: 'Calculating continuous accessible pedestrian channels tailored to individual mobility thresholds.',
    sector: 'DELHI ARCADES',
    coordinates: '28°37′58″ N · 77°13′11″ E',
    previewImage: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1400&q=80',
    actionText: 'Launch Passage Engine',
    target: 'passage',
  },
  {
    index: '04',
    title: 'The Abyssal Archive',
    subtitle: 'Permanent Barrier Memory & Civic Reparation',
    quote: 'Preserving verified community resolutions and preventing civic regressions forever.',
    sector: 'CHENNAI ARTERY',
    coordinates: '13°03′47″ N · 80°15′04″ E',
    previewImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80',
    actionText: 'Inspect Memory Archive',
    target: 'archive',
  },
];

// Terrain simulator obstacles
interface TerrainObstacle {
  name: string;
  type: string;
  stepHeight: number;
  slope: string;
  requiresTactile: boolean;
}

const TERRAIN_TESTS: TerrainObstacle[] = [
  { name: 'Flush Curb Cut', type: 'Compliant Ramp', stepHeight: 0.8, slope: '1:12 Gentle', requiresTactile: true },
  { name: 'Standard Sidewalk Lip', type: 'Minor Lip', stepHeight: 2.2, slope: 'Flat', requiresTactile: false },
  { name: 'Broken Concrete Step', type: 'Fractured Curb', stepHeight: 12.5, slope: 'Abrupt 90°', requiresTactile: false },
  { name: 'Steep Vehicular Ramp', type: 'Excessive Slope', stepHeight: 0, slope: '1:5 Steep Incline', requiresTactile: false },
  { name: 'Open Utility Trench', type: 'Civic Excavation', stepHeight: 65, slope: 'Impassable Chasm', requiresTactile: false },
];

export const InteractiveHomePage: React.FC<InteractiveHomePageProps> = ({
  barriers,
  onOpenMap,
  onOpenRoutePlanner,
  onOpenReportModal,
  onOpenArchive,
  onSelectBarrier,
  activeCount,
  resolvedCount,
}) => {
  // Canvas animation ref for oceanic caustic / particle waves
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Journey Index for The Sea We Breathe Showcase
  const [activeJourneyIdx, setActiveJourneyIdx] = useState(0);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Quick route form
  const [quickOrigin, setQuickOrigin] = useState('MG Road Metro, Bengaluru');
  const [quickDest, setQuickDest] = useState('Kanteerava Indoor Stadium, Bengaluru');

  // Scanner interactive demo state
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(62);
  const [isAudioSpeaking, setIsAudioSpeaking] = useState(false);

  // Mobility simulator state
  const [selectedProfileId, setSelectedProfileId] = useState<MobilityProfileId>('manual_wheelchair');

  // Before/after resolution slider state
  const [resolutionSplit, setResolutionSplit] = useState(50);

  // Section references for smooth scrolling into journeys
  const scannerSectionRef = useRef<HTMLElement | null>(null);

  // Atmospheric oceanic particle background canvas (The Sea We Breathe Caustics)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 680);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Oceanic plankton / telemetry particles
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      pulseSpeed: number;
      phase: number;
    }> = [];
    const count = Math.min(45, Math.floor(width / 28));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.15 - Math.random() * 0.25, // upward drifting like ocean bubbles
        radius: Math.random() * 1.8 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 3;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    let t = 0;
    const render = () => {
      t += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Deep water radial glow at cursor
      const radialGradient = ctx.createRadialGradient(mouseX, mouseY, 15, mouseX, mouseY, 320);
      radialGradient.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
      radialGradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.03)');
      radialGradient.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = radialGradient;
      ctx.fillRect(0, 0, width, height);

      // Render gentle caustic contour lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
      ctx.lineWidth = 1;
      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath();
        for (let x = 0; x < width; x += 30) {
          const y = height * (0.25 + wave * 0.28) + Math.sin(x * 0.005 + t + wave) * 25 + Math.cos(t * 0.5 + wave) * 15;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Render and connect floating particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.pulseSpeed;

        // Wrap around bounds
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Connect nearby nodes with delicate oceanic filament lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const filamentAlpha = (1 - dist / 110) * 0.12;
            ctx.strokeStyle = `rgba(34, 211, 238, ${filamentAlpha})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        const currentAlpha = p.alpha + Math.sin(p.phase) * 0.15;
        ctx.fillStyle = `rgba(103, 232, 249, ${Math.max(0.05, currentAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // GPS Acquisition handler
  const handleAcquireGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const accuracy = Math.round(pos.coords.accuracy || 15);

        let address = 'Current GPS Position';
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'ACCESSVERSE-India-Accessibility/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              address = data.display_name.split(',').slice(0, 3).join(', ');
            }
          }
        } catch {
          // Graceful fallback
        }

        setGpsLocation({ lat, lng, accuracy, address });
        setQuickOrigin(address);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(`GPS access notice: ${err.message}. Using city default coordinates.`);
        setGpsLocation({
          lat: 12.9716,
          lng: 77.5946,
          accuracy: 50,
          address: 'MG Road Corridor, Bengaluru (Default GPS Lock)',
        });
        setQuickOrigin('MG Road Corridor, Bengaluru');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  // Quick route form submit
  const handleQuickRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const origPt: RoutePoint = {
      name: quickOrigin,
      address: quickOrigin,
      lat: gpsLocation?.lat || 12.9716,
      lng: gpsLocation?.lng || 77.5946,
      isCustom: true,
    };
    const destPt: RoutePoint = {
      name: quickDest,
      address: quickDest,
      lat: 12.9765,
      lng: 77.5925,
      isCustom: true,
    };
    onOpenRoutePlanner(origPt, destPt);
  };

  // Play audio voice explanation
  const handlePlayVoice = (text: string) => {
    if (isAudioSpeaking) {
      speechService.stop();
      setIsAudioSpeaking(false);
      return;
    }
    const success = speechService.speak(text);
    if (success) {
      setIsAudioSpeaking(true);
      const timer = setTimeout(() => setIsAudioSpeaking(false), 7000);
      return () => clearTimeout(timer);
    }
  };

  const handleJourneyAction = (target: 'scanner' | 'map' | 'passage' | 'archive') => {
    if (target === 'scanner') {
      scannerSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === 'map') {
      onOpenMap();
    } else if (target === 'passage') {
      onOpenRoutePlanner();
    } else if (target === 'archive') {
      onOpenArchive();
    }
  };

  const currentScenario = SCENARIOS[activeScenarioIndex];
  const activeProfile = MOBILITY_PROFILES.find((p) => p.id === selectedProfileId) || MOBILITY_PROFILES[0];
  const activeJourney = THEMATIC_JOURNEYS[activeJourneyIdx];

  return (
    <div className="space-y-16 pb-20 font-hud">
      {/* 1. THE SEA WE BREATHE: ICONIC "JOURNEYS" CAROUSEL HERO */}
      <section className="relative rounded-2xl border border-cyan-500/20 bg-[#030914] overflow-hidden shadow-[0_0_50px_rgba(3,10,24,0.8)] hud-frame">
        {/* Deep Ocean Lighting Caustics */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Ambient Oceanic Canvas Layer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-auto z-0 opacity-80"
        />

        <div className="relative z-10 p-6 sm:p-10 lg:p-14 max-w-6xl mx-auto space-y-10">
          {/* Top HUD Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-500/20 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/60 text-cyan-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>EXPEDITION // {activeJourney.index} OF 04</span>
              </span>
              <span className="hidden sm:inline text-slate-600">//</span>
              <span className="text-cyan-400/90 font-medium tracking-widest hidden sm:inline uppercase">
                {activeJourney.sector}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="text-slate-400">COORDINATES:</span>
              <span className="text-cyan-300/80 tracking-wider font-mono">{activeJourney.coordinates}</span>
            </div>
          </div>

          {/* Central Hero Narrative (Mimicking The Sea We Breathe Editorial Presentation) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-px w-8 bg-cyan-400" />
                  <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono">
                    {activeJourney.subtitle}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] font-sans">
                  A City That Leaves{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300">
                    Nobody Behind
                  </span>.
                </h1>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl font-editorial italic text-lg sm:text-xl">
                  "{activeJourney.quote}"
                </p>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
                  India's civic urban accessibility network. Detect sidewalk obstacles with Gemma 4 visual reasoning,
                  navigate barrier-free pedestrian routes with spoken turn-by-turn guidance, and preserve permanent civic Barrier Memory for municipal accountability.
                </p>
              </div>

              {/* Journey Action & Chapter Navigation Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleJourneyAction(activeJourney.target)}
                  className="group flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-500 hover:from-cyan-300 hover:to-teal-200 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all cursor-pointer active:scale-95 border border-cyan-200/60"
                >
                  <span>{activeJourney.actionText}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Journey Selector Navigation Controls */}
                <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-1">
                  <button
                    onClick={() => setActiveJourneyIdx((prev) => (prev > 0 ? prev - 1 : THEMATIC_JOURNEYS.length - 1))}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Previous Journey"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 px-2">
                    {THEMATIC_JOURNEYS.map((j, idx) => (
                      <button
                        key={j.index}
                        onClick={() => setActiveJourneyIdx(idx)}
                        className={`transition-all rounded-full cursor-pointer ${
                          activeJourneyIdx === idx
                            ? 'w-6 h-1.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                            : 'w-1.5 h-1.5 bg-slate-600 hover:bg-slate-400'
                        }`}
                        title={`Journey ${j.index}: ${j.title}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveJourneyIdx((prev) => (prev < THEMATIC_JOURNEYS.length - 1 ? prev + 1 : 0))}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Next Journey"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Panoramic Journey Viewport (Sea We Breathe Portal) */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950 shadow-2xl group">
                <img
                  src={activeJourney.previewImage}
                  alt={activeJourney.title}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-4/3 object-cover filter brightness-90 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030914] via-transparent to-transparent opacity-80" />

                {/* Interactive Reticle Hotspots on the Journey Visual */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative flex items-center justify-center">
                    <span className="w-10 h-10 rounded-full border border-cyan-400/60 animate-ping absolute" />
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                      <Crosshair className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Lower HUD Overlay Badges */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-cyan-300 bg-[#020713]/85 backdrop-blur-md p-2.5 rounded-xl border border-cyan-500/30">
                  <span className="font-semibold tracking-wider uppercase">{activeJourney.title}</span>
                  <span className="text-[10px] text-slate-400">{activeJourney.sector}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigational Bridge Radar: GPS & Quick Route Launch Card */}
          <div className="bg-[#051022]/85 backdrop-blur-2xl border border-cyan-500/20 rounded-2xl p-6 sm:p-7 shadow-[0_0_30px_rgba(3,10,24,0.6)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3.5">
                <div className="relative w-11 h-11 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <div className="absolute inset-0 rounded-xl bg-cyan-400/20 animate-ping opacity-60" />
                  <Crosshair className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Live GPS Location Radar</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-600/50 font-mono font-medium">GPS ACTIVE</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {gpsLocation
                      ? `Locked: ${gpsLocation.address} (±${gpsLocation.accuracy}m accuracy)`
                      : 'Acquire real device GPS coordinates to discover accessible paths around you.'}
                  </p>
                </div>
              </div>

              {/* Primary GPS Acquire Button */}
              <button
                type="button"
                onClick={handleAcquireGps}
                disabled={gpsLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono font-bold rounded-xl shadow-lg border border-cyan-500/40 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{gpsLoading ? 'Acquiring GPS...' : gpsLocation ? 'Update GPS Lock' : 'Allow GPS & Locate Me'}</span>
              </button>
            </div>

            {gpsError && (
              <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-800/80 text-xs text-amber-200">
                {gpsError}
              </div>
            )}

            {/* Quick Route Search Form */}
            <form onSubmit={handleQuickRouteSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-semibold text-slate-400 block uppercase">Start (Origin)</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={quickOrigin}
                      onChange={(e) => setQuickOrigin(e.target.value)}
                      placeholder="Enter starting street or landmark..."
                      className="w-full bg-[#020713] border border-cyan-500/20 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-semibold text-slate-400 block uppercase">Destination</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={quickDest}
                      onChange={(e) => setQuickDest(e.target.value)}
                      placeholder="Enter destination in India..."
                      className="w-full bg-[#020713] border border-cyan-500/20 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-xs font-mono font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer border border-emerald-200/40 uppercase"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Plan Accessible Route</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenMap(gpsLocation ? { lat: gpsLocation.lat, lng: gpsLocation.lng } : undefined)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0b172a] hover:bg-[#13223d] text-cyan-300 text-xs font-mono font-semibold rounded-xl border border-cyan-500/30 transition-all cursor-pointer uppercase"
                  >
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Explore India Map</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenReportModal(
                      gpsLocation
                        ? {
                            lat: gpsLocation.lat,
                            lng: gpsLocation.lng,
                            address: gpsLocation.address,
                            nearestLandmark: 'Current GPS Location',
                          }
                        : undefined
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-mono text-rose-300 transition-all font-semibold cursor-pointer uppercase"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Report Barrier Here</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quantitative Metric Counters Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 border-t border-cyan-500/20">
            <div className="p-3.5 rounded-xl bg-[#061226]/80 border border-rose-500/30 shadow-lg">
              <span className="text-[10px] text-rose-300/80 font-mono font-medium block uppercase">Active Civic Obstacles</span>
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-rose-400 tabular-nums">
                {activeCount}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#061226]/80 border border-emerald-500/30 shadow-lg">
              <span className="text-[10px] text-emerald-300/80 font-mono font-medium block uppercase">Barrier Memory Repaired</span>
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-300 tabular-nums">
                {resolvedCount}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#061226]/80 border border-cyan-500/30 shadow-lg">
              <span className="text-[10px] text-cyan-300/80 font-mono font-medium block uppercase">Pedestrian Engine</span>
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-300">
                OSRM Foot
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#061226]/80 border border-indigo-500/30 shadow-lg">
              <span className="text-[10px] text-indigo-300/80 font-mono font-medium block uppercase">Multimodal Vision</span>
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-300">
                Gemma 4
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE GEMMA 4 LIVE BARRIER VISION SCANNER (DYNAMIC DEMO) */}
      <section ref={scannerSectionRef} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-cyan-500/40 bg-cyan-950/70 text-cyan-300 font-mono text-[11px] uppercase">
                <Eye className="w-3.5 h-3.5 text-cyan-300" />
                <span>Multimodal Perception Engine</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Live Barrier Vision Scanner
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Drag the scan slider to reveal what the human eye sees versus what Gemma 4's multi-step visual reasoning detects in real Indian street conditions.
            </p>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#040e1e]/90 border border-cyan-500/20 rounded-xl backdrop-blur-md shadow-lg">
            {SCENARIOS.map((scen, idx) => (
              <button
                key={scen.id}
                onClick={() => {
                  setActiveScenarioIndex(idx);
                  setIsAudioSpeaking(false);
                  speechService.stop();
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer uppercase ${
                  activeScenarioIndex === idx
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {scen.city.split(',')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* The Interactive Scanner Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Visual Scan Box with Dynamic Slider & Overlays */}
          <div className="lg:col-span-7 bg-[#030914] backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col hud-frame">
            <div className="relative aspect-16/10 w-full overflow-hidden select-none bg-slate-950">
              {/* Base Street Photo */}
              <img
                src={currentScenario.imageUrl}
                alt={currentScenario.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />

              {/* Gemma 4 Visual Reasoning Overlay (Clipped by Slider) */}
              <div
                className="absolute inset-0 bg-sky-950/30 backdrop-blur-[1px] pointer-events-none transition-all duration-75 overflow-hidden"
                style={{ width: `${scanProgress}%` }}
              >
                <img
                  src={currentScenario.imageUrl}
                  alt={currentScenario.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover filter contrast-125 brightness-110"
                  style={{ width: '100%', maxWidth: 'none' }}
                />

                {/* Sweeping Scanner Vertical Beam */}
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 via-teal-300 to-cyan-500 shadow-[0_0_20px_#22d3ee]" />

                {/* Bounding Hazard Box */}
                <div className="absolute top-[32%] left-[28%] w-[44%] h-[40%] border-2 border-rose-500 rounded-lg shadow-2xl bg-rose-500/15 flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-rose-300 bg-rose-950/90 px-2 py-0.5 rounded border border-rose-600 w-fit">
                    <span>HAZARD DETECTED · SEV {currentScenario.severity}/5</span>
                  </div>
                  <div className="text-[11px] font-mono text-white bg-slate-950/90 px-2 py-1 rounded border border-rose-400/80 flex items-center justify-between">
                    <span>Step Lip: {currentScenario.stepLipCm} cm</span>
                    <span>Clearance: {currentScenario.clearanceWidthCm} cm</span>
                  </div>
                </div>
              </div>

              {/* Interactive Split Divider Handle (Diamond reticle) */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/80 shadow-2xl pointer-events-none"
                style={{ left: `${scanProgress}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-lg rotate-45 bg-[#020713] border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)] flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5 -rotate-45 text-cyan-300" />
                </div>
              </div>

              {/* Labels on photo */}
              <div className="absolute bottom-3 left-3 bg-[#020713]/90 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-cyan-500/30">
                RAW IMAGE (RIGHT) ↔ GEMMA 4 VISION HUD (LEFT)
              </div>
            </div>

            {/* Slider Control Bar */}
            <div className="p-4 bg-[#040e1e] border-t border-cyan-500/20 flex items-center gap-4">
              <span className="text-xs font-mono font-semibold text-slate-300 shrink-0 uppercase">Scan Revealer:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={scanProgress}
                onChange={(e) => setScanProgress(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-ew-resize"
              />
              <span className="text-xs font-mono font-bold text-cyan-300 shrink-0 tabular-nums">{scanProgress}%</span>
            </div>
          </div>

          {/* AI Inspection Card Details */}
          <div className="lg:col-span-5 bg-[#030914] backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-5 hud-frame">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-2.5 py-1 rounded">
                  {currentScenario.city}
                </span>
                <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 px-2.5 py-1 rounded">
                  SEVERITY {currentScenario.severity} / 5
                </span>
              </div>

              <h3 className="text-lg font-bold text-white leading-snug">{currentScenario.title}</h3>

              {/* Audio Voice Guidance Button */}
              <button
                type="button"
                onClick={() => handlePlayVoice(currentScenario.audioText)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer uppercase ${
                  isAudioSpeaking
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300 shadow-sm'
                }`}
              >
                {isAudioSpeaking ? <VolumeX className="w-4 h-4 text-slate-950" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
                <span>{isAudioSpeaking ? 'Mute Spoken Warning' : 'Play Spoken Voice Guidance'}</span>
              </button>

              {/* Diagnostic Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30">
                  <span className="text-slate-400 block text-[10px] font-mono uppercase">Step Lip Height</span>
                  <span className="text-base font-extrabold font-mono text-rose-300 mt-0.5 block">
                    {currentScenario.stepLipCm} cm
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono">Exceeds 2.5cm max</span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <span className="text-slate-400 block text-[10px] font-mono uppercase">Clearance Width</span>
                  <span className="text-base font-extrabold font-mono text-amber-300 mt-0.5 block">
                    {currentScenario.clearanceWidthCm} cm
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">Needs 90cm standard</span>
                </div>
              </div>

              {/* Gemma 4 Reasoning Prose */}
              <div className="space-y-1.5">
                <span className="text-xs font-mono font-semibold text-slate-300 block uppercase">Gemma 4 Multimodal Reasoning:</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-[#020713] p-3 rounded-xl border border-cyan-500/15">
                  {currentScenario.reasoning}
                </p>
              </div>

              {/* Bypass Detour Recommendation */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>AUTOMATED ACCESSIBLE BYPASS:</span>
                </div>
                <p className="text-emerald-200/90 text-[11px] leading-relaxed">{currentScenario.bypass}</p>
              </div>
            </div>

            {/* Direct Barrier Audit Action CTA */}
            <button
              type="button"
              onClick={() => onOpenReportModal({
                lat: 12.9716,
                lng: 77.5946,
                address: currentScenario.title,
                nearestLandmark: currentScenario.city,
              })}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-mono font-bold rounded-xl border border-cyan-500/40 shadow-lg transition-all cursor-pointer active:scale-95 uppercase"
            >
              <Camera className="w-4 h-4 text-cyan-300" />
              <span>Report & Analyze Similar Obstacle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE MOBILITY PROFILE & TERRAIN SIMULATOR */}
      <section className="bg-[#030914] backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 hud-frame">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/60 text-emerald-300 font-mono text-[11px] uppercase">
                <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                <span>Personalized Accessibility Engine</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Interactive Mobility Profile Simulator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Different aids face vastly different urban thresholds. Select a mobility profile to observe live passability calculations across urban terrain types.
            </p>
          </div>

          {/* Profile Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {MOBILITY_PROFILES.map((prof) => (
              <button
                key={prof.id}
                onClick={() => setSelectedProfileId(prof.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedProfileId === prof.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-[#020713] text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
                }`}
              >
                {prof.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Profile Criteria Card */}
        <div className="bg-[#051125] border border-cyan-500/30 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-lg">
          <div>
            <span className="font-extrabold text-white text-sm block font-mono">{activeProfile.label} Specifications:</span>
            <span className="text-cyan-300/80 text-xs mt-0.5 block">{activeProfile.description}</span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Max Step Lip</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">{activeProfile.maxStepLipCm} cm</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Min Clearance Width</span>
              <span className="font-mono font-bold text-teal-300 text-sm">{activeProfile.minWidthCm} cm</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Surface Tolerance</span>
              <span className="font-mono font-bold text-indigo-300 text-sm capitalize">
                {activeProfile.surfaceTolerance.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Terrain Passability Simulation Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TERRAIN_TESTS.map((test, idx) => {
            const isPassable = test.stepHeight <= activeProfile.maxStepLipCm;
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  isPassable
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-rose-950/20 border-rose-500/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{test.type}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isPassable ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-rose-950 text-rose-400 border border-rose-600'
                      }`}
                    >
                      {isPassable ? 'PASSABLE' : 'IMPASSABLE'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{test.name}</h4>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400 font-mono">
                    <span>Vertical Lip:</span>
                    <span className="text-slate-200">{test.stepHeight} cm</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono">
                    <span>Slope:</span>
                    <span className="text-slate-200">{test.slope}</span>
                  </div>
                </div>

                <div
                  className={`text-[11px] p-2 rounded font-medium leading-tight ${
                    isPassable ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                  }`}
                >
                  {isPassable
                    ? 'Safe for autonomous navigation.'
                    : `Exceeds ${activeProfile.maxStepLipCm}cm limit. Requires detour.`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. BEFORE & AFTER BARRIER MEMORY SHOWCASE (CIVIC REPAIR AUDIT) */}
      <section className="bg-[#030914] backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 hud-frame">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/60 text-emerald-300 font-mono text-[11px] uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Municipal Accountability</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Permanent Barrier Memory
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Unlike transient map error pins, ACCESSVERSE preserves every reported hazard forever. Drag the repair handle to verify how citizen reporting catalyzed municipal curb reconstruction.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenArchive}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-mono font-bold rounded-xl border border-cyan-500/40 shadow-sm transition-all cursor-pointer shrink-0 uppercase"
          >
            <span>Explore All {resolvedCount} Resolved Records</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Before & After Resolution Slider */}
        <div className="relative aspect-16/9 sm:aspect-21/9 w-full rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950 select-none shadow-2xl">
          {/* Resolved After Image (Full background) */}
          <img
            src="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1400&q=80"
            alt="Repaired accessible curb ramp"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover filter brightness-105"
          />
          <div className="absolute top-4 right-4 bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-mono font-bold px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
            AFTER: VERIFIED MUNICIPAL RESOLUTION (FLUSH RAMP)
          </div>

          {/* Blocked Before Image (Clipped) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${resolutionSplit}%` }}
          >
            <img
              src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1400&q=80"
              alt="Blocked broken sidewalk barrier"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover filter contrast-125 brightness-90"
              style={{ width: '100%', maxWidth: 'none' }}
            />
            <div className="absolute top-4 left-4 bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs font-mono font-bold px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
              BEFORE: ACTIVE OBSTACLE (14CM DROP LIP)
            </div>
          </div>

          {/* Split Line & Handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white/80 shadow-2xl pointer-events-none"
            style={{ left: `${resolutionSplit}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-lg rotate-45 bg-[#020713] border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)] flex items-center justify-center">
              <Sliders className="w-4 h-4 -rotate-45 text-cyan-300" />
            </div>
          </div>
        </div>

        {/* Slider input */}
        <div className="flex items-center gap-4 bg-[#040e1e] p-3.5 rounded-xl border border-cyan-500/20">
          <span className="text-xs font-mono font-semibold text-slate-300 shrink-0 uppercase">Historical Comparison:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={resolutionSplit}
            onChange={(e) => setResolutionSplit(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-ew-resize"
          />
          <span className="text-xs font-mono font-bold text-cyan-300 shrink-0 tabular-nums">{resolutionSplit}% Before</span>
        </div>
      </section>

      {/* 5. LIVE CIVIC OBSTACLE FEED TICKER */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">
              Live Community Obstacle Feed (Across India)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenMap()}
            className="text-xs text-cyan-300 hover:text-cyan-200 font-mono font-bold flex items-center gap-1 cursor-pointer uppercase"
          >
            <span>View All on Cartography Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Barrier Cards Grid with oceanic HUD styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {barriers.slice(0, 6).map((barrier) => (
            <div
              key={barrier.id}
              onClick={() => {
                onSelectBarrier(barrier);
                if (barrier.location.lat && barrier.location.lng) {
                  onOpenMap({ lat: barrier.location.lat, lng: barrier.location.lng });
                } else {
                  onOpenMap();
                }
              }}
              className="p-4 rounded-xl bg-[#030914] backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400 hover:bg-[#07152d] cursor-pointer transition-all space-y-2.5 group shadow-lg"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white group-hover:text-cyan-300 transition-colors truncate max-w-[200px]">
                  {barrier.title}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    barrier.status === 'RESOLVED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {barrier.status === 'RESOLVED' ? 'RESOLVED' : `SEV ${barrier.severity}/5`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate font-mono">
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>{barrier.location.address}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/5 font-mono">
                <span className="truncate max-w-[150px]">{barrier.location.nearestLandmark}</span>
                <span className="text-cyan-300 group-hover:underline flex items-center gap-0.5 font-semibold shrink-0">
                  Inspect Coordinates →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. CALL TO ACTION FOOTER BANNER (The Sea We Breathe Callout) */}
      <section className="relative rounded-2xl border border-cyan-500/30 bg-[#030a16] p-8 sm:p-12 shadow-2xl overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 hud-frame">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-teal-500/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="space-y-2 text-center sm:text-left relative z-10">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Civic Navigation Station</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ready to Navigate Barrier-Free?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
            Experience turn-by-turn spoken directions that actively avoid known municipal hazards, or audit a new obstacle using Gemma 4 vision.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 shrink-0 relative z-10 font-mono">
          <button
            type="button"
            onClick={() => onOpenRoutePlanner()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-xs font-bold rounded-xl shadow-xl transition-all active:scale-95 cursor-pointer uppercase border border-emerald-200/50"
          >
            <Navigation className="w-4 h-4 fill-slate-950" />
            <span>Launch Navigation</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenReportModal()}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold rounded-xl border border-cyan-500/40 shadow-lg transition-all active:scale-95 cursor-pointer uppercase"
          >
            <Camera className="w-4 h-4 text-cyan-300" />
            <span>Report Urban Barrier</span>
          </button>
        </div>
      </section>
    </div>
  );
};
