"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Edge as FlowEdge,
  MiniMap,
  Node as FlowNode,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { WorkflowGraph } from "./types";

type FlowCanvasProps = {
  graph: WorkflowGraph;
};

const statusColorMap: Record<string, string> = {
  pending: "rgba(255,255,255,0.08)",
  running: "rgba(59, 130, 246, 0.4)",
  done: "rgba(34, 197, 94, 0.4)",
  blocked: "rgba(239, 68, 68, 0.4)",
};

const buildNodes = (graph: WorkflowGraph): FlowNode[] => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(graph.nodes.length, 3))));
  return graph.nodes.map((node, idx) => {
    const column = idx % columns;
    const row = Math.floor(idx / columns);

    return {
      id: node.id,
      position: { x: column * 240, y: row * 160 },
      data: {
        label: node.title,
        description: node.detail,
      },
      style: {
        background: "linear-gradient(145deg, #0f0f10, #0b0b0d)",
        border: `1px solid ${statusColorMap[node.status] ?? statusColorMap.pending}`,
        color: "#f5f5f4",
        padding: 12,
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        fontSize: 13,
      },
    };
  });
};

const buildEdges = (graph: WorkflowGraph): FlowEdge[] =>
  graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.label === "branch" || edge.label === "follow",
    style: { stroke: "#52525b" },
    labelStyle: { fill: "#e4e4e7", fontSize: 12 },
  }));

export function FlowCanvas({ graph }: FlowCanvasProps) {
  const nodes = useMemo(() => buildNodes(graph), [graph]);
  const edges = useMemo(() => buildEdges(graph), [graph]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-zinc-900/70 to-black">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.5}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#27272a" />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(10,10,10,0.6)"
          nodeStrokeColor="#71717a"
          nodeColor="#18181b"
        />
        <Controls position="bottom-right" showZoom={false} />
      </ReactFlow>
    </div>
  );
}

