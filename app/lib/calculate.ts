export type FacilityCategory =
  | "smelter"
  | "assembler"
  | "chemical"
  | "refinery"
  | "lab"
  | "collider";

export interface Item {
  id: string;
  name: string;
  en: string;
  category: string;
  glyph: string;
  raw?: boolean;
}

export interface Ingredient {
  itemId: string;
  qty: number;
}

export interface Recipe {
  id: string;
  outputId: string;
  outputQty: number;
  timeSec: number;
  facility: FacilityCategory;
  inputs: readonly Ingredient[];
  byproducts?: readonly Ingredient[];
  alternate?: boolean;
  productive?: boolean;
}

export interface Machine {
  id: string;
  name: string;
  category: FacilityCategory;
  speed: number;
  powerMw: number;
}

export type DataCollection<T extends { id: string }> =
  | readonly T[]
  | ReadonlyMap<string, T>
  | Readonly<Record<string, T>>;

export type SelectionMap<T> =
  | ReadonlyMap<string, T>
  | Readonly<Record<string, T>>;

export interface ProductionTarget {
  itemId: string;
  ratePerMin: number;
}

export interface ProductionSelections {
  /** Explicit recipe choice by output item ID. */
  recipeByItem?: SelectionMap<string>;
  /** Alias for recipeByItem, useful for serialised settings. */
  recipeIds?: SelectionMap<string>;
  /** Prefer alternate recipes when there is no explicit recipe choice. */
  rarePriority?: boolean;
  /** Alias for rarePriority. */
  preferRareRecipes?: boolean;
  /** Product output multiplier, for example 1.25 for proliferator Mk.III. */
  productMultiplier?: number;
  /** Per-item override of productMultiplier. */
  productMultiplierByItem?: SelectionMap<number>;
  /** Machine choice by facility category. */
  machineByCategory?: SelectionMap<string>;
  /** Alias for machineByCategory. */
  machineIds?: SelectionMap<string>;
  /** Optional machine override for a particular output item. */
  machineByItem?: SelectionMap<string>;
  /** Force selected items to remain raw leaves. */
  treatAsRaw?: readonly string[] | ReadonlySet<string>;
}

export interface CalculateProductionInput {
  items: DataCollection<Item>;
  recipes: DataCollection<Recipe>;
  machines: DataCollection<Machine>;
  target?: ProductionTarget;
  /** Top-level aliases allow simple form state to be passed directly. */
  targetItemId?: string;
  targetRatePerMin?: number;
  selections?: ProductionSelections;
}

export interface ProductionRow {
  itemId: string;
  item: Item;
  ratePerMin: number;
  recipeId: string;
  recipe: Recipe;
  craftsPerMin: number;
  productMultiplier: number;
  machineId: string;
  machine: Machine;
  exactMachines: number;
  roundedMachines: number;
  exactPowerMw: number;
  powerMw: number;
}

export interface ProductionTreeNode {
  itemId: string;
  item: Item;
  ratePerMin: number;
  raw: boolean;
  recipeId?: string;
  craftsPerMin?: number;
  productMultiplier?: number;
  machineId?: string;
  exactMachines?: number;
  roundedMachines?: number;
  exactPowerMw?: number;
  powerMw?: number;
  children: ProductionTreeNode[];
}

export interface ProductionCalculationResult {
  target: ProductionTarget;
  rows: ProductionRow[];
  rawTotals: Record<string, number>;
  byproducts: Record<string, number>;
  tree: ProductionTreeNode;
  totalExactMachines: number;
  totalRoundedMachines: number;
  totalExactPowerMw: number;
  totalPowerMw: number;
}

export type CalculationErrorCode =
  | "INVALID_TARGET"
  | "UNKNOWN_ITEM"
  | "MISSING_RECIPE"
  | "INVALID_RECIPE"
  | "MISSING_MACHINE"
  | "INVALID_MACHINE"
  | "CYCLE"
  | "MAX_DEPTH";

export class ProductionCalculationError extends Error {
  readonly code: CalculationErrorCode;
  readonly path?: readonly string[];

  constructor(
    code: CalculationErrorCode,
    message: string,
    path?: readonly string[],
  ) {
    super(message);
    this.name = "ProductionCalculationError";
    this.code = code;
    this.path = path;
  }
}

const MAX_DEPTH = 256;
const CEIL_EPSILON = 1e-10;

interface MutableProductionRow {
  itemId: string;
  item: Item;
  ratePerMin: number;
  recipeId: string;
  recipe: Recipe;
  craftsPerMin: number;
  productMultiplier: number;
  machineId: string;
  machine: Machine;
}

function indexCollection<T extends { id: string }>(
  collection: DataCollection<T>,
  label: string,
): Map<string, T> {
  const entries: readonly (readonly [string, T])[] = Array.isArray(collection)
    ? collection.map((value) => [value.id, value] as const)
    : collection instanceof Map
      ? [...collection.entries()]
      : Object.entries(collection as Readonly<Record<string, T>>);

  const result = new Map<string, T>();
  for (const [key, value] of entries) {
    const id = value.id || key;
    if (!id) {
      throw new ProductionCalculationError(
        "INVALID_RECIPE",
        `${label} contains an entry without an id.`,
      );
    }
    if (result.has(id)) {
      throw new ProductionCalculationError(
        "INVALID_RECIPE",
        `${label} contains duplicate id "${id}".`,
      );
    }
    result.set(id, value);
  }
  return result;
}

function getSelection<T>(
  selection: SelectionMap<T> | undefined,
  key: string,
): T | undefined {
  if (!selection) return undefined;
  const possibleMap = selection as ReadonlyMap<string, T>;
  if (typeof possibleMap.get === "function") {
    return possibleMap.get(key);
  }
  return (selection as Readonly<Record<string, T>>)[key];
}

function hasRawOverride(
  selection: ProductionSelections,
  itemId: string,
): boolean {
  const overrides = selection.treatAsRaw;
  if (!overrides) return false;
  if ("has" in overrides && typeof overrides.has === "function") {
    return overrides.has(itemId);
  }
  return (overrides as readonly string[]).includes(itemId);
}

function roundedMachineCount(exact: number): number {
  const nearestInteger = Math.round(exact);
  if (Math.abs(exact - nearestInteger) <= CEIL_EPSILON) {
    return nearestInteger;
  }
  return Math.ceil(exact);
}

function requirePositiveFinite(
  value: number,
  description: string,
  code: CalculationErrorCode,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ProductionCalculationError(
      code,
      `${description} must be a positive finite number.`,
    );
  }
}

function requireNonNegativeFinite(
  value: number,
  description: string,
  code: CalculationErrorCode,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ProductionCalculationError(
      code,
      `${description} must be a non-negative finite number.`,
    );
  }
}

/**
 * Calculate one production target in items per minute.
 *
 * Recipes are traversed as a single-primary-output dependency graph. Secondary
 * outputs are reported as gross byproducts and deliberately are not fed back
 * into the graph; doing so greedily would make oil/hydrogen results depend on
 * traversal order.
 */
export function calculateProduction(
  input: CalculateProductionInput,
): ProductionCalculationResult {
  const itemIndex = indexCollection(input.items, "items");
  const recipeIndex = indexCollection(input.recipes, "recipes");
  const machineIndex = indexCollection(input.machines, "machines");
  const selections = input.selections ?? {};

  const target: ProductionTarget = input.target ?? {
    itemId: input.targetItemId ?? "",
    ratePerMin: input.targetRatePerMin ?? Number.NaN,
  };

  if (!target.itemId) {
    throw new ProductionCalculationError(
      "INVALID_TARGET",
      "A target item ID is required.",
    );
  }
  requirePositiveFinite(
    target.ratePerMin,
    "Target rate per minute",
    "INVALID_TARGET",
  );

  const recipesByOutput = new Map<string, Recipe[]>();
  for (const recipe of recipeIndex.values()) {
    requirePositiveFinite(
      recipe.timeSec,
      `Recipe "${recipe.id}" timeSec`,
      "INVALID_RECIPE",
    );
    requirePositiveFinite(
      recipe.outputQty,
      `Recipe "${recipe.id}" outputQty`,
      "INVALID_RECIPE",
    );
    for (const ingredient of [
      ...recipe.inputs,
      ...(recipe.byproducts ?? []),
    ]) {
      requirePositiveFinite(
        ingredient.qty,
        `Ingredient "${ingredient.itemId}" quantity in recipe "${recipe.id}"`,
        "INVALID_RECIPE",
      );
      if (!itemIndex.has(ingredient.itemId)) {
        throw new ProductionCalculationError(
          "UNKNOWN_ITEM",
          `Recipe "${recipe.id}" references unknown item "${ingredient.itemId}".`,
        );
      }
    }
    if (!itemIndex.has(recipe.outputId)) {
      throw new ProductionCalculationError(
        "UNKNOWN_ITEM",
        `Recipe "${recipe.id}" produces unknown item "${recipe.outputId}".`,
      );
    }
    const choices = recipesByOutput.get(recipe.outputId) ?? [];
    choices.push(recipe);
    recipesByOutput.set(recipe.outputId, choices);
  }

  for (const machine of machineIndex.values()) {
    requirePositiveFinite(
      machine.speed,
      `Machine "${machine.id}" speed`,
      "INVALID_MACHINE",
    );
    requireNonNegativeFinite(
      machine.powerMw,
      `Machine "${machine.id}" powerMw`,
      "INVALID_MACHINE",
    );
  }

  const rowTotals = new Map<string, MutableProductionRow>();
  const rawTotals = new Map<string, number>();
  const byproductTotals = new Map<string, number>();

  function explicitRecipeId(itemId: string): string | undefined {
    return (
      getSelection(selections.recipeByItem, itemId) ??
      getSelection(selections.recipeIds, itemId)
    );
  }

  function resolveRecipe(item: Item): Recipe | undefined {
    const selectedId = explicitRecipeId(item.id);
    if (selectedId) {
      const selected = recipeIndex.get(selectedId);
      if (!selected) {
        throw new ProductionCalculationError(
          "INVALID_RECIPE",
          `Selected recipe "${selectedId}" for "${item.id}" does not exist.`,
        );
      }
      if (selected.outputId !== item.id) {
        throw new ProductionCalculationError(
          "INVALID_RECIPE",
          `Selected recipe "${selectedId}" does not produce "${item.id}".`,
        );
      }
      return selected;
    }

    if (item.raw || hasRawOverride(selections, item.id)) return undefined;

    const choices = recipesByOutput.get(item.id) ?? [];
    if (choices.length === 0) {
      throw new ProductionCalculationError(
        "MISSING_RECIPE",
        `No recipe is available for non-raw item "${item.id}".`,
      );
    }

    const preferAlternate =
      selections.rarePriority === true ||
      selections.preferRareRecipes === true;
    return preferAlternate
      ? (choices.find((recipe) => recipe.alternate) ?? choices[0])
      : (choices.find((recipe) => !recipe.alternate) ?? choices[0]);
  }

  function resolveProductMultiplier(itemId: string, recipe: Recipe): number {
    if (recipe.productive === false) return 1;
    const multiplier =
      getSelection(selections.productMultiplierByItem, itemId) ??
      selections.productMultiplier ??
      1;
    requirePositiveFinite(
      multiplier,
      `Product multiplier for "${itemId}"`,
      "INVALID_RECIPE",
    );
    return multiplier;
  }

  function resolveMachine(itemId: string, recipe: Recipe): Machine {
    const selectedId =
      getSelection(selections.machineByItem, itemId) ??
      getSelection(selections.machineByCategory, recipe.facility) ??
      getSelection(selections.machineIds, recipe.facility);

    let machine: Machine | undefined;
    if (selectedId) {
      machine = machineIndex.get(selectedId);
      if (!machine) {
        throw new ProductionCalculationError(
          "MISSING_MACHINE",
          `Selected machine "${selectedId}" for "${itemId}" does not exist.`,
        );
      }
    } else {
      machine = [...machineIndex.values()].find(
        (candidate) => candidate.category === recipe.facility,
      );
    }

    if (!machine) {
      throw new ProductionCalculationError(
        "MISSING_MACHINE",
        `No ${recipe.facility} machine is available for recipe "${recipe.id}".`,
      );
    }
    if (machine.category !== recipe.facility) {
      throw new ProductionCalculationError(
        "INVALID_MACHINE",
        `Machine "${machine.id}" cannot run ${recipe.facility} recipe "${recipe.id}".`,
      );
    }
    return machine;
  }

  function expand(
    itemId: string,
    ratePerMin: number,
    path: readonly string[],
  ): ProductionTreeNode {
    const item = itemIndex.get(itemId);
    if (!item) {
      throw new ProductionCalculationError(
        "UNKNOWN_ITEM",
        `Unknown item "${itemId}".`,
      );
    }

    if (path.length >= MAX_DEPTH) {
      throw new ProductionCalculationError(
        "MAX_DEPTH",
        `Production graph exceeds the maximum depth of ${MAX_DEPTH}.`,
        [...path, itemId],
      );
    }

    const cycleStart = path.indexOf(itemId);
    if (cycleStart >= 0) {
      const cycle = [...path.slice(cycleStart), itemId];
      throw new ProductionCalculationError(
        "CYCLE",
        `Production cycle detected: ${cycle.join(" → ")}`,
        cycle,
      );
    }

    const forcedRaw = hasRawOverride(selections, itemId);
    const recipe = forcedRaw ? undefined : resolveRecipe(item);
    if (!recipe) {
      rawTotals.set(itemId, (rawTotals.get(itemId) ?? 0) + ratePerMin);
      return {
        itemId,
        item,
        ratePerMin,
        raw: true,
        children: [],
      };
    }

    const productMultiplier = resolveProductMultiplier(itemId, recipe);
    const craftsPerMin =
      ratePerMin / (recipe.outputQty * productMultiplier);
    const machine = resolveMachine(itemId, recipe);
    const craftsPerMachinePerMin =
      (60 / recipe.timeSec) * machine.speed;
    const exactMachines = craftsPerMin / craftsPerMachinePerMin;
    const roundedMachines = roundedMachineCount(exactMachines);

    const aggregateKey = [
      itemId,
      recipe.id,
      machine.id,
      productMultiplier,
    ].join("\u0000");
    const row = rowTotals.get(aggregateKey);
    if (row) {
      row.ratePerMin += ratePerMin;
      row.craftsPerMin += craftsPerMin;
    } else {
      rowTotals.set(aggregateKey, {
        itemId,
        item,
        ratePerMin,
        recipeId: recipe.id,
        recipe,
        craftsPerMin,
        productMultiplier,
        machineId: machine.id,
        machine,
      });
    }

    for (const byproduct of recipe.byproducts ?? []) {
      const rate = craftsPerMin * byproduct.qty * productMultiplier;
      byproductTotals.set(
        byproduct.itemId,
        (byproductTotals.get(byproduct.itemId) ?? 0) + rate,
      );
    }

    const nextPath = [...path, itemId];
    const children = recipe.inputs.map((ingredient) =>
      expand(ingredient.itemId, craftsPerMin * ingredient.qty, nextPath),
    );

    return {
      itemId,
      item,
      ratePerMin,
      raw: false,
      recipeId: recipe.id,
      craftsPerMin,
      productMultiplier,
      machineId: machine.id,
      exactMachines,
      roundedMachines,
      exactPowerMw: exactMachines * machine.powerMw,
      powerMw: roundedMachines * machine.powerMw,
      children,
    };
  }

  const tree = expand(target.itemId, target.ratePerMin, []);

  const rows: ProductionRow[] = [...rowTotals.values()].map((row) => {
    const craftsPerMachinePerMin =
      (60 / row.recipe.timeSec) * row.machine.speed;
    const exactMachines = row.craftsPerMin / craftsPerMachinePerMin;
    const roundedMachines = roundedMachineCount(exactMachines);
    return {
      ...row,
      exactMachines,
      roundedMachines,
      exactPowerMw: exactMachines * row.machine.powerMw,
      powerMw: roundedMachines * row.machine.powerMw,
    };
  });

  const recordFromMap = (values: ReadonlyMap<string, number>) =>
    Object.fromEntries(values) as Record<string, number>;

  return {
    target: { ...target },
    rows,
    rawTotals: recordFromMap(rawTotals),
    byproducts: recordFromMap(byproductTotals),
    tree,
    totalExactMachines: rows.reduce(
      (total, row) => total + row.exactMachines,
      0,
    ),
    totalRoundedMachines: rows.reduce(
      (total, row) => total + row.roundedMachines,
      0,
    ),
    totalExactPowerMw: rows.reduce(
      (total, row) => total + row.exactPowerMw,
      0,
    ),
    totalPowerMw: rows.reduce((total, row) => total + row.powerMw, 0),
  };
}
