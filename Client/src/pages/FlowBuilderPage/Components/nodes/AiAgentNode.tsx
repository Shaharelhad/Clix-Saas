import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function AiAgentNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  const knowledgeBadges = [
    data.includeProducts !== false && t("aiProducts"),
    data.includeFaqs !== false && t("aiFaqs"),
    data.includeScrapedContent !== false && t("aiWebsite"),
  ].filter(Boolean);

  return (
    <FlowNodeWrapper
      type="ai_agent"
      icon={<Bot className="w-3.5 h-3.5" />}
      label={t("nodeAiAgent")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="text-[10px] text-violet-500 truncate">
        {data.model || "grok-4-fast"}
      </p>
      {data.systemPromptOverride && (
        <p className="truncate text-[10px] text-[#7A7267] mt-0.5">
          {data.systemPromptOverride}
        </p>
      )}
      {knowledgeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {knowledgeBadges.map((badge) => (
            <span
              key={badge as string}
              className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(AiAgentNode);
