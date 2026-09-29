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
  .attach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
  .att-card { border: 1px solid #ccc; border-radius: 6px; padding: 4mm; text-align: center;
    break-inside: avoid; display: flex; flex-direction: column; align-items: center; }
  .att-label { font-size: 9pt; font-weight: 700; margin-bottom: 3mm; color: #222; word-break: break-all; }
  .att-img { max-width: 100%; max-height: 50mm; object-fit: contain; }
  .att-qr { width: 38mm; height: 38mm; }
  .att-url { font-size: 7pt; color: #1a56db; word-break: break-all; margin-top: 2mm; }
  .att-memo { font-size: 7.5pt; color: #666; margin-top: 2mm; white-space: pre-wrap; }
`;

// 부자재(원단 이미지·링크) → HTML 문자열. 링크는 QR코드 + 주소 텍스트.
export async function buildAttachmentHTML(wo: WorkOrder): Promise<string> {
  const atts = wo.attachments ?? [];
  if (!atts.length) return "";
  const matLabel = (materialId: string) => {
    const m = (wo.materials ?? []).find((x) => x.id === materialId);
    return m ? [m.category, m.name].filter(Boolean).join(" ") : "";
  };
  const cards: string[] = [];
  for (const a of atts) {
    const label = [matLabel(a.materialId), a.name].filter(Boolean).join(" · ");
    if (a.type === "image") {
      cards.push(
        `<div class="att-card"><div class="att-label">${escapeHtml(label)}</div>` +
        `<img class="att-img" src="${a.value}" crossorigin="anonymous" />` +
        (a.memo ? `<div class="att-memo">${escapeHtml(a.memo)}</div>` : "") +
        `</div>`
      );
    } else {
      let qr = "";
      try { qr = await QRCode.toDataURL(a.value, { width: 160, margin: 1 }); } catch { /* ignore */ }
      cards.push(
        `<div class="att-card"><div class="att-label">${escapeHtml(label)}</div>` +
        (qr ? `<img class="att-qr" src="${qr}" />` : "") +
        `<div class="att-url">${escapeHtml(a.value)}</div>` +
        (a.memo ? `<div class="att-memo">${escapeHtml(a.memo)}</div>` : "") +
        `</div>`
      );
    }
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
