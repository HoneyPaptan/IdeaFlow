"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BarChart3,
  Box,
  CheckCircle2,
  Circle,
  GitBranch,
  Loader2,
  MessageSquare,
  XCircle,
  Zap,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkflowCategory, WorkflowNodeStatus } from "./types";

type CustomNodeData = {
  label: string;
  description?: string;
  category?: WorkflowCategory;
  status?: WorkflowNodeStatus;
  tags?: string[];
  onDelete?: (id: string) => void;
};

const categoryConfig: Record<
  WorkflowCategory,
  { icon: typeof Box; color: string; bg: string }
> = {
  collect: {
    icon: Box,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  analyze: {
    icon: BarChart3,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  execute: {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  notify: {
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  decision: {
    icon: GitBranch,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
};

const statusConfig: Record<
  WorkflowNodeStatus,
  { icon: typeof Circle; color: string; animate?: boolean }
> = {
  pending: { icon: Circle, color: "text-zinc-500" },
  running: { icon: Loader2, color: "text-sky-400", animate: true },
  done: { icon: CheckCircle2, color: "text-emerald-400" },
  blocked: { icon: XCircle, color: "text-rose-400" },
};

function CustomNodeComponent({ id, data, selected }: NodeProps<CustomNodeData>) {
  const category = data.category ?? "execute";
  const status = data.status ?? "pending";

  const catConfig = categoryConfig[category];
  const statConfig = statusConfig[status];

  const CategoryIcon = catConfig.icon;
  const StatusIcon = statConfig.icon;

  return (
    <div
      className={cn(
        "group relative min-w-[200px] max-w-[280px] rounded-xl border bg-zinc-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-sm transition-all duration-200",
        catConfig.bg,
        selected && "ring-2 ring-white/20 ring-offset-2 ring-offset-black"
      )}
    >
      {data.onDelete && (
        <button
          aria-label="Delete node"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          className="absolute left-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300"
        >
          <X className="size-3" />
        </button>
      )}
      {/* Status indicator */}
      <div className="absolute -right-1 -top-1">
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950",
            statConfig.color
          )}
        >
          <StatusIcon
            className={cn("size-3.5", statConfig.animate && "animate-spin")}
          />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900",
            catConfig.color
          )}
        >
          <CategoryIcon className="size-4" />
        </div>
        <div className="flex-1 overflow-hidden">
          <h3 className="truncate text-sm font-medium text-zinc-100">
            {data.label}
          </h3>
          {data.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {data.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-3 !rounded-full !border-2 !border-zinc-700 !bg-zinc-900 transition-colors group-hover:!border-zinc-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-3 !rounded-full !border-2 !border-zinc-700 !bg-zinc-900 transition-colors group-hover:!border-zinc-500"
      />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);

