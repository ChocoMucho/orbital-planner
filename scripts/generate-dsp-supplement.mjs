import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [sourcePath, buildingOutputPath, iconOutputPath] = process.argv.slice(2);
if (!sourcePath || !buildingOutputPath || !iconOutputPath) {
  throw new Error("usage: node generate-dsp-supplement.mjs <data.json> <building-output.ts> <icon-output.ts>");
}

const data = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
const localId = (id) => id.replaceAll("-", "_");

const KOREAN_BUILDING_NAMES = {
  "tesla-tower": "테슬라 타워",
  "wireless-power-tower": "무선 송전탑",
  "satellite-substation": "위성 배전반",
  "wind-turbine": "풍력 발전기",
  "thermal-power-plant": "화력 발전소",
  "solar-panel": "태양 전지판",
  "geothermal-power-station": "지열 발전소",
  "mini-fusion-power-plant": "미니 핵융합 발전소",
  "energy-exchanger": "에너지 교환기",
  accumulator: "축전기",
  "ray-receiver": "광선 수신기",
  "artificial-star": "인공 항성",
  "conveyor-belt-1": "컨베이어 벨트 Mk.I",
  "conveyor-belt-2": "컨베이어 벨트 Mk.II",
  "conveyor-belt-3": "컨베이어 벨트 Mk.III",
  splitter: "분배기",
  "automatic-piler": "자동 적재기",
  "traffic-monitor": "화물 유량 모니터",
  "spray-coater": "분사 도포기",
  "storage-1": "저장고 Mk.I",
  "storage-2": "저장고 Mk.II",
  "storage-tank": "액체 저장 탱크",
  "logistics-distributor": "물류 분배기",
  "planetary-logistics-station": "행성 내 물류 운송소",
  "interstellar-logistics-station": "성간 물류 운송소",
  "orbital-collector": "궤도 수집기",
  "sorter-1": "분류기 Mk.I",
  "sorter-2": "분류기 Mk.II",
  "sorter-3": "분류기 Mk.III",
  "sorter-4": "집적 분류기",
  "mining-machine": "채굴기",
  "advanced-mining-machine": "대형 채굴기",
  "water-pump": "급수 펌프",
  "oil-extractor": "원유 추출기",
  "oil-refinery": "정유소",
  fractionator: "분별기",
  "chemical-plant": "화학 공장",
  "quantum-chemical-plant": "양자 화학 공장",
  "miniature-particle-collider": "미니 입자 충돌기",
  "arc-smelter": "아크 제련소",
  "plane-smelter": "평면 제련소",
  "df-negentropy-smelter": "네겐트로피 제련소",
  "assembling-machine-1": "조립기 Mk.I",
  "assembling-machine-2": "조립기 Mk.II",
  "assembling-machine-3": "조립기 Mk.III",
  "df-recomposing-assembler": "재구성 조립기",
  "matrix-lab": "매트릭스 연구소",
  "df-self-evolution-lab": "자기 진화 연구소",
  "holo-beacon": "홀로 비콘",
  "em-rail-ejector": "EM 레일건 사출기",
  "vertical-launching-silo": "수직 발사 사일로",
  "df-gauss-turret": "가우스 포탑",
  "df-missile-turret": "미사일 포탑",
  "df-implosion-cannon": "내파 대포",
  "df-laser-turret": "레이저 포탑",
  "df-plasma-turret": "플라즈마 포탑",
  "df-plasma-turret-sr": "SR 플라즈마 포탑",
  "df-battlefield-analysis-base": "전장 분석 기지",
  "df-jammer-tower": "교란 타워",
  "df-signal-tower": "신호 타워",
  "df-planetary-shield-generator": "행성 보호막 생성기",
};

const SUPPORT_ITEMS = {
  "accumulator-full": { name: "충전된 축전기", raw: true },
  "reinforced-thruster": { name: "강화 추진기" },
  "df-engine": { name: "엔진" },
  "df-energy-shard": { name: "에너지 파편", raw: true },
  "df-negentropy-singularity": { name: "네겐트로피 특이점", raw: true },
  "df-matter-recombinator": { name: "물질 재조합기", raw: true },
  "df-dark-fog-matrix": { name: "다크 포그 매트릭스", raw: true },
  "df-silicon-based-neuron": { name: "실리콘 기반 뉴런", raw: true },
};

const sourceItems = new Map(data.items.map((item) => [item.id, item]));
const sourceRecipes = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
const buildingItems = data.items.filter((item) => item.category === "buildings" && item.id !== "accumulator-full");

for (const item of buildingItems) {
  if (!KOREAN_BUILDING_NAMES[item.id]) throw new Error(`missing Korean building name: ${item.id}`);
  if (!sourceRecipes.has(item.id)) throw new Error(`missing building recipe: ${item.id}`);
}

const quote = (value) => JSON.stringify(value);
const itemLine = (item, name, category, extra = "") =>
  `  { id: ${quote(localId(item.id))}, name: ${quote(name)}, en: ${quote(item.name)}, category: ${quote(category)}, glyph: ${quote(item.name.slice(0, 2))}${extra} },`;
const recipeLine = (source, prefix = "building-") => {
  const output = Object.entries(source.out)[0];
  const inputs = Object.entries(source.in).map(([itemId, qty]) => `{ itemId: ${quote(localId(itemId))}, qty: ${qty} }`).join(", ");
  return `  { id: ${quote(`${prefix}${source.id}`)}, outputId: ${quote(localId(output[0]))}, outputQty: ${output[1]}, timeSec: ${source.time}, facility: "assembler", inputs: [${inputs}], productive: true },`;
};

const supportItemLines = Object.entries(SUPPORT_ITEMS).map(([id, meta]) => {
  const item = sourceItems.get(id);
  if (!item) throw new Error(`missing support item: ${id}`);
  return itemLine(item, meta.name, meta.raw ? "raw" : "component", meta.raw ? ", raw: true" : "");
});
const supportRecipeLines = ["reinforced-thruster", "df-engine"].map((id) => recipeLine(sourceRecipes.get(id), "building-support-"));
const buildingItemLines = buildingItems.map((item) => itemLine(item, KOREAN_BUILDING_NAMES[item.id], "building", ", building: true"));
const buildingRecipeLines = buildingItems.map((item) => recipeLine(sourceRecipes.get(item.id)));

const buildingSource = `// Generated from FactorioLab DSP data (0.10.29.21950); building recipes spot-checked through DSP 0.10.34.\nimport type { Item, Recipe } from "./dsp-data.ts";\n\nexport const BUILDING_SUPPORT_ITEMS: Item[] = [\n${supportItemLines.join("\n")}\n];\n\nexport const BUILDING_ITEMS: Item[] = [\n${buildingItemLines.join("\n")}\n];\n\nexport const BUILDING_SUPPORT_RECIPES: Recipe[] = [\n${supportRecipeLines.join("\n")}\n];\n\nexport const BUILDING_RECIPES: Recipe[] = [\n${buildingRecipeLines.join("\n")}\n];\n`;

const iconLines = data.icons.map((icon) => `  ${quote(icon.id)}: [${icon.x}, ${icon.y}, ${quote(icon.color)}],`);
const iconSource = `// Generated from the FactorioLab DSP icon index. Sprite cells are 64 px in a 1472 px sheet.\nexport const DSP_ICON_SHEET_SIZE = 1472;\nexport const DSP_ICON_CELL_SIZE = 64;\n\nexport const DSP_ICON_POSITIONS: Record<string, readonly [number, number, string]> = {\n${iconLines.join("\n")}\n};\n\nconst ICON_ID_OVERRIDES: Record<string, string> = {\n  spiniform_crystal: "spiniform-stalagmite-crystal",\n};\n\nexport function getDspIconPosition(itemId: string) {\n  const iconId = ICON_ID_OVERRIDES[itemId] ?? itemId.replaceAll("_", "-");\n  return DSP_ICON_POSITIONS[iconId];\n}\n`;

await writeFile(resolve(buildingOutputPath), buildingSource, "utf8");
await writeFile(resolve(iconOutputPath), iconSource, "utf8");
console.log(`generated ${buildingItems.length} buildings, ${buildingRecipeLines.length + supportRecipeLines.length} recipes, ${data.icons.length} icon positions`);
