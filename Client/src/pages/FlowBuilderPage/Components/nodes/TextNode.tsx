import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function TextNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="text"
      icon={<MessageSquare className="w-3.5 h-3.5" />}
      label={t("nodeText")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="truncate">{data.message || t("messageHint")}</p>
      {data.continueAuto && (
        <span className="text-[10px] text-blue-500 mt-1 block">{t("continueAuto")}</span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(TextNode);
