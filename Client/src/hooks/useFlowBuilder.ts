import { useCallback, useEffect, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  addEdge,
  type Connection,
} from "@xyflow/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { FlowNode, FlowEdge, FlowJSON, FlowNodeData, FlowSettings, Workflow } from "@/types/flow";
import { NODE_DEFAULTS, DEFAULT_FLOW_SETTINGS } from "@/types/flow";

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
  // Workflow settings
  flowSettings: FlowSettings;
  updateFlowSettings: (patch: Partial<FlowSettings>) => void;
  // Workflow operations
  toggleStatus: () => void;
  save: () => void;
  // Save status
  saveStatus: SaveStatus;
}

// ── Hook ───────────────────────────────────────────────────────
export function useFlowBuilder(): UseFlowBuilderReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("New Flow");
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [flowSettings, setFlowSettings] = useState<FlowSettings>({ ...DEFAULT_FLOW_SETTINGS });

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

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

  // Sync loaded workflow to state
  useEffect(() => {
    if (!loadedWorkflow) return;
    setWorkflowName(loadedWorkflow.name);
    setWorkflowStatus(loadedWorkflow.status);
    const flowJson = loadedWorkflow.flow_json as unknown as FlowJSON | null;
    setNodes(flowJson?.nodes ?? []);
    setEdges(flowJson?.edges ?? []);
    setFlowSettings({ ...DEFAULT_FLOW_SETTINGS, ...flowJson?.settings });
    setSelectedNodeId(null);
  }, [loadedWorkflow, setNodes, setEdges]);

  // Auto-select first workflow, or auto-create if none exist
  useEffect(() => {
    if (!activeWorkflowId && workflows.length > 0) {
      setActiveWorkflowId(workflows[0].id);
    }
    if (!isLoadingList && workflows.length === 0 && user?.id && !createMutation.isPending) {
      createMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows, activeWorkflowId, isLoadingList, user?.id]);

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
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("error"),
  });

  // ── Create workflow ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          user_id: user.id,
          name: "תהליך חדש",
          flow_json: {
            nodes: [
              {
                id: "start-default",
                type: "start",
                position: { x: 400, y: 50 },
                data: { type: "start", triggerText: "" },
              },
              {
                id: "ai-agent-default",
                type: "ai_agent",
                position: { x: 400, y: 200 },
                data: {
                  type: "ai_agent",
                  temperature: 1.0,
                  maxTokens: 2048,
                  includeProducts: true,
                  includeFaqs: true,
                  includeScrapedContent: true,
                  maxHistoryMessages: 20,
                },
              },
            ],
            edges: [
              {
                id: "edge-start-to-agent",
                source: "start-default",
                target: "ai-agent-default",
                type: "smoothstep",
                animated: true,
              },
            ],
            settings: { ...DEFAULT_FLOW_SETTINGS },
          },
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

      // If publishing, save flow_json first so the latest changes go live
      if (newStatus === "active") {
        const flowJson: FlowJSON = { nodes, edges, settings: flowSettings };
        const { error: saveErr } = await supabase
          .from("workflows")
          .update({
            name: workflowName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            flow_json: flowJson as any,
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
  });

  // ── Connect edges ────────────────────────────────────────────
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, eds)
      );
    },
    [setEdges]
  );

  // ── Add node ─────────────────────────────────────────────────
  const addNode = useCallback(
    (type: FlowNodeData["type"], position: { x: number; y: number }) => {
      const id = `${type}-${Date.now()}`;
      const newNode: FlowNode = {
        id,
        type,
        position,
        data: { ...NODE_DEFAULTS[type] } as FlowNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // ── Update node data ────────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    [setNodes]
  );

  // ── Delete node ──────────────────────────────────────────────
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [setNodes, setEdges, selectedNodeId]
  );

  // ── Update flow settings ────────────────────────────────────
  const updateFlowSettings = useCallback(
    (patch: Partial<FlowSettings>) => {
      setFlowSettings((prev) => ({ ...prev, ...patch }));
    },
    []
  );

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
    setWorkflowName,
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
    flowSettings,
    updateFlowSettings,
    toggleStatus: () => toggleMutation.mutate(),
    save: () => saveMutation.mutate(),
    saveStatus,
  };
}
