export type BarrierCategory =
  | 'broken_ramp'
  | 'curb_cut_missing'
  | 'sidewalk_damaged'
  | 'construction_block'
  | 'elevator_outage'
  | 'steep_slope'
  | 'surface_hazard';

export type BarrierStatus = 'ACTIVE' | 'IN_REVIEW' | 'VERIFIED' | 'RESOLVED';

export type MobilityProfileId =
  | 'manual_wheelchair'
  | 'power_chair'
  | 'walker_cane'
  | 'stroller'
  | 'visual_impairment';

export interface MobilityProfile {
  id: MobilityProfileId;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
  maxStepLipCm: number;
  minWidthCm: number;
  surfaceTolerance: 'smooth_only' | 'light_cracks' | 'all';
}

export interface BarrierDiagnostics {
  severity: number;
  stepHeightCm?: number | null;
  clearanceWidthCm?: number | null;
  surfaceCondition?: string;
  passableFor?: string[];
  blockedFor?: string[];
  bypassRecommendation?: string;
  thinkingSummary?: string;
  duplicateDetection?: {
    isPotentialDuplicate: boolean;
    matchedBarrierId?: string | null;
    confidenceScore: number;
    reasoning: string;
  };
}

export type BarrierEventType =
  | 'REPORTED'
  | 'AI_ANALYZED'
  | 'COMMUNITY_VERIFIED'
  | 'MUNICIPAL_UPDATE'
  | 'RESOLUTION_SUBMITTED'
  | 'RESOLVED';

export interface BarrierEvent {
  id: string;
  timestamp: string;
  eventType: BarrierEventType;
  author: string;
  role: 'Citizen' | 'Gemma 4 AI' | 'Community Auditor' | 'Municipal Works' | 'Volunteer';
  note: string;
  imageUrl?: string;
  diagnostics?: BarrierDiagnostics;
  resolutionVerification?: {
    isResolved: boolean;
    confidenceScore: number;
    summary: string;
  };
}

export interface BarrierLocation {
  lat?: number | null;
  lng?: number | null;
  city?: string;
  state?: string;
  address: string;
  nearestLandmark?: string;
  x?: number; // legacy fallback
  y?: number; // legacy fallback
}

export interface BarrierItem {
  id: string;
  title: string;
  category: BarrierCategory;
  severity: number; // 1 to 5
  status: BarrierStatus;
  location: BarrierLocation;
  dimensions: {
    stepHeightCm?: number | null;
    clearanceWidthCm?: number | null;
    surfaceCondition?: string;
  };
  bypassRecommendation: string;
  reportedAt: string;
  initialImageUrl: string;
  resolutionImageUrl?: string;
  history: BarrierEvent[];
  verifications: number;
  downvotes: number;
  reporterName: string;
  passableProfiles: MobilityProfileId[];
  isDemo?: boolean; // Requirement: Clearly label sample demonstration reports
  isVerifiedLocation?: boolean; // Distinguish verified geographic reports from unverified
}

export interface CityLandmark {
  id: string;
  name: string;
  category: 'transit' | 'civic' | 'health' | 'culture' | 'education';
  city: string;
  state: string;
  lat: number;
  lng: number;
  address: string;
  x?: number;
  y?: number;
}

export interface RoutePoint {
  name: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  isCustom?: boolean;
}

export interface PlannedRoute {
  origin: RoutePoint;
  destination: RoutePoint;
  obstructedPath?: Array<{ lat: number; lng: number }>;
  accessiblePath?: Array<{ lat: number; lng: number }>;
  distanceKm: number;
  estimatedTimeMin?: number;
  advisory?: string;
  alternatives?: RouteAlternative[];
  selectedAlternativeIndex?: number;
}

export interface NavigationStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  modifier?: string;
  type?: string;
  name?: string;
  lat: number;
  lng: number;
}

export interface RouteAlternative {
  id: string;
  summary: string;
  distanceKm: number;
  durationMinutes: number;
  coordinates: Array<{ lat: number; lng: number }>;
  steps: NavigationStep[];
  barriersOnRoute: BarrierItem[];
  maxBarrierSeverity: number;
  isRecommended: boolean;
  recommendationReason: string;
}

export interface ActiveNavigationSession {
  route: RouteAlternative;
  origin: RoutePoint;
  destination: RoutePoint;
  currentStepIndex: number;
  userLat?: number;
  userLng?: number;
  isVoiceMuted: boolean;
  isTracking: boolean;
  lastSpokenIndex?: number;
}

