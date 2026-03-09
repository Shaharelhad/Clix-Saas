import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { useFlowBuilder } from "@/hooks/useFlowBuilder";
import FlowCanvas from "./Components/FlowCanvas";
import FlowToolbar from "./Components/FlowToolbar";
import FlowSettingsModal from "./Components/FlowSettingsModal";
import NodePalette from "./Components/NodePalette";
import NodeEditorSidebar from "./Components/NodeEditorSidebar";
import FlowPreviewSimulator from "./Components/FlowPreviewSimulator";

function FlowBuilderContent() {
  const fb = useFlowBuilder();
  const [showSettings, setShowSettings] = useState(false);

  // Listen for node delete events from node components
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail;
      if (nodeId) fb.deleteNode(nodeId);
    };
    document.addEventListener("flow:delete-node", handler);
    return () => document.removeEventListener("flow:delete-node", handler);
  }, [fb]);

  // Loading or auto-creating
  if (fb.isLoadingList || (!fb.activeWorkflowId && fb.workflows.length === 0)) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF7E47] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Toolbar */}
      <FlowToolbar
        workflowName={fb.workflowName}
        workflowStatus={fb.workflowStatus}
        onNameChange={fb.setWorkflowName}
        onSave={fb.save}
        onToggleStatus={fb.toggleStatus}
        onOpenSettings={() => setShowSettings(true)}
        saveStatus={fb.saveStatus}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor sidebar (right in RTL = visually left) */}
        <NodeEditorSidebar
          node={fb.selectedNode}
          onUpdate={fb.updateNodeData}
          onClose={() => fb.setSelectedNodeId(null)}
        />

        {/* Canvas (center) */}
        <FlowCanvas
          nodes={fb.nodes}
          edges={fb.edges}
          onNodesChange={fb.onNodesChange}
          onEdgesChange={fb.onEdgesChange}
          onConnect={fb.onConnect}
          onNodeClick={(id) => fb.setSelectedNodeId(id)}
          onAddNode={fb.addNode}
          onPaneClick={() => fb.setSelectedNodeId(null)}
        />

        {/* Node palette (left in RTL = visually right) */}
        <NodePalette />
      </div>

      {/* Preview simulator */}
      <FlowPreviewSimulator workflowId={fb.activeWorkflowId} />

      {/* Settings modal */}
      {showSettings && (
        <FlowSettingsModal
          settings={fb.flowSettings}
          onUpdate={fb.updateFlowSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilderContent />
    </ReactFlowProvider>
  );
}
