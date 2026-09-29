import QRCode from "qrcode";
import type { WorkOrder } from "@/types";
import { exportNodeAsPng } from "./exportWorkOrder";

export function hasAttachments(wo: WorkOrder): boolean {
  return !!(wo.attachments && wo.attachments.length > 0);
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// 인쇄창/이미지 캡처 공통 CSS
export const ATTACH_CSS = `
  .attach-page { page-break-before: always; padding: 10mm; box-sizing: border-box;
    font-family: 'Noto Sans KR','Malgun Gothic',sans-serif; background:#fff; color:#111; }
  .attach-title { font-size: 14pt; font-weight: 800; margin-bottom: 6mm;
    border-bottom: 2px solid #333; padding-bottom: 3mm; }
  .attach-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
  .att-card { border: 1px solid #ccc; border-radius: 6px; padding: 5mm;
    break-inside: avoid; }
  .att-label { font-size: 10pt; font-weight: 800; margin-bottom: 4mm; color: #222;
    word-break: break-all; text-align: center; }
  .att-body { display: flex; flex-wrap: wrap; gap: 5mm; justify-content: center; align-items: flex-start; }
  .att-item { display: flex; flex-direction: column; align-items: center; max-width: 48%; }
  .att-img { max-width: 100%; max-height: 55mm; object-fit: contain; }
  .att-qr { width: 36mm; height: 36mm; }
  .att-url { font-size: 6.5pt; color: #1a56db; word-break: break-all; margin-top: 1.5mm; max-width: 46mm; text-align: center; }
  .att-memo { font-size: 7.5pt; color: #666; margin-top: 1.5mm; white-space: pre-wrap; text-align: center; }
`;

// 부자재(원단 이미지·링크) → HTML 문자열. 같은 자재의 이미지+링크QR을 한 칸에 묶음.
export async function buildAttachmentHTML(wo: WorkOrder): Promise<string> {
  const atts = wo.attachments ?? [];
  if (!atts.length) return "";
  const matLabel = (materialId: string) => {
    const m = (wo.materials ?? []).find((x) => x.id === materialId);
    return m ? [m.category, m.name].filter(Boolean).join(" ") : "";
  };
  // 자재별로 그룹핑 (같은 원부자재 항목 = 한 칸)
  const order: string[] = [];
  const groups = new Map<string, typeof atts>();
  for (const a of atts) {
    const key = a.materialId || a.id;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push(a);
  }

  const cards: string[] = [];
  for (const key of order) {
    const list = groups.get(key)!;
    const label = matLabel(key) || list[0]?.name || "부자재";
    const items: string[] = [];
    for (const a of list) {
      if (a.type === "image") {
        items.push(
          `<div class="att-item"><img class="att-img" src="${a.value}" crossorigin="anonymous" />` +
          (a.memo ? `<div class="att-memo">${escapeHtml(a.memo)}</div>` : "") +
          `</div>`
        );
      } else {
        let qr = "";
        try { qr = await QRCode.toDataURL(a.value, { width: 160, margin: 1 }); } catch { /* ignore */ }
        items.push(
          `<div class="att-item">` +
          (qr ? `<img class="att-qr" src="${qr}" />` : "") +
          `<div class="att-url">${escapeHtml(a.value)}</div>` +
          (a.memo ? `<div class="att-memo">${escapeHtml(a.memo)}</div>` : "") +
          `</div>`
        );
      }
    }
    cards.push(`<div class="att-card"><div class="att-label">${escapeHtml(label)}</div><div class="att-body">${items.join("")}</div></div>`);
  }
  return `<div class="attach-page"><div class="attach-title">부자재 자료 — ${escapeHtml(wo.styleNo || "")} ${escapeHtml(wo.productName || "")}</div><div class="attach-grid">${cards.join("")}</div></div>`;
}

// 부자재 자료만 PNG로 저장 (이미지 전송용). 외부 이미지는 exportNodeAsPng가 프록시로 처리.
export async function exportAttachmentsPng(wo: WorkOrder, filename: string) {
  const html = await buildAttachmentHTML(wo);
  if (!html) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed; left:-99999px; top:0; width:297mm; background:#fff; z-index:-1;";
  wrap.innerHTML = `<style>${ATTACH_CSS}</style>${html}`;
  document.body.appendChild(wrap);
  try {
    // 렌더/이미지 로드 잠깐 대기
    await new Promise((r) => setTimeout(r, 150));
    await exportNodeAsPng(wrap, filename);
  } finally {
    document.body.removeChild(wrap);
  }
}
