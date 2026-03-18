import { useCallback, useRef, useState } from "react";
import type { FlowNode, FlowEdge } from "@/types/flow";

interface FlowSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 500;

export function useFlowHistory() {
  const pastRef = useRef<FlowSnapshot[]>([]);
  const futureRef = useRef<FlowSnapshot[]>([]);
  const lastPushRef = useRef<number>(0);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const pushSnapshot = useCallback(
    (nodes: FlowNode[], edges: FlowEdge[], debounce = false) => {
      if (debounce) {
        const now = Date.now();
        if (now - lastPushRef.current < DEBOUNCE_MS) return;
        lastPushRef.current = now;
      }
      const snapshot: FlowSnapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
      futureRef.current = [];
      bump();
    },
    [bump],
  );

  const undo = useCallback(
    (
      currentNodes: FlowNode[],
      currentEdges: FlowEdge[],
      setNodes: (nodes: FlowNode[]) => void,
      setEdges: (edges: FlowEdge[]) => void,
    ): FlowSnapshot | null => {
      if (pastRef.current.length === 0) return null;
      const prev = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [
        ...futureRef.current,
        { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) },
      ];
      setNodes(prev.nodes);
      setEdges(prev.edges);
      bump();
      return prev;
    },
    [bump],
  );

  const redo = useCallback(
    (
      currentNodes: FlowNode[],
      currentEdges: FlowEdge[],
      setNodes: (nodes: FlowNode[]) => void,
      setEdges: (edges: FlowEdge[]) => void,
    ): FlowSnapshot | null => {
      if (futureRef.current.length === 0) return null;
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [
        ...pastRef.current,
        { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) },
      ];
      setNodes(next.nodes);
      setEdges(next.edges);
      bump();
      return next;
    },
    [bump],
  );

  const resetHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastPushRef.current = 0;
    bump();
  }, [bump]);

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    resetHistory,
  };
}
