import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function OpenBotNode({ selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="open_bot"
      icon={<Bot className="w-3.5 h-3.5" />}
      label={t("nodeOpenBot")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={[]}
    >
      <p className="text-violet-600">{t("openBotDesc")}</p>
    </FlowNodeWrapper>
  );
}

export default memo(OpenBotNode);
