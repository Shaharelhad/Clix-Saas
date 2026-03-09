import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function FollowUpNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="follow_up"
      icon={<Bell className="w-3.5 h-3.5" />}
      label={t("nodeFollowUp")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="truncate">{data.followUpMessage || t("followUpMessageHint")}</p>
      <span className="text-[10px] text-pink-500 mt-1 block">
        {data.delayMinutes ?? 30} {t("delayMinutes").toLowerCase()}
      </span>
    </FlowNodeWrapper>
  );
}

export default memo(FollowUpNode);
