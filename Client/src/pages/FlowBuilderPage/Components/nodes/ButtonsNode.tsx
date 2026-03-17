import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { SquareMousePointer } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ButtonsNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");
  const buttons = data.buttons ?? [];
  const nodeWidth = buttons.length > 3 ? Math.max(240, buttons.length * 40 + 60) : undefined;

  return (
    <FlowNodeWrapper
      type="buttons"
      icon={<SquareMousePointer className="w-3.5 h-3.5" />}
      label={t("nodeButtons")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={buttons.map((b) => ({ id: `btn-${b.id}`, label: b.label }))}
      width={nodeWidth}
    >
      {data.buttonHeader && <p className="truncate font-bold text-[11px]">{data.buttonHeader}</p>}
      <p className="truncate">{data.message || t("messageHint")}</p>
      {data.buttonFooter && <p className="truncate text-[10px] text-gray-400">{data.buttonFooter}</p>}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {buttons.map((b) => (
            <span
              key={b.id}
              className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded"
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ButtonsNode);
