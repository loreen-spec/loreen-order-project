import * as XLSX from "xlsx";
import type { WorkOrder, ShoeWorkOrder } from "@/types";

// ── PNG 저장 (미리보기 캡처) ─────────────────────────────
// 크로스오리진 이미지는 same-origin 프록시로 바꿔 canvas 오염 방지
export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas")).default;
  const imgs = Array.from(node.querySelectorAll("img"));
  const restore: [HTMLImageElement, string][] = [];
  await Promise.all(imgs.map((img) => new Promise<void>((res) => {
    const src = img.getAttribute("src") || "";
    const isExternal = src && !src.startsWith("data:") && !/^\/(?!\/)/.test(src) && !src.startsWith(location.origin);
    if (isExternal) {
      restore.push([img, src]);
      img.crossOrigin = "anonymous";
      img.onload = () => res();
      img.onerror = () => res();
      img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
    } else { res(); }
  })));
  try {
    const canvas = await html2canvas(node, { useCORS: true, backgroundColor: "#ffffff", scale: 2, logging: false });
    const link = document.createElement("a");
    link.download = filename.replace(/[\\/:*?"<>|]/g, "_") + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    restore.forEach(([img, src]) => { img.src = src; });
  }
}

function download(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name.replace(/[\\/:*?"<>|]/g, "_") + ".xlsx");
}

// ── 의류 작업지시서 → 엑셀 ────────────────────────────────
export function exportWorkOrderXlsx(wo: WorkOrder) {
  const sizes = wo.sizes ?? [];
  const aoa: (string | number)[][] = [];
  aoa.push(["작 업 지 시 서"]);
  aoa.push([]);
  aoa.push(["STYLE NO", wo.styleNo, "상품명", wo.productName, "작업처", wo.vendor, "차수", `${wo.orderCount}차`]);
  aoa.push(["담당", wo.manager, "실장", wo.director, "작성일", wo.issueDate, "납품예정일", wo.deliveryDate]);
  aoa.push(["시즌", `${wo.year} ${wo.season}`, "SAMPLE NO.", wo.sampleNo]);
  aoa.push([]);
  aoa.push(["[사이즈 스펙]"]);
  aoa.push(["항목", ...sizes, "편차"]);
  (wo.measurements ?? []).forEach((m) => aoa.push([m.item, ...sizes.map((s) => m.values?.[s] ?? ""), m.diff]));
  aoa.push([]);
  aoa.push(["[원부자재]"]);
  aoa.push(["품목", "자재명", "색상", "규격", "요척", "단가", "비고"]);
  (wo.materials ?? []).forEach((m) => aoa.push([m.category, m.name, m.color, m.spec, m.yield, m.unitPrice, m.notes]));
  aoa.push([]);
  aoa.push(["[발주 색상 × 사이즈]"]);
  aoa.push(["COLOR", ...sizes, "계"]);
  (wo.colorSizeTable ?? []).forEach((r) => aoa.push([r.color, ...sizes.map((s) => r.sizes?.[s] ?? 0), r.total]));
  aoa.push(["계", ...sizes.map((s) => (wo.colorSizeTable ?? []).reduce((a, r) => a + (r.sizes?.[s] || 0), 0)), wo.totalQuantity]);
  if (wo.fixedNotes) {
    aoa.push([]);
    aoa.push(["[준수사항]"]);
    wo.fixedNotes.split("\n").filter(Boolean).forEach((l) => aoa.push([l]));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 16 }, { wch: 20 }, ...sizes.map(() => ({ wch: 8 })), { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (wo.category || "작지").slice(0, 31));
  download(wb, wo.styleNo || wo.productName || "작업지시서");
}

// ── 슈즈 작업지시서 → 엑셀 ────────────────────────────────
export function exportShoeXlsx(wo: ShoeWorkOrder) {
  const sizes = wo.sizes ?? [];
  const aoa: (string | number)[][] = [];
  aoa.push(["슈즈 작업지시서"]);
  aoa.push([]);
  aoa.push(["STYLE NO", wo.styleNo, "상품명", wo.productName, "작업처", wo.vendor, "차수", `${wo.orderCount}차`]);
  aoa.push(["담당", wo.manager, "실장", wo.director, "발주일", wo.orderDate, "납품예정일", wo.deliveryDate]);
  aoa.push(["시즌", `${wo.year} ${wo.season}`, "업체단가", wo.vendorUnitPrice]);
  aoa.push([]);
  aoa.push(["[제품 사양]"]);
  (wo.specs ?? []).forEach((s) => aoa.push([s.item, s.value]));
  aoa.push([]);
  aoa.push(["[오즈키즈 제공 부자재]"]);
  aoa.push([wo.suppliedMaterials || "제공 없음"]);
  aoa.push([]);
  aoa.push(["[발주 색상 × 사이즈]"]);
  aoa.push(["COLOR", ...sizes, "계"]);
  (wo.colorSizeTable ?? []).forEach((r) => aoa.push([r.color, ...sizes.map((s) => r.sizes?.[s] ?? 0), r.total]));
  aoa.push(["계", ...sizes.map((s) => (wo.colorSizeTable ?? []).reduce((a, r) => a + (r.sizes?.[s] || 0), 0)), wo.totalQuantity]);
  if (wo.cautions) {
    aoa.push([]);
    aoa.push(["[주의사항]"]);
    wo.cautions.split("\n").filter(Boolean).forEach((l) => aoa.push([l]));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 16 }, { wch: 20 }, ...sizes.map(() => ({ wch: 8 })), { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "슈즈작지");
  download(wb, wo.styleNo || wo.productName || "슈즈작업지시서");
}
