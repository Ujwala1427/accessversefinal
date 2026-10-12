# ACCESSVERSE — A City That Leaves Nobody Behind

An AI-powered, community-driven urban accessibility platform leveraging Google's Gemma 4 multimodal reasoning to interpret barrier photos, verify reports, detect duplicate obstacles, and track the persistent **Barrier Memory** lifecycle on an interactive map.

> [!IMPORTANT]
> **User Review & Confirmed Decisions:**
> - **Core Feature — Barrier Memory**: Every reported accessibility obstacle retains a permanent lifecycle record (Creation → Community Verification → Progress/Degradation Updates → Resolution → Archival Transparency). When an obstacle is resolved, it is marked cleared while its full audit trail remains accessible.
> - **Gemma 4 Multimodal Vision Engine**: Gemma 4 runs deep multi-step thinking (`thinking_level="high"`) to analyze photos of sidewalk cracks, missing curb cuts, steep ramps, construction blocks, or broken elevators—extracting barrier severity, step heights, passable widths, detour feasibility, and matching against existing nearby reports to detect duplicates.
> - **Mobility Profiles Supported**: Universal profile coverage with configurable obstacle tolerances (Manual Wheelchair, Power Chair, Cane/Walker, Stroller, Visual Impairment, Temporary Injury).
> - **Visual Workspace**: Dual view pairing an interactive vector city map with high-contrast accessibility markers and a rich Barrier Memory timeline drawer with before/after photo audits.

---

### 1. Overview & Core Concept

- **What It Does**: ACCESSVERSE bridges the gap between traditional navigation and real-world urban accessibility. Citizens, wheelchair users, and municipal advocates photograph and report barriers. Gemma 4 analyzes the images using multimodal visual reasoning, automatically calculating barrier severity, passability dimensions, and hazard categories. It identifies potential duplicates with nearby existing obstacles and logs each report into **Barrier Memory**—a persistent timeline preserving community verification, maintenance status, and resolution verification.
- **Target Audience / Persona**: Wheelchair and motorized chair users, visually impaired pedestrians, elderly citizens, parents with strollers, municipal urban planners, and volunteer accessibility auditors.
- **Key Value**: Eliminates surprise dead-ends, treacherous broken ramps, and blocked footpaths through community-validated data, grounded in transparent, permanent obstacle lifecycles.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Interactive Accessibility Map & Explorer**:
   - The user opens the interactive city map centered on high-traffic urban corridors.
   - High-contrast visual markers display active obstacles (red), caution/partial bottlenecks (amber), and recently resolved barriers (emerald).
   - Filter by Mobility Profile: Manual Wheelchair, Power Chair, Walker/Cane, Stroller, Visual Impairment.
   - Filter by Barrier Type: Broken Ramp, Missing Curb Cut, Construction Obstruction, Elevator Outage, Surface Hazard, Steep Incline.
2. **Barrier Memory Inspection (The Drawer)**:
   - Clicking any obstacle slides open the **Barrier Memory Drawer**.
   - Chronological timeline displaying: Initial Report (timestamp, photo, user notes) → Gemma 4 Multimodal Diagnostic Assessment → Community Verification count & upvotes → Municipal response/contractor update → Resolution Photo & clearance confirmation.
   - Toggle to inspect past resolved barriers along any planned path for historical route reliability.
3. **Report New Barrier (Gemma 4 Multimodal Analysis)**:
   - User uploads a barrier photo (or selects from curated urban obstacle samples: *Collapsed Curb Cut*, *Blocked Sidewalk Scaffolding*, *Steep Unpaved Ramp*, *Broken Transit Lift*).
   - Gemma 4 runs high-level visual thinking:
     1. Categorizes the barrier and rates severity ($1\text{ to }5$).
     2. Extracts physical constraints (e.g., clearance width: $< 60\text{cm}$, step lip: $15\text{cm}$).
     3. Checks GPS and visual similarities with existing nearby reports (Duplicate Detection).
     4. Suggests an immediate bypass/detour strategy.
   - User confirms or edits the analysis and posts to Barrier Memory.
4. **Community Verification & Resolution**:
   - Nearby users can confirm ("Barrier Still Present") or submit resolution proof ("Barrier Fixed / Repaved").
   - Gemma 4 verifies the fix photo against the original barrier photo to validate that the obstacle has indeed been removed.

#### Visual Identity & Theme
- **Aesthetic Direction**: High-contrast, utilitarian civic engineering interface engineered for maximum clarity, screen reader accessibility, and modern desktop/mobile responsiveness.
- **Color Palette**:
  - *Canvas (60%)*: Deep Obsidian Slate (`#0B0F19`, `#111827`) ensuring high contrast and glare reduction.
  - *Structural Surfaces (30%)*: Charcoal slate panels (`#1F2937`, `#374151`) with crisp hairline borders (`#4B5563`).
  - *Semantic Accents (10%)*: 
    - Active Barrier: High-visibility Coral Red (`#EF4444`)
    - Partial Caution: Amber Warning (`#F59E0B`)
    - Resolved / Clear: Emerald Green (`#10B981`)
    - Gemma Intelligence: Electric Sky Blue (`#38BDF8`)
- **Typography & Scale**:
  - *Brand & Headings*: Plus Jakarta Sans (bold, modern, civic-minded).
  - *Body & Documentation*: Public Sans (legible, crisp reading).
  - *Metrics & Coordinates*: Monospace tabular numerals (`font-mono tabular-nums`) for GPS coords, clearance widths, timestamps, and severity scores.
- **Zero-Pill Discipline**:
  - Metadata is presented as unboxed, clean inline text with middot separators (`Curb Cut · Reported 2h ago · 8 Community Verifications`).
  - Filters and action triggers use explicit, accessible segmented button controls.

---

### 3. Key Product Decisions & Trade-Offs

- **Barrier Memory as Permanent Event Ledger**:
  - *Chosen Approach*: Obstacles are never hard-deleted. When resolved, they transition to the `RESOLVED` state with resolution evidence, maintaining complete historical transparency.
  - *Why*: Allows urban planners to identify chronically problematic corridors and gives mobility users confidence that reported hazards won't silently disappear without proof.
- **Dual Multimodal Task in Single Gemma 4 Call**:
  - *Chosen Approach*: When a photo is uploaded, Gemma 4 performs both diagnostic evaluation (severity, hazard type, bypass recommendation) and compares its visual description against candidate nearby reports to flag potential duplicates.
  - *Why*: Minimizes latency and API overhead while giving users instant feedback on whether their submission is novel or corroborates an existing issue.
- **Hosted Gemma 4 Backend Proxy**:
  - *Chosen Approach*: Server-side Express proxy utilizing `@google/genai` with `gemma-4-26b-a4b-it` and `gemma-4-31b-it` under `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`.
  - *Why*: Keeps the Gemini API key secure on the backend while enabling streaming and multipart base64 image transmissions.
- **High-Density Interactive Map with Mock Geographic Grid**:
  - *Chosen Approach*: A responsive SVG/Canvas interactive city grid with zoom/pan, street coordinate nodes, custom barrier markers, and pedestrian pathway routing between points.
  - *Why*: Zero third-party map token friction or fragile external tile-server dependencies; instantly interactive and reliable in all sandboxes.

---

### 4. Technical Architecture & Data Strategy

#### System & Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                    ACCESSVERSE Web Application (Port 3000)             │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand · Mobility Profile Switcher · Stats · New Report)│
├──────────────────────────────────┬─────────────────────────────────────┤
│   Left: Interactive City Map     │    Right: Barrier Memory Drawer     │
│  ┌─────────────────────────────┐ │  ┌────────────────────────────────┐ │
│  │ Urban Coordinate Grid View  │ │  │ Selected Barrier Overview      │ │
│  │ Interactive Status Pins     │ │  │ Gemma 4 Multimodal Diagnostic  │ │
│  │ Pathway / Route Overlay     │ │  │ Step Height & Clearance Specs  │ │
│  │ Severity & Profile Filters  │ │  │ Persistent Lifecycle Timeline  │ │
│  │ Quick-Center Landmarks      │ │  │ Community Verification Stream  │ │
│  └─────────────────────────────┘ │  └────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  Modal Overlays:                                                       │
│  - New Barrier Reporter (Photo Upload / Camera / Gemma Multimodal AI)  │
│  - Route Clearance Planner (Calculates obstacle-free paths)            │
│  - Gemma 4 Thinking & Prompt Inspector (Developer inspection mode)     │
└────────────────────────────────────────────────────────────────────────┘
                                   │
               POST /api/gemma/analyze-barrier (Multipart/JSON)
               POST /api/gemma/verify-resolution (Dual Image Compare)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Express Server Backend                            │
│  - Manages GEMINI_API_KEY with @google/genai                           │
│  - Dispatches to gemma-4-26b-a4b-it / gemma-4-31b-it                   │
│  - Executes thinkingConfig: { thinkingLevel: 'high' }                  │
│  - Formats structured JSON diagnostics and duplicate likelihood scores │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities

- **BarrierItem**:
  - `id`: string
  - `title`: string
  - `category`: `'broken_ramp' | 'curb_cut_missing' | 'sidewalk_damaged' | 'construction_block' | 'elevator_outage' | 'steep_slope'`
  - `severity`: number (1: minor inconvenience to 5: complete blockage)
  - `status`: `'ACTIVE' | 'IN_REVIEW' | 'VERIFIED' | 'RESOLVED'`
  - `location`: `{ lat: number, lng: number, address: string, landmark: string }`
  - `dimensions`: `{ stepHeightCm?: number, clearanceWidthCm?: number, surfaceType: string }`
  - `bypassRecommendation`: string
  - `reportedAt`: string
  - `initialImageUrl`: string
  - `history`: `BarrierEvent[]`
  - `verifications`: number
  - `downvotes`: number

- **BarrierEvent** (The **Barrier Memory** unit):
  - `id`: string
  - `timestamp`: string
  - `eventType`: `'REPORTED' | 'AI_ANALYZED' | 'COMMUNITY_VERIFIED' | 'MUNICIPAL_NOTIFIED' | 'RESOLUTION_SUBMITTED' | 'RESOLVED'`
  - `author`: string
  - `note`: string
  - `imageUrl`?: string
  - `gemmaDiagnostics`?: {
      severity: number;
      thinkingSummary: string;
      duplicateConfidence?: number;
      passableProfiles: string[];
    }

- **MobilityProfile**:
  - Profiles: `MANUAL_WHEELCHAIR`, `POWER_CHAIR`, `WALKER_CANE`, `STROLLER`, `VISUAL_IMPAIRMENT`
  - Tolerances: Max step lip ($0\text{–}15\text{cm}$), min walkway width ($60\text{–}120\text{cm}$), surface roughness tolerance.
