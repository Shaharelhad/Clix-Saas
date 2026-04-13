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

  // Prefer new multi-rule shape; fall back to legacy single-rule fields.
  const rules = data.conditionRules && data.conditionRules.length > 0
    ? data.conditionRules
    : data.conditionVariable
      ? [{
          id: "legacy",
          variable: data.conditionVariable,
          operator: data.conditionOperator ?? "equals",
          value: data.conditionValue,
        }]
      : [];

  const combinator = data.conditionCombinator ?? "AND";
  const configuredRules = rules.filter((r) => r.variable?.trim());

  // Format a single rule as an LTR-safe label.
  // The variable name and value can be Hebrew, so we render the operator/symbol
  // in its own LTR span to prevent the browser's bidi algorithm from reordering
  // adjacent ASCII characters into the Hebrew run.
  const formatRule = (rule: typeof rules[number]) => {
    const v = rule.variable.trim();
    const value = rule.value ?? "";
    switch (rule.operator) {
      case "exists":       return { v, op: t("conditionOpExists"),    val: null };
      case "not_exists":   return { v, op: t("conditionOpNotExists"), val: null };
      case "is_empty":     return { v, op: t("conditionOpIsEmpty"),    val: null };
      case "is_not_empty": return { v, op: t("conditionOpIsNotEmpty"), val: null };
      case "contains":     return { v, op: "∋", val: value || "?" };
      case "not_contains": return { v, op: "∌", val: value || "?" };
      case "greater_than": return { v, op: ">", val: value || "?" };
      case "less_than":    return { v, op: "<", val: value || "?" };
      case "not_equals":   return { v, op: "≠", val: value || "?" };
      default:             return { v, op: "=", val: value || "?" };
    }
  };

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
      width={220}
    >
      {configuredRules.length === 0 ? (
        <span className="text-[10px] text-[#A39B90] italic">
          {t("conditionNotConfigured")}
        </span>
      ) : (
        <div className="space-y-1" dir="ltr">
          {configuredRules.map((rule, idx) => {
            const { v, op, val } = formatRule(rule);
            return (
              <div key={rule.id} className="flex items-center gap-1 text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                <span dir="auto" className="font-bold">{v}</span>
                <span className="text-yellow-600">{op}</span>
                {val !== null && <span dir="auto">{val}</span>}
                {idx < configuredRules.length - 1 && (
                  <span className="ms-auto text-[9px] uppercase text-yellow-600 font-bold">{combinator}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ConditionNode);
