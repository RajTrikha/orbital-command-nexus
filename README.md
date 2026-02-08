# Orbital Command Nexus

AI-powered mission control dashboard where **Tambo generates the UI in real time** based on telemetry, risk context, and operator actions.

## Live Demo

- Production: [https://orbital-command-nexus.vercel.app](https://orbital-command-nexus.vercel.app)

## What This Project Does

Orbital Command Nexus turns natural-language mission events into the right operational interface at runtime:

- `FleetMap` for geospatial hazard and route context
- `ApprovalGate` for human authorization on risky maneuvers
- `MissionChecklist` for actionable execution tasks
- `SystemsConsole` for incident remediation and override controls
- `CalmDashboard` fallback for nominal conditions

The workflow is human-in-the-loop: operator clicks (approve/deny, checklist progress, override auth) are synced back to Tambo state and influence the next generated panel.

## How Tambo Is Used

  Tambo is the decision engine at the core of Orbital Command Nexus. Every AI interaction flows through Tambo's V1 SDK — it decides which UI panel to   
  render, generates structured props, calls tools for live data, and maintains bidirectional state with interactive components.                         
                                                                                                                                                        
  Generative UI via Component Registration. We register 4 mission-critical components (CalmDashboard, FleetMap, SystemsConsole, ApprovalGate) with      
  TamboV1Provider, each with a Zod propsSchema. When an operator describes an orbital event, Tambo selects the right component and generates validated  
  props. We render Tambo's renderedComponent directly from message content blocks — no manual extraction or mapping layer.                              
                                                                                                                                                        
  Client-Side Tools (defineTool). Three tools give the AI access to live mission state: getAssetTelemetry returns satellite position, fuel, signal
  strength, and trend; getSpaceWeatherAlerts returns anomalies near a coordinate; getMissionOverview returns fleet-wide posture. The AI calls these
  tools autonomously before rendering — for example, calling getAssetTelemetry and getSpaceWeatherAlerts before deciding to render a FleetMap with real
  data instead of hallucinated coordinates.

  Interactable Components (useTamboV1ComponentState). Two components use Tambo's bidirectional state sync. ApprovalGate syncs a decision state (pending
  → approved/denied) — when the operator clicks Approve, Tambo's backend sees the state change and our app automatically sends a follow-up prompt so the
   AI acknowledges the decision and renders the next operational panel. SystemsConsole does the same with an overrideStatus state (idle → authorized).
  This creates a genuine human-in-the-loop control flow where the AI adapts its behavior based on operator decisions.

  Context Helpers. We provide three contextHelpers to TamboV1Provider: a missionPlaybook (known assets, incident timeline, response style rules,
  guardrails), a missionSnapshot (current tick, active scenario, highest-risk asset), and liveSpaceWeather (real-time NOAA Kp index and geomagnetic
  scale data). These give the AI persistent situational awareness without stuffing the prompt.

  Suggestions (useTamboV1Suggestions). After each AI response, Tambo generates up to 3 contextual follow-up suggestions rendered as clickable chips.
  Clicking one calls accept({ suggestion, shouldSubmit: true }) to auto-submit, guiding operators toward logical next actions.

  Voice Input (useTamboVoice). Operators can speak mission events instead of typing. startRecording/stopRecording captures audio, Tambo transcribes it,
  and the transcript populates the input field — critical for hands-free mission control scenarios.

  Thread Management. We use useTamboV1() for full thread access: messages for the conversation thread view, startNewThread for resetting context,
  currentThreadId for display, cancelRun for aborting in-flight responses, and isStreaming/isIdle for UI state gating (disabling buttons during
  streaming, locking interactable components until the AI finishes).

  In total, we use 11 Tambo SDK primitives: TamboV1Provider, useTamboV1, useTamboV1ThreadInput, useTamboV1ComponentState, useTamboV1Suggestions,
  useTamboVoice, defineTool, TamboComponent registration, contextHelpers, renderedComponent rendering, and thread lifecycle management.

## Architecture

- **Frontend**: Next.js App Router + React + TypeScript
- **UI Motion**: Framer Motion
- **Validation**: Zod schemas for component props/state contracts
- **State Flow**:
  - Tool outputs + prompt context -> generated component
  - Operator interaction -> synced component state
  - Synced state -> next AI step + next generated component

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure env

Create `.env.local`:

```bash
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key_here
NEXT_PUBLIC_TAMBO_USER_KEY=orbital-operator
```

Notes:

- Demo mode works without an API key.
- AI mode requires a valid `NEXT_PUBLIC_TAMBO_API_KEY`.
- Keep `NEXT_PUBLIC_TAMBO_USER_KEY` set to avoid context identifier errors.

### 3) Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Recommended Demo Flow

1. `New Thread`
2. `1. Orbital Hazard Map`
3. `2. Burn Approval` -> click `Approve`
4. `3. Mission Checklist` -> check tasks
5. `4. Ground Systems Alert` -> click `Authorize Ground Override`
6. Open `Tool Trace` to show explainability

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint checks

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Tambo React SDK (`@tambo-ai/react`)
- Zod
- Framer Motion
- Lucide React
