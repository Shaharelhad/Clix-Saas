import { useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import type { FlowNode, FlowEdge, FlowNodeData, FlowNodeType } from "@/types/flow";
import type { OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";

import StartNode from "./nodes/StartNode";
import TextNode from "./nodes/TextNode";
import ImageNode from "./nodes/ImageNode";
import ButtonsNode from "./nodes/ButtonsNode";
import CollectInputNode from "./nodes/CollectInputNode";
import DelayNode from "./nodes/DelayNode";
import FollowUpNode from "./nodes/FollowUpNode";
import ConditionNode from "./nodes/ConditionNode";
import AiAgentNode from "./nodes/AiAgentNode";

const nodeTypes: NodeTypes = {
  start: StartNode,
  text: TextNode,
  image: ImageNode,
  buttons: ButtonsNode,
  collect_input: CollectInputNode,
  delay: DelayNode,
  follow_up: FollowUpNode,
  condition: ConditionNode,
  ai_agent: AiAgentNode,
};

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  onNodeClick: (id: string) => void;
  onAddNode: (type: FlowNodeData["type"], position: { x: number; y: number }) => void;
  onPaneClick: () => void;
}

export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onAddNode,
  onPaneClick,
}: FlowCanvasProps) {
  const { t } = useTranslation("flow");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow") as FlowNodeType;
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onAddNode(type, position);
    },
    [screenToFlowPosition, onAddNode]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
        fitView
        deleteKeyCode="Delete"
        className="bg-[#F7F9FB]"
      >
        <Background color="#ddd" gap={20} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="!bg-white/80 !border-[#EDE6DD]"
        />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#A39B90] text-sm">{t("canvasEmpty")}</p>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
