"use client";
import type { Vendor, GianDoc, Recurring } from "./types";

// ── 로컬 저장소 (localStorage) ───────────────────────────────
// 1차 버전은 브라우저 로컬에 저장. 추후 Supabase 연동으로 교체 예정.
// 각 키는 openhan-dashboard 내 다른 앱과 충돌 방지를 위해 gm_ 접두어 사용.

const K = {
  vendors: "gm_vendors",
  docs: "gm_docs",
  recurring: "gm_recurring",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("저장 실패", e);
  }
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2));

// ── 업체 ──
export const getVendors = () => read<Vendor[]>(K.vendors, SEED_VENDORS);
export function saveVendor(v: Vendor): Vendor[] {
  const list = getVendors();
  const i = list.findIndex((x) => x.id === v.id);
  if (i >= 0) list[i] = v;
  else list.unshift(v);
  write(K.vendors, list);
  return list;
}
export function deleteVendor(id: string): Vendor[] {
  const list = getVendors().filter((v) => v.id !== id);
  write(K.vendors, list);
  return list;
}
/** 업체명으로 가장 근접한 업체 찾기 (인식 결과 자동 매칭) */
export function matchVendor(name: string): Vendor | null {
  if (!name) return null;
  const list = getVendors();
  const norm = (s: string) => s.replace(/\(주\)|주식회사|\s|㈜/g, "").toLowerCase();
  const target = norm(name);
  return (
    list.find((v) => norm(v.name) === target) ||
    list.find((v) => norm(v.name) && (norm(v.name).includes(target) || target.includes(norm(v.name)))) ||
    null
  );
}

// ── 기안 문서 ──
export const getDocs = () => read<GianDoc[]>(K.docs, []);
export function saveDoc(d: GianDoc): GianDoc[] {
  const list = getDocs();
  const i = list.findIndex((x) => x.id === d.id);
  if (i >= 0) list[i] = d;
  else list.unshift(d);
  write(K.docs, list);
  return list;
}
export function deleteDoc(id: string): GianDoc[] {
  const list = getDocs().filter((d) => d.id !== id);
  write(K.docs, list);
  return list;
}

// ── 정기결제 ──
export const getRecurring = () => read<Recurring[]>(K.recurring, []);
export function saveRecurring(r: Recurring): Recurring[] {
  const list = getRecurring();
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) list[i] = r;
  else list.unshift(r);
  write(K.recurring, list);
  return list;
}
export function deleteRecurring(id: string): Recurring[] {
  const list = getRecurring().filter((r) => r.id !== id);
  write(K.recurring, list);
  return list;
}

// ── 초기 예시 업체 (처음 사용 시) ──
const SEED_VENDORS: Vendor[] = [
  { id: "seed-1", name: "(주)대한부자재", bizNo: "214-81-45210", account: "원부자재비", payment: "계좌이체(말일)", type: "건별" },
  { id: "seed-2", name: "AWS Korea", bizNo: "120-87-65432", account: "지급수수료", payment: "카드 자동결제", type: "정기" },
  { id: "seed-3", name: "신성인쇄", bizNo: "305-12-88771", account: "인쇄비", payment: "계좌이체(익월10일)", type: "건별" },
];
