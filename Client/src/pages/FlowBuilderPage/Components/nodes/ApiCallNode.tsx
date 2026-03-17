import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import { findOperationById } from "@/types/integration-catalog";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ApiCallNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  // Operation mode: show service + operation label
  const operationDef =
    data.serviceType && data.operationId
      ? findOperationById(data.serviceType, data.operationId)
      : undefined;

  return (
    <FlowNodeWrapper
      type="api_call"
      icon={<Globe className="w-3.5 h-3.5" />}
      label={t("nodeApiCall")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
      sourceHandles={[
        { id: "success", label: t("apiCallHandleSuccess") },
        { id: "error", label: t("apiCallHandleError") },
      ]}
    >
      {operationDef ? (
        <>
          <span className="text-[10px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded inline-block">
            {t(operationDef.labelKey)}
          </span>
          {operationDef.responseMapping.length > 0 && (
            <span className="text-[10px] text-pink-500 mt-1 block">
              → {operationDef.responseMapping.map((m) => m.variableName).join(", ")}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">
              {data.method || "GET"}
            </span>
            <span className="truncate text-[11px]">{data.endpoint || "/..."}</span>
          </div>
          {(data.responseMapping?.length ?? 0) > 0 && (
            <span className="text-[10px] text-pink-500 mt-1 block">
              → {data.responseMapping!.length} {t("apiCallVariableName").toLowerCase()}(s)
            </span>
          )}
        </>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ApiCallNode);
