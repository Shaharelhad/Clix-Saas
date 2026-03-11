import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2, Lock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useFlowBuilder } from "@/hooks/useFlowBuilder";
import FlowCanvas from "./Components/FlowCanvas";
import FlowToolbar from "./Components/FlowToolbar";
import FlowSettingsModal from "./Components/FlowSettingsModal";
import NodePalette from "./Components/NodePalette";
import NodeEditorSidebar from "./Components/NodeEditorSidebar";
import FlowPreviewSimulator from "./Components/FlowPreviewSimulator";

function FlowBuilderContent() {
  const fb = useFlowBuilder();
  const { t } = useTranslation("flow");
  const [showSettings, setShowSettings] = useState(false);

  // Listen for node/edge delete events from custom components
  useEffect(() => {
    const onDeleteNode = (e: Event) => {
      const nodeId = (e as CustomEvent).detail;
      if (nodeId) fb.deleteNode(nodeId);
    };
    const onDeleteEdge = (e: Event) => {
      const edgeId = (e as CustomEvent).detail;
      if (edgeId) fb.deleteEdge(edgeId);
    };
    document.addEventListener("flow:delete-node", onDeleteNode);
    document.addEventListener("flow:delete-edge", onDeleteEdge);
    return () => {
      document.removeEventListener("flow:delete-node", onDeleteNode);
      document.removeEventListener("flow:delete-edge", onDeleteEdge);
    };
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
        onToggleStatus={fb.toggleStatus}
        onOpenSettings={() => setShowSettings(true)}
        saveStatus={fb.saveStatus}
        isLocked={fb.isLocked}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor sidebar (right in RTL = visually left) */}
        <NodeEditorSidebar
          node={fb.selectedNode}
          onUpdate={fb.updateNodeData}
          onClose={() => fb.setSelectedNodeId(null)}
          isLocked={fb.isLocked}
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
          isLocked={fb.isLocked}
          onLockedClick={fb.notifyLocked}
        />

        {/* Node palette (left in RTL = visually right) */}
        <NodePalette isLocked={fb.isLocked} onLockedDrag={fb.notifyLocked} />
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

      {/* Locked banner */}
      <AnimatePresence>
        {fb.showLockedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium shadow-lg flex items-center gap-2"
            dir="rtl"
          >
            <Lock className="w-4 h-4" />
            {t("lockedBanner")}
          </motion.div>
        )}
      </AnimatePresence>
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
