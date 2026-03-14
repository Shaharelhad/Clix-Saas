import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function StartNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="start"
      icon={<MessageSquareText className="w-3.5 h-3.5" />}
      label={t("nodeStart")}
      selected={selected}
      hideTarget
    >
      <p className="truncate">
        {data.triggerText || t("triggerTextHint")}
      </p>
    </FlowNodeWrapper>
  );
}

export default memo(StartNode);
