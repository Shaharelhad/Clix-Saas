import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { TextCursorInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function CollectInputNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="collect_input"
      icon={<TextCursorInput className="w-3.5 h-3.5" />}
      label={t("nodeCollectInput")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="truncate">{data.message || t("collectInputMessageHint")}</p>
      {data.variableName && (
        <span className="text-[10px] text-cyan-500 mt-1 block">
          {`{{${data.variableName}}}`}
        </span>
      )}
      {data.expectedAnswer && (
        <span className="text-[10px] text-orange-500 mt-1 block">{t("expectedAnswer")}</span>
      )}
      {data.allowSkip && (
        <span className="text-[10px] text-cyan-500 mt-1 block">{t("allowSkipBadge")}</span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(CollectInputNode);
