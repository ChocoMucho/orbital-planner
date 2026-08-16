import type {
  Item,
  Machine,
  ProductionPlanCalculationResult,
  ProductionRow,
  ProductionTreeNode,
  Recipe,
} from "./calculate";

export type ProductionFlowNode = ProcessFlowNode | RawFlowNode | TargetFlowNode;

interface FlowNodeBase {
  id: string;
  item: Item;
  ratePerMin: number;
  ratePerMinByTarget: number[];
  order: number;
}

export interface ProcessFlowNode extends FlowNodeBase {
  kind: "process";
  recipe: Recipe;
  machine: Machine;
  craftsPerMin: number;
  exactMachines: number;
  roundedMachines: number;
  capacityPerMachinePerMin: number;
  installedCapacityPerMin: number;
  utilization: number;
}

export interface RawFlowNode extends FlowNodeBase {
  kind: "raw";
}

export interface TargetFlowNode extends FlowNodeBase {
  kind: "target";
  targetIndex: number;
}

export interface ProductionFlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  item: Item;
  ratePerMin: number;
  ratePerMinByTarget: number[];
}

export interface ProductionFlowGraph {
  nodes: ProductionFlowNode[];
  edges: ProductionFlowEdge[];
  targetNodeIds: string[];
}

export type PositionedProductionFlowNode = ProductionFlowNode & {
  depth: number;
  x: number;
  y: number;
};

export interface PositionedProductionFlowEdge extends ProductionFlowEdge {
  source: PositionedProductionFlowNode;
  target: PositionedProductionFlowNode;
}

export interface ProductionFlowLayout {
  nodes: PositionedProductionFlowNode[];
  edges: PositionedProductionFlowEdge[];
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
}

function processKey(values: Pick<ProductionRow, "itemId" | "recipeId" | "machineId" | "productMultiplier">) {
  return `process:${JSON.stringify([values.itemId, values.recipeId, values.machineId, values.productMultiplier])}`;
}

function treeProcessKey(node: ProductionTreeNode) {
  return `process:${JSON.stringify([node.itemId, node.recipeId, node.machineId, node.productMultiplier ?? 1])}`;
}

function rawKey(itemId: string) {
  return `raw:${itemId}`;
}

function targetKey(index: number) {
  return `target:${index}`;
}

function addRate(values: number[], targetIndex: number, ratePerMin: number) {
  values[targetIndex] = (values[targetIndex] ?? 0) + ratePerMin;
}

export function buildProductionFlowGraph(
  result: ProductionPlanCalculationResult,
): ProductionFlowGraph {
  const targetCount = result.targets.length;
  const nodes = new Map<string, ProductionFlowNode>();
  const edges = new Map<string, ProductionFlowEdge>();
  const rowByKey = new Map(result.rows.map((row) => [processKey(row), row]));
  let order = 0;

  for (const row of result.rows) {
    const capacityPerMachinePerMin = row.exactMachines > 0
      ? row.ratePerMin / row.exactMachines
      : 0;
    const installedCapacityPerMin = capacityPerMachinePerMin * row.roundedMachines;
    nodes.set(processKey(row), {
      id: processKey(row),
      kind: "process",
      item: row.item,
      recipe: row.recipe,
      machine: row.machine,
      ratePerMin: row.ratePerMin,
      ratePerMinByTarget: Array(targetCount).fill(0),
      craftsPerMin: row.craftsPerMin,
      exactMachines: row.exactMachines,
      roundedMachines: row.roundedMachines,
      capacityPerMachinePerMin,
      installedCapacityPerMin,
      utilization: installedCapacityPerMin > 0 ? row.ratePerMin / installedCapacityPerMin : 0,
      order: order++,
    });
  }

  const addEdge = (
    sourceId: string,
    targetId: string,
    item: Item,
    ratePerMin: number,
    targetIndex: number,
  ) => {
    const id = `edge:${JSON.stringify([sourceId, targetId, item.id])}`;
    const existing = edges.get(id);
    if (existing) {
      existing.ratePerMin += ratePerMin;
      addRate(existing.ratePerMinByTarget, targetIndex, ratePerMin);
      return;
    }
    const ratePerMinByTarget = Array(targetCount).fill(0);
    addRate(ratePerMinByTarget, targetIndex, ratePerMin);
    edges.set(id, { id, sourceId, targetId, item, ratePerMin, ratePerMinByTarget });
  };

  const ensureRawNode = (node: ProductionTreeNode) => {
    const id = rawKey(node.itemId);
    let raw = nodes.get(id) as RawFlowNode | undefined;
    if (!raw) {
      raw = {
        id,
        kind: "raw",
        item: node.item,
        ratePerMin: result.rawTotals[node.itemId] ?? 0,
        ratePerMinByTarget: Array(targetCount).fill(0),
        order: order++,
      };
      nodes.set(id, raw);
    }
    return raw;
  };

  const visit = (node: ProductionTreeNode, targetIndex: number): string => {
    if (node.raw) {
      const raw = ensureRawNode(node);
      addRate(raw.ratePerMinByTarget, targetIndex, node.ratePerMin);
      return raw.id;
    }

    const id = treeProcessKey(node);
    const process = nodes.get(id) as ProcessFlowNode | undefined;
    if (!process || !rowByKey.has(id)) {
      throw new Error(`생산 흐름도에서 공정 ${node.itemId}의 합산 데이터를 찾을 수 없습니다.`);
    }
    addRate(process.ratePerMinByTarget, targetIndex, node.ratePerMin);

    for (const child of node.children) {
      const sourceId = visit(child, targetIndex);
      addEdge(sourceId, id, child.item, child.ratePerMin, targetIndex);
    }
    return id;
  };

  const targetNodeIds = result.trees.map((tree, targetIndex) => {
    const id = targetKey(targetIndex);
    const target = result.targets[targetIndex];
    const ratePerMin = target?.ratePerMin ?? tree.ratePerMin;
    const ratePerMinByTarget = Array(targetCount).fill(0);
    ratePerMinByTarget[targetIndex] = ratePerMin;
    nodes.set(id, {
      id,
      kind: "target",
      targetIndex,
      item: tree.item,
      ratePerMin,
      ratePerMinByTarget,
      order: targetIndex,
    });
    const sourceId = visit(tree, targetIndex);
    addEdge(sourceId, id, tree.item, ratePerMin, targetIndex);
    return id;
  });

  return { nodes: [...nodes.values()], edges: [...edges.values()], targetNodeIds };
}

export function layoutProductionFlowGraph(
  graph: ProductionFlowGraph,
): ProductionFlowLayout {
  const nodeWidth = 244;
  const nodeHeight = 148;
  const columnGap = 132;
  const rowGap = 30;
  const padding = 44;
  const incoming = new Map<string, string[]>();

  for (const edge of graph.edges) {
    const sources = incoming.get(edge.targetId) ?? [];
    sources.push(edge.sourceId);
    incoming.set(edge.targetId, sources);
  }

  const depthById = new Map<string, number>();
  const assignDepth = (nodeId: string, depth: number, path: ReadonlySet<string>) => {
    if (path.has(nodeId)) return;
    const previous = depthById.get(nodeId);
    if (previous !== undefined && previous >= depth) return;
    depthById.set(nodeId, depth);
    const nextPath = new Set(path);
    nextPath.add(nodeId);
    for (const sourceId of incoming.get(nodeId) ?? []) {
      assignDepth(sourceId, depth + 1, nextPath);
    }
  };

  for (const targetId of graph.targetNodeIds) assignDepth(targetId, 0, new Set());
  for (const node of graph.nodes) {
    if (!depthById.has(node.id)) depthById.set(node.id, 0);
  }

  const maxDepth = Math.max(0, ...depthById.values());
  const columns = new Map<number, ProductionFlowNode[]>();
  for (const node of graph.nodes) {
    const depth = depthById.get(node.id) ?? 0;
    const entries = columns.get(depth) ?? [];
    entries.push(node);
    columns.set(depth, entries);
  }
  for (const entries of columns.values()) entries.sort((a, b) => a.order - b.order);

  const maxColumnSize = Math.max(1, ...[...columns.values()].map((entries) => entries.length));
  const contentHeight = maxColumnSize * nodeHeight + (maxColumnSize - 1) * rowGap;
  const height = Math.max(390, contentHeight + padding * 2);
  const width = padding * 2 + (maxDepth + 1) * nodeWidth + maxDepth * columnGap;
  const positionedNodes: PositionedProductionFlowNode[] = [];

  for (const [depth, entries] of columns) {
    const columnHeight = entries.length * nodeHeight + Math.max(0, entries.length - 1) * rowGap;
    const top = (height - columnHeight) / 2;
    entries.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        depth,
        x: padding + (maxDepth - depth) * (nodeWidth + columnGap),
        y: top + index * (nodeHeight + rowGap),
      });
    });
  }

  const positionedById = new Map(positionedNodes.map((node) => [node.id, node]));
  const positionedEdges = graph.edges.flatMap((edge) => {
    const source = positionedById.get(edge.sourceId);
    const target = positionedById.get(edge.targetId);
    return source && target ? [{ ...edge, source, target }] : [];
  });

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width,
    height,
    nodeWidth,
    nodeHeight,
  };
}
