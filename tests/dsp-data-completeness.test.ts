import assert from "node:assert/strict";
import test from "node:test";

const dspDataUrl = new URL("../app/lib/dsp-data.ts", import.meta.url).href;
const { ITEMS, RECIPES } = await import(dspDataUrl);

// The 111 non-building item IDs in the DSP 0.10.34 reference catalog.
// accumulator_full is checked separately because it represents a charged
// building state rather than an independently selectable building.
const EXPECTED_REFERENCE_ITEM_IDS = [
  "iron_ore",
  "copper_ore",
  "silicon_ore",
  "titanium_ore",
  "stone",
  "coal",
  "log",
  "plant_fuel",
  "fire_ice",
  "kimberlite_ore",
  "fractal_silicon",
  "optical_grating_crystal",
  "spiniform_crystal",
  "unipolar_magnet",
  "iron_ingot",
  "copper_ingot",
  "high_purity_silicon",
  "titanium_ingot",
  "stone_brick",
  "energetic_graphite",
  "steel",
  "titanium_alloy",
  "glass",
  "titanium_glass",
  "prism",
  "diamond",
  "crystal_silicon",
  "gear",
  "magnet",
  "magnetic_coil",
  "electric_motor",
  "electromagnetic_turbine",
  "super_magnetic_ring",
  "particle_container",
  "strange_matter",
  "circuit_board",
  "processor",
  "quantum_chip",
  "microcrystalline_component",
  "plane_filter",
  "particle_broadband",
  "plasma_exciter",
  "photon_combiner",
  "solar_sail",
  "water",
  "crude_oil",
  "refined_oil",
  "sulfuric_acid",
  "hydrogen",
  "deuterium",
  "antimatter",
  "critical_photon",
  "hydrogen_fuel_rod",
  "deuteron_fuel_rod",
  "antimatter_fuel_rod",
  "df_strange_annihilation_fuel_rod",
  "plastic",
  "graphene",
  "carbon_nanotube",
  "organic_crystal",
  "titanium_crystal",
  "casimir_crystal",
  "df_combustible_unit",
  "df_explosive_unit",
  "df_crystal_explosive_unit",
  "graviton_lens",
  "space_warper",
  "annihilation_constraint_sphere",
  "df_engine",
  "thruster",
  "reinforced_thruster",
  "logistics_bot",
  "logistics_drone",
  "logistics_vessel",
  "frame_material",
  "dyson_sphere_component",
  "small_carrier_rocket",
  "foundation",
  "proliferator_1",
  "proliferator_2",
  "proliferator_3",
  "df_magnum_ammo_box",
  "df_titanium_ammo_box",
  "df_superalloy_ammo_box",
  "df_shell_set",
  "df_high_explosive_shell_set",
  "df_crystal_shell_set",
  "df_plasma_capsule",
  "df_antimatter_capsule",
  "df_missile_set",
  "df_supersonic_missile_set",
  "df_gravity_missile_set",
  "df_jamming_capsule",
  "df_suppressing_capsule",
  "df_prototype",
  "df_precision_drone",
  "df_attack_drone",
  "df_corvette",
  "df_destroyer",
  "df_dark_fog_matrix",
  "df_silicon_based_neuron",
  "df_matter_recombinator",
  "df_negentropy_singularity",
  "df_core_element",
  "df_energy_shard",
  "electromagnetic_matrix",
  "energy_matrix",
  "structure_matrix",
  "information_matrix",
  "gravity_matrix",
  "universe_matrix",
] as const;

const PREVIOUSLY_MISSING_ITEM_IDS = [
  "log",
  "plant_fuel",
  "critical_photon",
  "df_strange_annihilation_fuel_rod",
  "df_combustible_unit",
  "df_explosive_unit",
  "df_crystal_explosive_unit",
  "space_warper",
  "thruster",
  "logistics_bot",
  "logistics_drone",
  "logistics_vessel",
  "foundation",
  "proliferator_1",
  "proliferator_2",
  "proliferator_3",
  "df_magnum_ammo_box",
  "df_titanium_ammo_box",
  "df_superalloy_ammo_box",
  "df_shell_set",
  "df_high_explosive_shell_set",
  "df_crystal_shell_set",
  "df_plasma_capsule",
  "df_antimatter_capsule",
  "df_missile_set",
  "df_supersonic_missile_set",
  "df_gravity_missile_set",
  "df_jamming_capsule",
  "df_suppressing_capsule",
  "df_prototype",
  "df_precision_drone",
  "df_attack_drone",
  "df_corvette",
  "df_destroyer",
  "df_core_element",
] as const;

const NON_CRAFTABLE_ADDITIONS = new Set(["log", "plant_fuel", "df_core_element"]);
const CRAFTABLE_ADDITION_IDS = PREVIOUSLY_MISSING_ITEM_IDS.filter(
  (id) => !NON_CRAFTABLE_ADDITIONS.has(id),
);

test("matches the complete 111-item DSP reference catalog", () => {
  const expectedIds = new Set<string>(EXPECTED_REFERENCE_ITEM_IDS);
  const referenceItems = ITEMS.filter(
    (item: { id: string; building?: boolean }) =>
      !item.building && item.id !== "accumulator_full",
  );
  const actualIds = new Set<string>(
    referenceItems.map((item: { id: string }) => item.id),
  );

  assert.equal(EXPECTED_REFERENCE_ITEM_IDS.length, 111);
  assert.equal(referenceItems.length, 111);
  assert.equal(actualIds.size, 111, "reference item IDs must be unique");
  assert.deepEqual(
    EXPECTED_REFERENCE_ITEM_IDS.filter((id) => !actualIds.has(id)),
    [],
    "reference items are missing",
  );
  assert.deepEqual(
    [...actualIds].filter((id) => !expectedIds.has(id)),
    [],
    "unexpected non-building items were added to the reference catalog",
  );
});

test("contains every previously missing item and recipes for all 32 craftable additions", () => {
  const itemIds = new Set<string>(
    ITEMS.map((item: { id: string }) => item.id),
  );
  const recipeOutputIds = new Set<string>(
    RECIPES.map((recipe: { outputId: string }) => recipe.outputId),
  );

  assert.equal(PREVIOUSLY_MISSING_ITEM_IDS.length, 35);
  assert.equal(CRAFTABLE_ADDITION_IDS.length, 32);
  assert.deepEqual(
    PREVIOUSLY_MISSING_ITEM_IDS.filter((id) => !itemIds.has(id)),
    [],
    "previously missing items are still absent",
  );
  assert.deepEqual(
    CRAFTABLE_ADDITION_IDS.filter((id) => !recipeOutputIds.has(id)),
    [],
    "craftable additions must each have a production recipe",
  );
});

test("does not reference unknown items from any recipe", () => {
  const itemIds = new Set<string>(
    ITEMS.map((item: { id: string }) => item.id),
  );
  const unknownReferences: string[] = [];

  for (const recipe of RECIPES) {
    if (!itemIds.has(recipe.outputId)) {
      unknownReferences.push(`${recipe.id}:output:${recipe.outputId}`);
    }
    for (const input of recipe.inputs) {
      if (!itemIds.has(input.itemId)) {
        unknownReferences.push(`${recipe.id}:input:${input.itemId}`);
      }
    }
    for (const byproduct of recipe.byproducts ?? []) {
      if (!itemIds.has(byproduct.itemId)) {
        unknownReferences.push(`${recipe.id}:byproduct:${byproduct.itemId}`);
      }
    }
  }

  assert.deepEqual(unknownReferences, []);
});

test("keeps 61 selectable buildings and supports the charged accumulator state", () => {
  const buildings = ITEMS.filter(
    (item: { building?: boolean }) => item.building,
  );
  const buildingIds = new Set<string>(
    buildings.map((item: { id: string }) => item.id),
  );
  const recipeOutputIds = new Set<string>(
    RECIPES.map((recipe: { outputId: string }) => recipe.outputId),
  );
  const accumulatorFull = ITEMS.find(
    (item: { id: string }) => item.id === "accumulator_full",
  );
  const orbitalCollectorRecipe = RECIPES.find(
    (recipe: { outputId: string }) => recipe.outputId === "orbital_collector",
  );

  assert.equal(ITEMS.length, 173);
  assert.equal(buildings.length, 61);
  assert.equal(buildingIds.size, 61, "building IDs must be unique");
  assert.deepEqual(
    buildings
      .map((item: { id: string }) => item.id)
      .filter((id: string) => !recipeOutputIds.has(id)),
    [],
    "every selectable building must have a production recipe",
  );
  assert.ok(accumulatorFull, "accumulator_full support item is missing");
  assert.equal(accumulatorFull.building, undefined);
  assert.equal(accumulatorFull.raw, true);
  assert.ok(
    orbitalCollectorRecipe?.inputs.some(
      (input: { itemId: string }) => input.itemId === "accumulator_full",
    ),
    "orbital collector must continue to consume charged accumulators",
  );
});
