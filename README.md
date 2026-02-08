# A.T.C. — Agent Traffic Control

A **Generative Mission Control** dashboard built with Next.js where the UI reshapes itself based on AI-driven decisions. Powered by **Tambo** as the generative UI decision engine.

## How It Works

1. **Tambo** analyzes agent events described in natural language
2. Tambo selects which UI panel to render and generates structured props
3. The output is validated against a **Zod** discriminated union schema
4. **MissionControl** renders the appropriate panel with animated transitions

### UI Panels

| Panel | Purpose |
|-------|---------|
| **CalmDashboard** | Default view — all systems nominal |
| **FleetMap** | Geographic hazard detection and route visualization |
| **SystemsConsole** | System metrics with suggested remediation commands |
| **ApprovalGate** | Human-in-the-loop authorization for risky agent actions |

### Schema-Driven & Validated

All AI output is validated with Zod before rendering. If Tambo returns invalid JSON, the app falls back to CalmDashboard — it never crashes on bad model output.

### Human-in-the-Loop

The **ApprovalGate** panel enables human authorization for high-risk agent actions, with risk-level badges and approve/deny controls.

## Getting Started

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_TAMBO_API_KEY=your_tambo_api_key_here
NEXT_PUBLIC_TAMBO_USER_KEY=orbital-operator
```

The app works without an API key — demo mode is always available. AI mode requires a valid Tambo API key.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Use **Calm / Map / Auth / Sys** buttons to browse demo panels
- Click **AI** to enter AI mode, then describe an agent event (e.g., "Truck-01 hazard hurricane near NYC")

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Tambo** (`@tambo-ai/react`) — Generative UI decision engine
- **Zod** — Schema validation
- **Framer Motion** — Panel transitions
- **Lucide React** — Icons
