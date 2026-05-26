import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ListNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="list"
      icon={<ListChecks className="w-3.5 h-3.5" />}
      label={t("nodeList")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      {data.listHeader && <p className="truncate font-bold text-[11px]">{data.listHeader}</p>}
      <p className="truncate">{data.listBody || t("listBodyHint")}</p>
      {data.listFooter && <p className="truncate text-[10px] text-gray-400">{data.listFooter}</p>}
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
        <span>▼</span>
        <span className="truncate">{data.listButtonText || t("listButtonTextHint")}</span>
      </div>
      {data.listDataVariable && (
        <p className="truncate text-[10px] text-gray-500 mt-1">
          {`{{${data.listDataVariable}}}`}
        </p>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ListNode);
