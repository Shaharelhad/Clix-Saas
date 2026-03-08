import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ConditionNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="condition"
      icon={<GitBranch className="w-3.5 h-3.5" />}
      label={t("nodeCondition")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={[
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ]}
    >
      {data.variable ? (
        <p className="truncate">
          {data.variable} {data.operator} {data.value}
        </p>
      ) : (
        <p className="text-[#A39B90]">{t("conditionVariable")}</p>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ConditionNode);
