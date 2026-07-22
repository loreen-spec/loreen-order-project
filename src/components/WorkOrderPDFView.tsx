"use client";
import { useRef, useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import type { WorkOrder } from "@/types";
import ZoomPanViewport from "./ZoomPanViewport";

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

/* 기본 셀: 중앙 정렬 + 중앙 수직 + 긴 내용 자동 줄바꿈(잘림 방지) */
const S = {
  cell: { border: ".3pt solid #888", textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FL, whiteSpace: "normal" as const, wordBreak: "break-word" as const, overflowWrap: "anywhere" as const },
  lbl:  { border: ".3pt solid #888", background: "#e8e8e8", fontWeight: 700, textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FM, whiteSpace: "normal" as const, wordBreak: "break-word" as const, overflowWrap: "anywhere" as const },
};
const td  = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.cell, ...x });
const lbl = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.lbl,  ...x });
// 원부자재 셀 — 긴 내용 자동 줄바꿈(말줄임 없이 전부 표시)
const matTd = (x?: React.CSSProperties): React.CSSProperties => ({
  ...S.cell, overflow: "visible", lineHeight: 1.15, ...x,
});
// 숫자 셀 — 자릿수가 많아지면 폰트를 살짝 줄여 한 줄에 다 보이게(줄바꿈 금지)
const numFit = (v: number | string): React.CSSProperties => {
  const len = String(v ?? "").length;
  return {
    whiteSpace: "nowrap",
    overflow: "visible",
    fontSize: len <= 3 ? undefined : len === 4 ? "6.6pt" : len === 5 ? "5.8pt" : "5pt",
    letterSpacing: len >= 5 ? "-0.2pt" : undefined,
  };
};

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

  // ── 언어별 수동 수정본(오버라이드) — ref로 최신값 유지(빠른 연속 수정 시 유실 방지) ──
  const [i18n, setI18n] = useState<Record<string, Record<string, string>>>(() => wo.i18n ?? {});
  const i18nRef = useRef<Record<string, Record<string, string>>>(wo.i18n ?? {});
  const [savingI18n, setSavingI18n] = useState<"idle" | "saving" | "saved">("idle");

  // 열릴 때 서버에서 이 작지의 최신 i18n을 직접 가져와 반영
  // (리스트가 옛 localStorage 캐시로 넘겨줬을 때도 최신 수정본을 표시)
  useEffect(() => {
    let alive = true;
    fetch(`/api/work-orders?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (!alive || !Array.isArray(list)) return;
        const fresh = list.find((o) => o.id === wo.id);
        if (fresh?.i18n && typeof fresh.i18n === "object") {
          i18nRef.current = fresh.i18n;
          setI18n(fresh.i18n);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo.id]);

  const ov = lang === "ko" ? {} : (i18n[lang] ?? {});
  const tx = (key: string, auto: string) => {
    if (lang !== "ko" && ov[key] != null && ov[key] !== "") return ov[key];
    return auto;
  };
  async function persistI18n(next: Record<string, Record<string, string>>) {
    setSavingI18n("saving");
    try {
      const res = await fetch(`/api/work-orders/${encodeURIComponent(wo.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ i18n: next, updatedAt: new Date().toISOString() }),
      });
      setSavingI18n(res.ok ? "saved" : "idle");
      if (!res.ok) alert("수정 저장 실패 (서버). 다시 시도해주세요.");
    } catch {
      setSavingI18n("idle");
      alert("수정 저장 실패 (네트워크). 다시 시도해주세요.");
    }
  }
  // 항목 수정 → ref에 즉시 반영 후 저장 (연속 수정 안전)
  function saveOverride(key: string, text: string) {
    if (lang === "ko") return;
    const cur = i18nRef.current;
    const next = { ...cur, [lang]: { ...(cur[lang] ?? {}), [key]: text } };
    i18nRef.current = next;
    setI18n(next);
    persistI18n(next);
  }
  // 편집 가능한 텍스트 (영문/중문에서만 편집 → 해당 언어로 저장)
  const Ed = ({ k, auto, style }: { k: string; auto: string; style?: React.CSSProperties }) => {
    const val = tx(k, auto);
    if (lang === "ko") return <>{val}</>;
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const t = e.currentTarget.textContent ?? "";
          if (t !== val) saveOverride(k, t);
        }}
        style={{
          outline: "none", cursor: "text",
          whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere",
          display: "inline-block", maxWidth: "100%",
          ...style,
        }}
        title="클릭해서 이 언어 전용으로 수정"
      >{val}</span>
    );
  };

  // 고정 부자재 이름 번역 (영문/중문작지 폼 미리보기)
  const MAT_NAME_EN: Record<string, string> = {
    "메인라벨": "Main Label",
    "케어라벨": "Care Label",
    "취급주의라벨": "Caution Label",
    "품질보증택": "Quality Guarantee Tag",
    "가격택": "Price Tag",
    "바코드택": "Barcode Tag",
    "폴리백": "Poly Bag",
    "택끈": "Tag String",
  };
  // 중문 용어집 (공장 제공 용어 반영) — 자재명·품목·사이즈 항목 공통
  const ZH_GLOSSARY: Record<string, string> = {
    // 고정 부자재
    "메인라벨": "主唛", "케어라벨": "水洗标", "취급주의라벨": "注意事项标", "품질보증택": "吊牌", "가격택": "价格吊牌",
    "바코드택": "条形码吊牌", "폴리백": "胶袋", "택끈": "吊牌绳",
    // 사이즈 항목
    "기장": "衣长", "가슴둘레": "胸围", "어깨너비": "肩宽", "소매장": "袖长", "소매부리": "袖口",
    "암홀직선": "袖笼直线", "옆목너비": "领宽", "앞목깊이": "领深", "허리둘레": "腰围", "힙둘레": "臀围",
    "앞밑위": "前裆", "뒤밑위": "后裆", "인심길이": "内长", "바지부리": "裤脚", "편차": "码差",
    "화장": "袖长",
    // 구분/카테고리
    "상의": "上衣", "하의": "下装", "아우터": "夹克",
    // 라벨/부자재/공정
    "포인트라벨": "侧标", "하의라벨": "裤标", "라벨": "侧标", "지퍼백": "包装袋", "옷핀 택고리": "别针",
    "바코드스티커": "条码贴", "윗옷에 걸다": "挂上衣", "봉투에 붙이다": "贴包装袋", "부자재": "配布",
    "고무줄": "松紧", "삼봉": "三针五线", "말아박기": "卷边", "혼솔지퍼": "隐形拉链", "진이": "定针",
    "자바라테이프": "织带", "해리": "贴条", "프릴단": "荷叶边", "랍빠": "包边", "봉제실": "缝纫线",
    "인타록": "密拷线", "셔링": "打褶", "4골": "4股", "미까시": "挂面", "밀집모자": "草帽", "2겹": "双层",
    "리본장식": "蝴蝶结装饰品", "가방": "包包", "우라": "内衬", "나나인찌": "锁眼", "큐큐": "圆眼",
    "비조": "钳子", "우븐원단": "梭织", "폴라폴리스": "摇粒绒", "스팽글": "冲片", "심지": "衬子",
    "패턴": "样板", "스팩": "尺码", "와펜": "胸标", "스냅": "摁扣", "마이깡": "挂钩", "스토퍼": "绳扣",
    "아일렛": "乌眼", "포켓": "兜", "탈부착": "拆装", "마도매": "手逢", "벨트고리": "裤鼻", "봉사": "线",
    "합폭": "合逢", "샘플": "样品", "커프스": "袖头", "스티치": "锁边缝", "카라": "领子", "단추": "扣子",
    "배색": "配布", "소매": "袖", "어깨": "肩", "트임": "开叉", "허리": "腰", "끈장식": "带子装饰",
    "썬그립립": "四合扣", "털방울": "毛球", "안감": "里布", "지퍼": "拉链", "재봉사": "缝纫线",
    "4골 고무줄": "4股松紧", "8골": "8股", "E-band": "松紧", "5호": "5号", "3호": "3号",
    "60'/3합": "60'/3合", "원단매칭": "配色", "등가데": "后内贴", "밑가시": "挂面", "레이스": "蕾丝",
    "모빌론": "莫比龙胶带", "실고무줄": "弹力线", "샤망": "褶边", "끈": "带", "셀파고리": "扣袢",
    "장식단추": "装饰纽扣", "전사나염": "热转印", "충전재": "棉花", "모자": "帽", "벨크로": "魔术贴",
    "인타": "密拷线", "밴드": "松紧", "시리": "裆", "발목": "脚踝", "해리TAPE": "包边条", "프릴": "褶边",
  };
  const MAT_NAME_ZH = ZH_GLOSSARY;
  const matName = (name: string) =>
    eng ? (MAT_NAME_EN[name] ?? name) : chi ? (ZH_GLOSSARY[(name || "").trim()] ?? name) : name;

  // 사이즈 스펙 항목명 번역 (영문/중문작지 미리보기)
  const SPEC_NAME_EN: Record<string, string> = {
    "뒷목기장": "Back Length", "앞기장": "Front Length", "총장": "Total Length", "기장": "Length",
    "가슴둘레": "Chest", "가슴단면": "Chest (½)", "밑단둘레": "Hem", "밑단단면": "Hem (½)",
    "어깨너비": "Shoulder", "어깨경사": "Shoulder Slope",
    "AH직선": "Armhole (straight)", "AH곡선": "Armhole (curve)", "진동": "Armhole", "암홀": "Armhole",
    "소매장": "Sleeve Length", "소매통": "Sleeve Width", "소매부리": "Sleeve Opening", "소매단": "Cuff",
    "목너비": "Neck Width", "목깊이": "Neck Depth", "목둘레": "Neck", "칼라": "Collar", "카라": "Collar",
    "옆목너비": "Neck Width", "옆목깊이": "Neck Depth", "앞목너비": "Front Neck Width", "뒷목너비": "Back Neck Width",
    "암홀직선": "Armhole (straight)", "화장": "Sleeve Length", "바지부리": "Leg Opening",
    "앞밑위": "Front Rise", "뒤밑위": "Back Rise", "인심길이": "Inseam", "힙둘레": "Hip",
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
    "목": "Neck", "뒷목": "Back Neck", "앞목": "Front Neck", "옆목": "Neck", "가슴": "Chest", "밑단": "Hem",
    "어깨": "Shoulder", "소매": "Sleeve", "허리": "Waist", "엉덩이": "Hip", "힙": "Hip",
    "무릎": "Knee", "발목": "Ankle", "허벅지": "Thigh", "팔": "Arm", "손목": "Wrist",
    "앞": "Front", "뒤": "Back", "옆": "Side", "밑위": "Rise", "인심": "Inseam", "아웃심": "Outseam",
    "칼라": "Collar", "카라": "Collar", "후드": "Hood", "포켓": "Pocket", "주머니": "Pocket",
    "벨트": "Belt", "커프스": "Cuff", "요크": "Yoke", "다트": "Dart", "품": "Width",
  };
  const PART_ZH: Record<string, string> = {
    "목": "领", "뒷목": "后领", "앞목": "前领", "옆목": "领", "가슴": "胸", "밑단": "下摆",
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
    if (chi) return ZH_GLOSSARY[key] ?? SPEC_NAME_ZH[key] ?? composeSpec(key, false) ?? name;
    return name;
  };
  // 품목(카테고리) 전용 번역 사전
  const CAT_EN: Record<string, string> = {
    "주원단": "Main Fabric", "주원단A": "Main Fabric A", "주원단B": "Main Fabric B",
    "원단": "Fabric", "배색": "Contrast Fabric", "배색원단": "Contrast Fabric",
    "안감": "Lining", "안감A": "Lining A", "안감B": "Lining B",
    "부자재": "Trims", "심지": "Interlining",
  };
  const CAT_ZH: Record<string, string> = {
    "주원단": "主面料", "주원단A": "主面料A", "주원단B": "主面料B",
    "원단": "面料", "배색": "配布", "배색원단": "配布",
    "안감": "配布", "안감A": "配布A", "안감B": "配布B",
    "부자재": "配布", "심지": "衬子",
  };
  // 품목(카테고리) 번역 — 품목 전용 사전 우선, 없으면 공용 용어집
  const catName = (name: string) => {
    if (!name) return name;
    const key = name.trim();
    if (eng) return CAT_EN[key] ?? MAT_NAME_EN[key] ?? name;
    if (chi) return CAT_ZH[key] ?? ZH_GLOSSARY[key] ?? name;
    return name;
  };
  // 도식화 라벨 자동 번역 (모든 사전 종합)
  const labelAuto = (text: string) => {
    if (!text) return text;
    const key = text.trim();
    if (eng) return CAT_EN[key] ?? MAT_NAME_EN[key] ?? SPEC_NAME_EN[key] ?? composeSpec(key, true) ?? text;
    if (chi) return CAT_ZH[key] ?? ZH_GLOSSARY[key] ?? SPEC_NAME_ZH[key] ?? composeSpec(key, false) ?? text;
    return text;
  };
  // 색상 한국어 → 영문 (발주수량 COLOR 칸은 언어와 무관하게 항상 영문 표기)
  const COLOR_EN: Record<string, string> = {
    "블랙": "Black", "검정": "Black", "검정색": "Black", "먹": "Black",
    "화이트": "White", "흰색": "White", "백색": "White", "오프화이트": "Off White",
    "아이보리": "Ivory", "크림": "Cream", "베이지": "Beige", "카멜": "Camel", "탄": "Tan",
    "그레이": "Gray", "회색": "Gray", "챠콜": "Charcoal", "차콜": "Charcoal", "멜란지": "Melange",
    "네이비": "Navy", "남색": "Navy", "블루": "Blue", "파랑": "Blue", "스카이블루": "Sky Blue",
    "소라": "Sky Blue", "하늘색": "Sky Blue", "코발트": "Cobalt", "데님": "Denim",
    "레드": "Red", "빨강": "Red", "와인": "Wine", "버건디": "Burgundy", "카키": "Khaki",
    "그린": "Green", "초록": "Green", "연두": "Light Green", "민트": "Mint", "올리브": "Olive",
    "옐로우": "Yellow", "옐로": "Yellow", "노랑": "Yellow", "머스타드": "Mustard", "레몬": "Lemon",
    "핑크": "Pink", "분홍": "Pink", "연핑크": "Light Pink", "진핑크": "Hot Pink", "코랄": "Coral",
    "퍼플": "Purple", "보라": "Purple", "라벤더": "Lavender", "바이올렛": "Violet",
    "오렌지": "Orange", "주황": "Orange", "브라운": "Brown", "갈색": "Brown", "초코": "Chocolate",
    "실버": "Silver", "골드": "Gold", "로즈골드": "Rose Gold",
  };
  const colorName = (c: string) => {
    if (!c) return c;
    // "블랙, 화이트" / "블랙/화이트" 등 여러 색 분리해 각각 번역, 매핑 없으면 원문 유지
    return c
      .split(/[,/]/)
      .map((p) => {
        const key = p.trim();
        return COLOR_EN[key] ?? key;
      })
      .filter(Boolean)
      .join(", ");
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
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: "1280px" }}>

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">작업지시서 미리보기</div>
            <div className="text-xs text-gray-400">
              {[wo.styleNo, wo.productName, `${wo.orderCount}차`].filter(Boolean).join(" · ")}
              {lang !== "ko" && <span className="ml-2 text-violet-500">· 항목을 클릭하면 이 언어({lang === "en" ? "영문" : "중문"}) 전용으로 수정됩니다</span>}
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
            {lang !== "ko" && (
              <button onClick={() => persistI18n(i18nRef.current)}
                disabled={savingI18n === "saving"}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-violet-300 text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-60">
                {savingI18n === "saving" ? "저장 중..." : savingI18n === "saved" ? "✓ 저장됨" : "💾 수정 저장"}
              </button>
            )}
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

        {/* ── A4 가로 미리보기 (확대/축소 + 드래그 이동) ── */}
        <ZoomPanViewport>
          {/* A4 landscape 실제 비율: 297mm × 210mm */}
          <div style={{
            width: "1122px",   /* 297mm @ 96dpi ≈ 1122px (기준 크기 고정 — 확대/축소는 transform으로) */
            aspectRatio: "297 / 210",
            background: "#fff", flex: "0 0 auto",
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

                <div style={{ flex: "0 0 50%", minHeight: 0, position: "relative" }}>
                  <ImgBox src={(eng ? (wo.sketchImageEn || wo.sketchImage) : chi ? (wo.sketchImageZh || wo.sketchImage) : wo.sketchImage)} label="도식화" style={{ width: "100%", height: "100%" }} />
                  {(wo.sketchLabels ?? []).map((l) => (
                    <div key={l.id} style={{
                      position: "absolute", left: `${l.x}%`, top: `${l.y}%`,
                      transform: "translate(-50%,-50%)",
                      fontSize: FM, fontWeight: 700, color: "#111",
                      background: "rgba(255,255,255,0.85)", padding: "0 2px", borderRadius: "2px",
                      whiteSpace: "nowrap", lineHeight: 1.2,
                    }}>
                      <Ed k={`skl:${l.id}`} auto={labelAuto(l.text)} />
                    </div>
                  ))}
                </div>

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
                      <Ed k="pnote" auto={wo.productionNotes} style={{ display: "block", whiteSpace: "pre-wrap" }} />
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
                              <td style={td({ fontWeight: 600, background: "#f8f8f8", padding: "1px 2px" })}><Ed k={`sp:${i}:item`} auto={specName(m.item)} /></td>
                              {sizes.map(s => (
                                <td key={s} style={td({ padding: "1px", ...numFit(m.values[s] || "") })}>{m.values[s] || ""}</td>
                              ))}
                              <td style={td({ padding: "1px", ...numFit(m.diff) })}>{m.diff}</td>
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
                          <td style={td({ fontWeight: 600, padding: "1.5px 2px" })}>{colorName(row.color)}</td>
                          {sizes.map(s => (
                            <td key={s} style={td({ padding: "1.5px", ...numFit(row.sizes[s] || 0) })}>{row.sizes[s] || 0}</td>
                          ))}
                          <td style={td({ fontWeight: 700, color: "#1a56db", padding: "1.5px", ...numFit(row.total) })}>{row.total}</td>
                        </tr>
                      ))}
                      {/* 남는 여백 (빈 행) — 데이터와 합계 사이 */}
                      {Array.from({ length: Math.max(0, 4 - wo.colorSizeTable.length) }).map((_, i) => (
                        <tr key={`e${i}`}>
                          <td style={td({ padding: "1.5px 2px" })}>&nbsp;</td>
                          {sizes.map(s => <td key={s} style={td({ padding: "1.5px" })}></td>)}
                          <td style={td({ padding: "1.5px" })}></td>
                        </tr>
                      ))}
                      {/* 합계(계) 행 — 항상 표 맨 아래 줄에 고정 */}
                      <tr>
                        <td style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px 2px" }}>{t("계", "TOTAL", "合计")}</td>
                        {sizes.map(s => (
                          <td key={s} style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px", ...numFit(colTotal(s)) }}>{colTotal(s)}</td>
                        ))}
                        <td style={{ ...S.cell, background: "#dde8ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "1.5px", ...numFit(wo.totalQuantity) }}>
                          {wo.totalQuantity}
                        </td>
                      </tr>
                    </tbody>
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

                          // 같은 카테고리(품목)끼리 연속 그룹으로 묶는다. 각 자재 = 1행.
                          // 그룹 안에서 값이 모두 같은 컬럼(자재명·규격·요척 등)은 세로 병합(rowspan),
                          // 값이 다른 컬럼(색상 등)만 행별로 표시한다.
                          // (예: 주원단A 3개[IVORY/PINK/BLACK] → 품목·자재명·규격·요척은 병합, 색상만 3행)
                          const cellBase = { whiteSpace: "pre-line" as const, wordBreak: "break-word" as const, overflowWrap: "anywhere" as const, overflow: "visible" as const, textOverflow: "clip" as const, lineHeight: 1.15 };
                          const editable = (field: string) => field === "name" || field === "color" || field === "spec" || field === "notes";
                          type Field = "name" | "color" | "spec" | "yield" | "price" | "order" | "notes";
                          const fieldVal = (m: typeof wo.materials[0], f: Field): string => {
                            switch (f) {
                              case "name":  return matName(m.name);
                              case "color": return m.color ?? "";
                              case "spec":  return m.spec ?? "";
                              case "yield": return m.yield ?? "";
                              case "price": return m.unitPrice ?? "";
                              case "order": return m.orderUnit ?? "";
                              case "notes": return m.notes ?? "";
                            }
                          };

                          // 연속 동일 카테고리 그룹으로 분할
                          const groups: (typeof wo.materials)[] = [];
                          for (let i = 0; i < userMats.length; ) {
                            const cat = userMats[i].category;
                            let j = i;
                            while (j < userMats.length && userMats[j].category === cat) j++;
                            groups.push(userMats.slice(i, j));
                            i = j;
                          }
                          const totalUserRows = userMats.length;
                          const userEmptyCount = Math.max(0, MAT_MIN_ROWS - totalUserRows - fixedMats.length);

                          // 그룹 렌더: 각 자재 1행, 그룹 내 동일값 컬럼은 첫 행에서 rowspan 병합
                          const renderGroup = (g: typeof wo.materials, gi: number) => {
                            const k = g.length;
                            const allSame = (f: Field) => new Set(g.map((m) => fieldVal(m, f))).size <= 1;
                            const catId = g[0]?.id ?? `g${gi}`;
                            const valCell = (m: typeof wo.materials[0], mi: number, f: Field, extra?: React.CSSProperties) => {
                              const merged = allSame(f);
                              if (merged && mi > 0) return null; // 병합됨 — 첫 행에서만
                              const val = fieldVal(m, f);
                              // 병합 셀은 그룹 대표 id로 편집키 고정(기존 수정본 호환), 아니면 개별 자재 id
                              const key = `m:${(merged ? catId : (m.id ?? `${gi}-${mi}`))}:${f}`;
                              const style = matTd({ fontSize: matFS, padding: rowPad, ...cellBase, ...extra });
                              return (
                                <td key={f} rowSpan={merged ? k : 1} style={style}>
                                  {editable(f) ? <Ed k={key} auto={val} /> : val}
                                </td>
                              );
                            };
                            return g.map((m, mi) => (
                              <tr key={`g${gi}-${m.id ?? mi}`}>
                                {mi === 0 && (
                                  <td rowSpan={k} style={matTd({ fontSize: matFS, padding: rowPad, verticalAlign: "middle", ...cellBase })}>
                                    {catName(g[0].category)}
                                  </td>
                                )}
                                {valCell(m, mi, "name")}
                                {valCell(m, mi, "color")}
                                {valCell(m, mi, "spec")}
                                {valCell(m, mi, "yield")}
                                {valCell(m, mi, "price")}
                                {showFabricOrder && valCell(m, mi, "order")}
                                {valCell(m, mi, "notes", { textAlign: "left" })}
                              </tr>
                            ));
                          };

                          const renderFixedRow = (m: typeof wo.materials[0], i: number) => (
                            <tr key={`f${m.id ?? i}`}>
                              <td style={matTd({ fontSize: matFS, padding: rowPad, verticalAlign: "middle", ...cellBase })}>{catName(m.category)}</td>
                              <td style={matTd({ fontSize: matFS, padding: rowPad, ...cellBase })}><Ed k={`m:${m.id ?? i}:name`} auto={matName(m.name)} /></td>
                              <td style={matTd({ fontSize: matFS, padding: rowPad, ...cellBase })}><Ed k={`m:${m.id ?? i}:color`} auto={m.color} /></td>
                              <td style={matTd({ fontSize: matFS, padding: rowPad, ...cellBase })}><Ed k={`m:${m.id ?? i}:spec`} auto={m.spec} /></td>
                              <td style={matTd({ fontSize: matFS, padding: rowPad })}>{m.yield}</td>
                              <td style={matTd({ fontSize: matFS, padding: rowPad })}>{m.unitPrice}</td>
                              {showFabricOrder && (
                                <td style={matTd({ fontSize: matFS, padding: rowPad })}>{m.orderUnit}</td>
                              )}
                              <td style={matTd({ fontSize: matFS, padding: rowPad, textAlign: "left", ...cellBase })}><Ed k={`m:${m.id ?? i}:notes`} auto={m.notes} /></td>
                            </tr>
                          );

                          return [
                            // 1) 사용자 추가 행 (그룹 내 동일값 칸은 병합, 색상 등 다른 값만 행 분리)
                            ...groups.flatMap((g, gi) => renderGroup(g, gi)),
                            // 2) 빈 행 (고정 행들 아래로 밀어내는 여백)
                            ...Array.from({ length: userEmptyCount }, (_, i) => (
                              <tr key={`em${i}`}>
                                {Array.from({ length: showFabricOrder ? 8 : 7 }).map((__, j) => (
                                  <td key={j} style={matTd({ padding: rowPad })}>&nbsp;</td>
                                ))}
                              </tr>
                            )),
                            // 3) 고정 라벨 행 — 항상 표 맨 하단
                            ...fixedMats.map((m, i) => renderFixedRow(m, i)),
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
                  const vPad = "0.5px 3px";
                  const nb = (s?: string) => (s && s !== "" ? s : " "); // 빈 셀도 공백으로 채워 행 높이 균등
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
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{nb(row.materialType)}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{nb(row.vendorName)}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{nb((row as any).manager)}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{nb(row.contact)}</td>
                              <td style={td({ padding: vPad, fontSize: FS, textAlign: "left" })}>{nb(row.notes)}</td>
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
        </ZoomPanViewport>

      </div>
    </div>
  );
}
