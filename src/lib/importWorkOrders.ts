import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import type {
  WorkOrder, WorkOrderMaterial, WorkOrderMeasurement, WorkOrderColorSize,
} from "@/types";

// ── xlsx 내부 도식화 이미지 추출 (시트명 → [{row, dataURL}]) ──
function normalizePath(baseDir: string, rel: string): string {
  const out: string[] = [];
  for (const p of (baseDir + rel).split("/")) {
    if (p === "..") out.pop();
    else if (p === "." || p === "") continue;
    else out.push(p);
  }
  return out.join("/");
}
function bytesToBase64(u8: Uint8Array): string {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)) as any);
  return typeof btoa !== "undefined" ? btoa(s) : Buffer.from(u8).toString("base64");
}
function extractSheetImages(data: ArrayBuffer): Map<string, { row: number; col: number; dataURL: string; size: number }[]> {
  const map = new Map<string, { row: number; col: number; dataURL: string; size: number }[]>();
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(data)); } catch { return map; }
  const dec = (p: string) => (files[p] ? new TextDecoder("utf-8").decode(files[p]) : "");
  const relTarget = (relsXml: string, rId: string): string => {
    const m = relsXml.match(new RegExp(`Id="${rId}"[^>]*?Target="([^"]+)"`)) ||
              relsXml.match(new RegExp(`Target="([^"]+)"[^>]*?Id="${rId}"`));
    return m ? m[1] : "";
  };
  const wbXml = dec("xl/workbook.xml");
  const wbRels = dec("xl/_rels/workbook.xml.rels");
  const sheetTags = [...wbXml.matchAll(/<sheet[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)];
  for (const st of sheetTags) {
    const name = st[1]; const rid = st[2];
    const target = relTarget(wbRels, rid);
    if (!target) continue;
    const sheetPath = normalizePath("xl/", target);
    const sheetXml = dec(sheetPath);
    const dm = sheetXml.match(/<drawing[^>]*?r:id="([^"]+)"/);
    if (!dm) continue;
    const sheetFile = sheetPath.split("/").pop()!;
    const sheetRels = dec(`xl/worksheets/_rels/${sheetFile}.rels`);
    const drawTarget = relTarget(sheetRels, dm[1]);
    if (!drawTarget) continue;
    const drawPath = normalizePath("xl/worksheets/", drawTarget);
    const drawXml = dec(drawPath);
    const drawFile = drawPath.split("/").pop()!;
    const drawRels = dec(`xl/drawings/_rels/${drawFile}.rels`);
    const anchors = [...drawXml.matchAll(/<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)[\s\S]*?<\/xdr:\1>/g)].map((a) => a[0]);
    const imgs: { row: number; col: number; dataURL: string; size: number }[] = [];
    for (const anc of anchors) {
      const emb = anc.match(/r:embed="([^"]+)"/);
      if (!emb) continue;
      const fromM = anc.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/);
      const fromXml = fromM ? fromM[1] : "";
      const rowM = fromXml.match(/<xdr:row>(\d+)<\/xdr:row>/);
      const colM = fromXml.match(/<xdr:col>(\d+)<\/xdr:col>/);
      const mediaTarget = relTarget(drawRels, emb[1]);
      if (!mediaTarget) continue;
      const mediaPath = normalizePath("xl/drawings/", mediaTarget);
      const bytes = files[mediaPath];
      if (!bytes) continue;
      const ext = (mediaPath.split(".").pop() || "png").toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "emf" || ext === "wmf" ? "" : "image/png";
      if (!mime) continue; // emf/wmf 등 미지원 포맷 스킵
      imgs.push({ row: rowM ? parseInt(rowM[1]) : 0, col: colM ? parseInt(colM[1]) : 0, dataURL: `data:${mime};base64,${bytesToBase64(bytes)}`, size: bytes.length });
    }
    if (imgs.length) map.set(name.trim().toLowerCase(), imgs);
  }
  return map;
}

/**
 * 기존 엑셀 작업지시서(오즈키즈 템플릿)를 파싱해 WorkOrder 배열로 변환한다.
 * - "STYLE NO" 셀을 기준점(anchor)으로 블록 인식 → 한 시트에 여러 스타일 분리
 * - 열 위치를 고정하지 않고 헤더(편차/품목/COLOR/담당/납품예정일 등)를 찾아 상대적으로 읽음
 *   → 사이즈 개수(4·5개)나 열이 밀린 변형 템플릿도 자연스럽게 인식
 * - "(중)" 시트는 중복이라 건너뜀(미리보기 번역으로 대체)
 */

const emptyLabels = () => ({
  main: false, care: false, reorderInfo: false, priceTag: false, qualityTag: false,
  polybag: false, wappen: false, pointLabel: false, artworkLabel: false,
});

const FIXED_LABEL_HINT = /(라벨|택$|택끈|택고리|실고리|폴리백|옷핀|봉투|바코드)/;

function makeId(i: number) {
  try { return crypto.randomUUID(); } catch { return `imp-${Date.now()}-${i}`; }
}
function yearFromDate(s: string): string {
  const m = s.match(/(\d{2})\.\d{1,2}\.\d{1,2}/);
  if (m) return `20${m[1]}`;
  const y = s.match(/(20\d{2})/);
  return y ? y[1] : "";
}
function seasonFromName(fileName: string): string {
  const m = fileName.match(/(봄|여름|가을|겨울)/);
  if (m) return m[1];
  if (/SS/i.test(fileName)) return "여름";
  if (/FW/i.test(fileName)) return "겨울";
  return "";
}

export interface ParsedOrder {
  order: WorkOrder;
  sheet: string;
  warnings: string[];
}

export function parseWorkbook(data: ArrayBuffer, fileName: string): ParsedOrder[] {
  const wb = XLSX.read(data, { type: "array" });
  const imgMap = extractSheetImages(data); // 시트별 도식화 이미지
  const results: ParsedOrder[] = [];
  const season = seasonFromName(fileName);
  let idx = 0;

  for (const sheetName of wb.SheetNames) {
    if (/\(중\)\s*$/.test(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const maxC = Math.min(range.e.c, 30);

    const T = (r: number, c: number): string => {
      if (r < 0 || c < 0) return "";
      const v = ws[XLSX.utils.encode_cell({ r, c })];
      return v ? String(v.w ?? v.v ?? "").replace(/\s+/g, " ").trim() : "";
    };
    const NUM = (r: number, c: number): number | undefined => {
      const v = ws[XLSX.utils.encode_cell({ r, c })];
      if (!v) return undefined;
      if (typeof v.v === "number") return v.v;
      const n = parseFloat(String(v.v).replace(/,/g, ""));
      return isNaN(n) ? undefined : n;
    };
    // 지정 행에서 정규식에 맞는 첫 셀의 열
    const findColInRow = (r: number, re: RegExp, cFrom = 0): number => {
      for (let c = cFrom; c <= maxC; c++) if (re.test(T(r, c))) return c;
      return -1;
    };
    // 라벨 셀의 오른쪽에서 가장 가까운 비어있지 않은 값 (같은 행, 최대 4칸)
    const valueRightOf = (r: number, labelCol: number): string => {
      for (let c = labelCol + 1; c <= Math.min(labelCol + 4, maxC); c++) {
        const t = T(r, c);
        if (t) return t;
      }
      return "";
    };
    // 블록 상단 영역에서 라벨 셀 찾기 → 오른쪽 값
    const findLabelValue = (top: number, bottom: number, re: RegExp): string => {
      for (let r = top; r <= bottom; r++) {
        const c = findColInRow(r, re);
        if (c >= 0) { const v = valueRightOf(r, c); if (v) return v; }
      }
      return "";
    };

    const anchors: number[] = [];
    for (let r = 0; r <= range.e.r; r++) {
      if (/STYLE\s*NO/i.test(T(r, 1)) || /STYLE\s*NO/i.test(T(r, 0))) anchors.push(r);
    }

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const end = i + 1 < anchors.length ? anchors[i + 1] : range.e.r + 1;
      const v = a + 1; // 값 행 (사이즈 헤더도 여기)
      const warnings: string[] = [];

      // 헤더 열 탐지 (STYLE NO / 상품명 / 작업처)
      const styleCol = findColInRow(a, /STYLE\s*NO/i);
      const nameCol  = findColInRow(a, /상품명|품\s*명|PRODUCT/i);
      const vendorCol = findColInRow(a, /작업처|공장|VENDOR/i);
      const styleNo = T(v, styleCol >= 0 ? styleCol : 1);
      const productName = T(v, nameCol >= 0 ? nameCol : 2);
      const vendor = T(v, vendorCol >= 0 ? vendorCol : 3);
      if (!styleNo && !productName) continue;

      // 편차/DEV 열 → 사이즈 열 역산 (블록 상단 4행 내에서 탐지)
      let sizeHeaderRow = v, diffCol = -1;
      for (let r = a; r <= Math.min(a + 3, end - 1); r++) {
        const c = findColInRow(r, /^(편차|DEV\.?|편\s*차)$/i);
        if (c >= 0) { sizeHeaderRow = r; diffCol = c; break; }
      }
      const sizeCols: number[] = [];
      if (diffCol > 0) {
        for (let c = diffCol - 1; c >= 3; c--) {
          if (/^\d{2,3}$/.test(T(sizeHeaderRow, c))) sizeCols.unshift(c);
          else break;
        }
      }
      const itemCol = sizeCols.length ? sizeCols[0] - 1 : 4;
      const sizes = sizeCols.map((c) => T(sizeHeaderRow, c));

      // 측정(사이즈 스펙): itemCol 항목, COLOR 만나면 중단
      const measurements: WorkOrderMeasurement[] = [];
      let colorRow = -1;
      for (let r = sizeHeaderRow + 1; r < end; r++) {
        const item = T(r, itemCol);
        if (/^COLOR$/i.test(item)) { colorRow = r; break; }
        if (item && !/^TOTAL$/i.test(item) && !/^계$/.test(item)) {
          const values: Record<string, string> = {};
          sizeCols.forEach((c, si) => { const t = T(r, c); if (t) values[sizes[si]] = t; });
          measurements.push({ item, values, diff: diffCol > 0 ? T(r, diffCol) : "" });
        }
      }
      if (colorRow < 0) {
        for (let r = v; r < end; r++) { if (/^COLOR$/i.test(T(r, itemCol))) { colorRow = r; break; } }
      }

      // 원부자재: "품목" 헤더 열 찾기 → 오른쪽으로 자재명/색상/규격/요척/단가/발주량/비고
      let matHdrRow = -1, catCol = -1;
      for (let r = a; r <= Math.min(a + 5, end - 1); r++) {
        const c = findColInRow(r, /^품\s*목$/);
        if (c >= 0) { matHdrRow = r; catCol = c; break; }
      }
      const materials: WorkOrderMaterial[] = [];
      if (catCol >= 0) {
        const C = (o: number) => catCol + o; // 0품목 1자재명 2색상 3규격 4요척 5단가 6발주량 7비고
        for (let r = matHdrRow + 1; r < end; r++) {
          const cat = T(r, catCol);
          if (!cat) continue;
          if (/중국\s*위안|완사입|최종\s*원가/.test(cat)) break;
          if (FIXED_LABEL_HINT.test(cat)) {
            materials.push({
              id: makeId(idx++), category: "", name: cat, color: "", spec: "",
              yield: "", yieldUnit: "", unitPrice: "", orderUnit: T(r, C(4)) || T(r, C(5)), notes: "", fixed: true,
            });
            continue;
          }
          materials.push({
            id: makeId(idx++), category: cat,
            name: T(r, C(1)), color: T(r, C(2)), spec: T(r, C(3)),
            yield: T(r, C(4)), yieldUnit: "", unitPrice: T(r, C(5)),
            orderUnit: T(r, C(6)), notes: T(r, C(7)),
          });
        }
      }

      // 색상 × 사이즈 수량표
      const colorSizeTable: WorkOrderColorSize[] = [];
      if (colorRow >= 0 && sizeCols.length) {
        for (let r = colorRow + 1; r < end; r++) {
          const c0 = T(r, itemCol);
          if (!c0) continue;
          if (/^TOTAL$/i.test(c0) || /^계$/.test(c0)) break;
          const szMap: Record<string, number> = {};
          let tot = 0;
          sizeCols.forEach((c, si) => { const n = NUM(r, c); if (n != null) { szMap[sizes[si]] = n; tot += n; } });
          const kTotal = diffCol > 0 ? NUM(r, diffCol) : undefined;
          colorSizeTable.push({ color: c0, colorCode: "", sizes: szMap, total: kTotal ?? tot });
        }
      }
      const totalQuantity = colorSizeTable.reduce((s, r) => s + (r.total || 0), 0);

      // 담당/실장 (헤더는 값 위쪽 행)
      const manager = findLabelValue(a - 1, a + 1, /담당|DESIGNER|담\s*당/);
      const director = findLabelValue(a - 1, a + 1, /실장|실\s*장|팀장|组长/);
      const issueDate = findLabelValue(a - 1, a + 2, /작성일|작\s*성\s*일/);
      const productionDate = findLabelValue(a - 1, a + 2, /생산이관일|이관일/);
      const deliveryDate = findLabelValue(a - 1, a + 3, /납품예정일|납품일/);
      const sampleNo = findLabelValue(a - 2, a + 1, /SAMPLE\s*NO/i);

      // 준수사항
      const fixedLines: string[] = [];
      for (let r = a; r < end; r++) {
        const b = T(r, 1) || T(r, 0);
        if (b.startsWith("*")) fixedLines.push(b);
      }
      const fixedNotes = fixedLines.join("\n");

      if (!sizes.length) warnings.push("사이즈를 찾지 못했습니다");
      if (!colorSizeTable.length) warnings.push("색상×수량표를 찾지 못했습니다");
      if (!measurements.length) warnings.push("사이즈 스펙을 찾지 못했습니다");
      if (catCol < 0) warnings.push("원부자재(품목)를 찾지 못했습니다");

      const category = (productName.split("-")[0] || sheetName.replace(/\(.*?\)/, "")).trim();
      const now = new Date().toISOString();

      // 이 시트의 도식화 이미지 자동 첨부.
      // 도식화(라인 드로잉)는 좌측(측정표 왼쪽) 상단에 위치 → 좌측 컬럼(col ≤ 8) 중 가장 위(row 최소) 이미지 선택.
      // (제품사진은 그 아래, OZKIZ 로고는 우측이라 자연히 제외됨)
      let sketchImage = "";
      const sheetImgs = imgMap.get(sheetName.trim().toLowerCase());
      if (sheetImgs && sheetImgs.length) {
        const inBlock = sheetImgs.filter((im) => im.row >= a - 2 && im.row < end);
        const scope = inBlock.length ? inBlock : sheetImgs;
        const left = scope.filter((im) => im.col <= 8);
        const pool = left.length ? left : scope;
        const best = pool.reduce((m, im) => (im.row < m.row ? im : m), pool[0]);
        sketchImage = best.dataURL;
      }

      const order: WorkOrder = {
        id: makeId(idx++),
        styleNo, productName, vendor,
        season, year: yearFromDate(issueDate || productionDate),
        sampleNo, category,
        manager, director,
        issueDate, productionDate, deliveryDate,
        orderCount: 1, totalQuantity, sizes,
        measurements, materials, colorSizeTable,
        labels: emptyLabels(), customLabels: [],
        sketchImage, productImage: "", labelImage: "",
        productionNotes: "", fixedNotes, vendorNotes: "", specialNotes: "",
        totalCost: "", salePrice: "", laborCost: "", packagingCost: "",
        status: "draft",
        createdAt: now, updatedAt: now,
      };

      results.push({ order, sheet: sheetName, warnings });
    }
  }

  return results;
}
