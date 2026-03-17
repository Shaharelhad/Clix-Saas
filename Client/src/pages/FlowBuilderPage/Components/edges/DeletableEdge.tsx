import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isLocked = data?.isLocked === true;

  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />
      {!isLocked && (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`flex items-center justify-center w-5 h-5 rounded-full bg-white border border-[#EDE6DD] text-[#A39B90] ${selected ? "opacity-100" : "opacity-0"} hover:opacity-100 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm cursor-pointer nopan nodrag`}
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("flow:delete-edge", { detail: id }),
              )
            }
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
