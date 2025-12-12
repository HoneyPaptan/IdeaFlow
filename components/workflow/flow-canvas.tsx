"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge as FlowEdge,
  Node as FlowNode,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { CustomNode } from "./custom-node";
import type { WorkflowGraph } from "./types";

type FlowCanvasProps = {
  graph: WorkflowGraph;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onEdgeCreate?: (source: string, target: string) => void;
};

const nodeTypes = {
  custom: CustomNode,
};

const buildNodes = (
  graph: WorkflowGraph,
  existingNodes?: FlowNode[],
  onDeleteNode?: (nodeId: string) => void,
): FlowNode[] => {
  const nodeCount = graph.nodes.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodeCount)));

  // Create a map of existing node positions
  const positionMap = new Map<string, { x: number; y: number }>();
  if (existingNodes) {
    existingNodes.forEach((node) => {
      positionMap.set(node.id, node.position);
    });
  }

  return graph.nodes.map((node, idx) => {
    // Use existing position if available, otherwise calculate new position
    const existingPosition = positionMap.get(node.id);
    
    let position: { x: number; y: number };
    if (existingPosition) {
      position = existingPosition;
    } else {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const xOffset = row % 2 === 1 ? 140 : 0;
      position = {
        x: col * 320 + xOffset,
        y: row * 180,
      };
    }

    return {
      id: node.id,
      type: "custom",
      position,
      data: {
        label: node.title,
        description: node.detail,
        category: node.category,
        status: node.status,
        tags: node.tags,
        onDelete: onDeleteNode,
      },
      draggable: true,
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

type FlowInnerProps = {
  graph: WorkflowGraph;
  onNodeClick?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onEdgeCreate?: (source: string, target: string) => void;
};

function FlowInner({ graph, onNodeClick, onDeleteNode, onEdgeCreate }: FlowInnerProps) {
  const initialNodes = useMemo(() => buildNodes(graph, undefined, onDeleteNode), [graph, onDeleteNode]);
  const initialEdges = useMemo(() => buildEdges(graph), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();
  
  // Track previous node count to detect structural changes
  const prevNodeCountRef = useRef(graph.nodes.length);
  const isInitialMount = useRef(true);

  // Sync when graph changes externally - preserve positions!
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentNodeCount = graph.nodes.length;
    const nodeCountChanged = currentNodeCount !== prevNodeCountRef.current;
    
    setNodes((currentNodes) => {
      // Build new nodes, preserving existing positions
      return buildNodes(graph, currentNodes, onDeleteNode);
    });
    
    setEdges(buildEdges(graph));

    // Only fit view if nodes were added/removed
    if (nodeCountChanged) {
      prevNodeCountRef.current = currentNodeCount;
      setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    }
  }, [graph, setNodes, setEdges, fitView, onDeleteNode]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        setEdges((eds) => addEdge({ ...params, animated: true }, eds));
        onEdgeCreate?.(params.source, params.target);
      }
    },
    [setEdges, onEdgeCreate]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
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
      zoomOnScroll
      zoomOnPinch
      panOnScroll={false}
      panOnDrag
      selectionOnDrag={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: "#000000" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#27272a"
      />
      <Controls
        position="bottom-right"
        showZoom
        showFitView
        showInteractive={false}
        className="!bg-zinc-900/90 !border-zinc-800 !rounded-lg !shadow-xl [&>button]:!bg-transparent [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-800 [&>button:hover]:!text-zinc-200"
      />
    </ReactFlow>
  );
}

export function FlowCanvas({ graph, className, onNodeClick, onDeleteNode, onEdgeCreate }: FlowCanvasProps) {
  return (
    <div className={cn("size-full", className)}>
      <ReactFlowProvider>
        <FlowInner graph={graph} onNodeClick={onNodeClick} onDeleteNode={onDeleteNode} onEdgeCreate={onEdgeCreate} />
      </ReactFlowProvider>
    </div>
  );
}
