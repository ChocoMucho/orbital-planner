"use client";

import { useEffect, useState } from "react";
import { useCloudSession } from "../lib/cloud-session";
import {
  deleteProductionPlan,
  listProductionPlans,
  saveProductionPlan,
} from "../lib/plan-repository";
import type { ProductionPlanPayload, SavedProductionPlan } from "../lib/plan-model";

type PlanToolbarProps = {
  payload: ProductionPlanPayload;
  onLoad: (payload: ProductionPlanPayload) => void;
};

export default function PlanToolbar({ payload, onLoad }: PlanToolbarProps) {
  const cloud = useCloudSession();

  if (!cloud.configured) {
    return (
      <section className="plan-toolbar plan-toolbar--setup" aria-label="클라우드 저장 준비 상태">
        <div>
          <span className="plan-toolbar-label">LOCAL FOUNDATION</span>
          <b>클라우드 연결 준비 완료</b>
          <small>Supabase 주소와 공개 키를 설정하면 Google 로그인과 저장이 활성화됩니다.</small>
        </div>
      </section>
    );
  }

  if (!cloud.user) return null;

  return (
    <SignedInPlanToolbar
      key={cloud.user.id}
      payload={payload}
      onLoad={onLoad}
      userId={cloud.user.id}
      email={cloud.user.email ?? "Google 계정"}
      onSignOut={cloud.signOut}
    />
  );
}

type SignedInPlanToolbarProps = PlanToolbarProps & {
  userId: string;
  email: string;
  onSignOut: () => Promise<void>;
};

function SignedInPlanToolbar({ payload, onLoad, userId, email, onSignOut }: SignedInPlanToolbarProps) {
  const [plans, setPlans] = useState<SavedProductionPlan[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [name, setName] = useState("새 생산 계획");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    void listProductionPlans(userId).then((result) => {
      if (!active) return;
      setPlans(result.plans);
      setStatus(result.warning ? "오프라인 캐시 사용 중" : `${result.plans.length}개 계획 동기화됨`);
      setBusy(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const loadSelected = (id: string) => {
    setCurrentId(id);
    if (!id) {
      setName("새 생산 계획");
      setStatus("새 계획 작성 중");
      return;
    }
    const selected = plans.find((plan) => plan.id === id);
    if (!selected) return;
    setName(selected.name);
    onLoad(selected.payload);
    setStatus(selected.syncState === "pending" ? "동기화 대기 중" : "계획을 불러왔습니다.");
  };

  const save = async () => {
    setBusy(true);
    const saved = await saveProductionPlan({
      ownerId: userId,
      id: currentId || undefined,
      name,
      payload,
    });
    setCurrentId(saved.id);
    setName(saved.name);
    setPlans((current) => [saved, ...current.filter((plan) => plan.id !== saved.id)]);
    setStatus(saved.syncState === "synced" ? "클라우드에 저장됨" : "오프라인 저장 · 연결 시 동기화");
    setBusy(false);
  };

  const remove = async () => {
    if (!currentId) return;
    setBusy(true);
    const deletedId = currentId;
    const synced = await deleteProductionPlan(userId, deletedId);
    setPlans((current) => current.filter((plan) => plan.id !== deletedId));
    setCurrentId("");
    setName("새 생산 계획");
    setStatus(synced ? "계획을 삭제했습니다." : "삭제 대기 · 연결 시 동기화");
    setBusy(false);
  };

  return (
    <section className="plan-toolbar" aria-label="생산 계획 저장">
      <div className="plan-toolbar-account">
        <span className="plan-toolbar-label">CLOUD PLAN</span>
        <b>{email}</b>
        <button type="button" onClick={() => void onSignOut()}>로그아웃</button>
      </div>
      <div className="plan-toolbar-fields">
        <label>
          <span>저장된 계획</span>
          <select value={currentId} onChange={(event) => loadSelected(event.target.value)} disabled={busy}>
            <option value="">새 생산 계획</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}{plan.syncState === "pending" ? " · 동기화 대기" : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <span>계획 이름</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>
      <div className="plan-toolbar-actions">
        <span role="status">{busy ? "처리 중…" : status}</span>
        <button className="plan-save-button" type="button" onClick={() => void save()} disabled={busy}>저장</button>
        <button type="button" onClick={() => void remove()} disabled={busy || !currentId}>삭제</button>
      </div>
    </section>
  );
}
