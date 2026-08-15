import assert from "node:assert/strict";
import test from "node:test";

const calculatorUrl = new URL("../app/lib/calculate.ts", import.meta.url).href;
const {
  calculateProduction,
  ProductionCalculationError,
} = await import(calculatorUrl);

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
