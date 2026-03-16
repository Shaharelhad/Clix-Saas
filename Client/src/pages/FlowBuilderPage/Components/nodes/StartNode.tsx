import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function StartNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");
  const isDisabled = data.disabled === true;
  const keywords = data.triggerKeywords?.length
    ? data.triggerKeywords.filter((k) => typeof k === "string" && k.trim())
    : data.triggerText?.trim() ? [data.triggerText] : [];
  const displayText = keywords.length > 0
    ? keywords[0] + (keywords.length > 1 ? ` +${keywords.length - 1}` : "")
    : t("triggerTextHint");

  return (
    <FlowNodeWrapper
      type="start"
      icon={<MessageSquareText className="w-3.5 h-3.5" />}
      label={data.label || t("nodeStart")}
      selected={selected}
      hideTarget
      disabled={isDisabled}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className={`truncate ${isDisabled ? "line-through" : ""}`}>
        {displayText}
      </p>
      {isDisabled && (
        <span className="text-[10px] text-amber-500 mt-0.5 block">{t("startNodeDisabled")}</span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(StartNode);
