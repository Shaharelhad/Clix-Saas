import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function DelayNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="delay"
      icon={<Clock className="w-3.5 h-3.5" />}
      label={t("nodeDelay")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p>{data.delayMinutes ?? 5} {t("delayMinutes").toLowerCase()}</p>
    </FlowNodeWrapper>
  );
}

export default memo(DelayNode);
