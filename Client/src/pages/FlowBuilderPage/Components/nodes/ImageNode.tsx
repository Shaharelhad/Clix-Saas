import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Image } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlowNode } from "@/types/flow";
import FlowNodeWrapper from "../FlowNodeWrapper";

function ImageNode({ data, selected, id }: NodeProps<FlowNode>) {
  const { t } = useTranslation("flow");

  return (
    <FlowNodeWrapper
      type="image"
      icon={<Image className="w-3.5 h-3.5" />}
      label={t("nodeImage")}
      selected={selected}
      onDelete={() => {
        document.dispatchEvent(new CustomEvent("flow:delete-node", { detail: id }));
      }}
    >
      <p className="truncate">{data.message || t("messageHint")}</p>
      {data.imageUrl && (
        <span className="text-[10px] text-purple-500 mt-1 block truncate">{data.imageUrl}</span>
      )}
    </FlowNodeWrapper>
  );
}

export default memo(ImageNode);
