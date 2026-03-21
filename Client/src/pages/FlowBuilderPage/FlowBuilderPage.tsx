import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2, Lock, Monitor, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useFlowBuilder } from "@/hooks/useFlowBuilder";
import FlowCanvas from "./Components/FlowCanvas";
import FlowToolbar from "./Components/FlowToolbar";
import FlowSettingsModal from "./Components/FlowSettingsModal";
import FlowIntegrationsModal from "./Components/FlowIntegrationsModal";
import NodePalette from "./Components/NodePalette";
import NodeEditorSidebar from "./Components/NodeEditorSidebar";
import FlowHelpAssistant from "./Components/FlowHelpAssistant";
import TemplatePickerModal from "./Components/TemplatePickerModal";

function FlowBuilderContent() {
  const fb = useFlowBuilder();
  const { t } = useTranslation("flow");
  const [showSettings, setShowSettings] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

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

  // Loading
  if (fb.isLoadingList) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF7E47] animate-spin" />
      </div>
    );
  }

  // No workflows — show template picker
  if (fb.showTemplatePicker) {
    return <TemplatePickerModal onSelect={fb.createFromTemplate} />;
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
        onOpenIntegrations={() => setShowIntegrations(true)}
        saveStatus={fb.saveStatus}
        isLocked={fb.isLocked}
        workflows={fb.workflows}
        activeWorkflowId={fb.activeWorkflowId}
        onSwitchWorkflow={fb.switchWorkflow}
        onDeleteWorkflow={fb.deleteWorkflow}
        onNewFlow={fb.openTemplatePicker}
        onUndo={fb.undo}
        onRedo={fb.redo}
        canUndo={fb.canUndo}
        canRedo={fb.canRedo}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor sidebar (right in RTL = visually left) */}
        <NodeEditorSidebar
          node={fb.selectedNode}
          onUpdate={fb.updateNodeData}
          onClose={() => fb.setSelectedNodeId(null)}
          isLocked={fb.isLocked}
          strictMode={fb.flowSettings.strictMode}
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
          onNodeDragStart={fb.onNodeDragStart}
          onUndo={fb.undo}
          onRedo={fb.redo}
        />

        {/* Node palette (left in RTL = visually right) */}
        <NodePalette isLocked={fb.isLocked} onLockedDrag={fb.notifyLocked} strictMode={fb.flowSettings.strictMode} />
      </div>

      {/* Help assistant */}
      <FlowHelpAssistant />

      {/* Settings modal */}
      {showSettings && (
        <FlowSettingsModal
          settings={fb.flowSettings}
          onUpdate={fb.updateFlowSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Integrations modal */}
      {showIntegrations && (
        <FlowIntegrationsModal onClose={() => setShowIntegrations(false)} />
      )}

      {/* Template picker modal (for creating new flows) */}
      {fb.showTemplatePickerModal && (
        <TemplatePickerModal
          onSelect={fb.createFromTemplate}
          onClose={fb.closeTemplatePicker}
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

      {/* Toast notification */}
      <AnimatePresence>
        {fb.toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium shadow-lg"
            dir="rtl"
          >
            {fb.toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FlowBuilderPage() {
  const { t } = useTranslation("flow");
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile gate — desktop only */}
      <div className="lg:hidden flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-6" dir="rtl">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-8 max-w-sm text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#FF7E47]/10 flex items-center justify-center">
            <Monitor className="w-7 h-7 text-[#FF7E47]" />
          </div>
          <h2 className="text-lg font-bold text-[#2D2A26]">{t("desktopOnlyTitle")}</h2>
          <p className="text-sm text-[#7A7267] leading-relaxed">{t("desktopOnlyDesc")}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7E47] text-white text-sm font-bold hover:bg-[#E86B38] transition-colors"
          >
            {t("desktopOnlyBack")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop — full flow builder */}
      <div className="hidden lg:block">
        <ReactFlowProvider>
          <FlowBuilderContent />
        </ReactFlowProvider>
      </div>
    </>
  );
}
