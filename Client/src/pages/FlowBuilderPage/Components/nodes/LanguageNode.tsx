import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function LanguageNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="language"
      icon={<Languages className="w-3.5 h-3.5" />}
      label={t("nodeLanguage")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="truncate text-[10px] text-[#7A7267]">
        {data.message || t("languagePromptDefault")}
      </p>
      <div className="flex gap-1 mt-1">
        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          English
        </span>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          עברית
        </span>
      </div>
    </FlowNodeWrapper>
  );
}

export default memo(LanguageNode);
