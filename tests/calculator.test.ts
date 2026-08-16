import assert from "node:assert/strict";
import test from "node:test";

const calculatorUrl = new URL("../app/lib/calculate.ts", import.meta.url).href;
const {
  calculateProduction,
  calculateProductionPlan,
  ProductionCalculationError,
} = await import(calculatorUrl);
const dspDataUrl = new URL("../app/lib/dsp-data.ts", import.meta.url).href;
const iconDataUrl = new URL("../app/lib/dsp-icon-positions.ts", import.meta.url).href;
const flowGraphUrl = new URL("../app/lib/production-flow-graph.ts", import.meta.url).href;
const { DEFAULT_MACHINE_IDS, ITEMS, MACHINES, RECIPES } = await import(dspDataUrl);
const { getDspIconPosition } = await import(iconDataUrl);
const { buildProductionFlowGraph, layoutProductionFlowGraph } = await import(flowGraphUrl);

const item = (id: string, raw = false) => ({
  id,
  name: id,
  en: id,
  category: raw ? "raw" : "component",
  glyph: id.slice(0, 1),
  raw,
});

const baseMachines = [
  {
    id: "smelter-1",
    name: "Smelter",
    category: "smelter",
    speed: 1,
    powerMw: 0.36,
  },
  {
    id: "assembler-075",
    name: "Assembler Mk.I",
    category: "assembler",
    speed: 0.75,
    powerMw: 0.27,
  },
  {
    id: "refinery-1",
    name: "Refinery",
    category: "refinery",
    speed: 1,
    powerMw: 0.96,
  },
];

test("bundles real icons and complete production chains for all building targets", () => {
  const buildings = ITEMS.filter((entry: { building?: boolean }) => entry.building);
  assert.equal(buildings.length, 61);
  assert.deepEqual(ITEMS.filter((entry: { id: string }) => !getDspIconPosition(entry.id)), []);

  for (const building of buildings) {
    const result = calculateProduction({
      items: ITEMS,
      recipes: RECIPES,
      machines: MACHINES,
      target: { itemId: building.id, ratePerMin: 1 },
      selections: { machineByCategory: DEFAULT_MACHINE_IDS },
    });
    assert.equal(result.tree.raw, false, `${building.id} should have a production recipe`);
    assert.ok(result.rows.length > 0, `${building.id} should expand to at least one production row`);
  }
});

test("calculates a Tesla Tower line through its intermediate materials", () => {
  const result = calculateProduction({
    items: ITEMS,
    recipes: RECIPES,
    machines: MACHINES,
    target: { itemId: "tesla_tower", ratePerMin: 60 },
    selections: {
      machineByCategory: { ...DEFAULT_MACHINE_IDS, assembler: "assembler-2" },
    },
  });

  assert.equal(result.rows.find((row: { itemId: string }) => row.itemId === "tesla_tower")?.exactMachines, 1);
  assert.equal(result.rawTotals.iron_ore, 180);
  assert.equal(result.rawTotals.copper_ore, 30);
});

test("calculates recipe rates, exact machines, rounded machines and power", () => {
  const result = calculateProduction({
    items: [item("ore", true), item("plate"), item("gear")],
    recipes: [
      {
        id: "plate",
        outputId: "plate",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 1 }],
      },
      {
        id: "gear",
        outputId: "gear",
        outputQty: 1,
        timeSec: 2,
        facility: "assembler",
        inputs: [{ itemId: "plate", qty: 2 }],
      },
    ],
    machines: baseMachines,
    target: { itemId: "gear", ratePerMin: 45 },
  });

  assert.deepEqual(result.rawTotals, { ore: 90 });
  const gear = result.rows.find((row: { itemId: string }) => row.itemId === "gear");
  const plate = result.rows.find((row: { itemId: string }) => row.itemId === "plate");
  assert.equal(gear?.craftsPerMin, 45);
  assert.equal(gear?.exactMachines, 2);
  assert.equal(gear?.roundedMachines, 2);
  assert.equal(gear?.powerMw, 0.54);
  assert.equal(plate?.ratePerMin, 90);
  assert.equal(plate?.exactMachines, 1.5);
  assert.equal(plate?.roundedMachines, 2);
  assert.equal(result.tree.children[0]?.children[0]?.raw, true);
  assert.equal(result.tree.machine?.name, "Assembler Mk.I");
});

test("builds a facility-to-item production network for magnetic coils", () => {
  const result = calculateProductionPlan({
    items: ITEMS,
    recipes: RECIPES,
    machines: MACHINES,
    targets: [{ itemId: "magnetic_coil", ratePerMin: 60 }],
    selections: {
      machineByCategory: {
        ...DEFAULT_MACHINE_IDS,
        smelter: "plane-smelter",
        assembler: "assembler-3",
      },
    },
  });

  const graph = buildProductionFlowGraph(result);
  const processNodes = graph.nodes.filter((node: { kind: string }) => node.kind === "process");
  const rawNodes = graph.nodes.filter((node: { kind: string }) => node.kind === "raw");
  const targetNodes = graph.nodes.filter((node: { kind: string }) => node.kind === "target");
  assert.equal(processNodes.length, 3);
  assert.equal(rawNodes.length, 2);
  assert.equal(targetNodes.length, 1);
  assert.equal(graph.edges.length, 5);

  const coil = processNodes.find((node: { item: { id: string } }) => node.item.id === "magnetic_coil");
  const magnet = processNodes.find((node: { item: { id: string } }) => node.item.id === "magnet");
  const copper = processNodes.find((node: { item: { id: string } }) => node.item.id === "copper_ingot");
  assert.equal(coil?.machine.name, "조립기 Mk.III");
  assert.equal(coil?.roundedMachines, 1);
  assert.equal(coil?.capacityPerMachinePerMin, 180);
  assert.equal(magnet?.roundedMachines, 1);
  assert.equal(magnet?.capacityPerMachinePerMin, 80);
  assert.equal(copper?.roundedMachines, 1);
  assert.equal(copper?.capacityPerMachinePerMin, 120);

  const layout = layoutProductionFlowGraph(graph);
  const target = layout.nodes.find((node: { kind: string }) => node.kind === "target");
  assert.ok(layout.nodes.every((node: { x: number; y: number }) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(target && target.x > Math.min(...rawNodes.map((node: { id: string }) => layout.nodes.find((entry: { id: string }) => entry.id === node.id)?.x ?? Infinity)));
});

test("aggregates a shared intermediate before rounding", () => {
  const result = calculateProduction({
    items: [
      item("ore", true),
      item("shared"),
      item("left"),
      item("right"),
      item("target"),
    ],
    recipes: [
      {
        id: "shared",
        outputId: "shared",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 1 }],
      },
      {
        id: "left",
        outputId: "left",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "shared", qty: 1 }],
      },
      {
        id: "right",
        outputId: "right",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "shared", qty: 1 }],
      },
      {
        id: "target",
        outputId: "target",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [
          { itemId: "left", qty: 1 },
          { itemId: "right", qty: 1 },
        ],
      },
    ],
    machines: baseMachines,
    target: { itemId: "target", ratePerMin: 24 },
  });

  const sharedRows = result.rows.filter(
    (row: { itemId: string }) => row.itemId === "shared",
  );
  assert.equal(sharedRows.length, 1);
  assert.equal(sharedRows[0]?.ratePerMin, 48);
  assert.equal(sharedRows[0]?.exactMachines, 0.8);
  assert.equal(sharedRows[0]?.roundedMachines, 1);
  assert.deepEqual(result.rawTotals, { ore: 48 });

});

test("combines unrelated production targets into one plan", () => {
  const result = calculateProductionPlan({
    items: [
      item("iron", true),
      item("copper", true),
      item("plate"),
      item("wire"),
    ],
    recipes: [
      {
        id: "plate",
        outputId: "plate",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "iron", qty: 1 }],
      },
      {
        id: "wire",
        outputId: "wire",
        outputQty: 2,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "copper", qty: 1 }],
      },
    ],
    machines: baseMachines,
    targets: [
      { itemId: "plate", ratePerMin: 30 },
      { itemId: "wire", ratePerMin: 20 },
    ],
  });

  assert.deepEqual(result.targets, [
    { itemId: "plate", ratePerMin: 30 },
    { itemId: "wire", ratePerMin: 20 },
  ]);
  assert.deepEqual(result.rawTotals, { iron: 30, copper: 10 });
  assert.deepEqual(
    result.rows.map((row: { itemId: string }) => row.itemId),
    ["plate", "wire"],
  );
});

test("aggregates shared intermediates across targets before rounding", () => {
  const result = calculateProductionPlan({
    items: [
      item("ore", true),
      item("shared"),
      item("left"),
      item("right"),
    ],
    recipes: [
      {
        id: "shared",
        outputId: "shared",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 1 }],
      },
      {
        id: "left",
        outputId: "left",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "shared", qty: 1 }],
      },
      {
        id: "right",
        outputId: "right",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "shared", qty: 1 }],
      },
    ],
    machines: baseMachines,
    targets: [
      { itemId: "left", ratePerMin: 24 },
      { itemId: "right", ratePerMin: 24 },
    ],
  });

  const sharedRows = result.rows.filter(
    (row: { itemId: string }) => row.itemId === "shared",
  );
  assert.equal(sharedRows.length, 1);
  assert.equal(sharedRows[0]?.ratePerMin, 48);
  assert.equal(sharedRows[0]?.craftsPerMin, 48);
  assert.equal(sharedRows[0]?.exactMachines, 0.8);
  assert.equal(sharedRows[0]?.roundedMachines, 1);
  assert.deepEqual(result.rawTotals, { ore: 48 });

  const graph = buildProductionFlowGraph(result);
  const sharedNodes = graph.nodes.filter((node: { kind: string; item: { id: string } }) => node.kind === "process" && node.item.id === "shared");
  assert.equal(sharedNodes.length, 1);
  assert.equal(sharedNodes[0]?.ratePerMin, 48);
  assert.equal(sharedNodes[0]?.roundedMachines, 1);
  assert.equal(graph.targetNodeIds.length, 2);
  assert.equal(graph.edges.filter((edge: { item: { id: string } }) => edge.item.id === "shared").length, 2);
});

test("preserves duplicate target roots while aggregating their demand", () => {
  const result = calculateProductionPlan({
    items: [item("ore", true), item("plate")],
    recipes: [
      {
        id: "plate",
        outputId: "plate",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 2 }],
      },
    ],
    machines: baseMachines,
    targets: [
      { itemId: "plate", ratePerMin: 20 },
      { itemId: "plate", ratePerMin: 40 },
    ],
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.ratePerMin, 60);
  assert.equal(result.rows[0]?.craftsPerMin, 60);
  assert.deepEqual(result.rawTotals, { ore: 120 });
  assert.deepEqual(
    result.trees.map(
      (tree: { itemId: string; ratePerMin: number }) => [
        tree.itemId,
        tree.ratePerMin,
      ],
    ),
    [
      ["plate", 20],
      ["plate", 40],
    ],
  );
});

test("returns one per-target tree root in target order", () => {
  const result = calculateProductionPlan({
    items: [item("ore", true), item("plate"), item("gear")],
    recipes: [
      {
        id: "plate",
        outputId: "plate",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 1 }],
      },
      {
        id: "gear",
        outputId: "gear",
        outputQty: 1,
        timeSec: 1,
        facility: "assembler",
        inputs: [{ itemId: "plate", qty: 1 }],
      },
    ],
    machines: baseMachines,
    targets: [
      { itemId: "gear", ratePerMin: 12 },
      { itemId: "plate", ratePerMin: 18 },
    ],
  });

  assert.equal(result.trees.length, 2);
  assert.equal(result.trees[0]?.itemId, "gear");
  assert.equal(result.trees[0]?.ratePerMin, 12);
  assert.equal(result.trees[0]?.children[0]?.itemId, "plate");
  assert.equal(result.trees[1]?.itemId, "plate");
  assert.equal(result.trees[1]?.ratePerMin, 18);
});

test("honours explicit and rare-priority alternate recipe selection", () => {
  const recipes = [
    {
      id: "widget-basic",
      outputId: "widget",
      outputQty: 1,
      timeSec: 1,
      facility: "assembler",
      inputs: [{ itemId: "iron", qty: 2 }],
    },
    {
      id: "widget-rare",
      outputId: "widget",
      outputQty: 2,
      timeSec: 1,
      facility: "assembler",
      inputs: [{ itemId: "copper", qty: 3 }],
      alternate: true,
    },
  ];
  const common = {
    items: [item("iron", true), item("copper", true), item("widget")],
    recipes,
    machines: baseMachines,
    target: { itemId: "widget", ratePerMin: 60 },
  };

  const defaultResult = calculateProduction(common);
  assert.deepEqual(defaultResult.rawTotals, { iron: 120 });

  const rareResult = calculateProduction({
    ...common,
    selections: { rarePriority: true },
  });
  assert.deepEqual(rareResult.rawTotals, { copper: 90 });
  assert.equal(rareResult.rows[0]?.craftsPerMin, 30);

  const explicitResult = calculateProduction({
    ...common,
    selections: {
      rarePriority: true,
      recipeByItem: new Map([["widget", "widget-basic"]]),
    },
  });
  assert.deepEqual(explicitResult.rawTotals, { iron: 120 });
});

test("distinguishes product bonuses from machine speed", () => {
  const common = {
    items: [item("ore", true), item("plate")],
    recipes: [
      {
        id: "plate",
        outputId: "plate",
        outputQty: 1,
        timeSec: 1,
        facility: "smelter",
        inputs: [{ itemId: "ore", qty: 2 }],
      },
    ],
    target: { itemId: "plate", ratePerMin: 120 },
  };

  const bonus = calculateProduction({
    ...common,
    machines: baseMachines,
    selections: { productMultiplier: 1.25 },
  });
  assert.equal(bonus.rows[0]?.craftsPerMin, 96);
  assert.equal(bonus.rows[0]?.exactMachines, 1.6);
  assert.deepEqual(bonus.rawTotals, { ore: 192 });

  const faster = calculateProduction({
    ...common,
    machines: [
      {
        id: "fast-smelter",
        name: "Fast Smelter",
        category: "smelter",
        speed: 2,
        powerMw: 1,
      },
    ],
  });
  assert.equal(faster.rows[0]?.craftsPerMin, 120);
  assert.equal(faster.rows[0]?.exactMachines, 1);
  assert.deepEqual(faster.rawTotals, { ore: 240 });
});

test("reports byproducts without traversal-order-dependent reuse", () => {
  const result = calculateProduction({
    items: [item("crude", true), item("oil"), item("hydrogen", true)],
    recipes: [
      {
        id: "plasma-refining",
        outputId: "oil",
        outputQty: 2,
        timeSec: 4,
        facility: "refinery",
        inputs: [{ itemId: "crude", qty: 2 }],
        byproducts: [{ itemId: "hydrogen", qty: 1 }],
      },
    ],
    machines: baseMachines,
    target: { itemId: "oil", ratePerMin: 60 },
  });

  assert.deepEqual(result.rawTotals, { crude: 60 });
  assert.deepEqual(result.byproducts, { hydrogen: 30 });
  assert.equal(result.rows[0]?.craftsPerMin, 30);
  assert.equal(result.rows[0]?.exactMachines, 2);
});

test("detects dependency cycles and exposes the cycle path", () => {
  assert.throws(
    () =>
      calculateProduction({
        items: [item("a"), item("b")],
        recipes: [
          {
            id: "a-from-b",
            outputId: "a",
            outputQty: 1,
            timeSec: 1,
            facility: "assembler",
            inputs: [{ itemId: "b", qty: 1 }],
          },
          {
            id: "b-from-a",
            outputId: "b",
            outputQty: 1,
            timeSec: 1,
            facility: "assembler",
            inputs: [{ itemId: "a", qty: 1 }],
          },
        ],
        machines: baseMachines,
        target: { itemId: "a", ratePerMin: 1 },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ProductionCalculationError);
      const cycleError = error as Error & {
        code: string;
        path: readonly string[];
      };
      assert.equal(cycleError.code, "CYCLE");
      assert.deepEqual(cycleError.path, ["a", "b", "a"]);
      assert.match(cycleError.message, /a → b → a/);
      return true;
    },
  );
});

test("accepts records and maps and honours per-category machine IDs", () => {
  const items = new Map([
    ["ore", item("ore", true)],
    ["plate", item("plate")],
  ]);
  const recipes = {
    ignoredObjectKey: {
      id: "plate",
      outputId: "plate",
      outputQty: 1,
      timeSec: 1,
      facility: "smelter",
      inputs: [{ itemId: "ore", qty: 1 }],
    },
  };
  const machines = Object.fromEntries(
    baseMachines.map((machine) => [machine.id, machine]),
  );

  const result = calculateProduction({
    items,
    recipes,
    machines,
    targetItemId: "plate",
    targetRatePerMin: 60,
    selections: {
      machineIds: { smelter: "smelter-1" },
    },
  });
  assert.equal(result.rows[0]?.machineId, "smelter-1");
  assert.deepEqual(result.rawTotals, { ore: 60 });
});

test("rejects invalid targets, recipes, facilities and missing recipes", () => {
  assert.throws(
    () =>
      calculateProduction({
        items: [item("ore", true)],
        recipes: [],
        machines: [],
        target: { itemId: "ore", ratePerMin: 0 },
      }),
    (error: unknown) => {
      if (!(error instanceof ProductionCalculationError)) return false;
      return (error as Error & { code: string }).code === "INVALID_TARGET";
    },
  );

  assert.throws(
    () =>
      calculateProduction({
        items: [item("missing")],
        recipes: [],
        machines: baseMachines,
        target: { itemId: "missing", ratePerMin: 1 },
      }),
    (error: unknown) => {
      if (!(error instanceof ProductionCalculationError)) return false;
      return (error as Error & { code: string }).code === "MISSING_RECIPE";
    },
  );

  assert.throws(
    () =>
      calculateProduction({
        items: [item("ore", true), item("plate")],
        recipes: [
          {
            id: "bad",
            outputId: "plate",
            outputQty: 0,
            timeSec: 1,
            facility: "smelter",
            inputs: [{ itemId: "ore", qty: 1 }],
          },
        ],
        machines: baseMachines,
        target: { itemId: "plate", ratePerMin: 1 },
      }),
    (error: unknown) => {
      if (!(error instanceof ProductionCalculationError)) return false;
      return (error as Error & { code: string }).code === "INVALID_RECIPE";
    },
  );

  assert.throws(
    () =>
      calculateProduction({
        items: [item("ore", true), item("plate")],
        recipes: [
          {
            id: "plate",
            outputId: "plate",
            outputQty: 1,
            timeSec: 1,
            facility: "smelter",
            inputs: [{ itemId: "ore", qty: 1 }],
          },
        ],
        machines: baseMachines,
        target: { itemId: "plate", ratePerMin: 1 },
        selections: { machineByItem: { plate: "assembler-075" } },
      }),
    (error: unknown) => {
      if (!(error instanceof ProductionCalculationError)) return false;
      return (error as Error & { code: string }).code === "INVALID_MACHINE";
    },
  );
});
