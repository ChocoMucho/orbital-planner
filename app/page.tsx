"use client";

import { useMemo, useState } from "react";
import {
  calculateProduction,
  ProductionCalculationError,
  type ProductionCalculationResult,
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

type Unit = "minute" | "second";
type FactoryPreset = "starter" | "standard" | "darkfog";

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

export default function Home() {
  const [targetId, setTargetId] = useState("small_carrier_rocket");
  const [rate, setRate] = useState(60);
  const [unit, setUnit] = useState<Unit>("minute");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rarePriority, setRarePriority] = useState(false);
  const [productMultiplier, setProductMultiplier] = useState(1);
  const [factoryPreset, setFactoryPreset] = useState<FactoryPreset>("standard");
  const [beltCapacity, setBeltCapacity] = useState(1800);
  const [copied, setCopied] = useState(false);

  const target = ITEM_MAP.get(targetId) ?? TARGET_ITEMS[0];
  const ratePerMin = unit === "second" ? rate * 60 : rate;
  const increment = unit === "second" ? 1 : 10;

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return TARGET_ITEMS;
    return TARGET_ITEMS.filter((item) => `${item.name} ${item.en}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  const calculation = useMemo<{ result?: ProductionCalculationResult; error?: string }>(() => {
    try {
      return {
        result: calculateProduction({
          items: ITEMS,
          recipes: RECIPES,
          machines: MACHINES,
          target: { itemId: targetId, ratePerMin },
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
  }, [factoryPreset, productMultiplier, rarePriority, ratePerMin, targetId]);

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
    const groups = new Map<string, { machine: ProductionCalculationResult["rows"][number]["machine"]; count: number; power: number; lines: number }>();
    for (const row of result.rows) {
      const current = groups.get(row.machineId) ?? { machine: row.machine, count: 0, power: 0, lines: 0 };
      current.count += row.roundedMachines;
      current.power += row.powerMw;
      current.lines += 1;
      groups.set(row.machineId, current);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [result]);

  const setQuickRate = (perMinute: number) => setRate(unit === "second" ? perMinute / 60 : perMinute);

  const copySummary = async () => {
    if (!result || !target) return;
    const lines = [
      `[오비탈 플래너] ${target.name} ${formatNumber(ratePerMin)}/분`,
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

      <section className="hero" id="top">
        <div className="hero-copy-block">
          <p className="eyebrow">DYSON SPHERE PROGRAM · PRODUCTION CALCULATOR</p>
          <h1>성간 공장을<br /><em>숫자로 설계하세요.</em></h1>
          <p className="hero-copy">목표 생산량 하나만 정하세요. 필요한 설비, 원료, 전력과 벨트 라인을 전체 생산 체인으로 역산합니다.</p>
          <div className="hero-facts" aria-label="계산기 기능">
            <span><b>{RECIPES.length}</b> 레시피</span>
            <span><b>{TARGET_ITEMS.length}</b> 목표 아이템</span>
            <span><b>LIVE</b> 즉시 계산</span>
          </div>
        </div>

        <div className="target-panel">
          <p className="panel-label"><span>01</span> 생산 목표 <i>OUTPUT TARGET</i></p>
          <label>목표 아이템</label>
          <div className="picker-wrap">
            <button className="item-select" type="button" onClick={() => setPickerOpen((value) => !value)} aria-expanded={pickerOpen} aria-haspopup="listbox">
              <ItemMark item={target} />
              <span><b>{target.name}</b><small>{target.en}</small></span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </button>
            {pickerOpen && (
              <div className="item-picker" onKeyDown={(event) => event.key === "Escape" && setPickerOpen(false)}>
                <div className="picker-search">
                  <span aria-hidden="true">⌕</span>
                  <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="아이템 검색" aria-label="아이템 검색" />
                  <small>{filteredItems.length}</small>
                </div>
                <div className="picker-list" role="listbox" aria-label="목표 아이템">
                  {Object.entries(CATEGORY_LABELS).filter(([category]) => category !== "raw").map(([category, label]) => {
                    const entries = filteredItems.filter((item) => item.category === category);
                    if (!entries.length) return null;
                    return (
                      <div className="picker-group" key={category}>
                        <p>{label}</p>
                        {entries.map((item) => (
                          <button key={item.id} type="button" role="option" aria-selected={item.id === targetId} onClick={() => { setTargetId(item.id); setPickerOpen(false); setQuery(""); }}>
                            <ItemMark item={item} small />
                            <span><b>{item.name}</b><small>{item.en}</small></span>
                            {item.id === targetId && <i>선택됨</i>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {!filteredItems.length && <p className="empty-search">일치하는 아이템이 없습니다.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="rate-label-row">
            <label htmlFor="target-rate">목표 생산량</label>
            <div className="unit-tabs" role="group" aria-label="생산량 단위">
              <button type="button" className={unit === "minute" ? "active" : ""} onClick={() => { if (unit === "second") setRate(rate * 60); setUnit("minute"); }}>/분</button>
              <button type="button" className={unit === "second" ? "active" : ""} onClick={() => { if (unit === "minute") setRate(rate / 60); setUnit("second"); }}>/초</button>
            </div>
          </div>
          <div className="rate-control">
            <button type="button" onClick={() => setRate(Math.max(0.01, rate - increment))} aria-label={`생산량 ${increment} 감소`}>−</button>
            <input id="target-rate" type="number" min="0.01" step={unit === "second" ? 0.1 : 1} value={rate} onChange={(event) => setRate(Math.max(0.01, Number(event.target.value) || 0.01))} />
            <span>/{unit === "second" ? "초" : "분"}</span>
            <button type="button" onClick={() => setRate(rate + increment)} aria-label={`생산량 ${increment} 증가`}>＋</button>
          </div>
          <div className="quick-rates" aria-label="빠른 생산량 설정">
            {[60, 360, 1800].map((value) => <button key={value} type="button" onClick={() => setQuickRate(value)}>{formatNumber(value, 0)}/분</button>)}
          </div>
          <button className="calculate-button" type="button" onClick={() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth" })}>
            생산 라인 보기 <span>↓</span>
          </button>
        </div>
      </section>

      <section className="settings-band" aria-label="계산 설정">
        <div className="settings-title"><span>02</span><p><b>계산 설정</b><small>FACTORY PROFILE</small></p></div>
        <div className="setting-cell">
          <label>설비 세대</label>
          <div className="segmented">
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
                <p><b>{target.name}</b><span>{formatNumber(ratePerMin)}/분 기준</span></p>
                <button type="button" onClick={copySummary}>{copied ? "복사됨 ✓" : "요약 복사"}</button>
              </div>
            </div>

            <div className="metric-grid">
              <article><span className="metric-index">A</span><p>총 생산 설비</p><strong>{formatNumber(result.totalRoundedMachines, 0)}<small>대</small></strong><em>정확값 {formatNumber(result.totalExactMachines)}대</em></article>
              <article><span className="metric-index">↯</span><p>설비 기본 부하</p><strong>{formatNumber(result.totalPowerMw)}<small>MW</small></strong><em>증산제 전력 배율 제외</em></article>
              <article><span className="metric-index">R</span><p>외부 원료 종류</p><strong>{rawEntries.length}<small>종</small></strong><em>{rarePriority ? "희귀 자원 사용" : "기본 레시피 사용"}</em></article>
              <article><span className="metric-index">B</span><p>목표 출력 벨트</p><strong>{Math.max(1, Math.ceil(ratePerMin / beltCapacity))}<small>라인</small></strong><em>{BELT_OPTIONS.find((option) => option.value === beltCapacity)?.label} 기준</em></article>
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
                <TreeBranch key={`${targetId}-${ratePerMin}-${factoryPreset}-${productMultiplier}-${rarePriority}`} node={result.tree} depth={0} path="root" beltCapacity={beltCapacity} />
              </div>
              <div className="tree-footnote"><span className="raw-pill">RAW</span> 외부에서 공급할 원료 · 각 행의 <b>＋</b> 버튼으로 하위 재료를 펼칠 수 있습니다.</div>
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
          <article><span>01</span><h3>중간값은 그대로</h3><p>생산률과 설비 수는 계산 도중 반올림하지 않고, 실제 배치할 설비 수만 마지막에 올림합니다.</p></article>
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
