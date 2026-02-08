"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AgentUIPolicy } from "@/types/schema";
import CalmDashboard from "@/components/placeholders/CalmDashboard";
import FleetMapPlaceholder from "@/components/placeholders/FleetMapPlaceholder";
import SystemsConsolePlaceholder from "@/components/placeholders/SystemsConsolePlaceholder";
import ApprovalGatePlaceholder from "@/components/placeholders/ApprovalGatePlaceholder";

interface MissionControlProps {
  ui: AgentUIPolicy;
}

function PanelContent({ ui }: { ui: AgentUIPolicy }) {
  switch (ui.panel) {
    case "CalmDashboard":
      return <CalmDashboard {...ui.props} />;
    case "FleetMap":
      return <FleetMapPlaceholder {...ui.props} />;
    case "SystemsConsole":
      return <SystemsConsolePlaceholder {...ui.props} />;
    case "ApprovalGate":
      return <ApprovalGatePlaceholder {...ui.props} />;
  }
}

export default function MissionControl({ ui }: MissionControlProps) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(pointerY, [-0.5, 0.5], [5, -5]),
    { stiffness: 160, damping: 18, mass: 0.45 }
  );
  const rotateY = useSpring(
    useTransform(pointerX, [-0.5, 0.5], [-6, 6]),
    { stiffness: 160, damping: 18, mass: 0.45 }
  );

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(Math.max(-0.5, Math.min(0.5, nx)));
    pointerY.set(Math.max(-0.5, Math.min(0.5, ny)));
  }

  function handlePointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={ui.panel}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <motion.div
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={{ rotateX, rotateY, transformPerspective: 1100 }}
          className="origin-center will-change-transform"
        >
          <PanelContent ui={ui} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
