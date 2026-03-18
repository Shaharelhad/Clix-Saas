import { useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import type { FlowNode, FlowEdge, FlowNodeData, FlowNodeType } from "@/types/flow";
import type { OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";
import DeletableEdge from "./edges/DeletableEdge";

import StartNode from "./nodes/StartNode";
import TextNode from "./nodes/TextNode";
import ImageNode from "./nodes/ImageNode";
import ButtonsNode from "./nodes/ButtonsNode";
import DelayNode from "./nodes/DelayNode";
import OpenBotNode from "./nodes/OpenBotNode";
import CollectInputNode from "./nodes/CollectInputNode";
import ApiCallNode from "./nodes/ApiCallNode";
import LanguageNode from "./nodes/LanguageNode";

const nodeTypes: NodeTypes = {
  start: StartNode,
  text: TextNode,
  image: ImageNode,
  buttons: ButtonsNode,
  delay: DelayNode,
  open_bot: OpenBotNode,
  collect_input: CollectInputNode,
  api_call: ApiCallNode,
  language: LanguageNode,
};

const edgeTypes: EdgeTypes = {
  smoothstep: DeletableEdge,
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
  isLocked: boolean;
  onLockedClick: () => void;
  onNodeDragStart: () => void;
  onUndo: () => void;
  onRedo: () => void;
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
  isLocked,
  onLockedClick,
  onNodeDragStart,
  onUndo,
  onRedo,
}: FlowCanvasProps) {
  const { t } = useTranslation("flow");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Inject isLocked into edge data so custom edge can read it
  const edgesWithData = useMemo(
    () => edges.map((e) => ({ ...e, data: { ...e.data, isLocked } })),
    [edges, isLocked],
  );

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

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        onUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        e.stopPropagation();
        onRedo();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onUndo, onRedo]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edgesWithData}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onPaneClick={() => {
          if (isLocked) onLockedClick();
          onPaneClick();
        }}
        onNodeDragStart={onNodeDragStart}
        onDragOver={isLocked ? undefined : onDragOver}
        onDrop={isLocked ? undefined : onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
        fitView
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        deleteKeyCode={isLocked ? null : "Delete"}
        className="bg-[#F5EDE4]"
      >
        <Background color="#D4C4B0" gap={20} size={1.5} />
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
