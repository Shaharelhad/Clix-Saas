import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function TextNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  const sourceHandles = data.yesNoMode
    ? [
        { id: "yes", label: t("yesHandle") },
        { id: "no", label: t("noHandle") },
      ]
    : undefined;

  return (
    <FlowNodeWrapper
      type="text"
      icon={<MessageSquare className="w-3.5 h-3.5" />}
      label={t("nodeText")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={sourceHandles}
    >
      <p className="truncate">{data.message || t("messageHint")}</p>
      {data.yesNoMode && (
        <span className="text-[10px] text-green-500 mt-1 block">{t("yesNoMode")}</span>
      )}
      {!data.yesNoMode && data.continueAuto && (
        <span className="text-[10px] text-blue-500 mt-1 block">{t("continueAuto")}</span>
      )}
      {data.allowSkip && !data.yesNoMode && !data.continueAuto && data.expectedReply && (
        <span className="text-[10px] text-cyan-500 mt-1 block">{t("allowSkipBadge")}</span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(TextNode);
