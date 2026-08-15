"use client";

import { useMemo, useRef, useState } from "react";
import PlanToolbar from "./components/PlanToolbar";
import {
  calculateProductionPlan,
  ProductionCalculationError,
  type ProductionPlanCalculationResult,
  type ProductionTreeNode,
} from "./lib/calculate";
import {
  CATEGORY_LABELS,
  DATA_VERSION,
  DEFAULT_MACHINE_IDS,
  FACILITY_LABELS,
  ITEMS,
  MACHINES,
  RECIPES,
  type FacilityCategory,
  type Item,
} from "./lib/dsp-data";
import { CloudSessionProvider, useCloudSession } from "./lib/cloud-session";
import {
  createProductionPlanPayload,
  type FactoryPresetId,
  type PlanTargetDraft,
  type PlanUnit,
  type ProductionPlanPayload,
} from "./lib/plan-model";

type Unit = PlanUnit;
type FactoryPreset = FactoryPresetId;
type TargetDraft = PlanTargetDraft;

const ITEM_MAP = new Map(ITEMS.map((item) => [item.id, item]));
const TARGET_ITEMS = ITEMS.filter((item) => !item.raw);
const RARE_RAW_IDS = ITEMS.filter((item) => item.rareRaw).map((item) => item.id);

const FACTORY_PRESETS: Record<FactoryPreset, { label: string; machines: Record<FacilityCategory, string> }> = {
  starter: {
    label: "초기",
    machines: { ...DEFAULT_MACHINE_IDS, assembler: "assembler-1" },
  },
  standard: {
    label: "표준",
    machines: {
      ...DEFAULT_MACHINE_IDS,
      smelter: "plane-smelter",
      assembler: "assembler-3",
      chemical: "quantum-chemical-plant",
    },
  },
  darkfog: {
    label: "최종",
    machines: {
      ...DEFAULT_MACHINE_IDS,
      smelter: "negentropy-smelter",
      assembler: "recomposing-assembler",
      chemical: "quantum-chemical-plant",
      lab: "self-evolution-lab",
    },
  },
};

const PROLIFERATOR_OPTIONS = [
  { value: 1, label: "없음" },
  { value: 1.125, label: "Mk.I · +12.5%" },
  { value: 1.2, label: "Mk.II · +20%" },
  { value: 1.25, label: "Mk.III · +25%" },
];

const BELT_OPTIONS = [
  { value: 360, label: "벨트 Mk.I", sub: "360/분" },
  { value: 720, label: "벨트 Mk.II", sub: "720/분" },
  { value: 1800, label: "벨트 Mk.III", sub: "1,800/분" },
];

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : digits,
  });
}

function ItemMark({ item, small = false }: { item: Item; small?: boolean }) {
  return (
    <span className={`item-mark item-mark--${item.category}${small ? " item-mark--small" : ""}`} aria-hidden="true">
      {item.glyph}
    </span>
  );
}

function TreeBranch({ node, depth, path, beltCapacity }: { node: ProductionTreeNode; depth: number; path: string; beltCapacity: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const beltLanes = Math.max(1, Math.ceil(node.ratePerMin / beltCapacity));

  return (
    <div className="tree-branch">
      <div className={`tree-row${node.raw ? " tree-row--raw" : ""}`} style={{ "--tree-depth": Math.min(depth, 7) } as React.CSSProperties}>
        <div className="tree-item">
          {hasChildren ? (
            <button className="tree-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`${node.item.name} 하위 재료 ${expanded ? "접기" : "펼치기"}`}>
              {expanded ? "−" : "+"}
            </button>
          ) : <span className="tree-dot" />}
          <ItemMark item={node.item as Item} small />
          <span><b>{node.item.name}</b><small>{node.item.en}</small></span>
        </div>
        <div className="tree-rate"><b>{formatNumber(node.ratePerMin)}</b><small>/분</small></div>
        <div className="tree-machine">
          {node.raw ? <span className="raw-pill">RAW</span> : <><b>{formatNumber(node.roundedMachines ?? 0, 0)}대</b><small>정확 {formatNumber(node.exactMachines ?? 0)}</small></>}
        </div>
        <div className="tree-belt"><b>{beltLanes}</b><small>라인</small></div>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((child, index) => (
            <TreeBranch key={`${path}-${child.itemId}-${index}`} node={child} depth={depth + 1} path={`${path}-${index}`} beltCapacity={beltCapacity} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalculatorApp() {
  return (
    <CloudSessionProvider>
      <CloudEntry />
    </CloudSessionProvider>
  );
}

function CloudEntry() {
  const cloud = useCloudSession();

  if (cloud.configured && (cloud.loading || !cloud.user)) {
    return (
      <main className="cloud-gate">
        <div className="cloud-gate-card">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <p className="eyebrow">ORBITAL PLANNER · CLOUD</p>
          <h1>{cloud.loading ? "계정을 확인하고 있습니다." : "생산 계획을 동기화하세요."}</h1>
          <p>Google 계정으로 로그인하면 Windows 앱과 웹에서 같은 생산 계획을 불러올 수 있습니다.</p>
          {!cloud.loading && (
            <button type="button" onClick={() => void cloud.signIn()}>Google로 로그인</button>
          )}
          {cloud.error && <small role="alert">{cloud.error}</small>}
        </div>
      </main>
    );
  }

  return <CalculatorWorkspace />;
}

function CalculatorWorkspace() {
  const [targets, setTargets] = useState<TargetDraft[]>([
    { id: "target-1", itemId: "small_carrier_rocket", rate: 60, unit: "minute" },
    { id: "target-2", itemId: "solar_sail", rate: 30, unit: "second" },
  ]);
  const nextTargetId = useRef(3);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarePriority, setRarePriority] = useState(false);
  const [productMultiplier, setProductMultiplier] = useState(1);
  const [factoryPreset, setFactoryPreset] = useState<FactoryPreset>("standard");
  const [beltCapacity, setBeltCapacity] = useState(1800);
  const [copied, setCopied] = useState(false);

  const planPayload = useMemo(() => createProductionPlanPayload({
    targets,
    rarePriority,
    productMultiplier,
    factoryPreset,
    beltCapacity,
  }), [beltCapacity, factoryPreset, productMultiplier, rarePriority, targets]);

  const applySavedPlan = (payload: ProductionPlanPayload) => {
    setTargets(payload.targets.map((target) => ({ ...target })));
    setRarePriority(payload.settings.rarePriority);
    setProductMultiplier(payload.settings.productMultiplier);
    setFactoryPreset(payload.settings.factoryPreset);
    setBeltCapacity(payload.settings.beltCapacity);
    setPickerOpen(null);
    setQuery("");
    nextTargetId.current = payload.targets.length + 1;
  };

  const planTargets = useMemo(() => targets.map((target) => ({
    itemId: target.itemId,
    ratePerMin: target.unit === "second" ? target.rate * 60 : target.rate,
  })), [targets]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return TARGET_ITEMS;
    return TARGET_ITEMS.filter((item) => `${item.name} ${item.en}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  const calculation = useMemo<{ result?: ProductionPlanCalculationResult; error?: string }>(() => {
    try {
      return {
        result: calculateProductionPlan({
          items: ITEMS,
          recipes: RECIPES,
          machines: MACHINES,
          targets: planTargets,
          selections: {
            rarePriority,
            productMultiplier,
            machineByCategory: FACTORY_PRESETS[factoryPreset].machines,
            treatAsRaw: rarePriority ? RARE_RAW_IDS : [],
          },
        }),
      };
    } catch (error) {
      return {
        error: error instanceof ProductionCalculationError ? error.message : "계산 중 알 수 없는 오류가 발생했습니다.",
      };
    }
  }, [factoryPreset, planTargets, productMultiplier, rarePriority]);

  const result = calculation.result;
  const rawEntries = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.rawTotals)
      .map(([itemId, value]) => ({ item: ITEM_MAP.get(itemId)!, value }))
      .sort((a, b) => b.value - a.value);
  }, [result]);

  const byproductEntries = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.byproducts)
      .map(([itemId, value]) => ({ item: ITEM_MAP.get(itemId)!, value }))
      .sort((a, b) => b.value - a.value);
  }, [result]);

  const facilityGroups = useMemo(() => {
    if (!result) return [];
    const groups = new Map<string, { machine: ProductionPlanCalculationResult["rows"][number]["machine"]; count: number; power: number; lines: number }>();
    for (const row of result.rows) {
      const current = groups.get(row.machineId) ?? { machine: row.machine, count: 0, power: 0, lines: 0 };
      current.count += row.roundedMachines;
      current.power += row.powerMw;
      current.lines += 1;
      groups.set(row.machineId, current);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [result]);

  const updateTarget = (id: string, patch: Partial<Omit<TargetDraft, "id">>) => {
    setTargets((current) => current.map((target) => target.id === id ? { ...target, ...patch } : target));
  };

  const changeTargetUnit = (target: TargetDraft, nextUnit: Unit) => {
    if (target.unit === nextUnit) return;
    updateTarget(target.id, {
      unit: nextUnit,
      rate: nextUnit === "second"
        ? Math.max(0.01, Number((target.rate / 60).toFixed(4)))
        : Number((target.rate * 60).toFixed(2)),
    });
  };

  const addTarget = () => {
    const selected = new Set(targets.map((target) => target.itemId));
    const nextItem = TARGET_ITEMS.find((item) => !selected.has(item.id));
    if (!nextItem) return;
    const id = `target-${nextTargetId.current++}`;
    setTargets((current) => [...current, { id, itemId: nextItem.id, rate: 60, unit: "minute" }]);
    setPickerOpen(id);
    setQuery("");
  };

  const removeTarget = (id: string) => {
    setTargets((current) => current.length > 1 ? current.filter((target) => target.id !== id) : current);
    if (pickerOpen === id) setPickerOpen(null);
  };

  const copySummary = async () => {
    if (!result) return;
    const lines = [
      `[오비탈 플래너] ${targets.length}개 생산 목표`,
      ...targets.map((target) => `${ITEM_MAP.get(target.itemId)?.name}: ${formatNumber(target.rate)}${target.unit === "second" ? "/초" : "/분"}`),
      `설비 ${formatNumber(result.totalRoundedMachines, 0)}대 · 기본 부하 ${formatNumber(result.totalPowerMw)} MW`,
      ...rawEntries.map(({ item, value }) => `${item.name}: ${formatNumber(value)}/분`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="오비탈 플래너 홈">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>ORBITAL <b>PLANNER</b></span>
        </a>
        <nav aria-label="페이지 바로가기">
          <a href="#resources">원료</a>
          <a href="#production-tree">생산 트리</a>
          <a href="#method">계산 기준</a>
        </nav>
        <span className="version-badge">DATA · {DATA_VERSION}</span>
      </header>

      <PlanToolbar payload={planPayload} onLoad={applySavedPlan} />

      <section className="hero" id="top">
        <div className="hero-copy-block">
          <p className="eyebrow">DYSON SPHERE PROGRAM · PRODUCTION CALCULATOR</p>
          <h1>성간 공장을<br /><em>숫자로 설계하세요.</em></h1>
          <p className="hero-copy">생산할 물품을 원하는 만큼 쌓아두세요. 서로 겹치는 중간재를 합산해 필요한 설비, 원료, 전력과 벨트 라인을 하나의 공장 계획으로 역산합니다.</p>
          <div className="hero-facts" aria-label="계산기 기능">
            <span><b>{RECIPES.length}</b> 레시피</span>
            <span><b>{TARGET_ITEMS.length}</b> 목표 아이템</span>
            <span><b>MULTI</b> 다중 목표</span>
          </div>
        </div>

        <div className="target-panel">
          <p className="panel-label"><span>01</span> 생산 목표 <i>{targets.length} OUTPUTS</i></p>
          <div className="target-list">
            {targets.map((draft, index) => {
              const targetItem = ITEM_MAP.get(draft.itemId) ?? TARGET_ITEMS[0];
              const entriesForTarget = filteredItems.filter((item) => item.id === draft.itemId || !targets.some((other) => other.id !== draft.id && other.itemId === item.id));
              const increment = draft.unit === "second" ? 1 : 10;
              return (
                <div className="target-entry" key={draft.id}>
                  <div className="target-entry-head">
                    <span>OUTPUT {String(index + 1).padStart(2, "0")}</span>
                    <button type="button" onClick={() => removeTarget(draft.id)} disabled={targets.length === 1} aria-label={`${targetItem.name} 생산 목표 삭제`}>×</button>
                  </div>
                  <div className="target-entry-controls">
                    <div className="picker-wrap">
                      <button className="item-select item-select--compact" type="button" onClick={() => { setPickerOpen((value) => value === draft.id ? null : draft.id); setQuery(""); }} aria-expanded={pickerOpen === draft.id} aria-haspopup="listbox">
                        <ItemMark item={targetItem} small />
                        <span><b>{targetItem.name}</b><small>{targetItem.en}</small></span>
                        <span className="chevron" aria-hidden="true">⌄</span>
                      </button>
                      {pickerOpen === draft.id && (
                        <div className="item-picker">
                          <div className="picker-search">
                            <span aria-hidden="true">⌕</span>
                            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setPickerOpen(null)} placeholder="아이템 검색" aria-label={`${index + 1}번째 목표 아이템 검색`} />
                            <small>{entriesForTarget.length}</small>
                          </div>
                          <div className="picker-list" role="listbox" aria-label={`${index + 1}번째 목표 아이템`}>
                            {Object.entries(CATEGORY_LABELS).filter(([category]) => category !== "raw").map(([category, label]) => {
                              const entries = entriesForTarget.filter((item) => item.category === category);
                              if (!entries.length) return null;
                              return (
                                <div className="picker-group" key={category}>
                                  <p>{label}</p>
                                  {entries.map((item) => (
                                    <button key={item.id} type="button" role="option" aria-selected={item.id === draft.itemId} onClick={() => { updateTarget(draft.id, { itemId: item.id }); setPickerOpen(null); setQuery(""); }}>
                                      <ItemMark item={item} small />
                                      <span><b>{item.name}</b><small>{item.en}</small></span>
                                      {item.id === draft.itemId && <i>선택됨</i>}
                                    </button>
                                  ))}
                                </div>
                              );
                            })}
                            {!entriesForTarget.length && <p className="empty-search">일치하는 아이템이 없습니다.</p>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="target-rate-control">
                      <div className="rate-control rate-control--compact">
                        <button type="button" onClick={() => updateTarget(draft.id, { rate: Math.max(0.01, draft.rate - increment) })} aria-label={`${targetItem.name} 생산량 감소`}>−</button>
                        <input id={`target-rate-${draft.id}`} aria-label={`${targetItem.name} 목표 생산량`} type="number" min="0.01" step={draft.unit === "second" ? 0.1 : 1} value={draft.rate} onChange={(event) => updateTarget(draft.id, { rate: Math.max(0.01, Number(event.target.value) || 0.01) })} />
                        <button type="button" onClick={() => updateTarget(draft.id, { rate: draft.rate + increment })} aria-label={`${targetItem.name} 생산량 증가`}>＋</button>
                      </div>
                      <div className="unit-tabs" role="group" aria-label={`${targetItem.name} 생산량 단위`}>
                        <button type="button" className={draft.unit === "minute" ? "active" : ""} onClick={() => changeTargetUnit(draft, "minute")}>/분</button>
                        <button type="button" className={draft.unit === "second" ? "active" : ""} onClick={() => changeTargetUnit(draft, "second")}>/초</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="add-target-button" type="button" onClick={addTarget} disabled={targets.length >= TARGET_ITEMS.length}><span>＋</span> 생산 물품 추가</button>
          <p className="target-hint"><span>↗</span> 공통 중간재는 목표 전체에서 자동 합산됩니다.</p>
          <button className="calculate-button" type="button" onClick={() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth" })}>
            통합 생산 라인 보기 <span>↓</span>
          </button>
        </div>
      </section>

      <section className="settings-band" aria-label="계산 설정">
        <div className="settings-title"><span>02</span><p><b>계산 설정</b><small>FACTORY PROFILE</small></p></div>
        <div className="setting-cell">
          <span id="factory-preset-label">설비 세대</span>
          <div className="segmented" role="group" aria-labelledby="factory-preset-label">
            {(Object.entries(FACTORY_PRESETS) as [FactoryPreset, (typeof FACTORY_PRESETS)[FactoryPreset]][]).map(([id, preset]) => (
              <button key={id} className={factoryPreset === id ? "active" : ""} type="button" onClick={() => setFactoryPreset(id)}>{preset.label}</button>
            ))}
          </div>
        </div>
        <div className="setting-cell">
          <label htmlFor="proliferator">추가 생산 증산제</label>
          <select id="proliferator" value={productMultiplier} onChange={(event) => setProductMultiplier(Number(event.target.value))}>
            {PROLIFERATOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="setting-cell">
          <label htmlFor="belt">물류 벨트</label>
          <select id="belt" value={beltCapacity} onChange={(event) => setBeltCapacity(Number(event.target.value))}>
            {BELT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.sub}</option>)}
          </select>
        </div>
        <div className="setting-cell setting-cell--toggle">
          <span><b>희귀 자원 우선</b><small>대체 레시피 + 행성 채취</small></span>
          <button className={`switch${rarePriority ? " active" : ""}`} type="button" role="switch" aria-checked={rarePriority} onClick={() => setRarePriority((value) => !value)}><i /></button>
        </div>
      </section>

      <section className="results" id="results">
        {calculation.error ? (
          <div className="error-card"><b>계산할 수 없습니다.</b><p>{calculation.error}</p></div>
        ) : result && (
          <>
            <div className="section-heading result-heading">
              <div><p className="eyebrow">LINE SNAPSHOT</p><h2>필요 생산 라인</h2></div>
              <div className="result-actions">
                <div className="result-target-summary">
                  <b>{targets.length}개 목표 동시 계산</b>
                  <span>{targets.map((draft) => `${ITEM_MAP.get(draft.itemId)?.name} ${formatNumber(draft.rate)}${draft.unit === "second" ? "/초" : "/분"}`).join(" · ")}</span>
                </div>
                <button type="button" onClick={copySummary}>{copied ? "복사됨 ✓" : "요약 복사"}</button>
              </div>
            </div>

            <div className="metric-grid">
              <article><span className="metric-index">T</span><p>통합 생산 목표</p><strong>{targets.length}<small>개</small></strong><em>각 목표 단위 개별 설정</em></article>
              <article><span className="metric-index">A</span><p>총 생산 설비</p><strong>{formatNumber(result.totalRoundedMachines, 0)}<small>대</small></strong><em>공통 중간재 합산 후 올림</em></article>
              <article><span className="metric-index">↯</span><p>설비 기본 부하</p><strong>{formatNumber(result.totalPowerMw)}<small>MW</small></strong><em>증산제 전력 배율 제외</em></article>
              <article><span className="metric-index">R</span><p>외부 원료 종류</p><strong>{rawEntries.length}<small>종</small></strong><em>{rarePriority ? "희귀 자원 사용" : "기본 레시피 사용"}</em></article>
            </div>

            <div className="results-grid" id="resources">
              <section className="data-card raw-card">
                <div className="card-heading"><div><p className="eyebrow">RAW INPUT</p><h3>외부 원료</h3></div><span>{rawEntries.length} SOURCES</span></div>
                <div className="raw-list">
                  {rawEntries.map(({ item, value }) => (
                    <div className="raw-row" key={item.id}>
                      <ItemMark item={item} small />
                      <span><b>{item.name}</b><small>{item.en}</small></span>
                      <strong>{formatNumber(value)}<small>/분</small></strong>
                      <em>{Math.max(1, Math.ceil(value / beltCapacity))} 벨트</em>
                    </div>
                  ))}
                </div>
                {byproductEntries.length > 0 && (
                  <div className="byproduct-box">
                    <p><b>부산물</b><span>자동 상계하지 않음</span></p>
                    {byproductEntries.map(({ item, value }) => <span key={item.id}>{item.name} <b>{formatNumber(value)}/분</b></span>)}
                  </div>
                )}
              </section>

              <section className="data-card facility-card">
                <div className="card-heading"><div><p className="eyebrow">FACILITY MIX</p><h3>설비 구성</h3></div><span>{facilityGroups.length} TYPES</span></div>
                <div className="facility-list">
                  {facilityGroups.map((group) => (
                    <div className="facility-row" key={group.machine.id}>
                      <span className="facility-symbol">{FACILITY_LABELS[group.machine.category][0]}</span>
                      <span><b>{group.machine.name}</b><small>{group.lines}개 생산 공정 · 속도 ×{group.machine.speed}</small></span>
                      <strong>{formatNumber(group.count, 0)}<small>대</small></strong>
                      <em>{formatNumber(group.power)} MW</em>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="tree-card" id="production-tree">
              <div className="card-heading tree-heading">
                <div><p className="eyebrow">DEPENDENCY TREE</p><h3>생산 트리</h3></div>
                <p><span>아이템</span><span>처리량</span><span>설비</span><span>벨트</span></p>
              </div>
              <div className="tree-body">
                {result.trees.map((tree, index) => {
                  const draft = targets[index];
                  return (
                    <div className="tree-target-group" key={`${draft?.id}-${tree.itemId}-${tree.ratePerMin}-${factoryPreset}-${productMultiplier}-${rarePriority}`}>
                      <div className="tree-target-banner">
                        <span>TARGET {String(index + 1).padStart(2, "0")}</span>
                        <b>{tree.item.name}</b>
                        <em>{formatNumber(draft?.rate ?? tree.ratePerMin)}{draft?.unit === "second" ? "/초" : "/분"}</em>
                      </div>
                      <TreeBranch node={tree} depth={0} path={`root-${index}`} beltCapacity={beltCapacity} />
                    </div>
                  );
                })}
              </div>
              <div className="tree-footnote"><span className="raw-pill">RAW</span> 외부에서 공급할 원료 · 목표별 트리는 나누어 표시하고 공정·원료·설비 합계는 전체 목표를 합산합니다.</div>
            </section>

            <section className="process-card">
              <div className="card-heading"><div><p className="eyebrow">PROCESS TABLE</p><h3>공정별 상세</h3></div><span>{result.rows.length} LINES</span></div>
              <div className="process-table-wrap">
                <table>
                  <thead><tr><th>생산품</th><th>레시피</th><th>처리량</th><th>설비</th><th>필요 대수</th><th>기본 전력</th></tr></thead>
                  <tbody>
                    {[...result.rows].sort((a, b) => b.exactMachines - a.exactMachines).map((row) => (
                      <tr key={`${row.itemId}-${row.recipeId}-${row.machineId}`}>
                        <td><ItemMark item={row.item as Item} small /><span><b>{row.item.name}</b><small>{row.item.en}</small></span></td>
                        <td>{row.recipe.inputs.map((input) => `${input.qty}× ${ITEM_MAP.get(input.itemId)?.name}`).join(" + ")}<small>{row.recipe.timeSec}초 → {row.recipe.outputQty}개{row.productMultiplier > 1 ? ` × ${row.productMultiplier}` : ""}</small></td>
                        <td><b>{formatNumber(row.ratePerMin)}</b><small>/분</small></td>
                        <td>{row.machine.name}<small>속도 ×{row.machine.speed}</small></td>
                        <td><b>{formatNumber(row.roundedMachines, 0)}대</b><small>정확 {formatNumber(row.exactMachines)}</small></td>
                        <td><b>{formatNumber(row.powerMw)}</b><small>MW</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>

      <section className="method" id="method">
        <div><p className="eyebrow">CALCULATION NOTES</p><h2>계산 기준</h2></div>
        <div className="method-grid">
          <article><span>01</span><h3>공통 수요는 합산</h3><p>모든 목표에서 함께 쓰는 중간재를 먼저 합친 뒤, 실제 배치할 설비 수만 마지막에 올림합니다.</p></article>
          <article><span>02</span><h3>부산물은 별도</h3><p>정제유·그래핀 공정의 수소 부산물은 표시하되 다른 공정에 자동 재사용하지 않습니다.</p></article>
          <article><span>03</span><h3>특수 채취는 원료로</h3><p>중수소 분별, 가스 행성 채취, 반물질 생성은 속도가 조건마다 달라 외부 원료로 계산합니다.</p></article>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /></span><span>ORBITAL <b>PLANNER</b></span></a>
        <p>Dyson Sphere Program 비공식 생산 계산기 · 데이터 {DATA_VERSION}</p>
        <a href="#top">맨 위로 ↑</a>
      </footer>
    </main>
  );
}
