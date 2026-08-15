import assert from "node:assert/strict";
import test from "node:test";

const modelUrl = new URL("../app/lib/plan-model.ts", import.meta.url).href;
const {
  PLAN_SCHEMA_VERSION,
  PlanValidationError,
  createProductionPlanPayload,
  parseProductionPlanPayload,
} = await import(modelUrl);

test("creates a versioned cloud-save payload from calculator inputs", () => {
  const payload = createProductionPlanPayload({
    targets: [
      { id: "target-1", itemId: "solar_sail", rate: 30, unit: "second" },
      { id: "target-2", itemId: "small_carrier_rocket", rate: 60, unit: "minute" },
    ],
    rarePriority: true,
    productMultiplier: 1.25,
    factoryPreset: "darkfog",
    beltCapacity: 1800,
  });

  assert.equal(payload.schemaVersion, PLAN_SCHEMA_VERSION);
  assert.equal(payload.targets.length, 2);
  assert.equal(payload.targets[0]?.unit, "second");
  assert.equal(payload.settings.factoryPreset, "darkfog");
  assert.equal(payload.settings.productMultiplier, 1.25);
});

test("parses a saved plan into fresh arrays and objects", () => {
  const source = {
    schemaVersion: 1,
    gameDataVersion: "0.10.34",
    targets: [{ id: "target-1", itemId: "solar_sail", rate: 120, unit: "minute" }],
    settings: {
      rarePriority: false,
      productMultiplier: 1,
      factoryPreset: "standard",
      beltCapacity: 720,
    },
  };
  const parsed = parseProductionPlanPayload(source);

  assert.deepEqual(parsed, source);
  assert.notEqual(parsed, source);
  assert.notEqual(parsed.targets, source.targets);
  assert.notEqual(parsed.settings, source.settings);
});

test("rejects unsupported schemas and invalid production rates", () => {
  assert.throws(
    () => parseProductionPlanPayload({
      schemaVersion: 2,
      gameDataVersion: "0.10.34",
      targets: [],
      settings: {},
    }),
    PlanValidationError,
  );

  assert.throws(
    () => parseProductionPlanPayload({
      schemaVersion: 1,
      gameDataVersion: "0.10.34",
      targets: [{ id: "bad", itemId: "solar_sail", rate: 0, unit: "minute" }],
      settings: {
        rarePriority: false,
        productMultiplier: 1,
        factoryPreset: "standard",
        beltCapacity: 720,
      },
    }),
    PlanValidationError,
  );
});
