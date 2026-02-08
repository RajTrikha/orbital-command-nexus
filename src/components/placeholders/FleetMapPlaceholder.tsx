"use client";

interface FleetMapPlaceholderProps {
  assetId?: string;
  location?: { lat?: number; lng?: number };
  anomaly?: string;
  route?: { lat?: number; lng?: number }[];
}

type LatLng = { lat: number; lng: number };

type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const WORLD_BOUNDS: Bounds = {
  minLat: -90,
  maxLat: 90,
  minLng: -180,
  maxLng: 180,
};

const DEFAULT_LOCATION: LatLng = { lat: 18.742, lng: -43.128 };

const DEFAULT_ROUTE: LatLng[] = [
  { lat: 18.742, lng: -43.128 },
  { lat: 19.04, lng: -42.71 },
  { lat: 19.31, lng: -42.2 },
];

const GROUND_STATIONS: Array<{ id: string; label: string; location: LatLng }> = [
  { id: "ground-alpha", label: "Ground-Alpha", location: { lat: 25.84, lng: -17.93 } },
  { id: "ground-bravo", label: "Ground-Bravo", location: { lat: 29.55, lng: -95.1 } },
  { id: "ground-charlie", label: "Ground-Charlie", location: { lat: 13.03, lng: 77.59 } },
];

const CONTINENT_SHAPES: Array<{ id: string; points: LatLng[] }> = [
  {
    id: "north-america",
    points: [
      { lat: 72, lng: -165 },
      { lat: 61, lng: -145 },
      { lat: 52, lng: -132 },
      { lat: 41, lng: -125 },
      { lat: 24, lng: -106 },
      { lat: 17, lng: -95 },
      { lat: 10, lng: -84 },
      { lat: 24, lng: -78 },
      { lat: 35, lng: -80 },
      { lat: 46, lng: -67 },
      { lat: 59, lng: -72 },
      { lat: 71, lng: -95 },
    ],
  },
  {
    id: "south-america",
    points: [
      { lat: 12, lng: -81 },
      { lat: 6, lng: -77 },
      { lat: -3, lng: -73 },
      { lat: -15, lng: -69 },
      { lat: -30, lng: -64 },
      { lat: -50, lng: -70 },
      { lat: -54, lng: -75 },
      { lat: -32, lng: -76 },
      { lat: -10, lng: -79 },
    ],
  },
  {
    id: "africa-europe",
    points: [
      { lat: 59, lng: -10 },
      { lat: 53, lng: 3 },
      { lat: 52, lng: 20 },
      { lat: 45, lng: 31 },
      { lat: 37, lng: 28 },
      { lat: 32, lng: 22 },
      { lat: 20, lng: 16 },
      { lat: 7, lng: 9 },
      { lat: -9, lng: 12 },
      { lat: -27, lng: 20 },
      { lat: -35, lng: 19 },
      { lat: -34, lng: 10 },
      { lat: -20, lng: 2 },
      { lat: -2, lng: -4 },
      { lat: 13, lng: -7 },
      { lat: 31, lng: -11 },
      { lat: 44, lng: -4 },
    ],
  },
  {
    id: "asia",
    points: [
      { lat: 73, lng: 35 },
      { lat: 61, lng: 59 },
      { lat: 49, lng: 88 },
      { lat: 55, lng: 111 },
      { lat: 43, lng: 130 },
      { lat: 27, lng: 125 },
      { lat: 9, lng: 105 },
      { lat: 12, lng: 84 },
      { lat: 24, lng: 68 },
      { lat: 38, lng: 53 },
      { lat: 46, lng: 43 },
    ],
  },
  {
    id: "australia",
    points: [
      { lat: -12, lng: 113 },
      { lat: -19, lng: 128 },
      { lat: -25, lng: 139 },
      { lat: -31, lng: 151 },
      { lat: -39, lng: 147 },
      { lat: -44, lng: 133 },
      { lat: -34, lng: 116 },
      { lat: -22, lng: 112 },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLng(lng: number) {
  let value = lng;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toFiniteLocation(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.lat !== "number" || typeof obj.lng !== "number") return null;
  if (!Number.isFinite(obj.lat) || !Number.isFinite(obj.lng)) return null;
  return {
    lat: clamp(obj.lat, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat),
    lng: normalizeLng(obj.lng),
  };
}

function buildFocusBounds(points: LatLng[]): Bounds {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  let minLat = Math.min(...lats) - 4;
  let maxLat = Math.max(...lats) + 4;
  let minLng = Math.min(...lngs) - 6;
  let maxLng = Math.max(...lngs) + 6;

  const minLatSpan = 18;
  const minLngSpan = 26;

  if (maxLat - minLat < minLatSpan) {
    const centerLat = (maxLat + minLat) / 2;
    minLat = centerLat - minLatSpan / 2;
    maxLat = centerLat + minLatSpan / 2;
  }
  if (maxLng - minLng < minLngSpan) {
    const centerLng = (maxLng + minLng) / 2;
    minLng = centerLng - minLngSpan / 2;
    maxLng = centerLng + minLngSpan / 2;
  }

  minLat = clamp(minLat, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat);
  maxLat = clamp(maxLat, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat);
  minLng = clamp(minLng, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng);
  maxLng = clamp(maxLng, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng);

  if (maxLat - minLat < minLatSpan) {
    minLat = clamp(maxLat - minLatSpan, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat);
    maxLat = clamp(minLat + minLatSpan, WORLD_BOUNDS.minLat, WORLD_BOUNDS.maxLat);
  }
  if (maxLng - minLng < minLngSpan) {
    minLng = clamp(maxLng - minLngSpan, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng);
    maxLng = clamp(minLng + minLngSpan, WORLD_BOUNDS.minLng, WORLD_BOUNDS.maxLng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

function projectPoint(
  point: LatLng,
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
) {
  const x =
    padding + ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - padding * 2);
  const y =
    padding + ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * (height - padding * 2);
  return { x, y };
}

function pathFromPoints(
  points: LatLng[],
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => {
      const pos = projectPoint(point, bounds, width, height, padding);
      return `${index === 0 ? "M" : "L"}${pos.x.toFixed(2)} ${pos.y.toFixed(2)}`;
    })
    .join(" ");
}

function severityFromAnomaly(anomalyText: string) {
  const text = anomalyText.toLowerCase();
  if (
    text.includes("storm") ||
    text.includes("burst") ||
    text.includes("cme") ||
    text.includes("coronal") ||
    text.includes("leak")
  ) {
    return "high";
  }
  if (text.includes("spike") || text.includes("jitter") || text.includes("drift")) {
    return "medium";
  }
  return "low";
}

function regionLabel(location: LatLng) {
  if (location.lng >= -80 && location.lng <= -10 && location.lat >= -10 && location.lat <= 40) {
    return "Atlantic Relay Corridor";
  }
  if (location.lng >= 100 && location.lng <= 150 && location.lat >= -35 && location.lat <= 20) {
    return "Indo-Pacific Orbital Window";
  }
  if (location.lng >= -120 && location.lng <= -70 && location.lat >= 20 && location.lat <= 50) {
    return "North America Ground Arc";
  }
  return "Global Monitoring Sector";
}

function gridStep(span: number) {
  if (span <= 20) return 2;
  if (span <= 45) return 5;
  if (span <= 90) return 10;
  return 20;
}

function gridValues(min: number, max: number, step: number) {
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = first; value <= max; value += step) {
    values.push(Math.round(value * 1000) / 1000);
  }
  return values;
}

export default function FleetMapPlaceholder({
  assetId,
  location,
  anomaly,
  route,
}: FleetMapPlaceholderProps) {
  const safeLocation = toFiniteLocation(location) ?? DEFAULT_LOCATION;
  const routePoints = Array.isArray(route)
    ? route
        .map((point) => toFiniteLocation(point))
        .filter((point): point is LatLng => point !== null)
    : [];
  const safeRoute = routePoints.length > 0 ? routePoints : [safeLocation, ...DEFAULT_ROUTE];
  const safeAssetId = assetId?.trim() ? assetId : "Unknown Asset";
  const safeAnomaly = anomaly?.trim() ? anomaly : "unknown anomaly";
  const severity = severityFromAnomaly(safeAnomaly);
  const region = regionLabel(safeLocation);

  const anomalySeed = stableHash(`${safeAssetId}:${safeAnomaly}`);
  const hazardLocation = {
    lat: clamp(safeLocation.lat + ((anomalySeed % 100) / 100 - 0.5) * 7, -85, 85),
    lng: normalizeLng(safeLocation.lng + (((anomalySeed >> 4) % 100) / 100 - 0.5) * 9),
  };

  const focusBounds = buildFocusBounds([safeLocation, hazardLocation, ...safeRoute]);

  const mainWidth = 860;
  const mainHeight = 430;
  const mainPadding = 18;

  const routePath = pathFromPoints(safeRoute, focusBounds, mainWidth, mainHeight, mainPadding);
  const assetPos = projectPoint(safeLocation, focusBounds, mainWidth, mainHeight, mainPadding);
  const hazardPos = projectPoint(hazardLocation, focusBounds, mainWidth, mainHeight, mainPadding);

  const latStep = gridStep(focusBounds.maxLat - focusBounds.minLat);
  const lngStep = gridStep(focusBounds.maxLng - focusBounds.minLng);
  const latLines = gridValues(focusBounds.minLat, focusBounds.maxLat, latStep);
  const lngLines = gridValues(focusBounds.minLng, focusBounds.maxLng, lngStep);

  const hazardRadius = severity === "high" ? 24 : severity === "medium" ? 18 : 13;
  const hazardColor =
    severity === "high" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#22c55e";

  const nearestStations = [...GROUND_STATIONS]
    .map((station) => {
      const dLat = station.location.lat - safeLocation.lat;
      const dLng = station.location.lng - safeLocation.lng;
      return { station, distSq: dLat * dLat + dLng * dLng };
    })
    .sort((a, b) => a.distSq - b.distSq)
    .slice(0, 2)
    .map((entry) => entry.station);

  const insetWidth = 250;
  const insetHeight = 130;
  const insetPadding = 8;
  const worldRoute = pathFromPoints(
    safeRoute,
    WORLD_BOUNDS,
    insetWidth,
    insetHeight,
    insetPadding,
  );
  const insetAsset = projectPoint(
    safeLocation,
    WORLD_BOUNDS,
    insetWidth,
    insetHeight,
    insetPadding,
  );
  const insetHazard = projectPoint(
    hazardLocation,
    WORLD_BOUNDS,
    insetWidth,
    insetHeight,
    insetPadding,
  );

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">Orbital Track Map</h2>
          <p className="text-xs uppercase tracking-wider text-cyan-300/80">
            Regional Focus: {region}
          </p>
        </div>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          {safeAssetId}
        </span>
      </div>

      <div className="relative rounded-lg border border-zinc-800 bg-zinc-950 p-2">
        <svg viewBox={`0 0 ${mainWidth} ${mainHeight}`} className="h-[23rem] w-full">
          <defs>
            <linearGradient id="regionalOcean" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="50%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
            <radialGradient id="regionalGlow" cx="50%" cy="45%" r="72%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.2)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </radialGradient>
          </defs>

          <rect
            x={mainPadding}
            y={mainPadding}
            width={mainWidth - mainPadding * 2}
            height={mainHeight - mainPadding * 2}
            rx={14}
            fill="url(#regionalOcean)"
            stroke="rgba(56,189,248,0.35)"
            strokeWidth={1.2}
          />
          <rect
            x={mainPadding}
            y={mainPadding}
            width={mainWidth - mainPadding * 2}
            height={mainHeight - mainPadding * 2}
            rx={14}
            fill="url(#regionalGlow)"
          />

          {latLines.map((lat) => {
            const y = projectPoint(
              { lat, lng: focusBounds.minLng },
              focusBounds,
              mainWidth,
              mainHeight,
              mainPadding,
            ).y;
            return (
              <line
                key={`lat-${lat}`}
                x1={mainPadding}
                y1={y}
                x2={mainWidth - mainPadding}
                y2={y}
                stroke="rgba(125,211,252,0.16)"
                strokeWidth={0.8}
              />
            );
          })}

          {lngLines.map((lng) => {
            const x = projectPoint(
              { lat: focusBounds.minLat, lng },
              focusBounds,
              mainWidth,
              mainHeight,
              mainPadding,
            ).x;
            return (
              <line
                key={`lng-${lng}`}
                x1={x}
                y1={mainPadding}
                x2={x}
                y2={mainHeight - mainPadding}
                stroke="rgba(125,211,252,0.14)"
                strokeWidth={0.8}
              />
            );
          })}

          {nearestStations.map((station) => {
            const pos = projectPoint(
              station.location,
              focusBounds,
              mainWidth,
              mainHeight,
              mainPadding,
            );
            return (
              <g key={station.id}>
                <circle cx={pos.x} cy={pos.y} r={3.5} fill="#f8fafc" opacity={0.9} />
                <text
                  x={pos.x + 6}
                  y={pos.y - 6}
                  className="fill-slate-300 text-[9px] font-semibold"
                >
                  {station.label}
                </text>
              </g>
            );
          })}

          <path
            d={routePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.16}
          />
          <path
            d={routePath}
            fill="none"
            stroke="#67e8f9"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray="10 6"
          />

          <circle
            cx={hazardPos.x}
            cy={hazardPos.y}
            r={hazardRadius + 11}
            fill={hazardColor}
            opacity={0.08}
          />
          <circle
            cx={hazardPos.x}
            cy={hazardPos.y}
            r={hazardRadius}
            fill="none"
            stroke={hazardColor}
            strokeWidth={1.8}
          />
          <text
            x={hazardPos.x}
            y={hazardPos.y + hazardRadius + 15}
            textAnchor="middle"
            className="fill-red-300 text-[10px] font-bold"
          >
            {safeAnomaly.toUpperCase()}
          </text>

          <circle cx={assetPos.x} cy={assetPos.y} r={6} fill="#22c55e" />
          <circle
            cx={assetPos.x}
            cy={assetPos.y}
            r={12}
            fill="none"
            stroke="#22c55e"
            strokeWidth={1.4}
            opacity={0.65}
          />
          <text
            x={assetPos.x}
            y={assetPos.y - 14}
            textAnchor="middle"
            className="fill-green-300 text-[10px] font-semibold"
          >
            {safeAssetId}
          </text>
        </svg>

        <div className="pointer-events-none absolute right-3 top-3 w-[10.5rem] rounded-md border border-cyan-700/50 bg-zinc-950/90 p-1.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-300/90">
            Global Locator
          </p>
          <svg viewBox={`0 0 ${insetWidth} ${insetHeight}`} className="h-20 w-full">
            <rect
              x={insetPadding}
              y={insetPadding}
              width={insetWidth - insetPadding * 2}
              height={insetHeight - insetPadding * 2}
              rx={8}
              fill="#020617"
              stroke="rgba(125,211,252,0.4)"
              strokeWidth={0.9}
            />
            {CONTINENT_SHAPES.map((shape) => (
              <path
                key={shape.id}
                d={`${pathFromPoints(
                  shape.points,
                  WORLD_BOUNDS,
                  insetWidth,
                  insetHeight,
                  insetPadding,
                )} Z`}
                fill="rgba(30,41,59,0.72)"
                stroke="rgba(148,163,184,0.3)"
                strokeWidth={0.55}
              />
            ))}
            <path
              d={worldRoute}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={1.1}
              strokeDasharray="5 3"
              opacity={0.9}
            />
            <rect
              x={projectPoint(
                { lat: focusBounds.maxLat, lng: focusBounds.minLng },
                WORLD_BOUNDS,
                insetWidth,
                insetHeight,
                insetPadding,
              ).x}
              y={projectPoint(
                { lat: focusBounds.maxLat, lng: focusBounds.minLng },
                WORLD_BOUNDS,
                insetWidth,
                insetHeight,
                insetPadding,
              ).y}
              width={Math.max(
                6,
                projectPoint(
                  { lat: focusBounds.minLat, lng: focusBounds.maxLng },
                  WORLD_BOUNDS,
                  insetWidth,
                  insetHeight,
                  insetPadding,
                ).x -
                  projectPoint(
                    { lat: focusBounds.maxLat, lng: focusBounds.minLng },
                    WORLD_BOUNDS,
                    insetWidth,
                    insetHeight,
                    insetPadding,
                  ).x,
              )}
              height={Math.max(
                6,
                projectPoint(
                  { lat: focusBounds.minLat, lng: focusBounds.maxLng },
                  WORLD_BOUNDS,
                  insetWidth,
                  insetHeight,
                  insetPadding,
                ).y -
                  projectPoint(
                    { lat: focusBounds.maxLat, lng: focusBounds.minLng },
                    WORLD_BOUNDS,
                    insetWidth,
                    insetHeight,
                    insetPadding,
                  ).y,
              )}
              fill="none"
              stroke="rgba(56,189,248,0.95)"
              strokeWidth={1}
            />
            <circle cx={insetHazard.x} cy={insetHazard.y} r={2.6} fill={hazardColor} />
            <circle cx={insetAsset.x} cy={insetAsset.y} r={2.8} fill="#22c55e" />
          </svg>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Asset</p>
          <p className="mt-1 text-sm font-semibold text-zinc-200">{safeAssetId}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Anomaly</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              severity === "high"
                ? "text-red-400"
                : severity === "medium"
                  ? "text-amber-300"
                  : "text-emerald-300"
            }`}
          >
            {safeAnomaly}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Position</p>
          <p className="mt-1 text-xs font-mono text-zinc-400">
            {safeLocation.lat.toFixed(4)}, {safeLocation.lng.toFixed(4)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Window</p>
          <p className="mt-1 text-xs font-semibold text-cyan-200">
            {focusBounds.minLat.toFixed(1)} to {focusBounds.maxLat.toFixed(1)} lat
          </p>
          <p className="text-xs font-semibold text-cyan-200">
            {focusBounds.minLng.toFixed(1)} to {focusBounds.maxLng.toFixed(1)} lng
          </p>
        </div>
      </div>
    </div>
  );
}
