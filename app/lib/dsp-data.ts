import {
  BUILDING_ITEMS,
  BUILDING_RECIPES,
  BUILDING_SUPPORT_ITEMS,
  BUILDING_SUPPORT_RECIPES,
} from "./dsp-building-data.ts";
import { EXPANDED_ITEMS, EXPANDED_RECIPES } from "./dsp-item-expansion-data.ts";

export type ItemCategory = "raw" | "material" | "component" | "science" | "dyson" | "fuel" | "logistics" | "combat" | "building";
export type FacilityCategory = "smelter" | "assembler" | "chemical" | "refinery" | "lab" | "collider" | "ray_receiver";

export type Item = {
  id: string;
  name: string;
  en: string;
  category: ItemCategory;
  glyph: string;
  raw?: boolean;
  rareRaw?: boolean;
  building?: boolean;
};

export type Ingredient = { itemId: string; qty: number };

export type Recipe = {
  id: string;
  outputId: string;
  outputQty: number;
  timeSec: number;
  facility: FacilityCategory;
  inputs: Ingredient[];
  byproducts?: Ingredient[];
  alternate?: boolean;
  productive?: boolean;
};

export type Machine = {
  id: string;
  name: string;
  category: FacilityCategory;
  speed: number;
  powerMw: number;
};

export const DATA_VERSION = "0.10.34";

export const ITEMS: Item[] = [
  { id: "iron_ore", name: "철 광석", en: "Iron Ore", category: "raw", glyph: "Fe", raw: true },
  { id: "copper_ore", name: "구리 광석", en: "Copper Ore", category: "raw", glyph: "Cu", raw: true },
  { id: "stone", name: "돌", en: "Stone", category: "raw", glyph: "St", raw: true },
  { id: "coal", name: "석탄", en: "Coal", category: "raw", glyph: "Co", raw: true },
  { id: "silicon_ore", name: "규소 광석", en: "Silicon Ore", category: "raw", glyph: "Si", raw: true },
  { id: "titanium_ore", name: "티타늄 광석", en: "Titanium Ore", category: "raw", glyph: "Ti", raw: true },
  { id: "crude_oil", name: "원유", en: "Crude Oil", category: "raw", glyph: "Oil", raw: true },
  { id: "water", name: "물", en: "Water", category: "raw", glyph: "H₂O", raw: true },
  { id: "hydrogen", name: "수소", en: "Hydrogen", category: "raw", glyph: "H₂", raw: true },
  { id: "deuterium", name: "중수소", en: "Deuterium", category: "raw", glyph: "D", raw: true },
  { id: "antimatter", name: "반물질", en: "Antimatter", category: "raw", glyph: "Ā", raw: true },
  { id: "fire_ice", name: "가연성 얼음", en: "Fire Ice", category: "raw", glyph: "Fi", raw: true },
  { id: "kimberlite_ore", name: "킴벌라이트 광석", en: "Kimberlite Ore", category: "raw", glyph: "Km", raw: true },
  { id: "fractal_silicon", name: "프랙탈 실리콘", en: "Fractal Silicon", category: "raw", glyph: "Fs", raw: true },
  { id: "optical_grating_crystal", name: "광학 격자 결정", en: "Optical Grating Crystal", category: "raw", glyph: "Og", raw: true },
  { id: "spiniform_crystal", name: "가시죽순 결정", en: "Spiniform Stalagmite Crystal", category: "raw", glyph: "Sp", raw: true },
  { id: "unipolar_magnet", name: "단극 자석", en: "Unipolar Magnet", category: "raw", glyph: "Um", raw: true },

  { id: "iron_ingot", name: "철괴", en: "Iron Ingot", category: "material", glyph: "철" },
  { id: "copper_ingot", name: "구리괴", en: "Copper Ingot", category: "material", glyph: "구" },
  { id: "magnet", name: "자석", en: "Magnet", category: "material", glyph: "자" },
  { id: "stone_brick", name: "석재", en: "Stone Brick", category: "material", glyph: "석" },
  { id: "glass", name: "유리", en: "Glass", category: "material", glyph: "유" },
  { id: "high_purity_silicon", name: "고순도 실리콘", en: "High-purity Silicon", category: "material", glyph: "Si" },
  { id: "titanium_ingot", name: "티타늄괴", en: "Titanium Ingot", category: "material", glyph: "Ti" },
  { id: "energetic_graphite", name: "고에너지 흑연", en: "Energetic Graphite", category: "material", glyph: "C" },
  { id: "steel", name: "강철", en: "Steel", category: "material", glyph: "강" },
  { id: "crystal_silicon", name: "결정 실리콘", en: "Crystal Silicon", category: "material", glyph: "Cs" },
  { id: "diamond", name: "다이아몬드", en: "Diamond", category: "material", glyph: "◆" },
  { id: "refined_oil", name: "정제유", en: "Refined Oil", category: "material", glyph: "Ro" },
  { id: "plastic", name: "플라스틱", en: "Plastic", category: "material", glyph: "Pl" },
  { id: "sulfuric_acid", name: "황산", en: "Sulfuric Acid", category: "material", glyph: "Sa", rareRaw: true },
  { id: "organic_crystal", name: "유기 결정", en: "Organic Crystal", category: "material", glyph: "Oc", rareRaw: true },
  { id: "graphene", name: "그래핀", en: "Graphene", category: "material", glyph: "Gr" },
  { id: "carbon_nanotube", name: "탄소 나노튜브", en: "Carbon Nanotube", category: "material", glyph: "Cn" },
  { id: "titanium_alloy", name: "티타늄 합금", en: "Titanium Alloy", category: "material", glyph: "Ta" },
  { id: "titanium_glass", name: "티타늄 유리", en: "Titanium Glass", category: "material", glyph: "Tg" },
  { id: "titanium_crystal", name: "티타늄 결정", en: "Titanium Crystal", category: "material", glyph: "Tc" },

  { id: "gear", name: "기어", en: "Gear", category: "component", glyph: "⚙" },
  { id: "magnetic_coil", name: "자기 코일", en: "Magnetic Coil", category: "component", glyph: "Mc" },
  { id: "circuit_board", name: "회로 기판", en: "Circuit Board", category: "component", glyph: "Cb" },
  { id: "electric_motor", name: "전동기", en: "Electric Motor", category: "component", glyph: "M" },
  { id: "electromagnetic_turbine", name: "전자기 터빈", en: "Electromagnetic Turbine", category: "component", glyph: "Et" },
  { id: "super_magnetic_ring", name: "초자기 고리", en: "Super-magnetic Ring", category: "component", glyph: "Sr" },
  { id: "prism", name: "프리즘", en: "Prism", category: "component", glyph: "△" },
  { id: "plasma_exciter", name: "플라즈마 여기기", en: "Plasma Exciter", category: "component", glyph: "Pe" },
  { id: "microcrystalline_component", name: "미세 결정 부품", en: "Microcrystalline Component", category: "component", glyph: "µC" },
  { id: "processor", name: "프로세서", en: "Processor", category: "component", glyph: "CPU" },
  { id: "particle_container", name: "입자 용기", en: "Particle Container", category: "component", glyph: "Pc" },
  { id: "particle_broadband", name: "입자 광대역", en: "Particle Broadband", category: "component", glyph: "Pb" },
  { id: "casimir_crystal", name: "카시미르 결정", en: "Casimir Crystal", category: "component", glyph: "Cc" },
  { id: "plane_filter", name: "평면 필터", en: "Plane Filter", category: "component", glyph: "Pf" },
  { id: "quantum_chip", name: "양자 칩", en: "Quantum Chip", category: "component", glyph: "Qc" },
  { id: "strange_matter", name: "기묘한 물질", en: "Strange Matter", category: "component", glyph: "Sm" },
  { id: "graviton_lens", name: "중력 렌즈", en: "Graviton Lens", category: "component", glyph: "Gl" },

  { id: "photon_combiner", name: "광자 결합기", en: "Photon Combiner", category: "dyson", glyph: "Ph" },
  { id: "solar_sail", name: "태양 돛", en: "Solar Sail", category: "dyson", glyph: "☼" },
  { id: "frame_material", name: "프레임 재료", en: "Frame Material", category: "dyson", glyph: "Fm" },
  { id: "dyson_sphere_component", name: "다이슨 스피어 부품", en: "Dyson Sphere Component", category: "dyson", glyph: "Ds" },
  { id: "small_carrier_rocket", name: "소형 운반 로켓", en: "Small Carrier Rocket", category: "dyson", glyph: "▲" },

  { id: "hydrogen_fuel_rod", name: "수소 연료봉", en: "Hydrogen Fuel Rod", category: "fuel", glyph: "Hr" },
  { id: "deuteron_fuel_rod", name: "중수소 연료봉", en: "Deuteron Fuel Rod", category: "fuel", glyph: "Dr" },
  { id: "annihilation_constraint_sphere", name: "소멸 억제 구체", en: "Annihilation Constraint Sphere", category: "fuel", glyph: "As" },
  { id: "antimatter_fuel_rod", name: "반물질 연료봉", en: "Antimatter Fuel Rod", category: "fuel", glyph: "Ar" },

  { id: "electromagnetic_matrix", name: "전자기 매트릭스", en: "Electromagnetic Matrix", category: "science", glyph: "B" },
  { id: "energy_matrix", name: "에너지 매트릭스", en: "Energy Matrix", category: "science", glyph: "R" },
  { id: "structure_matrix", name: "구조 매트릭스", en: "Structure Matrix", category: "science", glyph: "Y" },
  { id: "information_matrix", name: "정보 매트릭스", en: "Information Matrix", category: "science", glyph: "P" },
  { id: "gravity_matrix", name: "중력 매트릭스", en: "Gravity Matrix", category: "science", glyph: "G" },
  { id: "universe_matrix", name: "우주 매트릭스", en: "Universe Matrix", category: "science", glyph: "W" },
];

ITEMS.push(...EXPANDED_ITEMS, ...BUILDING_SUPPORT_ITEMS, ...BUILDING_ITEMS);

const recipe = (id: string, outputId: string, outputQty: number, timeSec: number, facility: FacilityCategory, inputs: Ingredient[], extra: Partial<Recipe> = {}): Recipe => ({
  id, outputId, outputQty, timeSec, facility, inputs, productive: true, ...extra,
});

export const RECIPES: Recipe[] = [
  recipe("iron-ingot", "iron_ingot", 1, 1, "smelter", [{ itemId: "iron_ore", qty: 1 }]),
  recipe("copper-ingot", "copper_ingot", 1, 1, "smelter", [{ itemId: "copper_ore", qty: 1 }]),
  recipe("magnet", "magnet", 1, 1.5, "smelter", [{ itemId: "iron_ore", qty: 1 }]),
  recipe("stone-brick", "stone_brick", 1, 1, "smelter", [{ itemId: "stone", qty: 1 }]),
  recipe("glass", "glass", 1, 2, "smelter", [{ itemId: "stone", qty: 2 }]),
  recipe("high-purity-silicon", "high_purity_silicon", 1, 2, "smelter", [{ itemId: "silicon_ore", qty: 2 }]),
  recipe("titanium-ingot", "titanium_ingot", 1, 2, "smelter", [{ itemId: "titanium_ore", qty: 2 }]),
  recipe("energetic-graphite", "energetic_graphite", 1, 2, "smelter", [{ itemId: "coal", qty: 2 }]),
  recipe("steel", "steel", 1, 3, "smelter", [{ itemId: "iron_ingot", qty: 3 }]),
  recipe("crystal-silicon", "crystal_silicon", 1, 2, "smelter", [{ itemId: "high_purity_silicon", qty: 1 }]),
  recipe("crystal-silicon-advanced", "crystal_silicon", 2, 1.5, "assembler", [{ itemId: "fractal_silicon", qty: 1 }], { alternate: true }),
  recipe("diamond", "diamond", 1, 2, "smelter", [{ itemId: "energetic_graphite", qty: 1 }]),
  recipe("diamond-advanced", "diamond", 2, 1.5, "smelter", [{ itemId: "kimberlite_ore", qty: 1 }], { alternate: true }),
  recipe("titanium-alloy", "titanium_alloy", 4, 12, "smelter", [{ itemId: "titanium_ingot", qty: 4 }, { itemId: "steel", qty: 4 }, { itemId: "sulfuric_acid", qty: 8 }]),

  recipe("gear", "gear", 1, 1, "assembler", [{ itemId: "iron_ingot", qty: 1 }]),
  recipe("magnetic-coil", "magnetic_coil", 2, 1, "assembler", [{ itemId: "magnet", qty: 2 }, { itemId: "copper_ingot", qty: 1 }]),
  recipe("circuit-board", "circuit_board", 2, 1, "assembler", [{ itemId: "iron_ingot", qty: 2 }, { itemId: "copper_ingot", qty: 1 }]),
  recipe("electric-motor", "electric_motor", 1, 2, "assembler", [{ itemId: "iron_ingot", qty: 2 }, { itemId: "gear", qty: 1 }, { itemId: "magnetic_coil", qty: 1 }]),
  recipe("electromagnetic-turbine", "electromagnetic_turbine", 1, 2, "assembler", [{ itemId: "electric_motor", qty: 2 }, { itemId: "magnetic_coil", qty: 2 }]),
  recipe("super-magnetic-ring", "super_magnetic_ring", 1, 3, "assembler", [{ itemId: "electromagnetic_turbine", qty: 2 }, { itemId: "magnet", qty: 3 }, { itemId: "energetic_graphite", qty: 1 }]),
  recipe("prism", "prism", 2, 2, "assembler", [{ itemId: "glass", qty: 3 }]),
  recipe("plasma-exciter", "plasma_exciter", 1, 2, "assembler", [{ itemId: "magnetic_coil", qty: 4 }, { itemId: "prism", qty: 2 }]),
  recipe("microcrystalline-component", "microcrystalline_component", 1, 2, "assembler", [{ itemId: "high_purity_silicon", qty: 2 }, { itemId: "copper_ingot", qty: 1 }]),
  recipe("processor", "processor", 1, 3, "assembler", [{ itemId: "circuit_board", qty: 2 }, { itemId: "microcrystalline_component", qty: 2 }]),
  recipe("titanium-glass", "titanium_glass", 2, 5, "assembler", [{ itemId: "glass", qty: 2 }, { itemId: "titanium_ingot", qty: 2 }, { itemId: "water", qty: 2 }]),
  recipe("titanium-crystal", "titanium_crystal", 1, 4, "assembler", [{ itemId: "organic_crystal", qty: 1 }, { itemId: "titanium_ingot", qty: 3 }]),
  recipe("particle-broadband", "particle_broadband", 1, 8, "assembler", [{ itemId: "carbon_nanotube", qty: 2 }, { itemId: "crystal_silicon", qty: 2 }, { itemId: "plastic", qty: 1 }]),
  recipe("casimir-crystal", "casimir_crystal", 1, 4, "assembler", [{ itemId: "titanium_crystal", qty: 1 }, { itemId: "graphene", qty: 2 }, { itemId: "hydrogen", qty: 12 }]),
  recipe("casimir-crystal-advanced", "casimir_crystal", 1, 4, "assembler", [{ itemId: "optical_grating_crystal", qty: 8 }, { itemId: "graphene", qty: 2 }, { itemId: "hydrogen", qty: 12 }], { alternate: true }),
  recipe("particle-container", "particle_container", 1, 4, "assembler", [{ itemId: "electromagnetic_turbine", qty: 2 }, { itemId: "copper_ingot", qty: 2 }, { itemId: "graphene", qty: 2 }]),
  recipe("particle-container-advanced", "particle_container", 1, 4, "assembler", [{ itemId: "unipolar_magnet", qty: 10 }, { itemId: "copper_ingot", qty: 2 }], { alternate: true }),
  recipe("plane-filter", "plane_filter", 1, 12, "assembler", [{ itemId: "casimir_crystal", qty: 1 }, { itemId: "titanium_glass", qty: 1 }]),
  recipe("quantum-chip", "quantum_chip", 1, 6, "assembler", [{ itemId: "processor", qty: 2 }, { itemId: "plane_filter", qty: 2 }]),

  recipe("plasma-refining", "refined_oil", 2, 4, "refinery", [{ itemId: "crude_oil", qty: 2 }], { byproducts: [{ itemId: "hydrogen", qty: 1 }] }),
  recipe("plastic", "plastic", 1, 3, "chemical", [{ itemId: "refined_oil", qty: 2 }, { itemId: "energetic_graphite", qty: 1 }]),
  recipe("sulfuric-acid", "sulfuric_acid", 4, 6, "chemical", [{ itemId: "refined_oil", qty: 6 }, { itemId: "stone", qty: 8 }, { itemId: "water", qty: 4 }]),
  recipe("organic-crystal", "organic_crystal", 1, 6, "chemical", [{ itemId: "plastic", qty: 2 }, { itemId: "refined_oil", qty: 1 }, { itemId: "water", qty: 1 }]),
  recipe("graphene", "graphene", 2, 3, "chemical", [{ itemId: "energetic_graphite", qty: 3 }, { itemId: "sulfuric_acid", qty: 1 }]),
  recipe("graphene-advanced", "graphene", 2, 2, "chemical", [{ itemId: "fire_ice", qty: 2 }], { alternate: true, byproducts: [{ itemId: "hydrogen", qty: 1 }] }),
  recipe("carbon-nanotube", "carbon_nanotube", 2, 4, "chemical", [{ itemId: "graphene", qty: 3 }, { itemId: "titanium_ingot", qty: 1 }]),
  recipe("carbon-nanotube-advanced", "carbon_nanotube", 2, 4, "chemical", [{ itemId: "spiniform_crystal", qty: 6 }], { alternate: true }),

  recipe("photon-combiner", "photon_combiner", 1, 3, "assembler", [{ itemId: "prism", qty: 2 }, { itemId: "circuit_board", qty: 1 }]),
  recipe("photon-combiner-advanced", "photon_combiner", 1, 3, "assembler", [{ itemId: "optical_grating_crystal", qty: 1 }, { itemId: "circuit_board", qty: 1 }], { alternate: true }),
  recipe("solar-sail", "solar_sail", 2, 4, "assembler", [{ itemId: "graphene", qty: 1 }, { itemId: "photon_combiner", qty: 1 }]),
  recipe("frame-material", "frame_material", 1, 6, "assembler", [{ itemId: "carbon_nanotube", qty: 4 }, { itemId: "titanium_alloy", qty: 1 }, { itemId: "high_purity_silicon", qty: 1 }]),
  recipe("dyson-sphere-component", "dyson_sphere_component", 1, 8, "assembler", [{ itemId: "frame_material", qty: 3 }, { itemId: "solar_sail", qty: 3 }, { itemId: "processor", qty: 1 }]),
  recipe("small-carrier-rocket", "small_carrier_rocket", 1, 6, "assembler", [{ itemId: "dyson_sphere_component", qty: 2 }, { itemId: "deuteron_fuel_rod", qty: 2 }, { itemId: "quantum_chip", qty: 2 }]),

  recipe("hydrogen-fuel-rod", "hydrogen_fuel_rod", 2, 6, "assembler", [{ itemId: "hydrogen", qty: 10 }, { itemId: "titanium_ingot", qty: 1 }]),
  recipe("deuteron-fuel-rod", "deuteron_fuel_rod", 2, 6, "assembler", [{ itemId: "titanium_alloy", qty: 1 }, { itemId: "deuterium", qty: 20 }, { itemId: "super_magnetic_ring", qty: 1 }]),
  recipe("strange-matter", "strange_matter", 1, 8, "collider", [{ itemId: "particle_container", qty: 2 }, { itemId: "iron_ingot", qty: 2 }, { itemId: "deuterium", qty: 10 }]),
  recipe("graviton-lens", "graviton_lens", 1, 6, "assembler", [{ itemId: "diamond", qty: 4 }, { itemId: "strange_matter", qty: 1 }]),
  recipe("annihilation-constraint-sphere", "annihilation_constraint_sphere", 1, 20, "assembler", [{ itemId: "particle_container", qty: 1 }, { itemId: "processor", qty: 1 }]),
  recipe("antimatter-fuel-rod", "antimatter_fuel_rod", 2, 12, "assembler", [{ itemId: "antimatter", qty: 12 }, { itemId: "hydrogen", qty: 12 }, { itemId: "annihilation_constraint_sphere", qty: 1 }]),

  recipe("electromagnetic-matrix", "electromagnetic_matrix", 1, 3, "lab", [{ itemId: "circuit_board", qty: 1 }, { itemId: "magnetic_coil", qty: 1 }]),
  recipe("energy-matrix", "energy_matrix", 1, 6, "lab", [{ itemId: "energetic_graphite", qty: 2 }, { itemId: "hydrogen", qty: 2 }]),
  recipe("structure-matrix", "structure_matrix", 1, 8, "lab", [{ itemId: "diamond", qty: 1 }, { itemId: "titanium_crystal", qty: 1 }]),
  recipe("information-matrix", "information_matrix", 1, 10, "lab", [{ itemId: "particle_broadband", qty: 1 }, { itemId: "processor", qty: 2 }]),
  recipe("gravity-matrix", "gravity_matrix", 2, 24, "lab", [{ itemId: "graviton_lens", qty: 1 }, { itemId: "quantum_chip", qty: 1 }]),
  recipe("universe-matrix", "universe_matrix", 1, 15, "lab", [{ itemId: "electromagnetic_matrix", qty: 1 }, { itemId: "energy_matrix", qty: 1 }, { itemId: "structure_matrix", qty: 1 }, { itemId: "information_matrix", qty: 1 }, { itemId: "gravity_matrix", qty: 1 }, { itemId: "antimatter", qty: 1 }]),
];

RECIPES.push(...EXPANDED_RECIPES, ...BUILDING_SUPPORT_RECIPES, ...BUILDING_RECIPES);

export const MACHINES: Machine[] = [
  { id: "arc-smelter", name: "아크 제련소", category: "smelter", speed: 1, powerMw: 0.36 },
  { id: "plane-smelter", name: "평면 제련소", category: "smelter", speed: 2, powerMw: 1.44 },
  { id: "negentropy-smelter", name: "네겐트로피 제련소", category: "smelter", speed: 3, powerMw: 2.88 },
  { id: "assembler-1", name: "조립기 Mk.I", category: "assembler", speed: 0.75, powerMw: 0.27 },
  { id: "assembler-2", name: "조립기 Mk.II", category: "assembler", speed: 1, powerMw: 0.54 },
  { id: "assembler-3", name: "조립기 Mk.III", category: "assembler", speed: 1.5, powerMw: 1.08 },
  { id: "recomposing-assembler", name: "재구성 조립기", category: "assembler", speed: 3, powerMw: 2.7 },
  { id: "chemical-plant", name: "화학 공장", category: "chemical", speed: 1, powerMw: 0.72 },
  { id: "quantum-chemical-plant", name: "양자 화학 공장", category: "chemical", speed: 2, powerMw: 2.16 },
  { id: "oil-refinery", name: "정유소", category: "refinery", speed: 1, powerMw: 0.96 },
  { id: "matrix-lab", name: "매트릭스 연구소", category: "lab", speed: 1, powerMw: 0.48 },
  { id: "self-evolution-lab", name: "자기 진화 연구소", category: "lab", speed: 3, powerMw: 1.92 },
  { id: "particle-collider", name: "미니 입자 충돌기", category: "collider", speed: 1, powerMw: 12 },
  { id: "ray-receiver", name: "광선 수신기 (연속 수신 100%)", category: "ray_receiver", speed: 1, powerMw: 0 },
];

export const DEFAULT_MACHINE_IDS: Record<FacilityCategory, string> = {
  smelter: "arc-smelter",
  assembler: "assembler-3",
  chemical: "chemical-plant",
  refinery: "oil-refinery",
  lab: "matrix-lab",
  collider: "particle-collider",
  ray_receiver: "ray-receiver",
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  raw: "원료",
  material: "가공 소재",
  component: "부품",
  science: "매트릭스",
  dyson: "다이슨 스피어",
  fuel: "연료봉",
  logistics: "물류 · 지원",
  combat: "전투 · 탄약",
  building: "건물",
};

export const FACILITY_LABELS: Record<FacilityCategory, string> = {
  smelter: "제련",
  assembler: "조립",
  chemical: "화학",
  refinery: "정유",
  lab: "연구소",
  collider: "입자 충돌",
  ray_receiver: "광선 수신",
};
