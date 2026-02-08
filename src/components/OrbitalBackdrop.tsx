"use client";

import { useEffect } from "react";

export default function OrbitalBackdrop() {
  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const x = `${(event.clientX / window.innerWidth) * 100}%`;
      const y = `${(event.clientY / window.innerHeight) * 100}%`;
      document.documentElement.style.setProperty("--orbital-mouse-x", x);
      document.documentElement.style.setProperty("--orbital-mouse-y", y);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="orbital-gradient" />
      <div className="orbital-stars" />
      <div className="orbital-grid" />
      <div className="orbital-ring orbital-ring-a" />
      <div className="orbital-ring orbital-ring-b" />
      <div className="orbital-satellite orbital-satellite-a" />
      <div className="orbital-satellite orbital-satellite-b" />
    </div>
  );
}

