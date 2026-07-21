"use client";
import { useRef, useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import type { WorkOrder } from "@/types";

interface Props { wo: WorkOrder; onClose: () => void; }

/* ─────────────────────────────────────────────────────
   A4 가로: 297mm × 210mm  여백 5mm
   컬럼: 도식화(42%) | 사이즈스펙(22%) | 원부자재(36%)
   폰트: 기본 8pt (이전 7pt 대비 +15%)
───────────────────────────────────────────────────── */

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{
    width:297mm;height:210mm;overflow:hidden;
    font-family:'Noto Sans KR','Noto Sans SC','Malgun Gothic',sans-serif;
    font-size:8.6pt;color:#111;background:#fff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  @page{size:A4 landscape;margin:5mm}
  .sheet{
    width:287mm;height:200mm;
    display:flex;flex-direction:column;gap:2px;
    overflow:hidden;
  }
  table{border-collapse:collapse;width:100%}
  td,th{border:.3pt solid #888;padding:1.5pt 2.5pt;vertical-align:middle;text-align:center;font-size:8pt;line-height:1.25}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;

/* 폰트 크기 4단계 통일 */
const FS = "5.5pt";  // 캡션·고정문구
const FM = "6.5pt";  // 테이블 라벨 헤더
const FL = "7.5pt";  // 기본 데이터
const FX = "8.5pt";  // 강조 (상품명·담당자·원가)

/* 기본 셀: 중앙 정렬 + 중앙 수직 */
const S = {
  cell: { border: ".3pt solid #888", textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FL },
  lbl:  { border: ".3pt solid #888", background: "#e8e8e8", fontWeight: 700, textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FM },
};
const td  = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.cell, ...x });
const lbl = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.lbl,  ...x });
// 원부자재 전용 셀 — 줄바꿈 금지로 행 높이 균일 유지
const matTd = (x?: React.CSSProperties): React.CSSProperties => ({
  ...S.cell, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...x,
});

function ImgBox({ src, label, style }: { src: string; label: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      border: ".3pt solid #888",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#fafafa", overflow: "hidden", ...style,
    }}>
      {src
        ? <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <span style={{ fontSize: "8pt", color: "#ccc" }}>{label}</span>
      }
    </div>
  );
}

/* 원부자재 최소 표시 행 수 */
const MAT_MIN_ROWS = 25;

interface LabelPreset { id: string; group: string; name: string; imageData?: string; }

export default function WorkOrderPDFView({ wo, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sizes = wo.sizes || [];
  const colTotal = (sz: string) => wo.colorSizeTable.reduce((s, r) => s + (r.sizes[sz] || 0), 0);

  // COL B flex 비율: 컬러 수에 따라 발주표 높이 동적 계산
  const _colorRows      = wo.colorSizeTable.length;
  const _colorTotalRows = Math.max(6, _colorRows + 2);  // 헤더+데이터+합계, 최소 6
  const colBColorFlex   = _colorTotalRows * 3;           // 3 flex = 1행
  const colBLabelFlex   = 14;
  const colBSpecFlex    = Math.max(50, 110 - colBColorFlex - colBLabelFlex);

  // 선택된 라벨 다이어그램 이미지 로드 (브라우저에서만)
  const [selectedLabelImages, setSelectedLabelImages] = useState<{ name: string; group: string; imageData: string }[]>([]);
  useEffect(() => {
    const selected = wo.labelDiagramSelected ?? [];
    if (selected.length === 0) return;
    fetch("/api/label-presets")
      .then(r => r.json())
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) return;
        const presets: LabelPreset[] = rows.map(r => ({
          id: r.id, group: r.group_name, name: r.name,
          imageData: r.image_data ?? undefined,
        }));
        setSelectedLabelImages(
          presets
            .filter(p => selected.includes(p.id) && p.imageData)
            .map(p => ({ name: p.name, group: p.group, imageData: p.imageData! }))
        );
      })
      .catch(() => {});
  }, [wo.labelDiagramSelected]);

  function handlePrint() {
    const node = sheetRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=1500,height=1000");
    if (!win) return;
    // sheet 클래스 부여해서 인쇄 시 A4 정확히 맞춤
    const clone = node.cloneNode(true) as HTMLElement;
    clone.className = "sheet";
    clone.removeAttribute("style");
    win.document.write(`<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8"/>
      <title>작업지시서 — ${wo.styleNo} ${wo.productName} ${wo.orderCount}차</title>
      <style>${PRINT_CSS}</style>
    </head><body>${clone.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 700);
  }

  const FIXED_LABELS: [keyof WorkOrder["labels"], string][] = [
    ["main","메인라벨"],["care","케어라벨"],["reorderInfo","취급주의라벨"],
    ["priceTag","가격택"],["qualityTag","품질보증택"],["polybag","폴리백"],
    ["wappen","와펜"],["pointLabel","포인트라벨"],["artworkLabel","아트웍라벨"],
  ];
  const customLabels = wo.customLabels ?? [];
  const hasCustom = customLabels.length > 0;

  const BASE: React.CSSProperties = {
    fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif",
    fontSize: "8pt",
    color: "#111",
  };

  /* 원부자재 행 계산 — 25줄 초과 시 행 간격 자동 축소 */
  const matCount   = wo.materials.length;
  const compact    = matCount > MAT_MIN_ROWS;
  const emptyCount = compact ? 0 : MAT_MIN_ROWS - matCount;
  const matRatio   = compact ? Math.max(0.6, MAT_MIN_ROWS / matCount) : 1;
  const rowPad     = compact ? `${Math.round(0.9 * matRatio)}px 2px` : "2.5px 2px";
  // 원부자재 셀 폰트: 비압축 시 8pt (FL보다 0.5pt 크게), 압축 시 비율 축소
  const matFS      = compact ? `${(8 * matRatio).toFixed(1)}pt` : "8pt";
  const matHdrFS   = compact ? `${(7 * matRatio).toFixed(1)}pt` : "7pt";

  // 폼 종류로 기본 언어 결정, 미리보기에서 토글로 변경 가능 (한 작업지시서로 한/영/중 모두 출력)
  const defaultLang: "ko" | "en" | "zh" =
    wo.formType === "영문" ? "en" : wo.formType === "중문" ? "zh" : "ko";
  const [langOverride, setLangOverride] = useState<"ko" | "en" | "zh" | null>(null);
  const lang: "ko" | "en" | "zh" = langOverride ?? defaultLang;
  const eng = lang === "en";
  const chi = lang === "zh";
  // 원단발주 칸: 국내의류 폼에서만 표시 (그 외 폼은 비고에 합침)
  const showFabricOrder = wo.formType === "국내의류";

  // 고정 부자재 이름 번역 (영문/중문작지 폼 미리보기)
  const MAT_NAME_EN: Record<string, string> = {
    "메인라벨": "Main Label",
    "케어라벨": "Care Label",
    "품질보증택": "Quality Guarantee Tag",
    "가격택": "Price Tag",
    "바코드택": "Barcode Tag",
    "폴리백": "Poly Bag",
    "택끈": "Tag String",
  };
  const MAT_NAME_ZH: Record<string, string> = {
    "메인라벨": "主唛",
    "케어라벨": "洗唛",
    "품질보증택": "合格证",
    "가격택": "价格吊牌",
    "바코드택": "条形码吊牌",
    "폴리백": "胶袋",
    "택끈": "吊牌绳",
  };
  const matName = (name: string) =>
    eng ? (MAT_NAME_EN[name] ?? name) : chi ? (MAT_NAME_ZH[name] ?? name) : name;

  // 사이즈 스펙 항목명 번역 (영문/중문작지 미리보기)
  const SPEC_NAME_EN: Record<string, string> = {
    "뒷목기장": "Back Length", "앞기장": "Front Length", "총장": "Total Length", "기장": "Length",
    "가슴둘레": "Chest", "가슴단면": "Chest (½)", "밑단둘레": "Hem", "밑단단면": "Hem (½)",
    "어깨너비": "Shoulder", "어깨경사": "Shoulder Slope",
    "AH직선": "Armhole (straight)", "AH곡선": "Armhole (curve)", "진동": "Armhole", "암홀": "Armhole",
    "소매장": "Sleeve Length", "소매통": "Sleeve Width", "소매부리": "Sleeve Opening", "소매단": "Cuff",
    "목너비": "Neck Width", "목깊이": "Neck Depth", "목둘레": "Neck", "칼라": "Collar", "카라": "Collar",
    "허리둘레": "Waist", "허리단면": "Waist (½)", "엉덩이둘레": "Hip", "엉덩이단면": "Hip (½)",
    "밑위": "Rise", "밑단너비": "Leg Opening", "인심": "Inseam", "아웃심": "Outseam",
    "앞품": "Front Width", "뒤품": "Back Width", "앞길이": "Front Length", "뒷길이": "Back Length",
    "허벅지둘레": "Thigh", "무릎둘레": "Knee", "발목둘레": "Ankle",
  };
  const SPEC_NAME_ZH: Record<string, string> = {
    "뒷목기장": "后中长", "앞기장": "前中长", "총장": "总长", "기장": "衣长",
    "가슴둘레": "胸围", "가슴단면": "胸宽(半)", "밑단둘레": "下摆围", "밑단단면": "下摆宽(半)",
    "어깨너비": "肩宽", "어깨경사": "肩斜",
    "AH직선": "袖窿(直量)", "AH곡선": "袖窿(弯量)", "진동": "袖窿", "암홀": "袖窿",
    "소매장": "袖长", "소매통": "袖肥", "소매부리": "袖口", "소매단": "袖口",
    "목너비": "领宽", "목깊이": "领深", "목둘레": "领围", "칼라": "领子", "카라": "领子",
    "허리둘레": "腰围", "허리단면": "腰宽(半)", "엉덩이둘레": "臀围", "엉덩이단면": "臀宽(半)",
    "밑위": "立裆", "밑단너비": "脚口", "인심": "内长", "아웃심": "外长",
    "앞품": "前胸宽", "뒤품": "后背宽", "앞길이": "前长", "뒷길이": "后长",
    "허벅지둘레": "大腿围", "무릎둘레": "膝围", "발목둘레": "脚踝围",
  };
  // 부위(prefix) 사전 — 조합 번역용
  const PART_EN: Record<string, string> = {
    "목": "Neck", "뒷목": "Back Neck", "앞목": "Front Neck", "가슴": "Chest", "밑단": "Hem",
    "어깨": "Shoulder", "소매": "Sleeve", "허리": "Waist", "엉덩이": "Hip", "힙": "Hip",
    "무릎": "Knee", "발목": "Ankle", "허벅지": "Thigh", "팔": "Arm", "손목": "Wrist",
    "앞": "Front", "뒤": "Back", "옆": "Side", "밑위": "Rise", "인심": "Inseam", "아웃심": "Outseam",
    "칼라": "Collar", "카라": "Collar", "후드": "Hood", "포켓": "Pocket", "주머니": "Pocket",
    "벨트": "Belt", "커프스": "Cuff", "요크": "Yoke", "다트": "Dart", "품": "Width",
  };
  const PART_ZH: Record<string, string> = {
    "목": "领", "뒷목": "后领", "앞목": "前领", "가슴": "胸", "밑단": "下摆",
    "어깨": "肩", "소매": "袖", "허리": "腰", "엉덩이": "臀", "힙": "臀",
    "무릎": "膝", "발목": "脚踝", "허벅지": "大腿", "팔": "臂", "손목": "手腕",
    "앞": "前", "뒤": "后", "옆": "侧", "밑위": "立裆", "인심": "内长", "아웃심": "外长",
    "칼라": "领子", "카라": "领子", "후드": "帽", "포켓": "口袋", "주머니": "口袋",
    "벨트": "腰带", "커프스": "袖口", "요크": "育克", "다트": "省", "품": "宽",
  };
  // 측정타입(suffix) 사전
  const SUFFIX_EN: [string, string][] = [
    ["둘레", "Circ."], ["단면", "(½)"], ["너비", "Width"], ["폭", "Width"], ["통", "Width"],
    ["길이", "Length"], ["장", "Length"], ["깊이", "Depth"], ["높이", "Height"], ["경사", "Slope"],
  ];
  const SUFFIX_ZH: [string, string][] = [
    ["둘레", "围"], ["단면", "(半)"], ["너비", "宽"], ["폭", "宽"], ["통", "肥"],
    ["길이", "长"], ["장", "长"], ["깊이", "深"], ["높이", "高"], ["경사", "斜"],
  ];

  // 조합 번역: "부위 + 측정타입" 자동 조립 (사전에 없는 새 항목 대응)
  const composeSpec = (name: string, isEng: boolean): string | null => {
    const parts = isEng ? PART_EN : PART_ZH;
    const sufs = isEng ? SUFFIX_EN : SUFFIX_ZH;
    for (const [ko, tr] of sufs) {
      if (name.endsWith(ko)) {
        const prefix = name.slice(0, name.length - ko.length).trim();
        if (!prefix) return null;
        const partTr = parts[prefix];
        if (!partTr) return null;
        return isEng ? `${partTr} ${tr}`.trim() : `${partTr}${tr}`;
      }
    }
    // 부위 단독
    if (parts[name]) return parts[name];
    return null;
  };

  const specName = (name: string) => {
    if (!name) return name;
    const key = name.trim();
    if (eng) return SPEC_NAME_EN[key] ?? composeSpec(key, true) ?? name;
    if (chi) return SPEC_NAME_ZH[key] ?? composeSpec(key, false) ?? name;
    return name;
  };
  const t = (ko: string, en: string, zh?: string) =>
    lang === "en" ? en : lang === "zh" ? (zh ?? en) : ko;

  const ENG_COMPLIANCE = `- Compliance Requirements
- Ensure no color mismatch on the front and back of each label.
- Follow the center line and fabric direction indicated in the pattern.
- Check for any color variation or bleeding in printed fabrics by section.
- Ensure compliance with the overall detail size deviation (check before proceeding with production)
- For print placement and deviations, refer to the detail card.
- Confirm the quality of main fabric before starting production.
- Follow contamination precautions and pre-treatment instructions.
- Ensure stitching adheres to 1" = 11 stitches.

* Before starting production, ensure that 1 sample of each size is made and approved along with the color.`;

  const ZH_COMPLIANCE = `注意事项
- 每个裁片注意对比色差。
- 一定要遵守裁剪版上标识的中心线以及斜线方向
- 印花布要查看有没有局部色差
- 遵守整体细节和尺寸以及码差
- 印花位置和印花码差参考版子
- 面料检验之后投产
- 污渍 以及 线头 要处理干净
- 缝纫线间距 1" 11针（ 根据产品面料 可调节）

* 大货生产前， 先打一件 确认样之后投产。`;

  const complianceText = eng ? ENG_COMPLIANCE : chi ? ZH_COMPLIANCE : wo.fixedNotes;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: "1180px" }}>

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">작업지시서 미리보기</div>
            <div className="text-xs text-gray-400">
              {[wo.styleNo, wo.productName, `${wo.orderCount}차`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 언어 토글 — 한 작업지시서로 한/영/중 출력 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {([["ko", "한국어"], ["en", "영문"], ["zh", "중문"]] as ["ko" | "en" | "zh", string][]).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLangOverride(code)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    lang === code ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                  style={lang === code ? { background: "#836CE0" } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors"
              style={{ background: "#836CE0" }} onMouseOver={e=>(e.currentTarget.style.background="#7c3aed")} onMouseOut={e=>(e.currentTarget.style.background="#836CE0")}>
              <Printer size={14} />인쇄 / PDF 저장
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── A4 가로 미리보기 ── */}
        <div className="overflow-auto" style={{ background: "#d1d5db", padding: "20px" }}>
          {/* A4 landscape 실제 비율: 297mm × 210mm */}
          <div style={{
            width: "min(100%, 1122px)",   /* 297mm @ 96dpi ≈ 1122px */
            aspectRatio: "297 / 210",
            background: "#fff", margin: "0 auto",
            boxShadow: "0 4px 32px rgba(0,0,0,.25)",
            overflow: "hidden",
          }}>
          <div ref={sheetRef} style={{
            width: "100%", height: "100%",
            padding: "10px 12px",
            display: "flex", flexDirection: "column", gap: "2px",
            overflow: "hidden",
            ...BASE,
          }}>

            {/* ══ ROW 1: 타이틀 ══ */}
            <div style={{
              ...S.cell,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "18pt", fontWeight: 900, letterSpacing: eng ? "3pt" : "6pt" }}>{t("작 업 지 시 서", "WORK ORDER", "工 艺 单")}</span>
              <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}>
                <img
                  src="/ozkiz-logo.png"
                  alt="OZKIZ"
                  style={{ height: "31px", maxWidth: "112px", objectFit: "contain", display: "inline-block" }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const span = document.createElement("span");
                    span.style.cssText = "font-size:16pt;font-weight:900;color:#cc0000;letter-spacing:2pt";
                    span.textContent = "OZKIZ";
                    target.parentElement?.appendChild(span);
                  }}
                />
              </div>
            </div>

            {/* ══ ROW 2: 제품정보 바 ══ */}
            <table style={{ tableLayout: "fixed", flexShrink: 0 }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "27%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={lbl()}>STYLE NO</td>
                  <td style={lbl()}>{t("상품명", "PRODUCT NAME", "品名")}</td>
                  <td style={lbl()}>{t("작업처", "VENDOR", "工厂")}</td>
                  <td style={lbl()}>{t("차수", "ORDER No.", "批次")}</td>
                  <td style={lbl()}>SAMPLE NO.</td>
                  <td style={lbl()}>{t("담당", "DESIGNER", "设计师")}</td>
                  <td style={lbl()}>{t("실장", "DIRECTOR", "组长")}</td>
                  <td style={lbl()}>{t("작성일", "DATE", "制定日期")}</td>
                  <td style={lbl()}>{t("납품예정일", "DELIVERY", "预定交货日")}</td>
                </tr>
                <tr>
                  <td style={td({ fontSize: FL })}>{wo.styleNo}</td>
                  <td style={td({ fontWeight: 700, fontSize: FX })}>{wo.productName}</td>
                  <td style={td({ fontSize: FX })}>{wo.vendor}</td>
                  <td style={td({ fontWeight: 900, fontSize: "10pt", color: "#1a56db" })}>{eng ? `No.${wo.orderCount}` : chi ? `第${wo.orderCount}批` : `${wo.orderCount}차`}</td>
                  <td style={td({ fontSize: FL })}>{wo.sampleNo}</td>
                  <td style={td({ verticalAlign: "middle" })}>
                    {(() => {
                      const m = wo.manager?.match(/^([^(]+)(\([^)]+\))?$/);
                      return m ? (
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          <div style={{ fontSize: FX }}>{m[1].trim()}</div>
                          {m[2] && <div style={{ fontSize: FM, color: "#555", fontWeight: 500 }}>{m[2]}</div>}
                        </div>
                      ) : <div style={{ fontWeight: 700, fontSize: FX }}>{wo.manager}</div>;
                    })()}
                  </td>
                  <td style={td({ verticalAlign: "middle" })}>
                    {(() => {
                      const m = wo.director?.match(/^([^(]+)(\([^)]+\))?$/);
                      return m ? (
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          <div style={{ fontSize: FX }}>{m[1].trim()}</div>
                          {m[2] && <div style={{ fontSize: FM, color: "#555", fontWeight: 500 }}>{m[2]}</div>}
                        </div>
                      ) : <div style={{ fontWeight: 700, fontSize: FX }}>{wo.director}</div>;
                    })()}
                  </td>
                  <td style={td()}>{wo.issueDate}</td>
                  <td style={td({ color: "#cc0000", fontWeight: 700 })}>{wo.deliveryDate}</td>
                </tr>
              </tbody>
            </table>

            {/* ══ BODY: 3컬럼 (42% | 22% | 36%) ══ */}
            <div style={{
              display: "grid", gridTemplateColumns: "42% 22% 36%",
              gap: "2px", flex: 1, minHeight: 0,
            }}>

              {/* ── COL A: 도식화 / 제품사진+비고 / 고정문구 ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

                <ImgBox src={wo.sketchImage} label="도식화"
                  style={{ flex: "0 0 50%", minHeight: 0 }} />

                <div style={{ display: "grid", gridTemplateColumns: "38% 1fr", gap: "2px", flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ ...S.cell, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
                    <div style={{ ...S.lbl, padding: "1.5px 4px", flexShrink: 0, textAlign: "left" }}>{t("제품사진", "PRODUCT PHOTO", "产品照片")}</div>
                    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                      {wo.productImage
                        ? <img src={wo.productImage} alt="제품사진" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: "7pt", color: "#ccc" }}>{t("제품사진", "PRODUCT PHOTO", "产品照片")}</span>
                      }
                    </div>
                  </div>
                  <div style={{ ...S.cell, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                    <div style={{ ...S.lbl, padding: "1.5px 4px", flexShrink: 0, textAlign: "left" }}>{t("주의사항", "PRECAUTIONS", "注意点")}</div>
                    <div style={{
                      flex: 1, padding: "3px 4px", textAlign: "left",
                      fontSize: FL, lineHeight: 1.5,
                      whiteSpace: "pre-wrap", overflow: "hidden",
                    }}>
                      {wo.productionNotes}
                    </div>
                  </div>
                </div>

                <div style={{
                  ...S.cell, flexShrink: 0,
                  padding: "2px 4px", fontSize: FS, textAlign: "left",
                  lineHeight: 1.45,
                }}>
                  {complianceText.split("\n").map((line, i) => {
                    const isStar  = line.trimStart().startsWith("*");
                    const isDash  = line.trimStart().startsWith("-");
                    const isEmpty = line.trim() === "";
                    // 영문·중문: '-' 리스트는 얇게, 그 외(제목·'*') 굵게 / 한글: 기존 로직
                    const bold = (eng || chi) ? (!isDash && !isEmpty) : (!isStar && !isEmpty);
                    return (
                      <div key={i} style={{
                        fontWeight: bold ? 700 : 400,
                        marginBottom: isEmpty ? "1.5px" : 0,
                      }}>
                        {isEmpty ? " " : line}
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* ── COL B: 사이즈스펙 / 발주수량 / 라벨위치 ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

                {(() => {
                  const SPEC_MIN = 15;
                  const filled = wo.measurements.filter(m => m.item);
                  const dataRows = filled.filter(m => !m.isHeader).length;
                  const emptyRows = Math.max(0, SPEC_MIN - dataRows);
                  // 컬러 수에 따라 발주표 높이 동적 계산 (헤더+데이터+합계 = colorRows+2)
                  return (
                    <div style={{ flex: `${colBSpecFlex} 0 0`, overflow: "hidden", minHeight: 0 }}>
                      <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={lbl({ textAlign: "center", padding: "1px 3px", width: "28%" })}></th>
                            {sizes.map(s => (
                              <th key={s} style={lbl({ padding: "1px" })}>{s}</th>
                            ))}
                            <th style={lbl({ padding: "1px", width: "12%" })}>{t("편차", "DEV.", "码差")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filled.map((m, i) => m.isHeader ? (
                            // ── 구분 헤더 행 ──
                            <tr key={i}>
                              <td colSpan={sizes.length + 2} style={{
                                ...S.lbl,
                                background: "#d4d8e8",
                                fontSize: "6.3pt",
                                padding: "1.5px 4px",
                                textAlign: "center",
                                fontWeight: 800,
                                letterSpacing: "0.3pt",
                              }}>{specName(m.item)}</td>
                            </tr>
                          ) : (
                            // ── 일반 측정 행 ──
                            <tr key={i}>
                              <td style={td({ fontWeight: 600, background: "#f8f8f8", padding: "1px 2px" })}>{specName(m.item)}</td>
                              {sizes.map(s => (
                                <td key={s} style={td({ padding: "1px" })}>{m.values[s] || ""}</td>
                              ))}
                              <td style={td({ padding: "1px" })}>{m.diff}</td>
                            </tr>
                          ))}
                          {/* 15줄 고정 — 기존과 동일한 패딩으로 공란 */}
                          {Array.from({ length: emptyRows }).map((_, i) => (
                            <tr key={`sp${i}`}>
                              <td style={td({ padding: "1px 2px" })}>&nbsp;</td>
                              {sizes.map(s => <td key={s} style={td({ padding: "1px" })} />)}
                              <td style={td({ padding: "1px" })} />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                <div style={{ flex: `${colBColorFlex} 0 0`, minHeight: 0 }}>
                  <table style={{ width: "100%", height: "100%" }}>
                    <thead>
                      <tr>
                        <th style={lbl({ padding: "1px 3px", width: "28%" })}>COLOR</th>
                        {sizes.map(s => (
                          <th key={s} style={lbl({ padding: "1px" })}>{s}</th>
                        ))}
                        <th style={{ ...S.lbl, background: "#dde8ff", color: "#1a56db", padding: "1px", width: "12%" }}>{t("계", "TOTAL", "合计")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.colorSizeTable.map((row, i) => (
                        <tr key={i}>
                          <td style={td({ fontWeight: 600, padding: "1.5px 2px" })}>{row.color}</td>
                          {sizes.map(s => (
                            <td key={s} style={td({ padding: "1.5px" })}>{row.sizes[s] || 0}</td>
                          ))}
                          <td style={td({ fontWeight: 700, color: "#1a56db", padding: "1.5px" })}>{row.total}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 4 - wo.colorSizeTable.length) }).map((_, i) => (
                        <tr key={`e${i}`}>
                          <td style={td({ padding: "1.5px 2px" })}>&nbsp;</td>
                          {sizes.map(s => <td key={s} style={td({ padding: "1.5px" })}></td>)}
                          <td style={td({ padding: "1.5px" })}></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px 2px" }}>{t("계", "TOTAL", "合计")}</td>
                        {sizes.map(s => (
                          <td key={s} style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px" }}>{colTotal(s)}</td>
                        ))}
                        <td style={{ ...S.cell, background: "#dde8ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "1.5px" }}>
                          {wo.totalQuantity}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 라벨 위치 다이어그램 — 선택된 이미지 그리드 */}
                {(() => {
                  const count = selectedLabelImages.length;
                  const cols = Math.min(count || 1, 3);
                  const colPct = `${(100 / cols).toFixed(1)}%`;
                  return (
                    <div style={{
                      flex: `${colBLabelFlex} 0 0`, minHeight: 0,
                      border: ".3pt solid #888", background: "#fafafa",
                      display: "flex", flexDirection: "row",
                      alignItems: "stretch",
                      justifyContent: count === 0 ? "center" : "flex-start",
                      overflow: "hidden",
                    }}>
                      {count === 0 ? (
                        <span style={{ fontSize: FL, color: "#ccc", margin: "auto" }}>{t("라벨 위치 다이어그램", "LABEL PLACEMENT", "标签位置")}</span>
                      ) : selectedLabelImages.map((item, i) => (
                        <div key={i} style={{
                          width: colPct, flexShrink: 0,
                          display: "flex", flexDirection: "column", alignItems: "center",
                          borderRight: i < count - 1 ? ".3pt solid #ddd" : "none",
                          padding: "2px 1px 1px",
                          overflow: "hidden",
                        }}>
                          <img src={item.imageData} alt={item.name}
                            style={{ width: "100%", flex: 1, objectFit: "contain", minHeight: 0 }} />
                          <div style={{
                            fontSize: FS, color: "#555", textAlign: "center",
                            lineHeight: 1.2, marginTop: "1px", flexShrink: 0,
                          }}>
                            {item.group} · {item.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>

              {/* ── COL C: 원부자재(박스1) / 업체(박스2) ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minHeight: 0, height: "100%" }}>

                {/* ── 박스1: 원부자재 + 최종원가 — COL B spec+color 높이와 동일 */}
                <div style={{ flex: `${colBSpecFlex + colBColorFlex} 0 0`, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                  {/* 원부자재 데이터 — 남은 공간 채움 */}
                  <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                    <table style={{ width: "100%", height: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                      <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "8%" }} />
                        {showFabricOrder && <col style={{ width: "9%" }} />}
                        <col style={{ width: showFabricOrder ? "20%" : "29%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {(eng
                            ? ["ITEM","MATERIAL","COLOR","SPEC","YIELD","PRICE","NOTE"]
                            : chi
                            ? ["品名","辅料名称","颜色","规格","预算用料","单价","色号"]
                            : showFabricOrder
                            ? ["품목","자재명","색상","규격","요척","단가","원단발주","비고"]
                            : ["품목","자재명","색상","규격","요척","단가","비고"]
                          ).map((name) => (
                            <th key={name} style={lbl({ fontSize: matHdrFS })}>{name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // fixed 플래그가 없는 구버전 데이터 호환 — 이름으로 고정 행 판별
                          const FIXED_NAMES = ["메인라벨","케어라벨","품질보증택","가격택","바코드택","폴리백","택끈"];
                          const hasFixedFlag = wo.materials.some(m => m.fixed);
                          const isFixed = (m: typeof wo.materials[0]) =>
                            hasFixedFlag ? !!m.fixed : FIXED_NAMES.includes(m.name);
                          const userMats  = wo.materials.filter(m => !isFixed(m));
                          const fixedMats = wo.materials.filter(m =>  isFixed(m));
                          const sameGroup = (a: typeof wo.materials[0], b: typeof wo.materials[0]) =>
                            a.category === b.category && a.name === b.name;
                          const spans: number[] = userMats.map((m, i) => {
                            if (i > 0 && sameGroup(userMats[i - 1], m)) return 0;
                            let span = 1;
                            while (i + span < userMats.length && sameGroup(m, userMats[i + span])) span++;
                            return span;
                          });
                          const userEmptyCount = Math.max(0, MAT_MIN_ROWS - userMats.length - fixedMats.length);
                          const renderRow = (m: typeof wo.materials[0], i: number, spanArr: number[]) => {
                            const lines = m.name.split("\n").length;
                            const rFS  = lines > 1 ? `${(parseFloat(matFS) / lines).toFixed(1)}pt` : matFS;
                            const rPad = lines > 1 ? `0px 2px` : rowPad;
                            return (
                              <tr key={m.id ?? i}>
                                {spanArr[i] > 0 && (
                                  <td rowSpan={spanArr[i]} style={matTd({ fontSize: rFS, padding: rPad, verticalAlign: "middle" })}>
                                    {m.category}
                                  </td>
                                )}
                                <td style={matTd({ fontSize: rFS, padding: rPad, whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", textOverflow: "clip", lineHeight: 1.2 })}>{matName(m.name)}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad, whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", textOverflow: "clip", lineHeight: 1.2 })}>{m.color}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad, whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", textOverflow: "clip", lineHeight: 1.2 })}>{m.spec}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.yield}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.unitPrice}</td>
                                {showFabricOrder && (
                                  <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.orderUnit}</td>
                                )}
                                <td style={matTd({ fontSize: rFS, padding: rPad, textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", textOverflow: "clip", lineHeight: 1.2 })}>{m.notes}</td>
                              </tr>
                            );
                          };
                          return [
                            // 1) 사용자 추가 행
                            ...userMats.map((m, i) => renderRow(m, i, spans)),
                            // 2) 빈 행 (고정 행들 아래로 밀어내는 여백)
                            ...Array.from({ length: userEmptyCount }, (_, i) => (
                              <tr key={`em${i}`}>
                                {Array.from({ length: showFabricOrder ? 8 : 7 }).map((__, j) => (
                                  <td key={j} style={matTd({ padding: rowPad })}>&nbsp;</td>
                                ))}
                              </tr>
                            )),
                            // 3) 고정 라벨 행 — 항상 표 맨 하단
                            ...fixedMats.map((m, i) => renderRow(m, i, fixedMats.map(() => 1))),
                          ];
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* 최종원가 — 항상 하단에 고정 표시 */}
                  <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", flexShrink: 0 }}>
                    <colgroup>
                      <col style={{ width: "12%" }} /><col style={{ width: "22%" }} /><col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} /><col style={{ width: "9%" }} />
                      <col style={{ width: "8%" }} /><col style={{ width: "9%" }} /><col style={{ width: "20%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan={5} style={{ ...S.cell, background: "#f0f4ff", fontWeight: 800, fontSize: FL, letterSpacing: "0.5pt", padding: "2.5px 2px" }}>
                          {t("최종원가", "TOTAL COST", "最终成本")}
                        </td>
                        <td colSpan={3} style={{ ...S.cell, background: "#f0f4ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "2.5px 2px" }}>
                          {wo.totalCost}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                </div>

                {/* ── 박스2: 원부자재 업체 정보 — COL B label 높이와 동일, 4줄 고정 */}
                {(() => {
                  const rows = wo.vendorInfoTable ?? [];
                  const VENDOR_ROWS = 4;
                  const displayRows = rows.length >= VENDOR_ROWS ? rows.slice(0, VENDOR_ROWS) : [
                    ...rows,
                    ...Array.from({ length: VENDOR_ROWS - rows.length }, (_, i) => ({
                      id: `empty-${i}`, materialType: "", vendorName: "", manager: "", contact: "", notes: "",
                    })),
                  ];
                  const border = ".3pt solid #888";
                  const vPad = "0.5px 3px";
                  return (
                    <div style={{ flex: `${colBLabelFlex} 0 0`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "24%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "24%" }} />
                          <col />
                        </colgroup>
                        <thead>
                          <tr>
                            {(eng
                              ? ["TYPE", "VENDOR", "CONTACT PERSON", "CONTACT", "NOTE"]
                              : chi
                              ? ["种类", "工厂", "负责人", "联系方式", "备注"]
                              : ["종류", "업체명", "담당자", "연락처", "비고"]
                            ).map((h) => (
                              <th key={h} style={lbl({ padding: vPad, fontSize: FM })}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row) => (
                            <tr key={row.id}>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{row.materialType}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{row.vendorName}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{(row as any).manager ?? ""}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{row.contact}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{row.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

              </div>
            </div>{/* end body grid */}

          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
