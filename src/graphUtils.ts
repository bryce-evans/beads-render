import Dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { Task } from "./types";
import type { ColorMode } from "./types";
import { STATUS_GROUPS, NODE_W, NODE_H } from "./constants";
import { STATUS_COLOR } from "./utils";

export function getTaskColor(
  task: Task,
  mode: ColorMode,
  wsColor: Record<string, string>,
  ownerColor: Record<string, string>,
): string {
  if (mode === "status") return STATUS_GROUPS.find((g) => g.statuses.has(task.status))?.color ?? "#334155";
  if (mode === "owner") return task.assignee ? (ownerColor[task.assignee] ?? "#334155") : "#334155";
  return wsColor[task.workstream.split("—")[0].trim()] ?? "#334155";
}

const CLUSTER_GAP = 80;
const STANDALONE_COLS = 5;
const STANDALONE_NODE_GAP = 16;
const STANDALONE_PADDING = 24;
// Half the label div's line-height (22px); label hangs above the box's top border
const STANDALONE_LABEL_HALF = 11;

function findConnectedComponents(tasks: Task[]): string[][] {
  const taskIds = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (!adj.has(t.id)) adj.set(t.id, new Set());
    for (const dep of t.depends) {
      if (!taskIds.has(dep)) continue;
      if (!adj.has(dep)) adj.set(dep, new Set());
      adj.get(t.id)!.add(dep);
      adj.get(dep)!.add(t.id);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const t of tasks) {
    if (visited.has(t.id)) continue;
    const component: string[] = [];
    const stack = [t.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      for (const neighbor of (adj.get(id) ?? [])) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function layoutCluster(
  clusterTasks: Task[],
  taskIds: Set<string>,
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 96, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  clusterTasks.forEach((t) => g.setNode(t.id, { width: NODE_W, height: NODE_H }));
  clusterTasks.forEach((t) => {
    t.depends.forEach((dep) => { if (taskIds.has(dep)) g.setEdge(dep, t.id); });
  });
  Dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  clusterTasks.forEach((t) => {
    const p = g.node(t.id);
    positions.set(t.id, { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 });
  });
  return positions;
}

export function buildGraph(
  tasks: Task[],
  mode: ColorMode,
  wsColor: Record<string, string>,
  ownerColor: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const taskIds = new Set(tasks.map((t) => t.id));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const components = findConnectedComponents(tasks);
  const clusters = components.filter((c) => c.length > 1);
  const singletonIds = components.filter((c) => c.length === 1).map((c) => c[0]);

  const clusterNodes: Node[] = [];
  let yOffset = 0;

  for (const cluster of clusters) {
    const clusterTasks = cluster.map((id) => taskMap.get(id)!);
    const positions = layoutCluster(clusterTasks, taskIds);

    let minY = Infinity, maxY = -Infinity;
    for (const pos of positions.values()) {
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + NODE_H);
    }

    for (const t of clusterTasks) {
      const pos = positions.get(t.id)!;
      clusterNodes.push({
        id: t.id,
        type: "taskNode",
        position: { x: pos.x, y: pos.y - minY + yOffset },
        data: { ...t, wsColor: getTaskColor(t, mode, wsColor, ownerColor) },
      });
    }

    yOffset += (maxY - minY) + CLUSTER_GAP;
  }

  const standaloneNodes: Node[] = [];
  let standaloneBoxNode: Node | null = null;

  if (singletonIds.length > 0) {
    const colCount = Math.min(STANDALONE_COLS, singletonIds.length);
    const rowCount = Math.ceil(singletonIds.length / colCount);
    const gridW = colCount * (NODE_W + STANDALONE_NODE_GAP) - STANDALONE_NODE_GAP;
    const gridH = rowCount * (NODE_H + STANDALONE_NODE_GAP) - STANDALONE_NODE_GAP;

    // Box: label hangs STANDALONE_LABEL_HALF px above the top border
    standaloneBoxNode = {
      id: "__standalone_box__",
      type: "standaloneBox",
      position: {
        x: -STANDALONE_PADDING,
        y: yOffset - STANDALONE_LABEL_HALF,
      },
      data: {
        width: gridW + STANDALONE_PADDING * 2,
        height: STANDALONE_LABEL_HALF + STANDALONE_PADDING + gridH + STANDALONE_PADDING,
      },
      zIndex: -1,
      selectable: false,
      draggable: false,
    } as Node;

    singletonIds.forEach((id, i) => {
      const task = taskMap.get(id)!;
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      standaloneNodes.push({
        id: task.id,
        type: "taskNode",
        position: {
          x: col * (NODE_W + STANDALONE_NODE_GAP),
          y: yOffset + STANDALONE_PADDING + row * (NODE_H + STANDALONE_NODE_GAP),
        },
        data: { ...task, wsColor: getTaskColor(task, mode, wsColor, ownerColor) },
      });
    });
  }

  // Order: box first (renders behind), then task nodes on top
  const nodes: Node[] = [
    ...(standaloneBoxNode ? [standaloneBoxNode] : []),
    ...clusterNodes,
    ...standaloneNodes,
  ];

  const edges: Edge[] = tasks.flatMap((t) =>
    t.depends
      .filter((depId) => taskIds.has(depId))
      .map((depId) => {
        const sourceTask = taskMap.get(depId);
        const isActive = t.status === "in_progress" || t.status === "in_review";
        const isBlocked = t.status === "blocked";
        const color = isBlocked ? "#ef4444" : isActive ? STATUS_COLOR[t.status] : "#334155";
        return {
          id: `${depId}→${t.id}`,
          source: depId,
          target: t.id,
          animated: isActive && sourceTask?.status === "closed",
          style: { stroke: color, strokeWidth: isBlocked ? 2 : 1.5 },
          labelStyle: { fill: "#94a3b8", fontSize: 9 },
        };
      })
  );

  return { nodes, edges };
}
