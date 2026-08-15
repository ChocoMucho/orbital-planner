import { getCloudClient } from "./cloud.ts";
import {
  PLAN_SCHEMA_VERSION,
  createProductionPlanId,
  parseProductionPlanPayload,
  type ProductionPlanPayload,
  type SavedProductionPlan,
} from "./plan-model.ts";

type PlanRow = {
  id: string;
  owner_id: string;
  name: string;
  payload: unknown;
  revision: number;
  created_at: string;
  updated_at: string;
};

type PendingMutation =
  | { type: "upsert"; plan: SavedProductionPlan }
  | { type: "delete"; ownerId: string; planId: string };

export type PlanListResult = {
  plans: SavedProductionPlan[];
  source: "cloud" | "cache";
  warning?: string;
};

function storageKey(ownerId: string): string {
  return `orbital-planner:plans:${ownerId}`;
}

function pendingKey(ownerId: string): string {
  return `orbital-planner:pending:${ownerId}`;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasLocalStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readCachedPlans(ownerId: string): SavedProductionPlan[] {
  return readJson<SavedProductionPlan[]>(storageKey(ownerId), [])
    .map((plan) => {
      try {
        return { ...plan, payload: parseProductionPlanPayload(plan.payload) };
      } catch {
        return null;
      }
    })
    .filter((plan): plan is SavedProductionPlan => Boolean(plan))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function writeCachedPlans(ownerId: string, plans: SavedProductionPlan[]): void {
  writeJson(storageKey(ownerId), plans);
}

function mapRow(row: PlanRow): SavedProductionPlan {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    payload: parseProductionPlanPayload(row.payload),
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: "synced",
  };
}

function cachePlan(plan: SavedProductionPlan): void {
  const plans = readCachedPlans(plan.ownerId).filter((entry) => entry.id !== plan.id);
  writeCachedPlans(plan.ownerId, [plan, ...plans]);
}

function removeCachedPlan(ownerId: string, planId: string): void {
  writeCachedPlans(ownerId, readCachedPlans(ownerId).filter((plan) => plan.id !== planId));
}

function readPending(ownerId: string): PendingMutation[] {
  return readJson<PendingMutation[]>(pendingKey(ownerId), []);
}

function writePending(ownerId: string, mutations: PendingMutation[]): void {
  writeJson(pendingKey(ownerId), mutations);
}

function queueMutation(ownerId: string, mutation: PendingMutation): void {
  const mutations = readPending(ownerId).filter((entry) => {
    const entryId = entry.type === "upsert" ? entry.plan.id : entry.planId;
    const nextId = mutation.type === "upsert" ? mutation.plan.id : mutation.planId;
    return entryId !== nextId;
  });
  writePending(ownerId, [...mutations, mutation]);
}

async function pushPlan(plan: SavedProductionPlan): Promise<SavedProductionPlan> {
  const cloudClient = getCloudClient();
  if (!cloudClient) throw new Error("클라우드가 설정되지 않았습니다.");

  const { data, error } = await cloudClient
    .from("plans")
    .upsert({
      id: plan.id,
      owner_id: plan.ownerId,
      name: plan.name,
      payload: plan.payload,
      schema_version: PLAN_SCHEMA_VERSION,
      game_data_version: plan.payload.gameDataVersion,
    }, { onConflict: "id" })
    .select("id, owner_id, name, payload, revision, created_at, updated_at")
    .single();
  if (error) throw error;
  return mapRow(data as PlanRow);
}

export async function syncPendingPlans(ownerId: string): Promise<string | undefined> {
  const cloudClient = getCloudClient();
  if (!cloudClient) return "클라우드 연결 정보가 없습니다.";

  const pending = readPending(ownerId);
  const remaining: PendingMutation[] = [];
  let warning: string | undefined;

  for (const mutation of pending) {
    try {
      if (mutation.type === "upsert") {
        const synced = await pushPlan(mutation.plan);
        cachePlan(synced);
      } else {
        const { error } = await cloudClient
          .from("plans")
          .delete()
          .eq("id", mutation.planId)
          .eq("owner_id", mutation.ownerId);
        if (error) throw error;
      }
    } catch (syncError) {
      remaining.push(mutation);
      warning = syncError instanceof Error ? syncError.message : "일부 변경을 동기화하지 못했습니다.";
    }
  }

  writePending(ownerId, remaining);
  return warning;
}

export async function listProductionPlans(ownerId: string): Promise<PlanListResult> {
  const cached = readCachedPlans(ownerId);
  const cloudClient = getCloudClient();
  if (!cloudClient) return { plans: cached, source: "cache", warning: "클라우드가 설정되지 않았습니다." };

  const syncWarning = await syncPendingPlans(ownerId);
  const { data, error } = await cloudClient
    .from("plans")
    .select("id, owner_id, name, payload, revision, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return { plans: cached, source: "cache", warning: error.message };
  }

  const plans = (data as PlanRow[]).map(mapRow);
  writeCachedPlans(ownerId, plans);
  return { plans, source: "cloud", warning: syncWarning };
}

export async function saveProductionPlan(input: {
  ownerId: string;
  id?: string;
  name: string;
  payload: ProductionPlanPayload;
}): Promise<SavedProductionPlan> {
  const now = new Date().toISOString();
  const cached = input.id
    ? readCachedPlans(input.ownerId).find((plan) => plan.id === input.id)
    : undefined;
  const pendingPlan: SavedProductionPlan = {
    id: input.id ?? createProductionPlanId(),
    ownerId: input.ownerId,
    name: input.name.trim() || "새 생산 계획",
    payload: parseProductionPlanPayload(input.payload),
    revision: cached?.revision ?? 0,
    createdAt: cached?.createdAt ?? now,
    updatedAt: now,
    syncState: "pending",
  };

  cachePlan(pendingPlan);
  queueMutation(input.ownerId, { type: "upsert", plan: pendingPlan });

  try {
    const synced = await pushPlan(pendingPlan);
    cachePlan(synced);
    writePending(input.ownerId, readPending(input.ownerId).filter((mutation) => {
      const mutationId = mutation.type === "upsert" ? mutation.plan.id : mutation.planId;
      return mutationId !== synced.id;
    }));
    return synced;
  } catch {
    return pendingPlan;
  }
}

export async function deleteProductionPlan(ownerId: string, planId: string): Promise<boolean> {
  removeCachedPlan(ownerId, planId);
  queueMutation(ownerId, { type: "delete", ownerId, planId });

  const cloudClient = getCloudClient();
  if (!cloudClient) return false;
  const { error } = await cloudClient
    .from("plans")
    .delete()
    .eq("id", planId)
    .eq("owner_id", ownerId);
  if (error) return false;

  writePending(ownerId, readPending(ownerId).filter((mutation) => {
    const mutationId = mutation.type === "upsert" ? mutation.plan.id : mutation.planId;
    return mutationId !== planId;
  }));
  return true;
}
