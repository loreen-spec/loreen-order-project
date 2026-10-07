import type { WorkOrder } from "@/types";

// 공장 메모 가능한 편집용 엑셀 (이미지 삽입). ExcelJS 동적 로드.
export async function exportWorkOrderXlsxRich(wo: WorkOrder) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((wo.styleNo || "작업지시서").slice(0, 31), {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });

  const sizes = wo.sizes ?? [];
  const COLS = Math.max(9, sizes.length + 3);
  const LAST = String.fromCharCode(64 + COLS); // 열 문자 (A~)

  // 열 너비
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 20;
  for (let c = 3; c <= COLS; c++) ws.getColumn(c).width = 11;

  const thin = { style: "thin" as const, color: { argb: "FF888888" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const hdrFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8E8E8" } };

  let r = 1;

  // ── 타이틀 ──
  ws.mergeCells(`A${r}:${LAST}${r}`);
  const titleCell = ws.getCell(`A${r}`);
  titleCell.value = "작 업 지 시 서";
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 32;
  r += 2;

  // ── 기본 정보 (라벨/값) ──
  const info: [string, string][][] = [
    [["STYLE NO", wo.styleNo], ["상품명", wo.productName], ["작업처", wo.vendor]],
    [["담당", wo.manager], ["실장", wo.director], ["차수", `${wo.orderCount}차`]],
    [["작성일", wo.issueDate], ["납품예정일", wo.deliveryDate], ["시즌", `${wo.year} ${wo.season}`]],
    [["SAMPLE NO.", wo.sampleNo], ["품종", wo.category], ["", ""]],
  ];
  for (const row of info) {
    row.forEach(([label, val], i) => {
      const cL = 1 + i * 3;
      const lc = ws.getCell(r, cL);
      lc.value = label; lc.font = { bold: true, size: 9 }; lc.fill = hdrFill;
      lc.alignment = { horizontal: "center", vertical: "middle" }; lc.border = border;
      ws.mergeCells(r, cL + 1, r, cL + 2);
      const vc = ws.getCell(r, cL + 1);
      vc.value = val || ""; vc.font = { size: 9 }; vc.alignment = { horizontal: "left", vertical: "middle" }; vc.border = border;
      ws.getCell(r, cL + 2).border = border;
    });
    r++;
  }
  r++;

  // ── 이미지 (도식화 / 제품사진) ──
  const imgTop = r;
  ws.getCell(r, 1).value = "도식화";
  ws.getCell(r, 1).font = { bold: true, size: 9 }; ws.getCell(r, 1).fill = hdrFill;
  ws.getCell(r, 5).value = "제품사진";
  ws.getCell(r, 5).font = { bold: true, size: 9 }; ws.getCell(r, 5).fill = hdrFill;
  r++;
  const IMG_ROWS = 12;
  for (let k = 0; k < IMG_ROWS; k++) ws.getRow(r + k).height = 16;

  const addImg = async (src: string | undefined, tlCol: number, tlRow: number) => {
    if (!src) return;
    try {
      let imageId: number | null = null;
      const dm = src.match(/^data:image\/(\w+);base64,(.+)$/);
      if (dm) {
        imageId = wb.addImage({ base64: dm[2], extension: (dm[1] === "jpg" ? "jpeg" : dm[1]) as any });
      } else {
        const res = await fetch(src);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "";
        const ext = ct.includes("png") ? "png" : "jpeg";
        imageId = wb.addImage({ buffer: buf as any, extension: ext as any });
      }
      if (imageId == null) return;
      ws.addImage(imageId, { tl: { col: tlCol, row: tlRow } as any, ext: { width: 240, height: 200 } });
    } catch { /* 이미지 실패 무시 */ }
  };

  const productSrc = wo.notionProductId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/notion-image?pageId=${encodeURIComponent(wo.notionProductId)}&raw=1`
    : wo.productImage;
  await addImg(wo.sketchImage, 0, imgTop);     // 도식화
  await addImg(productSrc, 4, imgTop);         // 제품사진
  r += IMG_ROWS + 1;

  // 섹션 제목 헬퍼
  const sectionTitle = (txt: string) => {
    ws.mergeCells(r, 1, r, COLS);
    const c = ws.getCell(r, 1);
    c.value = txt; c.font = { bold: true, size: 11 }; c.alignment = { vertical: "middle" };
    r++;
  };
  // 표 행 헬퍼
  const tableRow = (vals: (string | number)[], opts?: { header?: boolean }) => {
    vals.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v as any;
      cell.border = border;
      cell.alignment = { horizontal: i === 0 || i === 1 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.font = { size: 9, bold: !!opts?.header };
      if (opts?.header) cell.fill = hdrFill;
    });
    r++;
  };

  // ── 사이즈 스펙 ──
  sectionTitle("■ 사이즈 스펙");
  tableRow(["항목", ...sizes, "편차"], { header: true });
  (wo.measurements ?? []).forEach((m) => tableRow([m.item, ...sizes.map((s) => m.values?.[s] ?? ""), m.diff]));
  r++;

  // ── 원부자재 (+ 공장 메모 칸) ──
  sectionTitle("■ 원부자재");
  tableRow(["품목", "자재명", "색상", "규격", "요척", "단가", "비고", "공장 메모"], { header: true });
  (wo.materials ?? []).forEach((m) =>
    tableRow([m.category, m.name, m.color, m.spec, m.yield, m.unitPrice, m.notes, ""])
  );
  r++;

  // ── 색상 × 사이즈 ──
  sectionTitle("■ 발주 색상 × 사이즈");
  tableRow(["COLOR", ...sizes, "계"], { header: true });
  (wo.colorSizeTable ?? []).forEach((row) =>
    tableRow([row.color, ...sizes.map((s) => row.sizes?.[s] ?? 0), row.total])
  );
  tableRow(["계", ...sizes.map((s) => (wo.colorSizeTable ?? []).reduce((a, x) => a + (x.sizes?.[s] || 0), 0)), wo.totalQuantity], { header: true });
  r++;

  // ── 준수사항 ──
  if (wo.fixedNotes) {
    sectionTitle("■ 준수사항");
    wo.fixedNotes.split("\n").filter(Boolean).forEach((line) => {
      ws.mergeCells(r, 1, r, COLS);
      const c = ws.getCell(r, 1);
      c.value = line; c.font = { size: 9 }; c.alignment = { vertical: "middle", wrapText: true };
      r++;
    });
  }

  // ── 다운로드 ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(wo.styleNo || wo.productName || "작업지시서").replace(/[\\/:*?"<>|]/g, "_")}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
