export type SwpcScaleEntry = {
  DateStamp?: string;
  TimeStamp?: string;
  G?: {
    Scale?: string | null;
    Text?: string | null;
  };
};

type SwpcScalesResponse = Record<string, SwpcScaleEntry>;
type KpRow = [string, string, string?, string?];

export type LiveSpaceWeatherSnapshot = {
  kp: number | null;
  kpTime: string | null;
  gNow: string | null;
  gNowText: string | null;
  gForecast: string | null;
  gForecastText: string | null;
  fetchedAt: string;
  source: "live" | "cache" | "fallback";
  error?: string;
};

const SWPC_SCALES_URL = "https://services.swpc.noaa.gov/products/noaa-scales.json";
const SWPC_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const CACHE_TTL_MS = 180000;

let cache: LiveSpaceWeatherSnapshot | null = null;
let cacheTime = 0;
let inflight: Promise<LiveSpaceWeatherSnapshot> | null = null;

function emptySnapshot(source: LiveSpaceWeatherSnapshot["source"], error?: string): LiveSpaceWeatherSnapshot {
  return {
    kp: null,
    kpTime: null,
    gNow: null,
    gNowText: null,
    gForecast: null,
    gForecastText: null,
    fetchedAt: new Date().toISOString(),
    source,
    error,
  };
}

function parseSnapshot(scales: SwpcScalesResponse, kpMatrix: unknown): LiveSpaceWeatherSnapshot {
  const kpRows = Array.isArray(kpMatrix)
    ? (kpMatrix as unknown[]).filter(
        (row): row is KpRow =>
          Array.isArray(row) &&
          row.length >= 2 &&
          typeof row[0] === "string" &&
          typeof row[1] === "string"
      )
    : [];

  const kpDataRows = kpRows.slice(1);
  const latestRow = kpDataRows[kpDataRows.length - 1];

  const kpValue = latestRow ? Number.parseFloat(latestRow[1]) : Number.NaN;
  const kp = Number.isFinite(kpValue) ? kpValue : null;

  return {
    kp,
    kpTime: latestRow?.[0] ?? null,
    gNow: scales?.["0"]?.G?.Scale ?? null,
    gNowText: scales?.["0"]?.G?.Text ?? null,
    gForecast: scales?.["1"]?.G?.Scale ?? null,
    gForecastText: scales?.["1"]?.G?.Text ?? null,
    fetchedAt: new Date().toISOString(),
    source: "live",
  };
}

async function fetchSpaceWeatherSnapshot(): Promise<LiveSpaceWeatherSnapshot> {
  const [scalesRes, kpRes] = await Promise.all([
    fetch(SWPC_SCALES_URL, { cache: "no-store" }),
    fetch(SWPC_KP_URL, { cache: "no-store" }),
  ]);

  if (!scalesRes.ok || !kpRes.ok) {
    throw new Error("Unable to reach SWPC feed");
  }

  const scales = (await scalesRes.json()) as SwpcScalesResponse;
  const kpMatrix = (await kpRes.json()) as unknown;
  return parseSnapshot(scales, kpMatrix);
}

export async function getLiveSpaceWeatherSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<LiveSpaceWeatherSnapshot> {
  const now = Date.now();
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetchSpaceWeatherSnapshot()
    .then((snapshot) => {
      cache = snapshot;
      cacheTime = Date.now();
      return snapshot;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unable to load SWPC feed";
      if (cache) {
        return {
          ...cache,
          source: "cache",
          error: message,
        } satisfies LiveSpaceWeatherSnapshot;
      }
      return emptySnapshot("fallback", message);
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function formatKpLevel(kp: number | null): string {
  if (kp === null) return "unknown";
  if (kp >= 8) return "severe";
  if (kp >= 6) return "strong";
  if (kp >= 5) return "storm";
  if (kp >= 4) return "active";
  return "quiet";
}
