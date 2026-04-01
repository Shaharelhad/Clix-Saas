import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function NotionAiAgentNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  const tools = data.agentTools;
  const enabledTools: string[] = [];
  if (tools?.updateNotion) enabledTools.push("Notion");
  if (tools?.bookEventDate?.enabled) enabledTools.push(t("notionAgentToolBookEvent"));
  if (tools?.calendarCheck?.enabled) enabledTools.push(t("notionAgentToolCalendar"));
  if (tools?.findSlots?.enabled) enabledTools.push(t("notionAgentToolSlots"));
  if (tools?.createMeeting?.enabled) enabledTools.push(t("notionAgentToolMeeting"));

  return (
    <FlowNodeWrapper
      type="notion_ai_agent"
      icon={<Bot className="w-3.5 h-3.5" />}
      label={t("nodeNotionAiAgent")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(
          new CustomEvent("flow:delete-node", { detail: id })
        );
      }}
    >
      {enabledTools.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {enabledTools.map((tool) => (
            <span
              key={tool}
              className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded"
            >
              {tool}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-[#A39B90] italic">
          {t("notionAgentNoTools")}
        </span>
      )}
      {data.agentSystemPrompt && (
        <span className="text-[10px] text-emerald-400 mt-1 block truncate max-w-[180px]">
          {data.agentSystemPrompt.substring(0, 50)}...
        </span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(NotionAiAgentNode);
