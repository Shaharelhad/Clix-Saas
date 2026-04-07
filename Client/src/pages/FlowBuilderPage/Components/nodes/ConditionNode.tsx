import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ConditionNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  const sourceHandles = [
    { id: "true", label: t("conditionTrue") },
    { id: "false", label: t("conditionFalse") },
  ];

  const variable = data.conditionVariable?.trim();
  const operator = data.conditionOperator ?? "equals";
  const value = data.conditionValue?.trim();

  const summary = variable
    ? operator === "exists"
      ? `${variable} ${t("conditionOpExists")}`
      : operator === "not_exists"
        ? `${variable} ${t("conditionOpNotExists")}`
        : `${variable} ${operator === "not_equals" ? "≠" : "="} ${value || "?"}`
    : null;

  return (
    <FlowNodeWrapper
      type="condition"
      icon={<GitBranch className="w-3.5 h-3.5" />}
      label={t("nodeCondition")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={sourceHandles}
      width={200}
    >
      {summary ? (
        <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded inline-block">
          {summary}
        </span>
      ) : (
        <span className="text-[10px] text-[#A39B90] italic">
          {t("conditionNotConfigured")}
        </span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ConditionNode);
