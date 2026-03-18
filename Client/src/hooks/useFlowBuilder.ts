import { useCallback, useEffect, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  addEdge,
  type Connection,
} from "@xyflow/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { FlowNode, FlowEdge, FlowJSON, FlowNodeData, FlowSettings, Workflow, ButtonItem } from "@/types/flow";
import { NODE_DEFAULTS, DEFAULT_FLOW_SETTINGS } from "@/types/flow";
import { FLOW_TEMPLATES } from "@/data/flow-templates";
import { useFlowHistory } from "@/hooks/useFlowHistory";

// ── Generate workflow_record on publish ───────────────────────
function describeNodeType(type: string): string {
  const map: Record<string, string> = {
    text: "שולח הודעת טקסט",
    image: "שולח תמונה",
    buttons: "תפריט כפתורים",
    delay: "ממתין",
    open_bot: "מעביר לשיחת AI חופשית",
  };
  return map[type] || type;
}

function describeFlowChain(
  startId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): string {
  const parts: string[] = [];
  let currentId: string | null = startId;
  let steps = 0;

  while (currentId && steps < 5) {
    steps++;
    const edge = edges.find((e) => e.source === currentId);
    if (!edge) break;
    const node = nodes.find((n) => n.id === edge.target);
    if (!node) break;

    const nd = node.data;
    const typeDesc = describeNodeType(nd.type);

    if (nd.type === "text" && nd.message) {
      parts.push(`${typeDesc}: "${nd.message.substring(0, 40)}${nd.message.length > 40 ? "..." : ""}"`);
    } else if (nd.type === "image") {
      parts.push(nd.message ? `${typeDesc} עם כיתוב` : typeDesc);
    } else if (nd.type === "buttons" && nd.buttons?.length) {
      const labels = nd.buttons.map((b) => b.label).join(", ");
      parts.push(`${typeDesc} (${labels})`);
    } else if (nd.type === "delay" && nd.delayMinutes) {
      parts.push(`${typeDesc} ${nd.delayMinutes} דקות`);
    } else {
      parts.push(typeDesc);
    }

    currentId = edge.target;
  }

  return parts.length > 0 ? parts.join(" → ") : "תהליך ריק";
}

function getNodeKeywords(data: FlowNodeData): string[] {
  if (data.triggerKeywords?.length) return data.triggerKeywords.filter((k) => k.trim());
  if (data.triggerText?.trim()) return [data.triggerText.trim()];
  return [];
}

function generateWorkflowRecord(nodes: FlowNode[], edges: FlowEdge[]): string {
  const startNodes = nodes.filter(
    (n) => n.data.type === "start" && !n.data.disabled && getNodeKeywords(n.data).length > 0,
  );

  if (startNodes.length === 0) {
    return "אין תהליכים מוגדרים. ענה באופן טבעי כבעל העסק.";
  }

  const lines = startNodes.map((startNode) => {
    const keywords = getNodeKeywords(startNode.data);
    const trigger = keywords.map((k) => `"${k}"`).join(", ");
    const description = describeFlowChain(startNode.id, nodes, edges);
    return `- ${trigger} → ${description}`;
  });

  return `הבוט מטפל בתהליכים הבאים:\n${lines.join("\n")}\nכשאין התאמה לתהליך — ענה באופן טבעי כבעל העסק, והצע ללקוח תהליכים רלוונטיים כשמתאים.`;
}

// ── Open Bot sync helper ────────────────────────────────────────
function syncOpenBotNodes(
  parentNodeId: string,
  newButtons: ButtonItem[],
  currentNodes: FlowNode[],
  currentEdges: FlowEdge[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  let nodes = [...currentNodes];
  let edges = [...currentEdges];
  const parentNode = nodes.find((n) => n.id === parentNodeId);
  if (!parentNode) return { nodes, edges };

  for (let i = 0; i < newButtons.length; i++) {
    const btn = newButtons[i];
    const handleId = `btn-${btn.id}`;

    // Find existing open_bot node by linkedButtonId (reliable, edge-independent)
    const existingOpenBot = nodes.find(
      (n) => n.data.type === "open_bot" && n.data.linkedButtonId === btn.id && n.data.linkedNodeId === parentNodeId,
    );

    if (btn.openBot && !existingOpenBot) {
      // Remove any existing edge from this handle
      edges = edges.filter((e) => !(e.source === parentNodeId && e.sourceHandle === handleId));
      // Create open_bot node
      const newNodeId = `open_bot-${Date.now()}-${i}`;
      const offset = (i - (newButtons.length - 1) / 2) * 180;
      const newNode: FlowNode = {
        id: newNodeId,
        type: "open_bot",
        position: {
          x: parentNode.position.x + offset,
          y: parentNode.position.y + 200,
        },
        data: { type: "open_bot", linkedButtonId: btn.id, linkedNodeId: parentNodeId },
      };
      nodes.push(newNode);
      edges.push({
        id: `e-${handleId}-${newNodeId}`,
        source: parentNodeId,
        target: newNodeId,
        sourceHandle: handleId,
        type: "smoothstep",
        animated: true,
      });
    } else if (!btn.openBot && existingOpenBot) {
      // Remove the open_bot node and ALL its edges
      nodes = nodes.filter((n) => n.id !== existingOpenBot.id);
      edges = edges.filter((e) => e.target !== existingOpenBot.id && e.source !== existingOpenBot.id);
    }
  }

  // Clean up open_bot nodes for buttons that were removed
  const btnIds = new Set(newButtons.map((b) => b.id));
  const orphanOpenBots = nodes.filter(
    (n) => n.data.type === "open_bot" && n.data.linkedNodeId === parentNodeId && n.data.linkedButtonId && !btnIds.has(n.data.linkedButtonId),
  );
  for (const orphan of orphanOpenBots) {
    nodes = nodes.filter((n) => n.id !== orphan.id);
    edges = edges.filter((e) => e.target !== orphan.id && e.source !== orphan.id);
  }

  return { nodes, edges };
}

// ── Types ──────────────────────────────────────────────────────
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseFlowBuilderReturn {
  // Workflow
  workflows: Workflow[];
  isLoadingList: boolean;
  activeWorkflowId: string | null;
  workflowName: string;
  workflowStatus: string;
  setWorkflowName: (name: string) => void;
  // Nodes & edges
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  // Selected node
  selectedNodeId: string | null;
  selectedNode: FlowNode | null;
  setSelectedNodeId: (id: string | null) => void;
  // Node operations
  addNode: (type: FlowNodeData["type"], position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  // Workflow settings
  flowSettings: FlowSettings;
  updateFlowSettings: (patch: Partial<FlowSettings>) => void;
  // Workflow operations
  toggleStatus: () => void;
  // Save status
  saveStatus: SaveStatus;
  // Lock state (published = locked)
  isLocked: boolean;
  showLockedBanner: boolean;
  notifyLocked: () => void;
  // Template picker
  showTemplatePicker: boolean;
  createFromTemplate: (templateId: string) => void;
  // Toast
  toastMsg: string | null;
  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onNodeDragStart: () => void;
  // Multi-workflow
  switchWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  showTemplatePickerModal: boolean;
  openTemplatePicker: () => void;
  closeTemplatePicker: () => void;
}

// ── Hook ───────────────────────────────────────────────────────
export function useFlowBuilder(): UseFlowBuilderReturn {
  const { user } = useAuth();
  const { t } = useTranslation("flow");
  const queryClient = useQueryClient();
  const updateNodeInternals = useUpdateNodeInternals();

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("New Flow");
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [flowSettings, setFlowSettings] = useState<FlowSettings>({ ...DEFAULT_FLOW_SETTINGS });

  const [nodes, setNodes, rawOnNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, rawOnEdgesChange] = useEdgesState<FlowEdge>([]);

  // Undo/redo history
  const {
    pushSnapshot,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
    resetHistory,
  } = useFlowHistory();

  // Auto-save refs
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedJsonRef = useRef<string>("");

  // Ref for edges (used by sync logic that needs both nodes + edges atomically)
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Lock state (published = locked)
  const isLocked = workflowStatus === "active";
  const [showLockedBanner, setShowLockedBanner] = useState(false);
  const lockedBannerTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notifyLocked = useCallback(() => {
    setShowLockedBanner(true);
    clearTimeout(lockedBannerTimerRef.current);
    lockedBannerTimerRef.current = setTimeout(() => setShowLockedBanner(false), 3000);
  }, []);

  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);

  // ── List workflows ───────────────────────────────────────────
  const { data: workflows = [], isLoading: isLoadingList } = useQuery({
    queryKey: ["workflows", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Workflow[];
    },
  });

  // ── Load single workflow ─────────────────────────────────────
  const { data: loadedWorkflow } = useQuery({
    queryKey: ["workflow", activeWorkflowId],
    enabled: !!activeWorkflowId,
    staleTime: 0, // Always refetch on remount so navigation back shows fresh data
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", activeWorkflowId!)
        .single();
      if (error) throw error;
      return data as Workflow;
    },
  });

  // Sync loaded workflow to state (auto-migrate legacy ai_agent nodes)
  useEffect(() => {
    if (!loadedWorkflow) return;
    setWorkflowName(loadedWorkflow.name);
    setWorkflowStatus(loadedWorkflow.status);
    const flowJson = loadedWorkflow.flow_json as unknown as FlowJSON | null;

    // Strip legacy ai_agent nodes and their edges
    const rawNodes = flowJson?.nodes ?? [];
    const aiIds = new Set(
      rawNodes.filter((n) => (n.data.type as string) === "ai_agent").map((n) => n.id),
    );
    const cleanNodes = rawNodes.filter((n) => !aiIds.has(n.id));
    const cleanEdges = (flowJson?.edges ?? []).filter(
      (e) => !aiIds.has(e.source) && !aiIds.has(e.target),
    );

    setNodes(cleanNodes);
    setEdges(cleanEdges);
    const loadedSettings = { ...DEFAULT_FLOW_SETTINGS, ...flowJson?.settings };
    setFlowSettings(loadedSettings);
    setSelectedNodeId(null);
    resetHistory();

    // Snapshot for auto-save comparison (prevents save-on-load)
    lastSavedJsonRef.current = JSON.stringify({
      nodes: cleanNodes,
      edges: cleanEdges,
      name: loadedWorkflow.name,
      settings: loadedSettings,
    });
  }, [loadedWorkflow, setNodes, setEdges, resetHistory]);

  // Auto-select first workflow (no longer auto-creates — template picker handles that)
  useEffect(() => {
    if (!activeWorkflowId && workflows.length > 0) {
      setActiveWorkflowId(workflows[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows, activeWorkflowId]);

  // Template picker state
  const showTemplatePicker = !isLoadingList && workflows.length === 0 && !!user?.id;
  const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);

  const openTemplatePicker = useCallback(() => setShowTemplatePickerModal(true), []);
  const closeTemplatePicker = useCallback(() => setShowTemplatePickerModal(false), []);

  const createFromTemplate = useCallback(
    (templateId: string) => {
      const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;
      createMutation.mutate({
        flowJson: template.flowJson,
        name: templateId === "blank" ? "תהליך חדש" : template.nameKey,
      });
      setShowTemplatePickerModal(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Switch workflow ──────────────────────────────────────────
  const switchWorkflow = useCallback(
    (id: string) => {
      if (id === activeWorkflowId) return;
      clearTimeout(autoSaveTimerRef.current);
      setSelectedNodeId(null);
      setActiveWorkflowId(id);
    },
    [activeWorkflowId],
  );

  // ── Delete workflow ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const target = workflows.find((w) => w.id === workflowId);
      if (target?.status === "active") {
        await supabase.from("profiles").update({ active_flow_id: null }).eq("id", user.id);
      }
      // Clean up related records
      await supabase.from("flow_delayed_jobs").delete().eq("workflow_id", workflowId);
      await supabase.from("flow_message_log").delete().eq("workflow_id", workflowId);
      await supabase.from("subscriber_sessions").delete().eq("workflow_id", workflowId);
      const { error } = await supabase.from("workflows").delete().eq("id", workflowId);
      if (error) throw error;
      return workflowId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["workflows", user?.id] });
      if (activeWorkflowId === deletedId) {
        const remaining = workflows.filter((w) => w.id !== deletedId);
        setActiveWorkflowId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
  });

  const deleteWorkflow = useCallback(
    (id: string) => {
      clearTimeout(autoSaveTimerRef.current);
      deleteMutation.mutate(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Save mutation ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkflowId) return;
      const flowJson: FlowJSON = { nodes, edges, settings: flowSettings };
      const { error } = await supabase
        .from("workflows")
        .update({
          name: workflowName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          flow_json: flowJson as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeWorkflowId);
      if (error) throw error;
    },
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      lastSavedJsonRef.current = JSON.stringify({
        nodes, edges, name: workflowName, settings: flowSettings,
      });
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("error"),
  });

  // ── Debounced auto-save ────────────────────────────────────────
  useEffect(() => {
    if (!activeWorkflowId) return;

    const currentJson = JSON.stringify({
      nodes, edges, name: workflowName, settings: flowSettings,
    });
    if (currentJson === lastSavedJsonRef.current) return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(undefined);
    }, 1500);

    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, workflowName, flowSettings, activeWorkflowId, workflowStatus]);

  // ── Create workflow ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (opts?: { flowJson?: FlowJSON; name?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const flowJson = opts?.flowJson ?? {
        nodes: [
          {
            id: "start-default",
            type: "start",
            position: { x: 400, y: 50 },
            data: { type: "start", triggerText: "" },
          },
        ],
        edges: [],
        settings: { ...DEFAULT_FLOW_SETTINGS },
      };
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          user_id: user.id,
          name: opts?.name ?? "תהליך חדש",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          flow_json: flowJson as any,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Workflow;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows", user?.id] });
      setActiveWorkflowId(data.id);
    },
  });

  // ── Toggle status (publish/unpublish) ────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkflowId || !user?.id) return;
      const newStatus = workflowStatus === "active" ? "paused" : "active";

      // Publish validation: in non-strict mode, all enabled starts need keywords
      if (newStatus === "active" && !flowSettings.strictMode) {
        const enabledStarts = nodes.filter(
          (n) => n.data.type === "start" && !n.data.disabled,
        );
        const emptyTriggers = enabledStarts.filter(
          (n) => getNodeKeywords(n.data).length === 0,
        );
        if (emptyTriggers.length > 0) {
          throw new Error("EMPTY_TRIGGERS");
        }
      }

      // If publishing, save flow_json + workflow_record so the latest changes go live
      if (newStatus === "active") {
        // Auto-pause any other active workflow first
        await supabase
          .from("workflows")
          .update({ status: "paused" })
          .eq("user_id", user.id)
          .eq("status", "active")
          .neq("id", activeWorkflowId!);

        const flowJson: FlowJSON = { nodes, edges, settings: flowSettings };
        const workflowRecord = generateWorkflowRecord(nodes, edges);
        const { error: saveErr } = await supabase
          .from("workflows")
          .update({
            name: workflowName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            flow_json: flowJson as any,
            workflow_record: workflowRecord,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeWorkflowId);
        if (saveErr) throw saveErr;

        await supabase
          .from("profiles")
          .update({ active_flow_id: activeWorkflowId })
          .eq("id", user.id);
      } else {
        const { error } = await supabase
          .from("workflows")
          .update({ status: newStatus })
          .eq("id", activeWorkflowId);
        if (error) throw error;
      }

      return newStatus;
    },
    onSuccess: (newStatus) => {
      if (newStatus) setWorkflowStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ["workflow", activeWorkflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows", user?.id] });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "EMPTY_TRIGGERS") {
        showToast(t("publishErrorEmptyTriggers"));
      }
    },
  });

  // ── Guarded node/edge change handlers (allow select only when locked) ──
  const onNodesChange: OnNodesChange<FlowNode> = useCallback(
    (changes) => {
      if (isLocked) {
        const selectOnly = changes.filter((c) => c.type === "select");
        if (selectOnly.length > 0) rawOnNodesChange(selectOnly);
        if (changes.some((c) => c.type !== "select")) notifyLocked();
        return;
      }
      rawOnNodesChange(changes);
    },
    [isLocked, rawOnNodesChange, notifyLocked]
  );

  const onEdgesChange: OnEdgesChange<FlowEdge> = useCallback(
    (changes) => {
      if (isLocked) {
        const selectOnly = changes.filter((c) => c.type === "select");
        if (selectOnly.length > 0) rawOnEdgesChange(selectOnly);
        if (changes.some((c) => c.type !== "select")) notifyLocked();
        return;
      }
      rawOnEdgesChange(changes);
    },
    [isLocked, rawOnEdgesChange, notifyLocked]
  );

  // ── Connect edges ────────────────────────────────────────────
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (isLocked) { notifyLocked(); return; }
      // Block manual connections to open_bot nodes (auto-managed only)
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (targetNode?.data.type === "open_bot") return;
      pushSnapshot(nodes, edges);
      setEdges((eds) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, eds)
      );
    },
    [isLocked, notifyLocked, setEdges, nodes, edges, pushSnapshot]
  );

  // ── Guarded workflow name setter ─────────────────────────────
  const guardedSetWorkflowName = useCallback(
    (name: string) => {
      if (isLocked) { notifyLocked(); return; }
      setWorkflowName(name);
    },
    [isLocked, notifyLocked]
  );

  // ── Add node ─────────────────────────────────────────────────
  const addNode = useCallback(
    (type: FlowNodeData["type"], position: { x: number; y: number }) => {
      if (isLocked) { notifyLocked(); return; }
      if (type === "start" && flowSettings.strictMode) {
        showToast(t("cannotAddStartStrictMode"));
        return;
      }
      pushSnapshot(nodes, edges);
      const id = `${type}-${Date.now()}`;
      const newNode: FlowNode = {
        id,
        type,
        position,
        data: { ...NODE_DEFAULTS[type] } as FlowNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [isLocked, notifyLocked, setNodes, flowSettings.strictMode, showToast, t, pushSnapshot, nodes, edges]
  );

  // ── Update node data ────────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      if (isLocked) { notifyLocked(); return; }

      // Block disabling the last enabled start node
      if (data.disabled === true) {
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (targetNode?.data.type === "start") {
          const otherEnabled = nodes.filter(
            (n) => n.data.type === "start" && !n.data.disabled && n.id !== nodeId,
          ).length;
          if (otherEnabled === 0) {
            showToast(t("cannotDisableLastStart"));
            return;
          }
        }
      }

      pushSnapshot(nodes, edges, true);

      // Handle buttons change specially — sync open_bot nodes + edges together
      if (data.buttons) {
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (targetNode?.data.type === "buttons") {
          const updatedNodes = nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          );
          const result = syncOpenBotNodes(nodeId, data.buttons!, updatedNodes, edges);
          setNodes(result.nodes);
          setEdges(result.edges);
          requestAnimationFrame(() => updateNodeInternals(nodeId));
          return;
        }
      }

      // Normal (non-buttons) node data update
      setNodes((nds) =>
        nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
      );

      // Migrate edges when yesNoMode is toggled
      if (data.yesNoMode === true) {
        // Toggled ON: migrate existing default edge → sourceHandle "yes"
        setEdges((eds) =>
          eds.map((e) =>
            e.source === nodeId && !e.sourceHandle
              ? { ...e, sourceHandle: "yes" }
              : e
          )
        );
        requestAnimationFrame(() => updateNodeInternals(nodeId));
      } else if (data.yesNoMode === false) {
        // Toggled OFF: migrate "yes" edge back to default, remove "no" edge
        setEdges((eds) =>
          eds
            .filter((e) => !(e.source === nodeId && e.sourceHandle === "no"))
            .map((e) =>
              e.source === nodeId && e.sourceHandle === "yes"
                ? { ...e, sourceHandle: undefined }
                : e
            )
        );
        requestAnimationFrame(() => updateNodeInternals(nodeId));
      }
    },
    [isLocked, notifyLocked, setNodes, setEdges, updateNodeInternals, nodes, edges, showToast, t, pushSnapshot]
  );

  // ── Delete node ──────────────────────────────────────────────
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (isLocked) { notifyLocked(); return; }

      // Block deleting the last enabled start node
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode?.data.type === "start") {
        const enabledStartCount = nodes.filter(
          (n) => n.data.type === "start" && !n.data.disabled && n.id !== nodeId,
        ).length;
        if (enabledStartCount === 0) {
          showToast(t("cannotDeleteLastStart"));
          return;
        }
      }

      pushSnapshot(nodes, edges);

      setNodes((nds) => {
        const deletedNode = nds.find((n) => n.id === nodeId);

        // Reverse-sync: if deleting an open_bot node, unset openBot on the source button
        if (deletedNode?.data.type === "open_bot") {
          const incomingEdge = edgesRef.current.find(
            (e) => e.target === nodeId && e.sourceHandle?.startsWith("btn-"),
          );
          if (incomingEdge) {
            const btnId = incomingEdge.sourceHandle!.slice(4);
            return nds
              .filter((n) => n.id !== nodeId)
              .map((n) =>
                n.id === incomingEdge.source && n.data.type === "buttons" && n.data.buttons
                  ? { ...n, data: { ...n.data, buttons: n.data.buttons.map((b) => b.id === btnId ? { ...b, openBot: false } : b) } }
                  : n,
              );
          }
        }

        return nds.filter((n) => n.id !== nodeId);
      });
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [isLocked, notifyLocked, setNodes, setEdges, selectedNodeId, nodes, edges, showToast, t, pushSnapshot]
  );

  // ── Delete edge ──────────────────────────────────────────────
  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (isLocked) { notifyLocked(); return; }

      pushSnapshot(nodes, edges);

      const edge = edgesRef.current.find((e) => e.id === edgeId);

      // If edge targets an open_bot node, also delete that node + unset button flag
      if (edge?.sourceHandle?.startsWith("btn-")) {
        setNodes((nds) => {
          const targetNode = nds.find((n) => n.id === edge.target);
          if (targetNode?.data.type !== "open_bot") return nds;
          const btnId = edge.sourceHandle!.slice(4);
          return nds
            .filter((n) => n.id !== edge.target)
            .map((n) =>
              n.id === edge.source && n.data.type === "buttons" && n.data.buttons
                ? { ...n, data: { ...n.data, buttons: n.data.buttons.map((b) => b.id === btnId ? { ...b, openBot: false } : b) } }
                : n,
            );
        });
      }

      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [isLocked, notifyLocked, setEdges, setNodes, nodes, edges, pushSnapshot]
  );

  // ── Update flow settings ────────────────────────────────────
  const updateFlowSettings = useCallback(
    (patch: Partial<FlowSettings>) => {
      if (patch.strictMode === true) {
        const enabledStarts = nodes.filter(
          (n) => n.data.type === "start" && !n.data.disabled,
        );
        if (enabledStarts.length > 1) {
          showToast(t("cannotEnableStrictMultipleStarts"));
          return;
        }
      }
      setFlowSettings((prev) => ({ ...prev, ...patch }));
    },
    [nodes, showToast, t]
  );

  // ── Undo / Redo ─────────────────────────────────────────────
  const onNodeDragStart = useCallback(() => {
    pushSnapshot(nodes, edges);
  }, [pushSnapshot, nodes, edges]);

  const handleUndo = useCallback(() => {
    if (isLocked) { notifyLocked(); return; }
    const restored = historyUndo(nodes, edges, setNodes, setEdges);
    if (restored && selectedNodeId && !restored.nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [isLocked, notifyLocked, historyUndo, nodes, edges, setNodes, setEdges, selectedNodeId]);

  const handleRedo = useCallback(() => {
    if (isLocked) { notifyLocked(); return; }
    const restored = historyRedo(nodes, edges, setNodes, setEdges);
    if (restored && selectedNodeId && !restored.nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [isLocked, notifyLocked, historyRedo, nodes, edges, setNodes, setEdges, selectedNodeId]);

  // ── Selected node ────────────────────────────────────────────
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  return {
    workflows,
    isLoadingList,
    activeWorkflowId,
    workflowName,
    workflowStatus,
    setWorkflowName: guardedSetWorkflowName,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    addNode,
    updateNodeData,
    deleteNode,
    deleteEdge,
    flowSettings,
    updateFlowSettings,
    toggleStatus: () => {
      clearTimeout(autoSaveTimerRef.current);
      toggleMutation.mutate();
    },
    saveStatus,
    toastMsg,
    undo: handleUndo,
    redo: handleRedo,
    canUndo: canUndo && !isLocked,
    canRedo: canRedo && !isLocked,
    onNodeDragStart,
    isLocked,
    showLockedBanner,
    notifyLocked,
    showTemplatePicker,
    createFromTemplate,
    switchWorkflow,
    deleteWorkflow,
    showTemplatePickerModal,
    openTemplatePicker,
    closeTemplatePicker,
  };
}
