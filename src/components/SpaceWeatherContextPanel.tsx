"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatKpLevel,
  getLiveSpaceWeatherSnapshot,
  type LiveSpaceWeatherSnapshot,
} from "@/lib/spaceWeather";

const inspirationEvents = [
  {
    date: "February 2-3, 2022",
    title: "NOAA issued G2 then G1 geomagnetic storm watches",
    summary:
      "A CME-driven forecast window highlighted how quickly LEO mission risk can escalate.",
    links: [
      {
        label: "NOAA SWPC bulletin",
        href: "https://www.swpc.noaa.gov/news/geomagnetic-storm-conditions-likely-2-3-february-2022",
      },
    ],
  },
  {
    date: "May 10-12, 2024",
    title: "G5 extreme storm reached Earth",
    summary:
      "NOAA/NASA documented the strongest geomagnetic storm in over two decades with global operational impacts.",
    links: [
      {
        label: "NOAA SWPC G4/G5 update",
        href: "https://www.swpc.noaa.gov/news/severe-and-extreme-g4-g5-geomagnetic-storms-likely-12-may-2024",
      },
      {
        label: "NASA storm analysis",
        href: "https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/",
      },
    ],
  },
  {
    date: "February 6, 2025",
    title: "NASA reported new temporary radiation belts",
    summary:
      "Post-storm science showed long-lived energetic particle belts relevant to spacecraft safety planning.",
    links: [
      {
        label: "NASA finding",
        href: "https://science.nasa.gov/science-research/heliophysics/nasa-cubesat-finds-new-radiation-belts-after-may-2024-solar-storm/",
      },
    ],
  },
] as const;

export default function SpaceWeatherContextPanel() {
  const [snapshot, setSnapshot] = useState<LiveSpaceWeatherSnapshot>({
    kp: null,
    kpTime: null,
    gNow: null,
    gNowText: null,
    gForecast: null,
    gForecastText: null,
    fetchedAt: new Date().toISOString(),
    source: "fallback",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await getLiveSpaceWeatherSnapshot();
      if (!cancelled) {
        setSnapshot(next);
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 180000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const kpLabel = useMemo(() => formatKpLevel(snapshot.kp), [snapshot.kp]);

  return (
    <section className="mt-8 rounded-2xl border border-cyan-700/40 bg-gradient-to-b from-cyan-950/30 to-zinc-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">
            Narrative Foundation
          </p>
          <h3 className="mt-1 text-lg font-semibold text-cyan-100">
            Inspired by Real Space-Weather Events
          </h3>
          <p className="mt-1 text-sm text-zinc-300">
            Mission storyline mirrors documented NOAA/NASA storm patterns while keeping
            operational UI behavior simulated and deterministic for demos.
          </p>
        </div>
        <div className="rounded-lg border border-cyan-700/40 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
          <p>
            Source feeds: <span className="text-cyan-200">NOAA SWPC + NASA</span>
          </p>
          <p className="mt-1 text-zinc-400">
            SWPC updated: {snapshot.kpTime ?? "unavailable"}
          </p>
          <p className="mt-1 text-zinc-500">mode: {snapshot.source}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {inspirationEvents.map((event) => (
            <article
              key={event.date}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
            >
              <p className="text-[11px] uppercase tracking-widest text-cyan-300/80">
                {event.date}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{event.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{event.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {event.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-cyan-700/50 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-200 transition-colors hover:border-cyan-500"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-widest text-zinc-400">
            Live NOAA Snapshot
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Kp Index</p>
              <p className="mt-1 text-lg font-bold text-cyan-200">
                {snapshot.kp !== null ? snapshot.kp.toFixed(2) : "--"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{kpLabel}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Current G</p>
              <p className="mt-1 text-lg font-bold text-cyan-200">
                {snapshot.gNow !== null ? `G${snapshot.gNow}` : "--"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                {snapshot.gNowText ?? "unknown"}
              </p>
            </div>
            <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Next Forecast Window</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">
                {snapshot.gForecast !== null ? `G${snapshot.gForecast}` : "--"}{" "}
                {snapshot.gForecastText ?? "unknown"}
              </p>
            </div>
          </div>

          {snapshot.error && (
            <p className="mt-3 text-xs text-yellow-400">
              Live feed unavailable: {snapshot.error}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Operational visuals are intentionally simulated for deterministic demos; this panel
            grounds the narrative in real space-weather context.
          </p>
        </div>
      </div>
    </section>
  );
}
