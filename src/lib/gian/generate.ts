import type { Statement, Vendor } from "./types";

// ── 숫자 포맷 ────────────────────────────────────────────────
export const won = (n: number) =>
  (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString("ko-KR");

/** 품목 요약 문구 (예: "EVA 폼시트 외 3건") */
export function summarizeItems(items: Statement["items"]): string {
  if (!items || items.length === 0) return "";
  const first = items[0]?.name?.trim() || "품목";
  return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
}

/** 하이웍스 제목:  [지출결의서] {업체} {품목요약} 지급의 건 (YYYY년 M월) */
export function buildTitle(st: Statement): string {
  const d = new Date(st.date || Date.now());
  const ym = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  const summary = summarizeItems(st.items);
  const vendor = st.vendor || "거래처";
  const mid = summary ? `${summary} ` : "";
  return `[지출결의서] ${vendor} ${mid}지급의 건 (${ym})`;
}

/** 본문 상단 고정 문구 (하이웍스 양식과 동일) */
export const BODY_INTRO = "아래의 사항에 대하여 지출을 기안하오니 검토 후 지급 바랍니다.";

/** 비고 문구 자동 생성 */
export function buildNote(st: Statement, vendor?: Vendor | null): string {
  const parts: string[] = [];
  if (st.date) parts.push(`거래일자: ${st.date}`);
  const pay = vendor?.payment || "";
  if (pay) parts.push(`결제방법: ${pay}`);
  if (st.bizNo) parts.push(`사업자번호: ${st.bizNo}`);
  if (st.note) parts.push(st.note);
  parts.push("증빙: 거래명세서 및 전자세금계산서 첨부");
  return parts.join(" / ");
}

// ── 하이웍스 본문 표 (HTML) ──────────────────────────────────
// 컬럼: 거래처 | 항목 | 단가 | 수량 | 공급가액 | 세액 | 총 금액
// 붙여넣기/자동입력 모두에서 표 구조가 유지되도록 인라인 스타일 사용.
export function buildBodyTableHtml(st: Statement): string {
  const th = (t: string, w?: string) =>
    `<th style="border:1px solid #333;padding:6px 8px;background:#f2f2f2;font-weight:bold;${w ? `width:${w};` : ""}">${t}</th>`;
  const td = (t: string, align = "center") =>
    `<td style="border:1px solid #333;padding:6px 8px;text-align:${align};">${t}</td>`;

  const rows = st.items
    .map((it) =>
      "<tr>" +
      td(esc(st.vendor)) +
      td(esc(it.name), "left") +
      td(won(it.unitPrice)) +
      td(String(it.qty ?? "")) +
      td(won(it.supply)) +
      td(won(it.vat)) +
      td(won(it.total)) +
      "</tr>"
    )
    .join("");

  const totalRow =
    "<tr>" +
    `<td colspan="4" style="border:1px solid #333;padding:6px 8px;text-align:center;font-weight:bold;background:#fafafa;">합 계</td>` +
    td(won(st.supplyTotal)) +
    td(won(st.vatTotal)) +
    `<td style="border:1px solid #333;padding:6px 8px;text-align:center;font-weight:bold;">${won(st.grandTotal)}</td>` +
    "</tr>";

  return (
    `<table style="border-collapse:collapse;width:100%;font-size:13px;">` +
    "<thead><tr>" +
    th("거래처", "14%") + th("항 목") + th("단가", "12%") + th("수량", "8%") +
    th("공급가액", "14%") + th("세액", "12%") + th("총 금액", "14%") +
    "</tr></thead><tbody>" +
    rows + totalRow +
    "</tbody></table>"
  );
}

/** 하이웍스 본문 전체 HTML (문구 + 표 + 비고) — 붙여넣기/자동입력용 */
export function buildBodyHtml(st: Statement, vendor?: Vendor | null): string {
  return (
    `<p style="text-align:center;font-weight:bold;margin:8px 0 14px;">${BODY_INTRO}</p>` +
    buildBodyTableHtml(st) +
    `<p style="margin-top:14px;"><b>[비고]</b> ${esc(buildNote(st, vendor))}</p>`
  );
}

/** 복사용 순수 텍스트 버전 (표를 지원 안 하는 곳 대비) */
export function buildBodyText(st: Statement, vendor?: Vendor | null): string {
  const lines: string[] = [BODY_INTRO, ""];
  lines.push("거래처\t항목\t단가\t수량\t공급가액\t세액\t총금액");
  for (const it of st.items) {
    lines.push(
      [st.vendor, it.name, won(it.unitPrice), it.qty, won(it.supply), won(it.vat), won(it.total)].join("\t")
    );
  }
  lines.push(["합계", "", "", "", won(st.supplyTotal), won(st.vatTotal), won(st.grandTotal)].join("\t"));
  lines.push("", `[비고] ${buildNote(st, vendor)}`);
  return lines.join("\n");
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── 합계 재계산 유틸 (사용자가 표를 수정했을 때) ────────────────
export function recalcTotals(st: Statement): Statement {
  const supplyTotal = st.items.reduce((a, b) => a + (Number(b.supply) || 0), 0);
  const vatTotal = st.items.reduce((a, b) => a + (Number(b.vat) || 0), 0);
  const grandTotal = st.items.reduce(
    (a, b) => a + (Number(b.total) || Number(b.supply) + Number(b.vat) || 0),
    0
  );
  return { ...st, supplyTotal, vatTotal, grandTotal: grandTotal || supplyTotal + vatTotal };
}
