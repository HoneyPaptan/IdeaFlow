"use client";

import { useCallback, useMemo } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge as FlowEdge,
  Node as FlowNode,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { CustomNode } from "./custom-node";
import type { WorkflowGraph } from "./types";

type FlowCanvasProps = {
  graph: WorkflowGraph;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
  onGraphChange?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
};

const nodeTypes = {
  custom: CustomNode,
};

const buildNodes = (graph: WorkflowGraph): FlowNode[] => {
  const nodeCount = graph.nodes.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodeCount)));

  return graph.nodes.map((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    // Offset alternating rows for visual interest
    const xOffset = row % 2 === 1 ? 140 : 0;

    return {
      id: node.id,
      type: "custom",
      position: {
        x: col * 320 + xOffset,
        y: row * 180,
      },
      data: {
        label: node.title,
        description: node.detail,
        category: node.category,
        status: node.status,
        tags: node.tags,
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
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#52525b",
      strokeWidth: 2,
    },
    labelStyle: {
      fill: "#a1a1aa",
      fontSize: 11,
      fontWeight: 500,
    },
    labelBgStyle: {
      fill: "#18181b",
      fillOpacity: 0.9,
    },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
  }));

export function FlowCanvas({
  graph,
  className,
  onNodeClick,
  onGraphChange,
}: FlowCanvasProps) {
  const initialNodes = useMemo(() => buildNodes(graph), [graph]);
  const initialEdges = useMemo(() => buildEdges(graph), [graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  // Sync external graph changes
  useMemo(() => {
    const newNodes = buildNodes(graph);
    const newEdges = buildEdges(graph);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [graph, setNodes, setEdges]);

  return (
    <div className={cn("size-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.2,
        }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#27272a"
          className="bg-black"
        />
        <Controls
          position="bottom-right"
          showZoom
          showFitView
          showInteractive={false}
          className="!bg-zinc-900/90 !border-zinc-800 !rounded-lg !shadow-xl [&>button]:!bg-transparent [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-800 [&>button:hover]:!text-zinc-200"
        />
      </ReactFlow>
    </div>
  );
}
