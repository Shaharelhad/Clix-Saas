import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function AiRouterNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  const intents = data.routerIntents ?? [];
  const definedIntents = intents.filter((i) => i.label.trim());

  // Build source handles: one per intent + fallback
  const sourceHandles = [
    ...definedIntents.map((intent) => ({
      id: `intent-${intent.id}`,
      label: intent.label,
    })),
    { id: "intent-fallback", label: t("aiRouterFallback") },
  ];

  return (
    <FlowNodeWrapper
      type="ai_router"
      icon={<Route className="w-3.5 h-3.5" />}
      label={t("nodeAiRouter")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(
          new CustomEvent("flow:delete-node", { detail: id })
        );
      }}
      sourceHandles={sourceHandles}
      width={Math.max(200, sourceHandles.length * 55)}
    >
      <div className="flex flex-wrap gap-1">
        {definedIntents.length > 0 ? (
          definedIntents.map((intent) => (
            <span
              key={intent.id}
              className="text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded"
            >
              {intent.label}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-[#A39B90] italic">
            {t("aiRouterNoIntents")}
          </span>
        )}
      </div>
      {data.routerContext && (
        <span className="text-[10px] text-orange-400 mt-1 block truncate">
          ctx: {data.routerContext}
        </span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(AiRouterNode);
