import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { NODE_COLORS, type FlowNodeType } from "@/types/flow";

interface FlowNodeWrapperProps {
  type: FlowNodeType;
  icon: ReactNode;
  label: string;
  children: ReactNode;
  selected?: boolean;
  onDelete?: () => void;
  sourceHandles?: { id: string; label: string }[];
  hideTarget?: boolean;
  width?: number;
  disabled?: boolean;
}

export default function FlowNodeWrapper({
  type,
  icon,
  label,
  children,
  selected,
  onDelete,
  sourceHandles,
  hideTarget,
  width,
  disabled,
}: FlowNodeWrapperProps) {
  const color = NODE_COLORS[type];

  return (
    <div
      className={`relative overflow-visible bg-white rounded-xl shadow-md border-2 min-w-[180px] transition-shadow ${
        width ? "" : "max-w-[240px] "
      }${selected ? "shadow-lg ring-2 ring-[#FF7E47]/40" : ""}${disabled ? " opacity-50" : ""}`}
      style={{ borderColor: selected ? "#FF7E47" : `${color}40`, ...(width ? { width } : {}) }}
    >
      {/* Target handle */}
      {!hideTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-white !bg-gray-400"
        />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-[10px]"
        style={{ backgroundColor: `${color}15` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-bold text-[#2D2A26]">{label}</span>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-100 text-[#A39B90] hover:text-red-500 transition-colors cursor-pointer"
            aria-label="Delete node"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 text-xs text-[#7A7267]">{children}</div>

      {/* Source handles */}
      {sourceHandles ? (
        sourceHandles.map((handle, i) => (
          <div
            key={handle.id}
            className="group/tip absolute overflow-visible"
            style={{
              bottom: 0,
              left: `${((i + 1) / (sourceHandles.length + 1)) * 100}%`,
              transform: "translate(-50%, 50%)",
              width: 12,
              height: 12,
            }}
          >
            <Handle
              type="source"
              position={Position.Bottom}
              id={handle.id}
              className="!w-3 !h-3 !border-2 !border-white !relative !transform-none !left-0 !top-0"
              style={{ backgroundColor: color }}
            />
            <div className="pointer-events-none absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium leading-none whitespace-nowrap bg-[#2D2A26] text-[#EDE6DD] shadow-[0_2px_8px_rgba(45,42,38,0.25)] opacity-0 scale-95 transition-all duration-150 ease-out group-hover/tip:opacity-100 group-hover/tip:scale-100 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[#2D2A26]">
              {handle.label}
            </div>
          </div>
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}
