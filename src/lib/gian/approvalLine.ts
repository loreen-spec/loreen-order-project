import type { ApprovalLine, Person } from "./types";

// ── 결재선 규칙 (사용자 지정) ─────────────────────────────────
//  · 기본 결재자: 사원 Loreen박정은(본인) → 임원 Anna임은영
//  · 기본 참조:   Hans최철용, Andy김현창, kara김보현, bot, jenna양지연
//  · 합계 100만원 이상  → Hans최철용(대표)을 참조에서 빼고 임원(Anna) 다음 결재자로 추가
//  · 모든 문서          → 참조에 sunny김진선 항상 추가
// ─────────────────────────────────────────────────────────────

export const HANS = "Hans최철용";      // 대표님
export const SUNNY = "sunny김진선";     // 항상 참조
export const CEO_THRESHOLD = 1_000_000; // 대표 결재 기준 금액

/** 기본 결재자 (사원 → 임원) */
export const DEFAULT_APPROVERS: Person[] = [
  { name: "Loreen박정은", role: "사원" },
  { name: "Anna임은영", role: "임원" },
];

/** 기본 참조자 */
export const DEFAULT_REFERENCES: Person[] = [
  { name: HANS },
  { name: "Andy김현창" },
  { name: "kara김보현" },
  { name: "bot" },
  { name: "jenna양지연" },
];

/**
 * 합계금액에 따라 결재선을 계산한다.
 * @param grandTotal 기안서 합계금액(원)
 */
export function buildApprovalLine(grandTotal: number): ApprovalLine {
  const approvers: Person[] = DEFAULT_APPROVERS.map((p) => ({ ...p }));
  let references: Person[] = DEFAULT_REFERENCES.map((p) => ({ ...p }));

  const ceoRequired = grandTotal >= CEO_THRESHOLD;

  if (ceoRequired) {
    // 참조에서 대표(Hans) 제거 → 임원(Anna) 다음 결재자로 승격
    references = references.filter((p) => p.name !== HANS);
    approvers.push({ name: HANS, role: "대표" });
  }

  // 모든 문서: sunny김진선 참조에 항상 포함 (중복 방지)
  if (!references.some((p) => p.name === SUNNY)) {
    references.push({ name: SUNNY });
  }

  return { approvers, references };
}

/** 화면 안내용 — 이 금액이면 대표 결재가 붙는지 */
export function needsCeoApproval(grandTotal: number): boolean {
  return grandTotal >= CEO_THRESHOLD;
}
