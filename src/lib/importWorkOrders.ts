import * as XLSX from "xlsx";
import type {
  WorkOrder, WorkOrderMaterial, WorkOrderMeasurement, WorkOrderColorSize,
} from "@/types";

/**
 * 기존 엑셀 작업지시서(오즈키즈 템플릿)를 파싱해 WorkOrder 배열로 변환한다.
 * - "STYLE NO" 셀을 기준점(anchor)으로 블록을 인식 → 한 시트에 여러 스타일이 있어도 각각 분리
 * - 시트가 제품/언어별로 나뉜 파일도 시트마다 파싱. "(중)" 시트는 중복이라 건너뜀(미리보기 번역으로 대체)
 */

const col = (letter: string) => XLSX.utils.decode_col(letter);
const SIZE_COLS = ["F", "G", "H", "I", "J"];

const emptyLabels = () => ({
  main: false, care: false, reorderInfo: false, priceTag: false, qualityTag: false,
  polybag: false, wappen: false, pointLabel: false, artworkLabel: false,
});

const FIXED_LABEL_HINT = /(라벨|택$|택끈|택고리|실고리|폴리백|옷핀|봉투|지퍼\s*폴리백|바코드)/;

function makeId(i: number) {
  try { return crypto.randomUUID(); } catch { return `imp-${Date.now()}-${i}`; }
}

// "25.10.30" → 년도 "2025"
function yearFromDate(s: string): string {
  const m = s.match(/(\d{2})\.\d{1,2}\.\d{1,2}/);
  if (m) return `20${m[1]}`;
  const y = s.match(/(20\d{2})/);
  return y ? y[1] : "";
}

// 파일명에서 시즌 추정
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
  const results: ParsedOrder[] = [];
  const season = seasonFromName(fileName);
  let idx = 0;

  for (const sheetName of wb.SheetNames) {
    // "(중)" 시트는 중문 중복본 → 건너뜀
    if (/\(중\)\s*$/.test(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const T = (r: number, c: number): string => {
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

    // anchor: B열 === STYLE NO
    const anchors: number[] = [];
    for (let r = 0; r <= range.e.r; r++) {
      if (/STYLE\s*NO/i.test(T(r, col("B")))) anchors.push(r);
    }

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const end = i + 1 < anchors.length ? anchors[i + 1] : range.e.r + 1;
      const vRow = a + 1;
      const styleNo = T(vRow, col("B"));
      const productName = T(vRow, col("C"));
      const vendor = T(vRow, col("D"));
      if (!styleNo && !productName) continue;

      const warnings: string[] = [];

      // 사이즈: 값 행 F..J
      const sizes: string[] = [];
      SIZE_COLS.forEach((cl) => { const t = T(vRow, col(cl)); if (t) sizes.push(t); });

      const manager = T(a, col("M"));
      const director = T(a, col("N"));
      const productionDate = T(vRow, col("R"));      // 생산이관일 (값 행 R)
      const issueDate = T(a - 1 >= 0 ? a - 1 : a, col("R")); // 작성일 (SAMPLE NO 행 R)
      const deliveryDate = T(vRow + 1, col("R"));    // 납품예정일
      const sampleRaw = T(a - 1 >= 0 ? a - 1 : a, col("B"));
      const sampleNo = sampleRaw.replace(/SAMPLE\s*NO\.?/i, "").trim();

      // 측정(사이즈 스펙): 값행+1 .. COLOR 전까지, E열 항목
      const measurements: WorkOrderMeasurement[] = [];
      let colorRow = -1;
      for (let r = vRow + 1; r < end; r++) {
        const e = T(r, col("E"));
        if (/^COLOR$/i.test(e)) { colorRow = r; break; }
        if (e && !/^TOTAL$/i.test(e)) {
          const values: Record<string, string> = {};
          sizes.forEach((s, si) => { const t = T(r, col(SIZE_COLS[si])); if (t) values[s] = t; });
          measurements.push({ item: e, values, diff: T(r, col("K")) });
        }
      }

      // 원부자재: L열 품목
      const materials: WorkOrderMaterial[] = [];
      for (let r = vRow + 1; r < end; r++) {
        const cat = T(r, col("L"));
        if (!cat) continue;
        if (/품목/.test(cat)) continue;             // 헤더
        if (/중국\s*위안|완사입|최종\s*원가/.test(cat)) continue;
        const pVal = T(r, col("P"));
        if (FIXED_LABEL_HINT.test(cat)) {
          // 고정 라벨류 → fixed 자재로 추가
          materials.push({
            id: makeId(idx++), category: "", name: cat, color: "", spec: "",
            yield: "", yieldUnit: "", unitPrice: "", orderUnit: pVal, notes: "", fixed: true,
          });
          continue;
        }
        materials.push({
          id: makeId(idx++),
          category: cat,
          name: T(r, col("M")),
          color: T(r, col("N")),
          spec: T(r, col("O")),
          yield: pVal,
          yieldUnit: "",
          unitPrice: T(r, col("Q")),
          orderUnit: T(r, col("R")),
          notes: T(r, col("S")),
        });
      }

      // 색상 × 사이즈 수량표
      const colorSizeTable: WorkOrderColorSize[] = [];
      if (colorRow >= 0) {
        for (let r = colorRow + 1; r < end; r++) {
          const c0 = T(r, col("E"));
          if (!c0) continue;
          if (/^TOTAL$/i.test(c0)) break;
          const szMap: Record<string, number> = {};
          let tot = 0;
          sizes.forEach((s, si) => {
            const n = NUM(r, col(SIZE_COLS[si]));
            if (n != null) { szMap[s] = n; tot += n; }
          });
          const kTotal = NUM(r, col("K"));
          colorSizeTable.push({ color: c0, colorCode: "", sizes: szMap, total: kTotal ?? tot });
        }
      }
      const totalQuantity = colorSizeTable.reduce((s, r) => s + (r.total || 0), 0);

      // 준수사항: B열 '*' 문장
      const fixedLines: string[] = [];
      for (let r = a; r < end; r++) {
        const b = T(r, col("B"));
        if (b.startsWith("*") || /준수사항/.test(b)) fixedLines.push(b);
      }
      const fixedNotes = fixedLines.filter((l) => l.startsWith("*")).join("\n");

      if (!sizes.length) warnings.push("사이즈를 찾지 못했습니다");
      if (!colorSizeTable.length) warnings.push("색상×수량표를 찾지 못했습니다");
      if (!measurements.length) warnings.push("사이즈 스펙을 찾지 못했습니다");

      const category = (productName.split("-")[0] || sheetName.replace(/\(.*?\)/, "")).trim();
      const now = new Date().toISOString();

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
        sketchImage: "", productImage: "", labelImage: "",
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
