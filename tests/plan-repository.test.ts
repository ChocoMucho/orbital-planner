import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: storage },
});

const modelUrl = new URL("../app/lib/plan-model.ts", import.meta.url).href;
const repositoryUrl = new URL("../app/lib/plan-repository.ts", import.meta.url).href;
const { createProductionPlanPayload } = await import(modelUrl);
const { deleteProductionPlan, listProductionPlans, saveProductionPlan } = await import(repositoryUrl);

const payload = createProductionPlanPayload({
  targets: [{ id: "target-1", itemId: "solar_sail", rate: 60, unit: "minute" }],
  rarePriority: false,
  productMultiplier: 1,
  factoryPreset: "standard",
  beltCapacity: 1800,
});

test("keeps unsynced plans in the owner-scoped offline cache", async () => {
  storage.clear();
  const saved = await saveProductionPlan({
    ownerId: "owner-a",
    name: "로켓 공장",
    payload,
  });

  assert.equal(saved.syncState, "pending");
  assert.equal(saved.name, "로켓 공장");

  const ownerPlans = await listProductionPlans("owner-a");
  const otherOwnerPlans = await listProductionPlans("owner-b");
  assert.equal(ownerPlans.source, "cache");
  assert.equal(ownerPlans.plans.length, 1);
  assert.equal(ownerPlans.plans[0]?.id, saved.id);
  assert.equal(otherOwnerPlans.plans.length, 0);
});

test("queues an offline deletion and hides the deleted plan immediately", async () => {
  storage.clear();
  const saved = await saveProductionPlan({ ownerId: "owner-a", name: "삭제할 계획", payload });
  const synced = await deleteProductionPlan("owner-a", saved.id);
  const result = await listProductionPlans("owner-a");

  assert.equal(synced, false);
  assert.deepEqual(result.plans, []);
});
