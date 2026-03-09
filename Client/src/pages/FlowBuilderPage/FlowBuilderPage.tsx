import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { GitBranch, Plus, Loader2 } from "lucide-react";
import { useFlowBuilder } from "@/hooks/useFlowBuilder";
import FlowCanvas from "./Components/FlowCanvas";
import FlowToolbar from "./Components/FlowToolbar";
import NodePalette from "./Components/NodePalette";
import NodeEditorSidebar from "./Components/NodeEditorSidebar";
import FlowPreviewSimulator from "./Components/FlowPreviewSimulator";

function FlowBuilderContent() {
  const { t } = useTranslation("flow");
  const fb = useFlowBuilder();

  // Listen for node delete events from node components
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail;
      if (nodeId) fb.deleteNode(nodeId);
    };
    document.addEventListener("flow:delete-node", handler);
    return () => document.removeEventListener("flow:delete-node", handler);
  }, [fb]);

  // No workflows — show create prompt
  if (!fb.isLoadingList && fb.workflows.length === 0) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#FF7E47]/10 flex items-center justify-center">
          <GitBranch className="w-8 h-8 text-[#FF7E47]" />
        </div>
        <h2 className="text-xl font-bold text-[#2D2A26]">{t("createFirst")}</h2>
        <p className="text-sm text-[#7A7267] max-w-sm text-center">{t("createFirstDesc")}</p>
        <button
          onClick={fb.createWorkflow}
          disabled={fb.isCreating}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF7E47] text-white font-medium hover:bg-[#E86B38] transition-colors cursor-pointer disabled:opacity-50"
        >
          {fb.isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {t("newFlow")}
        </button>
      </div>
    );
  }

  // Loading
  if (fb.isLoadingList) {
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
        onDelete={fb.deleteWorkflow}
        onCreate={fb.createWorkflow}
        saveStatus={fb.saveStatus}
        workflows={fb.workflows}
        activeWorkflowId={fb.activeWorkflowId}
        onSelectWorkflow={fb.selectWorkflow}
        isCreating={fb.isCreating}
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
