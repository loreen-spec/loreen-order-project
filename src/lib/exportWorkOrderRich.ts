import type { WorkOrder } from "@/types";

/* 한↔중 병기 사전 (공장 편의) — WorkOrderPDFView의 중문 사전에서 자주 쓰는 항목 발췌 */
const ZH_SECTION: Record<string, string> = {
  "사이즈 스펙": "尺寸规格", "원부자재": "物料", "발주 색상 × 사이즈": "颜色 × 尺码",
  "준수사항": "注意事项", "주의사항": "备注", "케어라벨 위치": "洗唛位置", "업체 연락처": "供应商信息",
  "최종원가": "最终成本", "도식화": "款式图", "제품사진": "产品照片",
};
const ZH_COL: Record<string, string> = {
  "항목": "项目", "편차": "码差", "품목": "品类", "자재명": "物料名", "색상": "颜色",
  "규격": "规格", "요척": "用量", "단가": "单价", "비고": "备注", "계": "合计",
  "종류": "种类", "업체명": "工厂", "담당자": "负责人", "연락처": "联系方式",
};
const ZH_SPEC: Record<string, string> = {
  "뒷목기장": "后中长", "앞기장": "前中长", "총장": "总长", "기장": "衣长",
  "가슴둘레": "胸围", "가슴단면": "胸宽", "밑단둘레": "下摆围", "밑단단면": "下摆宽",
  "어깨너비": "肩宽", "어깨경사": "肩斜", "진동": "袖窿", "암홀": "袖窿", "AH직선": "袖窿直量", "AH곡선": "袖窿弯量",
  "소매장": "袖长", "소매통": "袖肥", "소매부리": "袖口", "소매단": "袖口", "화장": "袖长",
  "목너비": "领宽", "목깊이": "领深", "목둘레": "领围", "옆목너비": "领宽", "옆목깊이": "领深",
  "앞목너비": "前领宽", "뒷목너비": "后领宽", "앞목깊이": "前领深",
  "허리둘레": "腰围", "엉덩이둘레": "臀围", "힙둘레": "臀围", "밑위": "立裆", "앞밑위": "前裆", "뒤밑위": "后裆",
  "인심": "内长", "인심길이": "内长", "아웃심": "外长", "바지부리": "裤脚", "허벅지둘레": "大腿围",
};
const ZH_CAT: Record<string, string> = {
  "주원단": "主面料", "배색": "配布", "안감": "里布", "충전재": "填充物", "지퍼": "拉链", "지퍼풀": "拉链头",
  "단추": "纽扣", "테이프": "织带", "스트링": "绳", "아일렛": "鸡眼", "스토퍼": "绳扣", "밴드": "橡筋",
  "리본장식": "蝴蝶结", "재봉사": "缝纫线", "패턴비": "纸样费", "와펜": "布标", "부클패치": "贴布",
  "메인라벨": "主唛", "케어라벨": "洗唛", "가격택": "价格吊牌", "품질보증택": "质保吊牌",
  "바코드택": "条码吊牌", "폴리백": "胶袋", "택끈": "吊粒", "옷핀": "别针",
};
const zhBase = (dict: Record<string, string>, s: string): string => {
  const t = (s || "").trim();
  if (!t) return "";
  if (dict[t]) return dict[t];
  // "주원단A","E-band" 등 — 한글 접두 기준 베이스 매칭
  const base = t.replace(/[A-Za-z0-9\s\-().]+$/g, "").trim();
  if (base && dict[base]) return dict[base];
  for (const k of Object.keys(dict)) if (t.startsWith(k)) return dict[k];
  return "";
};
// 중문 자동 병기 제거 — 공장이 직접 수정하므로 한국어만 사용
const bi = (ko: string, _zh?: string) => ko;

export async function exportWorkOrderXlsxRich(wo: WorkOrder) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((wo.styleNo || "작업지시서").slice(0, 31), {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const sizes = wo.sizes ?? [];
  const COLS = Math.max(9, sizes.length + 3);
  const colLetter = (n: number) => {
    let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s;
  };
  const LAST = colLetter(COLS);

  ws.getColumn(1).width = 15;
  ws.getColumn(2).width = 20;
  for (let c = 3; c <= COLS; c++) ws.getColumn(c).width = 11;

  const thin = { style: "thin" as const, color: { argb: "FF999999" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const GRAY = "FFEDEDED";     // 헤더
  const DATA = "FFF7F7F7";     // 우리 원본 값 (연회색)
  const MEMO = "FFFFF7C2";     // 공장 기입 (노랑)

  let r = 1;

  // ── 타이틀 + 버전/발행일 ──
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const issued = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const version = "v1";
  ws.mergeCells(r, 1, r, COLS);
  const tc = ws.getCell(r, 1);
  tc.value = "작 업 지 시 서";
  tc.font = { size: 18, bold: true };
  tc.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 30; r++;
  ws.mergeCells(r, 1, r, COLS);
  const vc = ws.getCell(r, 1);
  vc.value = `${version} · 발행일 ${issued}`;
  vc.font = { size: 9, color: { argb: "FF888888" } };
  vc.alignment = { horizontal: "right", vertical: "middle" }; r += 2;

  // ── 기본 정보 ──
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
      lc.value = label; lc.font = { bold: true, size: 9 }; lc.fill = fill(GRAY);
      lc.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; lc.border = border;
      ws.mergeCells(r, cL + 1, r, cL + 2);
      const vcell = ws.getCell(r, cL + 1);
      vcell.value = val || ""; vcell.font = { size: 9 }; vcell.alignment = { horizontal: "left", vertical: "middle" }; vcell.border = border;
      ws.getCell(r, cL + 2).border = border;
    });
    ws.getRow(r).height = 20; r++;
  }
  r++;

  // ── 이미지: 도식화 / 제품사진 ──
  ws.getCell(r, 1).value = bi("도식화", ZH_SECTION["도식화"]);
  ws.getCell(r, 1).font = { bold: true, size: 9 }; ws.getCell(r, 1).fill = fill(GRAY); ws.getCell(r, 1).alignment = { wrapText: true };
  ws.getCell(r, 5).value = bi("제품사진", ZH_SECTION["제품사진"]);
  ws.getCell(r, 5).font = { bold: true, size: 9 }; ws.getCell(r, 5).fill = fill(GRAY); ws.getCell(r, 5).alignment = { wrapText: true };
  const imgTop = r;
  const IMG_ROWS = 12;
  for (let k = 0; k <= IMG_ROWS; k++) ws.getRow(r + k).height = 16;

  const addImg = async (src: string | undefined, tlCol: number, tlRow: number) => {
    if (!src) return;
    try {
      let id: number | null = null;
      const dm = src.match(/^data:image\/(\w+);base64,(.+)$/);
      if (dm) id = wb.addImage({ base64: dm[2], extension: (dm[1] === "jpg" ? "jpeg" : dm[1]) as any });
      else {
        const res = await fetch(src); if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const ext = (res.headers.get("content-type") || "").includes("png") ? "png" : "jpeg";
        id = wb.addImage({ buffer: buf as any, extension: ext as any });
      }
      if (id != null) ws.addImage(id, { tl: { col: tlCol, row: tlRow + 0.2 } as any, ext: { width: 230, height: 190 } });
    } catch { /* ignore */ }
  };
  const productSrc = wo.notionProductId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/notion-image?pageId=${encodeURIComponent(wo.notionProductId)}&raw=1`
    : wo.productImage;
  await addImg(wo.sketchImage, 0, imgTop);
  await addImg(productSrc, 4, imgTop);
  r += IMG_ROWS + 1;

  // ── 섹션/표 헬퍼 ──
  const sectionTitle = (ko: string) => {
    ws.mergeCells(r, 1, r, COLS);
    const c = ws.getCell(r, 1);
    c.value = bi("■ " + ko, ZH_SECTION[ko]);
    c.font = { bold: true, size: 11 }; c.alignment = { vertical: "middle", wrapText: true };
    ws.getRow(r).height = 24; r++;
  };
  const row = (vals: (string | number)[], o?: { header?: boolean; memoCols?: number[] }) => {
    vals.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v as any;
      cell.border = border;
      cell.alignment = { horizontal: i <= 1 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.font = { size: 9, bold: !!o?.header };
      if (o?.header) cell.fill = fill(GRAY);
      else if (o?.memoCols?.includes(i)) cell.fill = fill(MEMO);
      else cell.fill = fill(DATA);
    });
    ws.getRow(r).height = 18; r++;
  };

  // ── 사이즈 스펙 (+ 공장 메모) ──
  sectionTitle("사이즈 스펙");
  const specMemoCol = sizes.length + 2;
  row([bi("항목", ZH_COL["항목"]), ...sizes, bi("편차", ZH_COL["편차"]), bi("공장 메모", "工厂备注")], { header: true });
  (wo.measurements ?? []).forEach((m) =>
    row([bi(m.item, zhBase(ZH_SPEC, m.item)), ...sizes.map((s) => m.values?.[s] ?? ""), m.diff, ""], { memoCols: [specMemoCol] })
  );
  r++;

  // ── 원부자재 (+ 공장 메모) ──
  sectionTitle("원부자재");
  row([bi("품목", ZH_COL["품목"]), bi("자재명", ZH_COL["자재명"]), bi("색상", ZH_COL["색상"]), bi("규격", ZH_COL["규격"]), bi("요척", ZH_COL["요척"]), bi("단가", ZH_COL["단가"]), bi("비고", ZH_COL["비고"]), bi("공장 메모", "工厂备注")], { header: true });
  (wo.materials ?? []).forEach((m) =>
    row([bi(m.category, zhBase(ZH_CAT, m.category)), m.name, m.color, m.spec, m.yield, m.unitPrice, m.notes, ""], { memoCols: [7] })
  );
  r++;

  // ── 색상 × 사이즈 (+ 공장 메모) ──
  sectionTitle("발주 색상 × 사이즈");
  const colorMemoCol = sizes.length + 2;
  row([bi("COLOR", ZH_COL["색상"]), ...sizes, bi("계", ZH_COL["계"]), bi("공장 메모", "工厂备注")], { header: true });
  (wo.colorSizeTable ?? []).forEach((c) =>
    row([c.color, ...sizes.map((s) => c.sizes?.[s] ?? 0), c.total, ""], { memoCols: [colorMemoCol] })
  );
  row([bi("계", ZH_COL["계"]), ...sizes.map((s) => (wo.colorSizeTable ?? []).reduce((a, x) => a + (x.sizes?.[s] || 0), 0)), wo.totalQuantity, ""], { header: true });
  r++;

  // ── 최종원가 ──
  if (wo.totalCost) {
    sectionTitle("최종원가");
    row([bi("최종원가", ZH_SECTION["최종원가"]), `${wo.totalCost}`], {});
    r++;
  }

  // ── 주의사항 ──
  if (wo.productionNotes) {
    sectionTitle("주의사항");
    wo.productionNotes.split("\n").forEach((line) => {
      ws.mergeCells(r, 1, r, COLS);
      const c = ws.getCell(r, 1); c.value = line; c.font = { size: 9 }; c.alignment = { wrapText: true, vertical: "middle" };
      c.border = border; c.fill = fill(DATA); r++;
    });
    r++;
  }

  // ── 준수사항 ──
  if (wo.fixedNotes) {
    sectionTitle("준수사항");
    wo.fixedNotes.split("\n").filter(Boolean).forEach((line) => {
      ws.mergeCells(r, 1, r, COLS);
      const c = ws.getCell(r, 1); c.value = line; c.font = { size: 9 }; c.alignment = { wrapText: true, vertical: "middle" }; r++;
    });
    r++;
  }

  // ── 케어라벨 위치 그림 ──
  if (wo.labelDiagramSelected?.length) {
    try {
      const rows: any[] = await fetch("/api/label-presets").then((x) => x.json());
      const picks = (Array.isArray(rows) ? rows : [])
        .filter((p) => wo.labelDiagramSelected!.includes(p.id) && p.image_data);
      if (picks.length) {
        sectionTitle("케어라벨 위치");
        const topR = r;
        for (let k = 0; k <= 10; k++) ws.getRow(r + k).height = 16;
        for (let i = 0; i < picks.length; i++) {
          ws.getCell(topR, i * 3 + 1).value = picks[i].name || "";
          ws.getCell(topR, i * 3 + 1).font = { size: 8, bold: true };
          await addImg(picks[i].image_data, i * 3, topR);
        }
        r += 12;
      }
    } catch { /* ignore */ }
  }

  // ── 업체 연락처 표 ──
  const vrows = wo.vendorInfoTable ?? [];
  if (vrows.length) {
    sectionTitle("업체 연락처");
    row([bi("종류", ZH_COL["종류"]), bi("업체명", ZH_COL["업체명"]), bi("담당자", ZH_COL["담당자"]), bi("연락처", ZH_COL["연락처"]), bi("비고", ZH_COL["비고"])], { header: true });
    vrows.forEach((v) => row([v.materialType, v.vendorName, (v as any).manager ?? "", v.contact, v.notes], {}));
  }

  // ── 숨김 메타 시트 (추후 v2 회신 비교용) ──
  const meta = wb.addWorksheet("_meta", { state: "veryHidden" });
  meta.getCell("A1").value = "workOrderId"; meta.getCell("B1").value = wo.id;
  meta.getCell("A2").value = "version"; meta.getCell("B2").value = version;
  meta.getCell("A3").value = "issued"; meta.getCell("B3").value = issued;
  meta.getCell("A4").value = "styleNo"; meta.getCell("B4").value = wo.styleNo;

  // ── 다운로드 (품번_업체_v1_MMDD) ──
  const safe = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_");
  const fname = `${safe(wo.styleNo || wo.productName || "작업지시서")}_${safe(wo.vendor || "")}_${version}_${mmdd}`;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fname + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
