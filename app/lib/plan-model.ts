import { DATA_VERSION } from "./dsp-data.ts";

export const PLAN_SCHEMA_VERSION = 1 as const;

export type PlanUnit = "minute" | "second";
export type FactoryPresetId = "starter" | "standard" | "darkfog";

export type PlanTargetDraft = {
  id: string;
  itemId: string;
  rate: number;
  unit: PlanUnit;
};

export type ProductionPlanPayload = {
  schemaVersion: typeof PLAN_SCHEMA_VERSION;
  gameDataVersion: string;
  targets: PlanTargetDraft[];
  settings: {
    rarePriority: boolean;
    productMultiplier: number;
    factoryPreset: FactoryPresetId;
    beltCapacity: number;
  };
};

export type SavedProductionPlan = {
  id: string;
  ownerId: string;
  name: string;
  payload: ProductionPlanPayload;
  revision: number;
  createdAt: string;
  updatedAt: string;
  syncState: "synced" | "pending";
};

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

const PRESETS = new Set<FactoryPresetId>(["starter", "standard", "darkfog"]);

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlanValidationError(`${label} 형식이 올바르지 않습니다.`);
  }
  return value as Record<string, unknown>;
}

function requirePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new PlanValidationError(`${label}은 0보다 큰 숫자여야 합니다.`);
  }
  return value;
}

export function parseProductionPlanPayload(value: unknown): ProductionPlanPayload {
  const root = requireObject(value, "생산 계획");
  if (root.schemaVersion !== PLAN_SCHEMA_VERSION) {
    throw new PlanValidationError("지원하지 않는 생산 계획 버전입니다.");
  }

  if (typeof root.gameDataVersion !== "string" || !root.gameDataVersion.trim()) {
    throw new PlanValidationError("게임 데이터 버전이 없습니다.");
  }

  if (!Array.isArray(root.targets) || root.targets.length === 0) {
    throw new PlanValidationError("생산 목표가 하나 이상 필요합니다.");
  }

  const targets = root.targets.map((targetValue, index) => {
    const target = requireObject(targetValue, `${index + 1}번째 생산 목표`);
    if (typeof target.id !== "string" || !target.id.trim()) {
      throw new PlanValidationError(`${index + 1}번째 생산 목표 ID가 없습니다.`);
    }
    if (typeof target.itemId !== "string" || !target.itemId.trim()) {
      throw new PlanValidationError(`${index + 1}번째 생산 물품이 없습니다.`);
    }
    if (target.unit !== "minute" && target.unit !== "second") {
      throw new PlanValidationError(`${index + 1}번째 생산량 단위가 올바르지 않습니다.`);
    }

    return {
      id: target.id,
      itemId: target.itemId,
      rate: requirePositiveNumber(target.rate, `${index + 1}번째 생산량`),
      unit: target.unit,
    } satisfies PlanTargetDraft;
  });

  const settings = requireObject(root.settings, "계산 설정");
  if (typeof settings.rarePriority !== "boolean") {
    throw new PlanValidationError("희귀 자원 설정이 올바르지 않습니다.");
  }
  if (typeof settings.factoryPreset !== "string" || !PRESETS.has(settings.factoryPreset as FactoryPresetId)) {
    throw new PlanValidationError("설비 세대 설정이 올바르지 않습니다.");
  }

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    gameDataVersion: root.gameDataVersion,
    targets,
    settings: {
      rarePriority: settings.rarePriority,
      productMultiplier: requirePositiveNumber(settings.productMultiplier, "증산 배율"),
      factoryPreset: settings.factoryPreset as FactoryPresetId,
      beltCapacity: requirePositiveNumber(settings.beltCapacity, "벨트 처리량"),
    },
  };
}

export function createProductionPlanPayload(input: {
  targets: PlanTargetDraft[];
  rarePriority: boolean;
  productMultiplier: number;
  factoryPreset: FactoryPresetId;
  beltCapacity: number;
}): ProductionPlanPayload {
  return parseProductionPlanPayload({
    schemaVersion: PLAN_SCHEMA_VERSION,
    gameDataVersion: DATA_VERSION,
    targets: input.targets,
    settings: {
      rarePriority: input.rarePriority,
      productMultiplier: input.productMultiplier,
      factoryPreset: input.factoryPreset,
      beltCapacity: input.beltCapacity,
    },
  });
}

export function createProductionPlanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
