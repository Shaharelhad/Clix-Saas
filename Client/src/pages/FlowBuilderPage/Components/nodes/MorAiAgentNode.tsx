import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function MorAiAgentNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="mor_ai_agent"
      icon={<Sparkles className="w-3.5 h-3.5" />}
      label={t("nodeMorAiAgent")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(
          new CustomEvent("flow:delete-node", { detail: id })
        );
      }}
    >
      <div className="flex flex-wrap gap-1">
        {(["save_lead", "update_lead_status", "mark_paid"] as const).map((tool) => (
          <span
            key={tool}
            className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
          >
            {tool}
          </span>
        ))}
      </div>
      {data.systemPrompt && (
        <span className="text-[10px] text-purple-400 mt-1 block truncate max-w-[180px]">
          {data.systemPrompt.substring(0, 50)}...
        </span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(MorAiAgentNode);
