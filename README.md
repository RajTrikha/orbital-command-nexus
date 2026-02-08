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

This app uses Tambo as the decision and rendering runtime, not just as chat:

- Registers components in `TamboV1Provider` for model-driven panel selection
- Registers tools for telemetry and hazard grounding
- Uses `useTamboV1ComponentState` for interactable state sync back to AI
- Uses Tambo thread hooks for input, streaming, suggestions, and voice
- Includes a tool-to-UI trace to explain why each panel was rendered

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
