"use client";
import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, Save, Printer, Plus, Trash2, Edit3,
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ImagePlus, X, ChevronDown, Check,
  Image as ImageIcon, Link as LinkIcon, Paperclip, ExternalLink,
  Sparkles, Loader2, Search, Download
} from "lucide-react";
import type { WorkOrder, WorkOrderMaterial, WorkOrderMeasurement, WorkOrderColorSize } from "@/types";

// ─── 기본 측정 항목 (아동복 기준) ──────────────────────────
const DEFAULT_MEASUREMENTS: WorkOrderMeasurement[] = [
  { item: "기장",     values: {}, diff: "" },
  { item: "가슴둘레", values: {}, diff: "" },
  { item: "어깨너비", values: {}, diff: "" },
  { item: "앞품길이", values: {}, diff: "" },
  { item: "소매장",   values: {}, diff: "" },
  { item: "소매부리", values: {}, diff: "" },
  { item: "옆목너비", values: {}, diff: "" },
  { item: "밑단길이", values: {}, diff: "" },
];

const DEFAULT_SIZES = ["100", "110", "120", "130", "140"];

const MATERIAL_CATEGORIES = [
  "주원단A", "안감A", "안감B", "안감C",
  "배색B", "배색C", "테이프",
  "웰론(몸판)", "웰론(소매)", "지퍼", "슬라이더", "와펜",
  "E/BAND", "아일렛", "스트링", "스토퍼", "재봉사", "패턴비",
  "완사입가(VAT+)", "기타",
];

const YIELD_UNITS = ["YD", "M", "EA", "직접입력"] as const;
type YieldUnit = typeof YIELD_UNITS[number];

const LINING_NAMES = ["폴리트윌", "T/C", "단면폴라폴리스", "양면폴라폴리스", "직접입력"];

const SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];
const YEARS   = ["2024", "2025", "2026", "2027"];

type TemplateMat = Pick<WorkOrderMaterial, "category"|"name"|"yield"|"yieldUnit"|"notes">;
const mk = (category: string, name="", yld="", yieldUnit="YD", notes=""): TemplateMat =>
  ({ category, name, yield: yld, yieldUnit, notes });

const MATERIAL_TEMPLATES: Record<string, TemplateMat[]> = {
  "티셔츠": [
    mk("주원단A", "", "1.3"),
    mk("배색B", "립", "0.1", "M", "넥/소매/밑단"),
    mk("재봉사", "", "1", "EA"),
  ],
  "맨투맨": [
    mk("주원단A", "", "1.5"),
    mk("배색B", "립", "0.15", "M", "넥/소매/밑단"),
    mk("E/BAND", "", "1", "M"),
    mk("재봉사", "", "1", "EA"),
  ],
  "후드집업": [
    mk("주원단A", "", "1.7"),
    mk("배색B", "립", "0.15", "M", "소매/밑단"),
    mk("E/BAND", "", "1", "M"),
    mk("지퍼", "", "1", "EA"),
    mk("슬라이더", "", "1", "EA"),
    mk("스트링", "", "1.5", "M", "후드끈"),
    mk("스토퍼", "", "2", "EA"),
    mk("아일렛", "", "2", "EA"),
    mk("재봉사", "", "1", "EA"),
  ],
  "패딩류": [
    mk("주원단A", "", "1.5"),
    mk("안감A", "폴리트윌", "1.2"),
    mk("웰론(몸판)", "", "1.2", "YD"),
    mk("웰론(소매)", "", "0.5", "YD"),
    mk("배색B", "", "0.3"),
    mk("지퍼", "", "1", "EA"),
    mk("슬라이더", "", "1", "EA"),
    mk("재봉사", "", "1", "EA"),
  ],
  "점퍼": [
    mk("주원단A", "", "1.5"),
    mk("안감A", "폴리트윌", "1.2"),
    mk("배색B", "", "0.3", "M", "소매/밑단 립"),
    mk("배색C", "", "0.2", "M", "테이프"),
    mk("지퍼", "", "1", "EA"),
    mk("슬라이더", "", "1", "EA"),
    mk("재봉사", "", "1", "EA"),
  ],
  "코트": [
    mk("주원단A", "", "2.0"),
    mk("안감A", "폴리트윌", "1.8"),
    mk("배색B", "", "0.2"),
    mk("테이프", "", "1", "M"),
    mk("재봉사", "", "1", "EA"),
  ],
  "블라우스": [
    mk("주원단A", "", "1.3"),
    mk("배색B", "", "0.2"),
    mk("재봉사", "", "1", "EA"),
  ],
  "바지": [
    mk("주원단A", "", "1.2"),
    mk("안감A", "", "0.5", "YD", "필요 시"),
    mk("E/BAND", "", "0.8", "M", "허리"),
    mk("스트링", "", "0.8", "M", "허리끈"),
    mk("스토퍼", "", "2", "EA"),
    mk("재봉사", "", "1", "EA"),
  ],
  "스커트": [
    mk("주원단A", "", "1.0"),
    mk("안감A", "", "0.8", "YD", "필요 시"),
    mk("E/BAND", "", "0.6", "M", "허리"),
    mk("재봉사", "", "1", "EA"),
  ],
  "실내복": [
    mk("주원단A", "", "1.8", "YD", "상하 합산"),
    mk("배색B", "립", "0.2", "M"),
    mk("E/BAND", "", "0.8", "M"),
    mk("재봉사", "", "1", "EA"),
  ],
  "상하복(세트)": [
    mk("주원단A", "", "2.5", "YD", "상하 합산"),
    mk("배색B", "립", "0.2", "M"),
    mk("E/BAND", "", "1.0", "M"),
    mk("스트링", "", "0.8", "M"),
    mk("스토퍼", "", "2", "EA"),
    mk("재봉사", "", "1", "EA"),
  ],
};

function emptyOrder(): WorkOrder {
  return {
    id: "",
    styleNo: "", productName: "", vendor: "", season: "여름",
    year: "2026", sampleNo: "", category: "",
    manager: "", director: "",
    issueDate: new Date().toISOString().slice(0, 10),
    productionDate: "", deliveryDate: "",
    orderCount: 1, totalQuantity: 0,
    sizes: ["100", "110", "120", "130", "140"],
    measurements: DEFAULT_MEASUREMENTS.map(m => ({ ...m, values: {} })),
    materials: [],
    colorSizeTable: [],
    labels: { main: true, care: true, reorderInfo: true, priceTag: true, qualityTag: true, polybag: true, wappen: false, pointLabel: false, artworkLabel: false },
    customLabels: [],
    attachments: [],
    sketchImage: "", productImage: "", labelImage: "",
    productionNotes: "",
    fixedNotes: `준수사항\n* 각 "필"의 앞쪽과 뒤쪽의 이색 현상확인.\n* 패턴에 표시된 중심선 및 식서방향 반드시 준수.\n* 나염원단은 부분별 이색및 이염 현상 확인 준수.\n* 전체 디테일 사이즈 편차 준수. (체크후 작업진행)\n* 나염위치, 편차는 디테일 카드 참조.\n* 메인원단 퀄리티 컨펌후 작업진행.\n* 오염주의 및 제사처리 준수.\n* 봉제 땀수 1" 11땀 준수.\n* 작업투입전 필히 사이즈별 1매씩 제작하여 색상과 함께 승인후 작업투입 바랍니다.\n\n작업투입전 필히 사이즈별 1매씩 제작하여 색상과 함께 승인후 작업투입 바랍니다.`,
    vendorNotes: "",
    specialNotes: "",
    totalCost: "", salePrice: "", laborCost: "", packagingCost: "",
    status: "draft",
    createdAt: "", updatedAt: "",
  };
}

// ─── 엑셀 파싱 (패턴실 스펙 파일) ────────────────────────
// 구조: 행0=품명, 행1=헤더(카테고리,공백,100,110,...,편차), 행2~=항목,공백,값들,편차,비고
async function parsePatternExcel(file: File): Promise<{
  productName: string;
  fileName: string;
  sizes: string[];
  measurements: WorkOrderMeasurement[];
} | null> {
  try {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (rows.length < 2) return null;

    // 행0: 품명
    const productName = String(rows[0][0] || "").trim();

    // 행1: 헤더 → 사이즈 추출 (숫자인 컬럼들)
    const headerRow = rows[1];
    const sizeColIndices: number[] = [];
    const sizes: string[] = [];
    let diffColIdx = -1;

    headerRow.forEach((cell: any, i: number) => {
      const v = String(cell).trim();
      if (!isNaN(Number(v)) && Number(v) > 50 && Number(v) < 300) {
        sizeColIndices.push(i);
        sizes.push(v);
      }
      if (v === "편차") diffColIdx = i;
    });

    if (sizes.length === 0) return null;

    // 행2~: 측정항목
    const measurements: WorkOrderMeasurement[] = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const itemName = String(row[0] || "").trim();
      if (!itemName) continue;

      const values: Record<string, string> = {};
      sizeColIndices.forEach((ci, si) => {
        const v = row[ci];
        values[sizes[si]] = v !== "" && v !== null && v !== undefined
          ? String(parseFloat(Number(v).toFixed(2)))
          : "";
      });

      const diff = diffColIdx >= 0 && row[diffColIdx] !== ""
        ? String(parseFloat(Number(row[diffColIdx]).toFixed(2)))
        : "";

      measurements.push({ item: itemName, values, diff });
    }

    // 파일명에서 패턴이름 추출 (확장자 제거)
    const fileName = file.name.replace(/\.[^.]+$/, "");

    return { productName, fileName, sizes, measurements };
  } catch (e) {
    console.error("엑셀 파싱 오류:", e);
    return null;
  }
}

// ─── 탭 타입 ───────────────────────────────────────────────
const TABS = ["기본정보", "사이즈스펙", "원부자재", "라벨·기타", "첨부파일"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  initial?: WorkOrder | null;
  onSave: (wo: WorkOrder) => void;
  onCancel: () => void;
  onPreview: (wo: WorkOrder) => void;
}

// ─── 원부자재별 첨부파일 컴포넌트 ────────────────────────
type Attachment = NonNullable<WorkOrder["attachments"]>[number];

function MaterialAttachList({
  materials, attachments, onChange,
}: {
  materials: WorkOrder["materials"];
  attachments: Attachment[];
  onChange: (atts: Attachment[]) => void;
}) {
  const [openForms, setOpenForms] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, {
    imageFile?: File; imagePreview?: string;
    link: string; memo: string;
  }>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  // 수정 중인 첨부 ID → 편집 중 값
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ link: string; memo: string }>({ link: "", memo: "" });

  function getDraft(matId: string) {
    return drafts[matId] ?? { link: "", memo: "" };
  }
  function setDraft(matId: string, patch: object) {
    setDrafts(prev => ({ ...prev, [matId]: { ...getDraft(matId), ...patch } }));
  }
  function openForm(matId: string) {
    setOpenForms(prev => ({ ...prev, [matId]: true }));
    setSavedIds(prev => ({ ...prev, [matId]: false }));
  }
  function closeForm(matId: string) {
    setOpenForms(prev => ({ ...prev, [matId]: false }));
    setDrafts(prev => { const n = { ...prev }; delete n[matId]; return n; });
  }

  function saveEntry(matId: string) {
    const d = getDraft(matId);
    const newAtts: Attachment[] = [];
    if (d.imagePreview) {
      newAtts.push({
        id: crypto.randomUUID(), materialId: matId, type: "image",
        name: d.imageFile?.name ?? "사진", value: d.imagePreview, memo: d.memo,
      });
    }
    if (d.link.trim()) {
      newAtts.push({
        id: crypto.randomUUID(), materialId: matId, type: "link",
        name: d.link.trim(), value: d.link.trim(), memo: d.memo,
      });
    }
    if (newAtts.length === 0 && d.memo.trim()) {
      newAtts.push({
        id: crypto.randomUUID(), materialId: matId, type: "link",
        name: "(메모)", value: "", memo: d.memo,
      });
    }
    if (newAtts.length === 0) return;
    onChange([...attachments, ...newAtts]);
    setSavedIds(prev => ({ ...prev, [matId]: true }));
    closeForm(matId);
    setTimeout(() => setSavedIds(prev => ({ ...prev, [matId]: false })), 2000);
  }

  function removeAtt(id: string) {
    onChange(attachments.filter(a => a.id !== id));
  }

  function startEdit(att: Attachment) {
    setEditingId(att.id);
    setEditDraft({ link: att.value || "", memo: att.memo || "" });
  }
  function saveEdit(id: string) {
    onChange(attachments.map(a => a.id !== id ? a : {
      ...a, value: editDraft.link, name: editDraft.link || a.name, memo: editDraft.memo,
    }));
    setEditingId(null);
  }

  return (
    <>
    {lightbox && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors" onClick={() => setLightbox(null)}><X size={18} /></button>
        <img src={lightbox} alt="확대" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    <div className="space-y-3">
      {materials.map((mat) => {
        const matAtts = attachments.filter(a => a.materialId === mat.id);
        const isOpen  = openForms[mat.id] ?? false;
        const draft   = getDraft(mat.id);
        const saved   = savedIds[mat.id] ?? false;

        return (
          <div key={mat.id} className="border border-gray-100 rounded-2xl bg-white overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded-md">{mat.category || "—"}</span>
              <span className="text-sm font-bold text-gray-800">{mat.name || "자재명 없음"}</span>
              {mat.color && <span className="text-xs text-gray-400">{mat.color}</span>}
              <div className="ml-auto flex items-center gap-2">
                {saved && <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check size={12} />저장됨</span>}
                <button
                  onClick={() => isOpen ? closeForm(mat.id) : openForm(mat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isOpen ? "bg-gray-200 text-gray-600 hover:bg-gray-300" : "bg-pink-500 text-white hover:bg-pink-600"}`}
                >
                  <Plus size={12} />{isOpen ? "취소" : "올리기"}
                </button>
              </div>
            </div>

            {/* 올리기 폼 */}
            {isOpen && (
              <div className="p-4 border-b border-gray-100 bg-pink-50/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* 사진 업로드 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">사진</label>
                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-indigo-200 rounded-xl bg-white cursor-pointer hover:border-pink-400 transition-colors overflow-hidden">
                      {draft.imagePreview ? (
                        <div className="relative w-full h-full">
                          <img src={draft.imagePreview} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={(e) => { e.preventDefault(); setDraft(mat.id, { imageFile: undefined, imagePreview: undefined }); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-white/80 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500"><X size={10} /></button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-indigo-300">
                          <ImageIcon size={20} />
                          <span className="text-[10px]">클릭하여 사진 선택</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setDraft(mat.id, { imageFile: f, imagePreview: ev.target?.result as string });
                        reader.readAsDataURL(f); e.target.value = "";
                      }} />
                    </label>
                  </div>
                  {/* 링크 (제목 없음) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">링크</label>
                    <input value={draft.link} onChange={(e) => setDraft(mat.id, { link: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400 bg-white" />
                  </div>
                </div>
                {/* 비고 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">비고</label>
                  <textarea value={draft.memo} onChange={(e) => setDraft(mat.id, { memo: e.target.value })}
                    placeholder="두께감, 색상 옵션, 단가, 특이사항 등"
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 bg-white resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => closeForm(mat.id)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
                  <button onClick={() => saveEntry(mat.id)} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"><Save size={11} />저장</button>
                </div>
              </div>
            )}

            {/* 저장된 첨부 목록 — 가로 행 레이아웃 */}
            {matAtts.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-300 text-center">첨부 없음</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {matAtts.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors group">
                    {/* 썸네일 */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center cursor-pointer border border-gray-100"
                      onClick={() => att.type === "image" && att.value && setLightbox(att.value)}>
                      {att.type === "image" && att.value
                        ? <img src={att.value} alt={att.name} className="w-full h-full object-cover" />
                        : <LinkIcon size={16} className="text-gray-300" />}
                    </div>
                    {/* 링크 */}
                    <div className="flex-1 min-w-0">
                      {editingId === att.id ? (
                        <input value={editDraft.link} onChange={(e) => setEditDraft(d => ({ ...d, link: e.target.value }))}
                          placeholder="https://..." autoFocus
                          className="w-full px-2 py-1 text-xs border border-pink-300 rounded-lg focus:outline-none bg-white" />
                      ) : (
                        att.value
                          ? <a href={att.value} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-pink-600 hover:underline truncate block">{att.value}</a>
                          : <span className="text-xs text-gray-300">링크 없음</span>
                      )}
                    </div>
                    {/* 비고 */}
                    <div className="w-40 flex-shrink-0">
                      {editingId === att.id ? (
                        <input value={editDraft.memo} onChange={(e) => setEditDraft(d => ({ ...d, memo: e.target.value }))}
                          placeholder="비고"
                          className="w-full px-2 py-1 text-xs border border-pink-300 rounded-lg focus:outline-none bg-white" />
                      ) : (
                        <span className="text-xs text-gray-500 truncate block">{att.memo || "—"}</span>
                      )}
                    </div>
                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {editingId === att.id ? (
                        <>
                          <button onClick={() => saveEdit(att.id)} className="px-2 py-1 text-[10px] font-semibold bg-pink-500 text-white rounded-lg hover:bg-pink-600">저장</button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(att)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-pink-500 transition-all" title="수정"><Edit3 size={12} /></button>
                          <button onClick={() => removeAtt(att.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all" title="삭제"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}

// ─── 라벨 다이어그램 프리셋 타입 ──────────────────────────
export interface LabelDiagramPreset {
  id: string;
  group: "케어라벨" | "메인라벨" | "포인트라벨" | string;
  name: string;
  imageData?: string; // base64
}

const LABEL_PRESET_DEFAULT: LabelDiagramPreset[] = [
  { id: "care_top",    group: "케어라벨",  name: "상의"  },
  { id: "care_bottom", group: "케어라벨",  name: "하의"  },
  { id: "care_outer",  group: "케어라벨",  name: "아우터" },
  { id: "main_top",    group: "메인라벨",  name: "상의"  },
  { id: "main_bottom", group: "메인라벨",  name: "하의"  },
  { id: "main_outer",  group: "메인라벨",  name: "아우터" },
  { id: "point_top",   group: "포인트라벨", name: "상의"  },
  { id: "point_outer", group: "포인트라벨", name: "아우터" },
  { id: "point_care",  group: "포인트라벨", name: "케어+포인트 같이" },
];

const LABEL_GROUPS = ["케어라벨", "메인라벨", "포인트라벨"] as const;
const GROUP_COLORS: Record<string, { border: string; bg: string; header: string; tag: string }> = {
  "케어라벨":   { border: "border-blue-200",   bg: "bg-blue-50/40",   header: "bg-blue-100   text-blue-700",   tag: "bg-blue-100   text-blue-600"   },
  "메인라벨":   { border: "border-indigo-200",  bg: "bg-pink-50/40", header: "bg-indigo-100 text-pink-700", tag: "bg-indigo-100 text-pink-600" },
  "포인트라벨": { border: "border-pink-200",    bg: "bg-pink-50/40",   header: "bg-pink-100   text-pink-700",   tag: "bg-pink-100   text-pink-600"   },
};

function LabelDiagramSection({
  selected, onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [presets, setPresets] = useState<LabelDiagramPreset[]>(LABEL_PRESET_DEFAULT);

  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadFromSupabase() {
    setLoadError(null);
    fetch("/api/label-presets")
      .then(r => r.json())
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) {
          setLoadError(`API 오류: ${JSON.stringify(rows).slice(0, 100)}`);
          setPresets(LABEL_PRESET_DEFAULT);
          return;
        }
        if (rows.length === 0) {
          Promise.all(LABEL_PRESET_DEFAULT.map((p, i) =>
            fetch("/api/label-presets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: p.id, group: p.group, name: p.name, sortOrder: i }),
            })
          ));
          setPresets(LABEL_PRESET_DEFAULT);
          return;
        }
        setPresets(rows.map(r => ({
          id: r.id, group: r.group_name, name: r.name,
          imageData: r.image_data ?? undefined,
        })));
      })
      .catch((e) => {
        setLoadError(`네트워크 오류: ${e?.message ?? e}`);
        setPresets(LABEL_PRESET_DEFAULT);
      });
  }

  useEffect(() => { loadFromSupabase(); }, []);

  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function toggleSelect(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  async function updatePresetImage(id: string, imageData: string) {
    const updated = presets.map(p => p.id === id ? { ...p, imageData } : p);
    setPresets(updated);
    setSaving(id);
    const preset = updated.find(p => p.id === id)!;
    await fetch("/api/label-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, group: preset.group, name: preset.name, imageData }),
    }).catch(() => {});
    setSaving(null);
  }

  async function addCustomPreset(group: string) {
    if (!newName.trim()) return;
    const id = `custom_${Date.now()}`;
    const newPreset = { id, group, name: newName.trim() };
    const updated = [...presets, newPreset];
    setPresets(updated);
    onChange([...selected, id]);
    setNewName("");
    setAddingGroup(null);
    await fetch("/api/label-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, group, name: newPreset.name, sortOrder: updated.length }),
    }).catch(() => {});
  }

  async function removePreset(id: string) {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    onChange(selected.filter(s => s !== id));
    await fetch("/api/label-presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          <span>{loadError}</span>
          <button onClick={loadFromSupabase} className="ml-auto px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-semibold">재시도</button>
        </div>
      )}
      {LABEL_GROUPS.map(group => {
        const items = presets.filter(p => p.group === group);
        const c = GROUP_COLORS[group];
        return (
          <div key={group} className={`border ${c.border} rounded-2xl overflow-hidden`}>
            {/* 그룹 헤더 */}
            <div className={`px-4 py-2.5 ${c.header} font-semibold text-sm`}>{group}</div>

            {/* 아이템 그리드 */}
            <div className={`${c.bg} p-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4`}>
              {items.map(preset => {
                const isChecked = selected.includes(preset.id);
                const isDefault = LABEL_PRESET_DEFAULT.some(d => d.id === preset.id);
                return (
                  <div key={preset.id} className="flex flex-col gap-1">
                    {/* 체크박스 + 이름 — 카드 밖, 클릭 독립 */}
                    <label className="flex items-center gap-1.5 cursor-pointer px-0.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(preset.id)}
                        className="w-3.5 h-3.5 accent-pink-500 cursor-pointer rounded shrink-0"
                      />
                      <span className={`text-xs font-semibold truncate ${isChecked ? "text-pink-700" : "text-gray-600"}`}>
                        {preset.name}
                      </span>
                      {!isDefault && (
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); removePreset(preset.id); }}
                          className="text-gray-300 hover:text-red-400 shrink-0 ml-auto"
                        ><X size={10} /></button>
                      )}
                    </label>

                    {/* 이미지 카드 — 업로드 전용 */}
                    <div className={`relative rounded-xl border-2 overflow-hidden group/img cursor-pointer ${
                      isChecked ? "border-pink-400 shadow-sm shadow-indigo-100" : "border-gray-200 bg-white"
                    }`}
                      onClick={() => toggleSelect(preset.id)}
                    >
                      <div className="h-24 bg-gray-50 flex items-center justify-center">
                        {preset.imageData ? (
                          <img src={preset.imageData} alt={preset.name}
                            className="w-full h-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-gray-300">
                            <ImagePlus size={20} />
                            <span className="text-[10px]">이미지 없음</span>
                          </div>
                        )}
                      </div>
                      {/* 업로드 오버레이 */}
                      <label
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/20 opacity-0 group-hover/img:opacity-100 transition-all cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="bg-white text-gray-700 text-[10px] font-semibold px-2 py-1 rounded-lg shadow flex items-center gap-1">
                          <Upload size={9} />{preset.imageData ? "교체" : "업로드"}
                        </span>
                        <input type="file" accept="image/*" className="hidden"
                          ref={el => { fileRefs.current[preset.id] = el; }}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = ev => updatePresetImage(preset.id, ev.target?.result as string);
                            reader.readAsDataURL(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              {/* + 직접추가 카드 */}
              {addingGroup === group ? (
                <div className="rounded-xl border-2 border-dashed border-pink-300 bg-white p-2 flex flex-col gap-1.5">
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter") addCustomPreset(group); if(e.key==="Escape") setAddingGroup(null); }}
                    placeholder="이름 입력..."
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => addCustomPreset(group)}
                      className="flex-1 py-1 bg-pink-500 text-white text-[10px] font-semibold rounded-lg hover:bg-pink-600">추가</button>
                    <button onClick={() => setAddingGroup(null)}
                      className="flex-1 py-1 bg-gray-100 text-gray-500 text-[10px] rounded-lg hover:bg-gray-200">취소</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingGroup(group); setNewName(""); }}
                  className="rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/40 transition-all flex flex-col items-center justify-center gap-1 h-[110px] text-gray-400 hover:text-pink-500"
                >
                  <Plus size={16} />
                  <span className="text-[10px] font-medium">직접추가</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
      {selected.length > 0 && (
        <p className="text-xs text-pink-600 font-medium">
          ✓ {selected.length}개 선택됨 — PDF에 포함됩니다
        </p>
      )}
    </div>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────
function SectionCard({ title, sub, action, children, className }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2.5 mb-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-pink-400 to-pink-300 shrink-0" />
          <div>
            <div className="text-sm font-bold text-gray-800">{title}</div>
            {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
          </div>
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-bold text-gray-800 text-base">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── 인풋 헬퍼 ───────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 tracking-wide">
        {label}{required && <span className="text-pink-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition placeholder:text-gray-300";
const selectCls = inputCls;

// ─── 드롭다운 + 직접입력 컴포넌트 ────────────────────────
function SelectDropdown({
  presets,
  value,
  onChange,
  placeholder,
}: {
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isCustom = value !== "" && !presets.includes(value);

  function selectPreset(p: string) {
    onChange(p);
    setCustom("");
    setOpen(false);
  }

  function submitCustom() {
    if (custom.trim()) {
      onChange(custom.trim());
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${value ? "text-gray-900" : "text-gray-400"}`}
      >
        <span>{value || placeholder || "선택하세요"}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPreset(p)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-pink-50 hover:text-pink-700 ${
                value === p ? "bg-pink-50 text-pink-700 font-medium" : "text-gray-700"
              }`}
            >
              {p}
              {value === p && <Check size={13} className="text-pink-500 flex-shrink-0" />}
            </button>
          ))}
          <div className="border-t border-gray-100 p-2">
            <div className="flex gap-1.5">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCustom()}
                placeholder="직접 입력"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400"
              />
              <button
                type="button"
                onClick={submitCustom}
                className="px-2 py-1.5 text-xs bg-pink-500 text-white rounded-lg hover:bg-pink-600 font-medium"
              >확인</button>
            </div>
            {isCustom && (
              <div className="mt-1 text-xs text-pink-600 px-1">현재: <strong>{value}</strong></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 직접 추가 라벨 입력 컴포넌트 ─────────────────────────
function CustomLabelInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  function submit() {
    const trimmed = val.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setVal("");
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="직접 추가 (예: 행택, 특수라벨…)"
        className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 w-64"
      />
      <button
        type="button"
        onClick={submit}
        className="flex items-center gap-1 px-3 py-2 text-sm bg-pink-500 text-white rounded-xl hover:bg-pink-600 font-medium"
      >
        <Plus size={14} />추가
      </button>
    </div>
  );
}

const VENDORS = ["오중생산", "코니키즈", "성은교역", "와이티트레이딩", "민주어페럴", "내주실업", "인도(CEEDEE)", "기타"];

type VendorType = "china" | "outsourcing" | "domestic" | "india" | "other";
function getVendorType(vendor: string): VendorType {
  const v = vendor.trim().toLowerCase();
  if (["오중생산", "오중"].some(k => vendor.trim() === k)) return "china";
  if (["코니키즈", "성은교역", "와이티트레이딩"].includes(vendor.trim())) return "outsourcing";
  if (["민주", "민주어페럴", "내주", "내주실업"].includes(vendor.trim())) return "domestic";
  if (v.includes("인도") || v.includes("ceedee")) return "india";
  return "other";
}

function calcMaterialsSum(materials: WorkOrderMaterial[]): number {
  return materials.reduce((sum, m) => {
    const price = parseFloat(m.unitPrice?.replace(/,/g, "") || "0");
    const yld   = parseFloat(m.yield?.replace(/,/g, "") || "0");
    if (!isNaN(price) && !isNaN(yld)) return sum + price * yld;
    return sum;
  }, 0);
}

function fmtKRW(n: number) {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}
function fmtCNY(n: number) {
  return "¥ " + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtUSD(n: number) {
  return "$ " + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function roundToThousand(n: number) { return Math.round(n / 1000) * 1000; }

function SalePanel({ finalCost, salePrice, onSaleChange, inputCls }: {
  finalCost: number; salePrice: string; onSaleChange: (v: string) => void; inputCls: string;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white px-4 py-4 flex flex-col gap-2 h-full">
      <div className="text-xs font-semibold text-gray-500 mb-0.5">판매가</div>
      {finalCost > 0 && (
        <div className="flex gap-2">
          {[4, 5].map(mult => {
            const val = roundToThousand(finalCost * mult);
            const active = salePrice?.replace(/,/g, "") === String(val);
            return (
              <button key={mult} type="button"
                onClick={() => onSaleChange(val.toLocaleString())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                  active ? "bg-pink-500 border-pink-500 text-white" : "border-pink-300 text-pink-500 bg-pink-50 hover:bg-pink-100"
                }`}>
                {mult}배수 → {val.toLocaleString()}원
              </button>
            );
          })}
        </div>
      )}
      <input value={salePrice} onChange={(e) => onSaleChange(e.target.value)}
        placeholder="직접 입력" className={inputCls} />
    </div>
  );
}

function CostLayout({ cost, finalCost, salePrice, onSaleChange, inputCls }: {
  cost: React.ReactNode; finalCost: number; salePrice: string; onSaleChange: (v: string) => void; inputCls: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 items-start">
      <div>{cost}</div>
      <SalePanel finalCost={finalCost} salePrice={salePrice} onSaleChange={onSaleChange} inputCls={inputCls} />
    </div>
  );
}
const CATEGORIES = ["상의", "하의", "실내복", "아우터", "원피스", "세트"];
const MANAGERS  = ["김진선(SUNNY)", "박정은(LOREEN)", "유가현(JESSICA)"];

export default function WorkOrderForm({ initial, onSave, onCancel, onPreview }: Props) {
  const [tab, setTab]   = useState<Tab>("기본정보");
  const [wo, setWo]     = useState<WorkOrder>(() => initial ? { ...initial } : emptyOrder());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [xlsxStatus, setXlsxStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [xlsxMsg, setXlsxMsg]       = useState("");
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // ── 드라이브 검색 상태 ──
  const [driveQuery, setDriveQuery]   = useState("");
  const [driveResults, setDriveResults] = useState<{ id: string; name: string; score?: number }[]>([]);
  const [driveSearching, setDriveSearching] = useState(false);
  const [driveOpen, setDriveOpen]     = useState(false);
  const [driveLoadingId, setDriveLoadingId] = useState<string | null>(null);
  const [driveError, setDriveError]   = useState<string | null>(null);
  const [driveTotal, setDriveTotal]   = useState<number | null>(null);
  const driveSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matTableRef   = useRef<HTMLTableElement>(null);

  // ─── 원부자재 드래그 정렬 ──────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // 품목 드롭다운
  const [catOpen, setCatOpen] = useState<string | null>(null);
  const [catPos, setCatPos]   = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 140 });
  // 단위 직접입력 모드 (materialId)
  const [unitDirect, setUnitDirect] = useState<Record<string, boolean>>({});
  // 자재명 드롭다운
  const [nameOpen, setNameOpen] = useState<string | null>(null);
  const [namePos, setNamePos]   = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 150 });
  // AI 도식화 분석
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState("");
  const [usdToKrw, setUsdToKrw] = useState<number>(1380);
  const [rateDate, setRateDate] = useState<string>("");

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then(r => r.json())
      .then(d => {
        if (d.usdToKrw) { setUsdToKrw(d.usdToKrw); setRateDate(d.fallback ? "고정환율" : "오늘 기준"); }
      })
      .catch(() => {});
  }, []);

  function applyTemplate(type: string) {
    const tmpl = MATERIAL_TEMPLATES[type];
    if (!tmpl) return;
    const existingCats = new Set(wo.materials.map((m) => m.category));
    const newMats: WorkOrderMaterial[] = tmpl
      .filter((t) => !existingCats.has(t.category))
      .map((t) => ({
        id: crypto.randomUUID(),
        category: t.category, name: t.name,
        color: "", spec: "",
        yield: t.yield, yieldUnit: t.yieldUnit,
        unitPrice: "", orderUnit: "", notes: t.notes,
      }));
    if (newMats.length === 0) { alert("이미 모든 항목이 추가되어 있습니다."); return; }
    setWo((w) => ({ ...w, materials: [...w.materials, ...newMats] }));
  }

  async function analyzeSketch() {
    if (!wo.sketchImage) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      // base64에서 헤더 제거 (data:image/jpeg;base64, 부분)
      const base64 = wo.sketchImage.split(",")[1];
      const mimeType = wo.sketchImage.split(";")[0].replace("data:", "") || "image/jpeg";
      const res = await fetch("/api/analyze-sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(JSON.stringify(data.error ?? data).slice(0, 200));
      if (!Array.isArray(data.materials)) throw new Error("materials 없음: " + JSON.stringify(data).slice(0, 200));
      // 기존 원부자재에 추가 (중복 카테고리 제외)
      const existingCats = new Set(wo.materials.map((m) => m.category));
      const newMats: WorkOrderMaterial[] = data.materials
        .filter((m: any) => !existingCats.has(m.category))
        .map((m: any) => ({
          id: crypto.randomUUID(),
          category:  m.category  ?? "",
          name:      m.name      ?? "",
          color:     m.color     ?? "",
          spec:      m.spec      ?? "",
          yield:     m.yield     ?? "",
          yieldUnit: m.yieldUnit ?? "YD",
          unitPrice: m.unitPrice ?? "",
          orderUnit: m.orderUnit ?? "",
          notes:     m.notes     ?? "",
        }));
      setWo((w) => ({ ...w, materials: [...w.materials, ...newMats] }));
      setAnalyzeResult(`✅ ${newMats.length}개 항목 자동 추가됨. 원부자재 탭에서 확인·수정하세요.`);
    } catch (e: any) {
      setAnalyzeResult(`❌ 분석 실패: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }
  function onDragEnter(idx: number) {
    dragOverIdx.current = idx;
    setDragOver(idx);
  }
  function onDragEnd() {
    const from = dragIdx.current;
    const to   = dragOverIdx.current;
    if (from !== null && to !== null && from !== to) {
      setWo(prev => {
        const mats = [...prev.materials];
        const [moved] = mats.splice(from, 1);
        mats.splice(to, 0, moved);
        return { ...prev, materials: mats };
      });
    }
    dragIdx.current = null;
    dragOverIdx.current = null;
    setDragOver(null);
  }

  // ─── 노션 자동완성 ────────────────────────────────────────
  const [notionFillStatus, setNotionFillStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const notionLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function lookupNotion(name: string) {
    if (!name.trim() || name.trim().length < 2) { setNotionFillStatus("idle"); return; }
    setNotionFillStatus("loading");
    try {
      const res = await fetch(`/api/notion-product-lookup?q=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (!data) { setNotionFillStatus("notfound"); return; }
      setNotionFillStatus("found");
      // 자동완성: 빈 필드만 채우고, 이미 입력된 건 유지
      setWo(prev => {
        const hasSizes  = prev.sizes && prev.sizes.length > 0;
        const hasColors = prev.colorSizeTable && prev.colorSizeTable.length > 0;
        return {
          ...prev,
          notionProductId:  prev.notionProductId  || data.notionProductId || "",
          vendor:           data.vendor           || prev.vendor          || "",
          year:             data.year             || prev.year,
          season:           data.season           || prev.season,
          category:         prev.category         || data.category        || "",
          productImage:     prev.productImage     || data.imageUrl        || "",
          // 발주수량표: 비어있을 때만 채움
          sizes:            hasSizes  ? prev.sizes         : (data.sizes         ?? prev.sizes),
          colorSizeTable:   hasColors ? prev.colorSizeTable : (data.colorSizeTable ?? prev.colorSizeTable),
          totalQuantity:    hasColors ? prev.totalQuantity  : (data.totalQuantity  ?? prev.totalQuantity),
        };
      });
    } catch {
      setNotionFillStatus("notfound");
    }
  }

  function handleProductNameChange(name: string) {
    set("productName", name);
    if (notionLookupTimer.current) clearTimeout(notionLookupTimer.current);
    setNotionFillStatus("idle");
    notionLookupTimer.current = setTimeout(() => lookupNotion(name), 700);
  }

  function handleMatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    if (e.key === "Tab") return; // Tab은 브라우저 기본 동작 유지
    e.preventDefault();
    const table = matTableRef.current;
    if (!table) return;
    const inputs = Array.from(table.querySelectorAll<HTMLInputElement>("input"));
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
  }

  useEffect(() => {
    if (initial) setWo({ ...initial });
    else setWo(emptyOrder());
  }, [initial]);

  // ─── 필드 업데이트 헬퍼 ────────────────────────────────
  function set<K extends keyof WorkOrder>(key: K, value: WorkOrder[K]) {
    setWo((w) => ({ ...w, [key]: value }));
  }

  // ─── 수량 자동 합산 ────────────────────────────────────
  function recomputeTotal(table: WorkOrderColorSize[]): number {
    return table.reduce((s, row) => s + (row.total || 0), 0);
  }

  function updateColorSize(idx: number, field: string, value: any) {
    const next = wo.colorSizeTable.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row };
      if (field === "color") {
        updated.color = value;
      } else if (field in (row.sizes ?? {})) {
        updated.sizes = { ...updated.sizes, [field]: Number(value) || 0 };
      } else {
        updated.sizes = { ...updated.sizes, [field]: Number(value) || 0 };
      }
      updated.total = wo.sizes.reduce((s, sz) => s + (updated.sizes[sz] || 0), 0);
      return updated;
    });
    setWo((w) => ({ ...w, colorSizeTable: next, totalQuantity: recomputeTotal(next) }));
  }

  function addColorRow() {
    const newRow: WorkOrderColorSize = {
      color: "",
      sizes: Object.fromEntries(wo.sizes.map((s) => [s, 0])),
      total: 0,
    };
    setWo((w) => ({ ...w, colorSizeTable: [...w.colorSizeTable, newRow] }));
  }

  function removeColorRow(idx: number) {
    const next = wo.colorSizeTable.filter((_, i) => i !== idx);
    setWo((w) => ({ ...w, colorSizeTable: next, totalQuantity: recomputeTotal(next) }));
  }

  // ─── 원부자재 ─────────────────────────────────────────
  function addMaterial() {
    const m: WorkOrderMaterial = {
      id: Date.now().toString(),
      category: "", name: "", color: "", spec: "",
      yield: "", yieldUnit: "YD", unitPrice: "", orderUnit: "", notes: "",
    };
    setWo((w) => ({ ...w, materials: [...w.materials, m] }));
  }

  function updateMaterial(id: string, key: keyof WorkOrderMaterial, value: string) {
    setWo((w) => ({
      ...w,
      materials: w.materials.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, [key]: value };
        // 패턴비 선택 시 자동 입력 (항상 강제)
        if (key === "category" && value === "패턴비") {
          updated.yield     = "1";
          updated.yieldUnit = "EA";
          if (!updated.unitPrice) updated.unitPrice = "300";
        }
        return updated;
      }),
    }));
  }

  function removeMaterial(id: string) {
    setWo((w) => ({ ...w, materials: w.materials.filter((m) => m.id !== id) }));
  }

  // ─── 측정치 ───────────────────────────────────────────
  function updateMeasurement(idx: number, field: string, value: string) {
    setWo((w) => ({
      ...w,
      measurements: w.measurements.map((m, i) => {
        if (i !== idx) return m;
        if (field === "diff") return { ...m, diff: value };
        if (field === "item") return { ...m, item: value };
        return { ...m, values: { ...m.values, [field]: value } };
      }),
    }));
  }

  function addMeasurementRow() {
    setWo((w) => ({ ...w, measurements: [...w.measurements, { item: "", values: {}, diff: "" }] }));
  }

  function addMeasurementHeader() {
    setWo((w) => ({ ...w, measurements: [...w.measurements, { item: "상의", values: {}, diff: "", isHeader: true }] }));
  }

  function removeMeasurementRow(idx: number) {
    setWo((w) => ({ ...w, measurements: w.measurements.filter((_, i) => i !== idx) }));
  }

  // 사이즈스펙 드래그
  const mDragIdx = useRef<number | null>(null);
  const mDragOverIdx = useRef<number | null>(null);
  const [mDragOver, setMDragOver] = useState<number | null>(null);

  function onMDragStart(idx: number) { mDragIdx.current = idx; }
  function onMDragEnter(idx: number) { mDragOverIdx.current = idx; setMDragOver(idx); }
  function onMDragEnd() {
    const from = mDragIdx.current;
    const to = mDragOverIdx.current;
    if (from !== null && to !== null && from !== to) {
      setWo((w) => {
        const arr = [...w.measurements];
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        return { ...w, measurements: arr };
      });
    }
    mDragIdx.current = null; mDragOverIdx.current = null; setMDragOver(null);
  }

  // ─── 사이즈 목록 변경 ─────────────────────────────────
  function updateSizes(raw: string) {
    const sizes = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setWo((w) => ({ ...w, sizes }));
  }

  // ─── 엑셀 파일 업로드 ─────────────────────────────────
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxStatus("loading");
    setXlsxMsg("파일 분석 중...");

    const result = await parsePatternExcel(file);
    if (!result) {
      setXlsxStatus("error");
      setXlsxMsg("파일을 읽을 수 없습니다. 패턴실 엑셀 형식인지 확인하세요.");
      return;
    }

    setWo((w) => ({
      ...w,
      sizes: result.sizes,
      measurements: result.measurements,
      // 품명이 비어있으면 엑셀의 품명으로 자동기입
      productName: w.productName || result.productName,
      // 파일명을 SAMPLE NO.에 자동기입
      sampleNo: result.fileName,
    }));

    setXlsxStatus("ok");
    setXlsxMsg(`✓ "${result.fileName}" — ${result.measurements.length}개 항목, 사이즈 ${result.sizes.join("·")} 자동입력됨`);
    // 인풋 리셋 (같은 파일 재업로드 가능하도록)
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── 드라이브 검색 ────────────────────────────────────
  async function fetchDrive(q: string) {
    setDriveSearching(true);
    setDriveError(null);
    try {
      const url = q.trim() ? `/api/drive-search?q=${encodeURIComponent(q)}` : `/api/drive-search`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setDriveError(data.error); setDriveResults([]); setDriveTotal(null); }
      else { setDriveResults(data.files ?? []); setDriveTotal(data.total ?? null); }
    } catch (e) {
      setDriveError(String(e));
      setDriveResults([]);
      setDriveTotal(null);
    } finally {
      setDriveSearching(false);
    }
  }

  function searchDrive(q: string) {
    setDriveQuery(q);
    setDriveOpen(true);
    if (driveSearchTimer.current) clearTimeout(driveSearchTimer.current);
    if (!q.trim()) { setDriveResults([]); setDriveSearching(false); setDriveError(null); return; }
    driveSearchTimer.current = setTimeout(() => fetchDrive(q), 400);
  }

  async function loadDriveFile(fileId: string, fileName: string) {
    setDriveLoadingId(fileId);
    setDriveOpen(false);
    setXlsxStatus("loading");
    setXlsxMsg("드라이브에서 파일 불러오는 중...");
    try {
      const res = await fetch(`/api/drive-file?id=${fileId}`);
      if (!res.ok) throw new Error(await res.text());
      const buffer = await res.arrayBuffer();
      const file = new File([buffer], fileName, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const result = await parsePatternExcel(file);
      if (!result) throw new Error("파일 파싱 실패");
      setWo((w) => ({
        ...w,
        sizes: result.sizes,
        measurements: result.measurements,
        productName: w.productName || result.productName,
        sampleNo: result.fileName,
      }));
      setXlsxStatus("ok");
      setXlsxMsg(`✓ "${result.fileName}" — ${result.measurements.length}개 항목, 사이즈 ${result.sizes.join("·")} 자동입력됨`);
    } catch (e) {
      setXlsxStatus("error");
      setXlsxMsg(String(e));
    } finally {
      setDriveLoadingId(null);
    }
  }

  // ─── 이미지 업로드 ────────────────────────────────────
  function handleImageUpload(field: "sketchImage" | "productImage" | "labelImage", file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      set(field, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // ─── 저장 ─────────────────────────────────────────────
  function handleSave() {
    const e: Record<string, string> = {};
    if (!wo.productName) e.productName = "품명을 입력하세요";
    if (!wo.styleNo)     e.styleNo     = "스타일넘버를 입력하세요";
    if (Object.keys(e).length) { setErrors(e); setTab("기본정보"); return; }
    setErrors({});
    const now = new Date().toISOString();
    const saved: WorkOrder = {
      ...wo,
      id: wo.id || Date.now().toString(),
      createdAt: wo.createdAt || now,
      updatedAt: now,
    };
    onSave(saved);
  }

  // ─── 렌더 ─────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />목록으로
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <div className="font-bold text-gray-900 text-base">
              {initial ? "작업지시서 수정" : "새 작업지시서"}
            </div>
            {wo.styleNo && <div className="text-xs text-gray-400">{wo.styleNo} · {wo.productName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPreview(wo)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} />PDF 미리보기
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors"
          >
            <Save size={14} />저장
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab===t ? "bg-white text-pink-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >{t}</button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="bg-gray-50/50 rounded-2xl p-5">

        {/* ── 1. 기본정보 ── */}
        {tab === "기본정보" && (
          <div className="space-y-4">
            <SectionCard title="제품 기본 정보" sub="스타일넘버, 품명, 작업처 등 기본 정보를 입력하세요">
            <div className="grid grid-cols-3 gap-4">
              <Field label="스타일넘버" required>
                <input value={wo.styleNo} onChange={(e) => set("styleNo", e.target.value)}
                  placeholder="O26WJ07BC600" className={inputCls} />
                {errors.styleNo && <p className="text-xs text-red-500 mt-1">{errors.styleNo}</p>}
              </Field>
              <Field label="품명" required>
                <div className="relative">
                  <input value={wo.productName} onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="아우터-뉴플래시" className={inputCls} />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {notionFillStatus === "loading" && (
                      <Loader2 size={13} className="text-pink-400 animate-spin" />
                    )}
                    {notionFillStatus === "found" && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        <Sparkles size={10} />노션 연동됨
                      </span>
                    )}
                    {notionFillStatus === "notfound" && (
                      <span className="text-[10px] text-gray-300">노션 없음</span>
                    )}
                  </div>
                </div>
                {notionFillStatus === "found" && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    작업처·연도·시즌·카테고리·이미지·발주수량표(1차)가 자동으로 채워졌어요. 수정 가능합니다.
                  </p>
                )}
                {errors.productName && <p className="text-xs text-red-500 mt-1">{errors.productName}</p>}
              </Field>
              <Field label="카테고리">
                <SelectDropdown
                  presets={CATEGORIES}
                  value={wo.category}
                  onChange={(v) => set("category", v)}
                  placeholder="직접 입력 (예: 니트, 팬츠…)"
                />
              </Field>
              <Field label="작업처(업체명)">
                <SelectDropdown
                  presets={VENDORS}
                  value={wo.vendor}
                  onChange={(v) => set("vendor", v)}
                  placeholder="직접 입력"
                />
              </Field>
              <Field label="연도">
                <select value={wo.year} onChange={(e) => set("year", e.target.value)} className={selectCls}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="시즌">
                <select value={wo.season} onChange={(e) => set("season", e.target.value)} className={selectCls}>
                  {SEASONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="SAMPLE NO.">
                <input value={wo.sampleNo} onChange={(e) => set("sampleNo", e.target.value)}
                  placeholder="메직 - 실버후드패딩(그레이딩:26.06.02)" className={inputCls} />
              </Field>
              <Field label="차수">
                <input type="number" min={1} value={wo.orderCount}
                  onChange={(e) => set("orderCount", Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="상태">
                <select value={wo.status} onChange={(e) => set("status", e.target.value as WorkOrder["status"])} className={selectCls}>
                  <option value="draft">작성중</option>
                  <option value="pending_confirm">컨펌대기</option>
                  <option value="completed">완료</option>
                  <option value="custom">직접입력</option>
                </select>
                {wo.status === "custom" && (
                  <input
                    value={wo.customStatus || ""}
                    onChange={(e) => set("customStatus", e.target.value)}
                    placeholder="상태 직접 입력..."
                    className={`${inputCls} mt-1.5`}
                  />
                )}
              </Field>
              <Field label="노션 제품DB 링크">
                <input
                  value={wo.notionProductId || ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    // URL에서 페이지 ID 추출 (notion.so/xxx-xxxxxxxx 형식)
                    const match = raw.match(/([a-f0-9]{32})/i) || raw.match(/notion\.so\/(?:[^/]+-)?([a-f0-9-]{36})/i);
                    const id = match ? match[1].replace(/-/g, "") : raw;
                    set("notionProductId", id || raw);
                  }}
                  placeholder="노션 페이지 URL 또는 ID를 붙여넣으세요"
                  className={inputCls}
                />
                {wo.notionProductId && (
                  <a
                    href={`https://www.notion.so/${wo.notionProductId.replace(/-/g,"")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pink-500 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    노션에서 열기 →
                  </a>
                )}
              </Field>
            </div>
            </SectionCard>

            {/* ── 발주수량 (기본정보 내) ── */}
            <SectionCard title="컬러 × 사이즈 발주 수량표" sub="컬러별, 사이즈별 발주 수량을 입력하세요">
              <div className="flex items-center justify-end mb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-gray-500">총</span>
                    <span className="font-bold text-pink-700 text-lg">{wo.totalQuantity.toLocaleString()}</span>
                    <span className="text-gray-500">장</span>
                  </div>
                  <button onClick={addColorRow}
                    className="flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors">
                    <Plus size={14} />컬러 추가
                  </button>
                </div>
              </div>
              {wo.colorSizeTable.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl py-10 flex flex-col items-center text-center">
                  <div className="text-gray-300 text-3xl mb-3">🎨</div>
                  <div className="text-sm text-gray-400 mb-4">발주 수량표가 비어 있습니다</div>
                  <button onClick={addColorRow}
                    className="flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors">
                    <Plus size={14} />컬러 추가
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-[120px]">컬러</th>
                        {wo.sizes.map((s) => (
                          <th key={s} className="border border-gray-200 px-4 py-2.5 text-center text-xs font-semibold text-gray-600 min-w-[70px]">{s}</th>
                        ))}
                        <th className="border border-gray-200 px-4 py-2.5 text-center text-xs font-semibold text-pink-600 min-w-[70px]">합계</th>
                        <th className="border border-gray-200 px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.colorSizeTable.map((row, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-200 p-1">
                            <input value={row.color}
                              onChange={(e) => updateColorSize(idx, "color", e.target.value)}
                              placeholder="퍼플, 핑크…"
                              className="w-full px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent" />
                          </td>
                          {wo.sizes.map((s) => (
                            <td key={s} className="border border-gray-200 p-1">
                              <input type="number" min={0}
                                value={row.sizes[s] || ""}
                                onChange={(e) => updateColorSize(idx, s, e.target.value)}
                                className="w-full px-2 py-1.5 text-sm text-center rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent" />
                            </td>
                          ))}
                          <td className="border border-gray-200 p-1 text-center font-bold text-pink-700">{row.total}</td>
                          <td className="border border-gray-200 p-1 text-center">
                            <button onClick={() => removeColorRow(idx)}
                              className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-pink-50">
                        <td className="border border-gray-200 px-4 py-2 font-bold text-xs text-gray-600">TOTAL</td>
                        {wo.sizes.map((s) => (
                          <td key={s} className="border border-gray-200 px-4 py-2 text-center font-bold text-xs text-gray-700">
                            {wo.colorSizeTable.reduce((sum, r) => sum + (r.sizes[s] || 0), 0)}
                          </td>
                        ))}
                        <td className="border border-gray-200 px-4 py-2 text-center font-bold text-pink-700">{wo.totalQuantity}</td>
                        <td className="border border-gray-200"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="담당자 & 일정">
              <div className="grid grid-cols-3 gap-4">
                <Field label="담당자">
                  <SelectDropdown
                    presets={MANAGERS}
                    value={wo.manager}
                    onChange={(v) => set("manager", v)}
                    placeholder="직접 입력"
                  />
                </Field>
                <Field label="실장">
                  <input value={wo.director} onChange={(e) => set("director", e.target.value)} placeholder="임은영(ANNA)" className={inputCls} />
                </Field>
                <Field label="작성일">
                  <input type="date" value={wo.issueDate} onChange={(e) => set("issueDate", e.target.value)} className={inputCls} />
                </Field>
                <Field label="생산이관일">
                  <input type="date" value={wo.productionDate} onChange={(e) => set("productionDate", e.target.value)} className={inputCls} />
                </Field>
                <Field label="납품예정일">
                  <input type="date" value={wo.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} className={inputCls} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="비용 및 원가" sub={`작업처 타입: ${{ china:"중국 위안 계산", outsourcing:"완사입 (VAT포함)", domestic:"국내 공임 계산", india:"인도 달러→원 환산", other:"직접 입력" }[getVendorType(wo.vendor)]}`}>
              {(() => {
                const vtype = getVendorType(wo.vendor);
                const matSum = calcMaterialsSum(wo.materials);
                const sp = wo.salePrice;
                const setSale = (v: string) => set("salePrice", v);

                // ── 중국 (오중생산) ────────────────────────────────────
                if (vtype === "china") {
                  return <CostLayout finalCost={0} salePrice={sp} onSaleChange={setSale} inputCls={inputCls} cost={
                    <div className="border border-amber-200 rounded-2xl bg-amber-50 px-5 py-4 space-y-1 h-full">
                      <div className="text-xs text-amber-600 font-semibold">소재+부자재 합계 (단가×요척)</div>
                      <div className="text-2xl font-bold text-amber-700">{fmtCNY(matSum)}</div>
                      <div className="text-[11px] text-amber-400">원부자재 탭 단가(위안)·요척 입력 시 자동계산</div>
                    </div>
                  } />;
                }

                // ── 완사입 (코니키즈 등) ───────────────────────────────
                if (vtype === "outsourcing") {
                  const basePrice = parseFloat(wo.totalCost?.replace(/,/g, "") || "0");
                  const vatExcl = basePrice > 0 ? basePrice / 1.1 : 0;
                  const total = basePrice + matSum;
                  return <CostLayout finalCost={total} salePrice={sp} onSaleChange={setSale} inputCls={inputCls} cost={
                    <div className="border border-pink-200 rounded-2xl bg-pink-50/60 px-5 py-4 space-y-2">
                      <div className="text-xs text-pink-600 font-semibold mb-1">납품가 (VAT 포함)</div>
                      <input value={wo.totalCost} onChange={(e) => set("totalCost", e.target.value)}
                        placeholder="23,500" className={inputCls} />
                      {vatExcl > 0 && <div className="text-[11px] text-gray-400">(VAT제외: {Math.round(vatExcl).toLocaleString()}원)</div>}
                      {matSum > 0 && (
                        <div className="border-t border-pink-200 pt-2 text-xs text-pink-600">
                          <span className="font-semibold">추가 부자재</span> +{fmtKRW(matSum)}
                        </div>
                      )}
                      {total > 0 && (
                        <div className="border-t border-pink-200 pt-2 flex items-baseline gap-2">
                          <span className="text-xs text-pink-500 font-semibold">총 원가</span>
                          <span className="text-xl font-bold text-pink-700">{fmtKRW(total)}</span>
                        </div>
                      )}
                    </div>
                  } />;
                }

                // ── 인도 (CEEDEE) ─────────────────────────────────────
                if (vtype === "india") {
                  const usdPrice = parseFloat(wo.totalCost?.replace(/,/g, "") || "0");
                  const usdToKrwVal = usdPrice * usdToKrw;
                  const total = usdToKrwVal + matSum;
                  return <CostLayout finalCost={total} salePrice={sp} onSaleChange={setSale} inputCls={inputCls} cost={
                    <div className="border border-teal-200 rounded-2xl bg-teal-50/60 px-5 py-4 space-y-2">
                      <div className="text-xs text-teal-600 font-semibold mb-1">달러 금액 ($)</div>
                      <input value={wo.totalCost} onChange={(e) => set("totalCost", e.target.value)}
                        placeholder="12.50" className={inputCls} />
                      {usdPrice > 0 && (
                        <div className="text-[11px] text-gray-500">
                          = {fmtKRW(usdToKrwVal)}
                          <span className="ml-1 text-gray-400">({rateDate} 1$={Math.round(usdToKrw).toLocaleString()}원)</span>
                        </div>
                      )}
                      {matSum > 0 && (
                        <div className="border-t border-teal-200 pt-2 text-xs text-teal-600">
                          <span className="font-semibold">추가 원부자재</span> +{fmtKRW(matSum)}
                        </div>
                      )}
                      {total > 0 && (
                        <div className="border-t border-teal-200 pt-2">
                          <div className="text-[11px] text-teal-400 mb-0.5">
                            {fmtUSD(usdPrice)} × {Math.round(usdToKrw).toLocaleString()}원{matSum > 0 ? ` + 부자재 ${fmtKRW(matSum)}` : ""}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-teal-500 font-semibold">최종 원가</span>
                            <span className="text-xl font-bold text-teal-700">{fmtKRW(total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  } />;
                }

                // ── 국내 공임 (민주·내주) ─────────────────────────────
                if (vtype === "domestic") {
                  const laborVal = parseFloat(wo.laborCost?.replace(/,/g, "") || "0");
                  const packVal  = parseFloat(wo.packagingCost?.replace(/,/g, "") || "0");
                  const subtotal = matSum + laborVal + packVal;
                  const totalVat = subtotal * 1.1;
                  return <CostLayout finalCost={totalVat} salePrice={sp} onSaleChange={setSale} inputCls={inputCls} cost={
                    <div className="border border-violet-200 rounded-2xl bg-violet-50/60 px-5 py-4 space-y-2">
                      <div className="text-xs text-violet-600 font-semibold">원부자재 합계 (단가×요척)</div>
                      <div className="text-base font-bold text-violet-700">{fmtKRW(matSum)}</div>
                      <div className="grid grid-cols-2 gap-3 border-t border-violet-200 pt-2">
                        <div>
                          <div className="text-xs text-violet-500 font-semibold mb-1">공임비</div>
                          <input value={wo.laborCost} onChange={(e) => set("laborCost", e.target.value)} placeholder="5,000" className={inputCls} />
                        </div>
                        <div>
                          <div className="text-xs text-violet-500 font-semibold mb-1">포장비</div>
                          <input value={wo.packagingCost} onChange={(e) => set("packagingCost", e.target.value)} placeholder="500" className={inputCls} />
                        </div>
                      </div>
                      {subtotal > 0 && (
                        <div className="border-t border-violet-200 pt-2">
                          <div className="text-[11px] text-violet-400 mb-0.5">({fmtKRW(matSum)} + {fmtKRW(laborVal)} + {fmtKRW(packVal)}) × 1.1</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-violet-500 font-semibold">VAT포함 총 원가</span>
                            <span className="text-xl font-bold text-violet-700">{fmtKRW(totalVat)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  } />;
                }

                // ── 기타 / 직접입력 ────────────────────────────────────
                const directCost = parseFloat(wo.totalCost?.replace(/,/g, "") || "0");
                return <CostLayout finalCost={directCost} salePrice={sp} onSaleChange={setSale} inputCls={inputCls} cost={
                  <div className="border border-gray-200 rounded-2xl bg-gray-50 px-5 py-4">
                    <div className="text-xs text-gray-500 font-semibold mb-1">원가 (VAT 포함)</div>
                    <input value={wo.totalCost} onChange={(e) => set("totalCost", e.target.value)} placeholder="23,500원" className={inputCls} />
                  </div>
                } />;
              })()}
            </SectionCard>

            {/* ── 이미지 업로드 ── */}
            <SectionCard title="이미지" sub="도식화와 제품 사진을 등록하세요 — PDF에 자동 삽입됩니다">
              <div className="grid grid-cols-2 gap-5">

                {/* 도식화 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">도식화 이미지</div>
                    {wo.sketchImage && (
                      <button
                        type="button"
                        onClick={analyzeSketch}
                        disabled={analyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
                        style={{ background: analyzing ? "#e5e7eb" : "linear-gradient(135deg, #f472b6, #fb7185)", color: analyzing ? "#9ca3af" : "white" }}
                      >
                        {analyzing ? (
                          <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full" />분석 중...</>
                        ) : (
                          <>✨ AI 원부자재 자동분석</>
                        )}
                      </button>
                    )}
                  </div>
                  {analyzeResult && (
                    <div className={`text-xs px-3 py-2 rounded-xl ${analyzeResult.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {analyzeResult}
                    </div>
                  )}
                  {wo.sketchImage ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={wo.sketchImage} alt="도식화"
                        className="w-full object-contain"
                        style={{ maxHeight: "360px", minHeight: "200px" }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                        <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-white text-gray-800 text-xs font-medium rounded-lg shadow hover:bg-gray-50">
                          <Upload size={12} />교체
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload("sketchImage", f); }} />
                        </label>
                        <button onClick={() => set("sketchImage", "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 shadow">
                          <X size={12} />삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-pink-300 hover:bg-pink-50/30 transition-all"
                      style={{ minHeight: "280px" }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleImageUpload("sketchImage", f);
                      }}
                    >
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload("sketchImage", f); }} />
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <ImagePlus size={22} className="text-gray-400" />
                      </div>
                      <div className="text-sm font-semibold text-gray-400">도식화 이미지 업로드</div>
                      <div className="text-xs text-gray-300 mt-1">클릭 또는 드래그&드롭</div>
                    </label>
                  )}
                </div>

                {/* 제품 사진 */}
                <div className="space-y-2 flex flex-col">
                  <div className="text-xs font-semibold text-gray-600">제품 사진</div>
                  {wo.productImage ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={wo.productImage} alt="제품사진"
                        className="w-full object-contain"
                        style={{ maxHeight: "180px", minHeight: "120px" }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                        <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-white text-gray-800 text-xs font-medium rounded-lg shadow hover:bg-gray-50">
                          <Upload size={12} />교체
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload("productImage", f); }} />
                        </label>
                        <button onClick={() => set("productImage", "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 shadow">
                          <X size={12} />삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-pink-300 hover:bg-pink-50/30 transition-all flex-1"
                      style={{ minHeight: "160px" }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleImageUpload("productImage", f);
                      }}
                    >
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload("productImage", f); }} />
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                        <ImagePlus size={18} className="text-gray-400" />
                      </div>
                      <div className="text-sm font-semibold text-gray-400">제품 사진 업로드</div>
                      <div className="text-xs text-gray-300 mt-1">클릭 또는 드래그&드롭</div>
                    </label>
                  )}
                </div>

              </div>
            </SectionCard>
          </div>
        )}

        {/* ── 2. 사이즈스펙 ── */}
        {tab === "사이즈스펙" && (
          <div className="space-y-4">
            <SectionCard
              title="사이즈 스펙"
              sub="패턴실 엑셀 파일 업로드 또는 직접 입력"
              action={
                <Field label="사이즈 목록 (쉼표로 구분)">
                  <input value={wo.sizes.join(", ")}
                    onChange={(e) => updateSizes(e.target.value)}
                    placeholder="100, 110, 120, 130, 140"
                    className={inputCls + " w-56"} />
                </Field>
              }
            >

            {/* 드라이브 검색 */}
            <div className="relative mb-3">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-100 transition">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  value={driveQuery}
                  onChange={(e) => searchDrive(e.target.value)}
                  onFocus={() => { if (driveQuery) setDriveOpen(true); }}
                  placeholder="패턴 파일명으로 검색 (예: OF2501_티셔츠)"
                  className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-300"
                />
                {driveSearching && (
                  <div className="w-4 h-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                {driveQuery && !driveSearching && (
                  <button type="button" onClick={() => { setDriveQuery(""); setDriveResults([]); setDriveOpen(false); }}
                    className="text-gray-300 hover:text-gray-500 shrink-0"><X size={13} /></button>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between pl-1">
                <span className="text-[11px] text-gray-400">구글 드라이브 패턴실 폴더에서 유사한 파일을 자동으로 찾아줍니다</span>
                <button type="button" onClick={() => { setDriveOpen(true); fetchDrive(""); }}
                  className="text-[11px] text-pink-500 hover:text-pink-700 transition-colors">
                  전체 목록 보기
                </button>
              </div>

              {/* 검색 결과 드롭다운 */}
              {driveOpen && (driveResults.length > 0 || driveError || (!driveSearching && driveQuery)) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
                  {driveError ? (
                    <div className="px-4 py-3 text-xs text-red-500 whitespace-pre-wrap">{driveError}</div>
                  ) : driveResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400 text-center">
                      일치하는 파일 없음 (40% 이상 유사도 기준)
                      {driveTotal !== null && (
                        <div className="text-xs text-gray-300 mt-1">폴더에서 총 {driveTotal}개 파일 확인됨</div>
                      )}
                      {driveTotal === 0 && (
                        <div className="text-xs text-orange-400 mt-1">⚠ 폴더 접근 권한을 확인해주세요</div>
                      )}
                    </div>
                  ) : (
                    driveResults.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={driveLoadingId === f.id}
                        onClick={() => loadDriveFile(f.id, f.name)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-pink-50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet size={14} className="text-green-500 shrink-0" />
                          <span className="text-sm text-gray-700 truncate group-hover:text-pink-700">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {f.score !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-500 font-medium">
                              {Math.round(f.score * 100)}%
                            </span>
                          )}
                          {driveLoadingId === f.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download size={13} className="text-gray-300 group-hover:text-pink-400" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 엑셀 업로드 영역 */}
            <div
              className="border-2 border-dashed border-indigo-200 rounded-2xl p-5 bg-pink-50/40 hover:bg-pink-50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelUpload}
              />
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  xlsxStatus === "ok" ? "bg-green-100" : xlsxStatus === "error" ? "bg-red-100" : "bg-indigo-100"
                }`}>
                  {xlsxStatus === "loading" ? (
                    <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                  ) : xlsxStatus === "ok" ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : xlsxStatus === "error" ? (
                    <AlertCircle size={20} className="text-red-500" />
                  ) : (
                    <FileSpreadsheet size={20} className="text-pink-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${
                    xlsxStatus === "ok" ? "text-green-700" : xlsxStatus === "error" ? "text-red-600" : "text-pink-700"
                  }`}>
                    {xlsxStatus === "idle"    && "패턴실 엑셀 파일 업로드"}
                    {xlsxStatus === "loading" && "파일 분석 중..."}
                    {xlsxStatus === "ok"      && "자동 입력 완료"}
                    {xlsxStatus === "error"   && "파일 오류"}
                  </div>
                  <div className={`text-xs mt-0.5 truncate ${
                    xlsxStatus === "ok" ? "text-green-600" : xlsxStatus === "error" ? "text-red-500" : "text-pink-400"
                  }`}>
                    {xlsxStatus === "idle"
                      ? ".xlsx 파일을 드래그하거나 클릭해서 선택 — 파일명이 SAMPLE NO.에, 사이즈 스펙이 표에 자동 입력됩니다"
                      : xlsxMsg}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-xs font-medium rounded-lg hover:bg-pink-600 transition-colors"
                >
                  <Upload size={13} />파일 선택
                </button>
              </div>
            </div>

            {/* 스펙 테이블 */}
            <div className="overflow-x-auto mt-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-1 py-2 w-6"></th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 w-32">항목</th>
                    {wo.sizes.map((s) => (
                      <th key={s} className="border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600 w-20">{s}</th>
                    ))}
                    <th className="border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600 w-16">편차</th>
                    <th className="border border-gray-200 px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {wo.measurements.map((m, idx) => m.isHeader ? (
                    // ── 구분 헤더 행 ──
                    <tr key={idx}
                      onDragEnter={() => onMDragEnter(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      className={`bg-pink-50 border-t-2 border-indigo-200${mDragOver === idx ? " opacity-50" : ""}`}>
                      <td draggable
                        onDragStart={() => onMDragStart(idx)}
                        onDragEnd={onMDragEnd}
                        className="border border-gray-200 p-1 text-center cursor-grab text-gray-300 select-none">⠿</td>
                      <td colSpan={wo.sizes.length + 2} className="border border-gray-200 p-1">
                        <input value={m.item}
                          onChange={(e) => updateMeasurement(idx, "item", e.target.value)}
                          placeholder="구분명 입력 (예: 상의, 하의, 모자)"
                          className="w-full px-2 py-1 text-xs font-bold text-pink-700 rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent" />
                      </td>
                      <td className="border border-gray-200 p-1 text-center">
                        <button onClick={() => removeMeasurementRow(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ) : (
                    // ── 일반 측정 행 ──
                    <tr key={idx}
                      onDragEnter={() => onMDragEnter(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      className={`${idx % 2 === 0 ? "" : "bg-gray-50/50"}${mDragOver === idx ? " opacity-50" : ""}`}>
                      <td draggable
                        onDragStart={() => onMDragStart(idx)}
                        onDragEnd={onMDragEnd}
                        className="border border-gray-200 p-1 text-center cursor-grab text-gray-300 select-none">⠿</td>
                      <td className="border border-gray-200 p-1">
                        <input value={m.item}
                          onChange={(e) => updateMeasurement(idx, "item", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent font-medium" />
                      </td>
                      {wo.sizes.map((s) => (
                        <td key={s} className="border border-gray-200 p-1">
                          <input value={m.values[s] || ""}
                            onChange={(e) => updateMeasurement(idx, s, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs text-center rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent" />
                        </td>
                      ))}
                      <td className="border border-gray-200 p-1">
                        <input value={m.diff}
                          onChange={(e) => updateMeasurement(idx, "diff", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs text-center rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent" />
                      </td>
                      <td className="border border-gray-200 p-1 text-center">
                        <button onClick={() => removeMeasurementRow(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={addMeasurementRow}
                  className="flex items-center gap-1.5 text-sm text-pink-600 hover:text-pink-700 transition-colors">
                  <Plus size={14} />항목 추가
                </button>
                <button onClick={addMeasurementHeader}
                  className="flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-600 transition-colors border border-indigo-200 rounded px-2 py-0.5">
                  <Plus size={12} />구분 추가
                </button>
              </div>
              {wo.measurements.length > 0 && (
                <span className="text-xs text-gray-400">{wo.measurements.filter(m => !m.isHeader).length}개 항목</span>
              )}
            </div>
            </SectionCard>
          </div>
        )}

        {/* ── 3. 원부자재 ── */}
        {tab === "원부자재" && (
          <div className="space-y-4">
            <SectionCard
              title="원단 및 부자재"
              sub="요척, 단가, 발주단위 등을 입력하세요"
              action={
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 border border-pink-200 rounded-xl bg-pink-50">
                    <span className="text-xs text-pink-500 font-semibold whitespace-nowrap">✨ 품종 자동입력</span>
                    <select
                      value={templateType}
                      onChange={(e) => {
                        setTemplateType(e.target.value);
                        if (e.target.value) applyTemplate(e.target.value);
                      }}
                      className="text-xs text-gray-600 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="">품종 선택</option>
                      {Object.keys(MATERIAL_TEMPLATES).map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={addMaterial}
                    className="flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors">
                    <Plus size={14} />항목 추가
                  </button>
                </div>
              }
            >

            {wo.materials.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center text-center">
                <div className="text-gray-300 text-3xl mb-3">🧵</div>
                <div className="text-sm text-gray-400 mb-4">원단/부자재 항목이 없습니다</div>
                <button onClick={addMaterial}
                  className="flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors">
                  <Plus size={14} />첫 항목 추가
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table ref={matTableRef} className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 w-7" />
                      {["품목", "자재명", "색상", "규격", "요척", "단위", "단가", "단발주", "비고", ""].map((h) => (
                        <th key={h} className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wo.materials.map((m, idx) => (
                      <tr key={m.id}
                        onDragEnter={() => onDragEnter(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        className={`transition-colors ${
                          dragOver === idx
                            ? "bg-pink-50 border-t-2 border-t-indigo-400"
                            : dragIdx.current === idx
                            ? "opacity-40"
                            : ""
                        }`}
                      >
                        {/* 드래그 핸들만 draggable */}
                        <td draggable
                          onDragStart={() => onDragStart(idx)}
                          onDragEnd={onDragEnd}
                          className="border border-gray-200 p-1 text-center cursor-grab active:cursor-grabbing select-none">
                          <span className="text-gray-300 hover:text-gray-500 text-xs leading-none" title="드래그하여 순서 변경">
                            ⠿
                          </span>
                        </td>
                        {/* 품목 — fixed 드롭다운 (overflow 컨테이너 탈출) */}
                        <td
                          className="border border-gray-200 p-1 min-w-[120px]"
                          ref={(el) => { if (el) (el as any)._matId = m.id; }}
                        >
                          <div className="flex items-center gap-0.5">
                            <input
                              value={m.category}
                              onChange={(e) => updateMaterial(m.id, "category", e.target.value)}
                              onFocus={(e) => {
                                const td = e.currentTarget.closest("td")!;
                                const r = td.getBoundingClientRect();
                                setCatPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 180) });
                                setCatOpen(m.id);
                              }}
                              onBlur={() => setTimeout(() => setCatOpen(null), 200)}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent"
                              placeholder="-- 선택 또는 입력 --"
                            />
                            <button type="button" tabIndex={-1}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const td = e.currentTarget.closest("td")!;
                                const r = td.getBoundingClientRect();
                                setCatPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 180) });
                                setCatOpen(v => v === m.id ? null : m.id);
                              }}
                              className="flex-shrink-0 text-gray-300 hover:text-gray-500 px-0.5">
                              <ChevronDown size={11} />
                            </button>
                          </div>
                        </td>
                        {/* 자재명 — 안감 계열이면 fixed 드롭다운 */}
                        <td className="border border-gray-200 p-1 min-w-[110px]">
                          {m.category.includes("안감") ? (
                            <div className="flex items-center gap-0.5">
                              <input value={m.name}
                                onChange={(e) => updateMaterial(m.id, "name", e.target.value)}
                                onFocus={(e) => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setNamePos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width + 24, 160) });
                                  setNameOpen(m.id);
                                }}
                                onBlur={() => setTimeout(() => setNameOpen(null), 150)}
                                onKeyDown={handleMatKeyDown}
                                className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent"
                                placeholder="자재명"
                              />
                              <button type="button" tabIndex={-1}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setNamePos({ top: r.bottom + 2, left: r.left - 140, width: 160 });
                                  setNameOpen(v => v === m.id ? null : m.id);
                                }}
                                className="flex-shrink-0 text-gray-300 hover:text-gray-500 px-0.5">
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          ) : (
                            <input value={m.name}
                              onChange={(e) => updateMaterial(m.id, "name", e.target.value)}
                              onKeyDown={handleMatKeyDown}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent"
                              placeholder="반사우본"
                            />
                          )}
                        </td>
                        {/* 색상, 규격 */}
                        {(["color","spec"] as const).map((f) => (
                          <td key={f} className="border border-gray-200 p-1">
                            <input value={m[f]}
                              onChange={(e) => updateMaterial(m.id, f, e.target.value)}
                              onKeyDown={handleMatKeyDown}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent min-w-[80px]"
                              placeholder={f === "color" ? "BLACK" : "60\""}
                            />
                          </td>
                        ))}
                        {/* 요척 숫자 + YD→M 변환 버튼 */}
                        <td className="border border-gray-200 p-1 min-w-[90px]">
                          <div className="flex items-center gap-0.5">
                            <input value={m.yield}
                              onChange={(e) => updateMaterial(m.id, "yield", e.target.value)}
                              onKeyDown={handleMatKeyDown}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent"
                              placeholder="1.5"
                            />
                            {/* YD↔M 변환 버튼 */}
                            {(m.yieldUnit === "YD" || m.yieldUnit === "M") && (
                              <button
                                type="button"
                                title={m.yieldUnit === "YD" ? "YD → M 변환" : "M → YD 변환"}
                                onClick={() => {
                                  const n = parseFloat(m.yield);
                                  if (isNaN(n)) return;
                                  if (m.yieldUnit === "YD") {
                                    updateMaterial(m.id, "yield", (n * 0.9144).toFixed(3));
                                    updateMaterial(m.id, "yieldUnit", "M");
                                  } else {
                                    updateMaterial(m.id, "yield", (n / 0.9144).toFixed(3));
                                    updateMaterial(m.id, "yieldUnit", "YD");
                                  }
                                }}
                                className="flex-shrink-0 px-1 py-0.5 text-[9px] font-bold rounded bg-pink-50 text-pink-500 hover:bg-pink-100 whitespace-nowrap leading-none"
                              >
                                {m.yieldUnit === "YD" ? "→M" : "→YD"}
                              </button>
                            )}
                          </div>
                        </td>
                        {/* 단위 — 드롭다운 또는 직접입력 */}
                        <td className="border border-gray-200 p-1 min-w-[90px]">
                          {unitDirect[m.id] ? (
                            <div className="flex items-center gap-0.5">
                              <input
                                value={m.yieldUnit}
                                onChange={(e) => updateMaterial(m.id, "yieldUnit", e.target.value)}
                                placeholder="단위 입력"
                                autoFocus
                                className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent"
                              />
                              <button type="button"
                                onClick={() => { setUnitDirect(p => ({ ...p, [m.id]: false })); updateMaterial(m.id, "yieldUnit", "YD"); }}
                                className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-[10px] leading-none px-0.5" title="목록으로">✕</button>
                            </div>
                          ) : (
                            <select
                              value={m.yieldUnit || "YD"}
                              onChange={(e) => {
                                if (e.target.value === "직접입력") {
                                  setUnitDirect(p => ({ ...p, [m.id]: true }));
                                  updateMaterial(m.id, "yieldUnit", "");
                                } else {
                                  updateMaterial(m.id, "yieldUnit", e.target.value);
                                }
                              }}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent cursor-pointer"
                            >
                              {YIELD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          )}
                        </td>
                        {/* 단가, 단발주, 비고 */}
                        {(["unitPrice","orderUnit","notes"] as const).map((f) => (
                          <td key={f} className="border border-gray-200 p-1">
                            <input value={m[f]}
                              onChange={(e) => updateMaterial(m.id, f, e.target.value)}
                              onKeyDown={handleMatKeyDown}
                              className="w-full px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-pink-300 bg-transparent min-w-[70px]"
                              placeholder={f === "unitPrice" ? "단가" : f === "orderUnit" ? "1EA" : ""}
                            />
                          </td>
                        ))}
                        <td className="border border-gray-200 p-1 text-center">
                          <button onClick={() => removeMaterial(m.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </SectionCard>
          </div>
        )}

        {/* ── 4. 라벨·기타 ── */}
        {tab === "라벨·기타" && (
          <div className="space-y-4">

            {/* 라벨 구성 */}
            <SectionCard title="라벨 구성" sub="부착할 라벨/태그를 선택하세요">
              <div className="grid grid-cols-4 gap-3">
                {(Object.entries({
                  main:         "메인라벨",
                  care:         "케어라벨",
                  reorderInfo:  "취급주의라벨",
                  priceTag:     "가격택",
                  qualityTag:   "품질보증택",
                  polybag:      "폴리백",
                  wappen:       "와펜",
                  pointLabel:   "포인트라벨",
                  artworkLabel: "아트웍라벨",
                }) as [keyof WorkOrder["labels"], string][]).map(([key, label]) => (
                  <label key={key}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      wo.labels[key] ? "border-pink-400 bg-pink-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <input type="checkbox" checked={wo.labels[key]}
                      onChange={(e) => set("labels", { ...wo.labels, [key]: e.target.checked })}
                      className="accent-pink-500" />
                    <span className={`text-sm font-medium ${wo.labels[key] ? "text-pink-700" : "text-gray-600"}`}>{label}</span>
                  </label>
                ))}
              </div>

              {wo.customLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {wo.customLabels.map((name, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-pink-400 bg-pink-50">
                      <span className="text-sm font-medium text-pink-700">{name}</span>
                      <button
                        type="button"
                        onClick={() => set("customLabels", wo.customLabels.filter((_, j) => j !== i))}
                        className="text-indigo-300 hover:text-red-400 transition-colors ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <CustomLabelInput
                  onAdd={(name) => {
                    if (name && !wo.customLabels.includes(name)) {
                      set("customLabels", [...wo.customLabels, name]);
                    }
                  }}
                />
              </div>
            </SectionCard>

            {/* 라벨 위치 다이어그램 */}
            <SectionCard
              title="라벨 위치 다이어그램"
              sub="체크한 항목만 PDF에 삽입됩니다. 이미지에 마우스를 올려 업로드하세요."
            >
              <LabelDiagramSection
                selected={wo.labelDiagramSelected ?? []}
                onChange={(ids) => set("labelDiagramSelected", ids)}
              />
            </SectionCard>

            {/* 비고/기타 작성란 */}
            <SectionCard title="비고 / 기타 작성란" sub="PDF 하단 좌측 — 제품이미지 옆 비고란">
              <textarea value={wo.productionNotes}
                onChange={(e) => set("productionNotes", e.target.value)}
                rows={4}
                placeholder="비고, 특이사항 등"
                className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 resize-none placeholder:text-gray-300`}
              />
            </SectionCard>

            {/* 고정값 문구 (순수사항) */}
            <SectionCard title="고정값 문구 (순수사항)" sub="PDF 하단 좌측 하단 — 매 작업지시서에 공통으로 들어가는 문구">
              <textarea value={wo.fixedNotes}
                onChange={(e) => set("fixedNotes", e.target.value)}
                rows={6}
                className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 resize-none font-mono placeholder:text-gray-300`}
              />
            </SectionCard>

            {/* 원부자재 업체 정보 */}
            <SectionCard title="원부자재 업체 정보" sub="PDF 우측 하단 — 거래 업체명, 연락처 등">
              <textarea value={wo.vendorNotes}
                onChange={(e) => set("vendorNotes", e.target.value)}
                rows={4}
                placeholder={"예)\n원단: OO텍스타일 010-0000-0000\n지퍼: OO지퍼 02-000-0000"}
                className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 resize-none placeholder:text-gray-300`}
              />
            </SectionCard>

          </div>
        )}

        {/* ── 6. 첨부파일 ── */}
        {tab === "첨부파일" && (
          <div className="space-y-4">
            <SectionCard
              title="원부자재별 첨부파일"
              sub="원부자재 탭에서 입력한 각 항목별로 스와치 사진·링크를 첨부하세요 (PDF에는 포함되지 않음)"
            >
              {wo.materials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                  <Paperclip size={28} className="mb-2 text-gray-300" />
                  <p className="text-sm font-medium">원부자재가 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1">먼저 원부자재 탭에서 자재를 추가해주세요</p>
                  <button onClick={() => setTab("원부자재" as Tab)}
                    className="mt-4 px-4 py-2 text-xs text-pink-600 border border-indigo-200 rounded-xl hover:bg-pink-50 transition-colors">
                    원부자재 탭으로 이동
                  </button>
                </div>
              ) : (
                <MaterialAttachList
                  materials={wo.materials.filter((mat) =>
                    !["중국위안", "완사입가(VAT+)", "최종원가", "패턴비"].includes(mat.category?.trim()) &&
                    !["중국위안", "완사입가(VAT+)", "최종원가", "패턴비"].includes(mat.name?.trim())
                  )}
                  attachments={wo.attachments ?? []}
                  onChange={(atts) => set("attachments", atts)}
                />
              )}
            </SectionCard>
          </div>
        )}
      </div>

      {/* 품목 fixed 드롭다운 */}
      {catOpen && (
        <div
          style={{ position: "fixed", top: catPos.top, left: catPos.left, width: Math.max(catPos.width, 200), zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto"
        >
          {MATERIAL_CATEGORIES.map((c) => (
            <button key={c} type="button"
              onMouseDown={(e) => { e.preventDefault(); updateMaterial(catOpen, "category", c); setCatOpen(null); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 hover:text-pink-700 transition-colors text-gray-700">
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 안감 자재명 fixed 드롭다운 */}
      {nameOpen && (
        <div
          style={{ position: "fixed", top: namePos.top, left: namePos.left, width: namePos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto"
        >
          {LINING_NAMES.map((n) => (
            <button key={n} type="button"
              onMouseDown={() => {
                if (n !== "직접입력") updateMaterial(nameOpen, "name", n);
                setNameOpen(null);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-pink-50 hover:text-pink-700 transition-colors ${
                n === "직접입력" ? "text-pink-500 font-semibold border-t border-gray-100" : "text-gray-700"
              }`}>
              {n}
            </button>
          ))}
        </div>
      )}

      {/* 하단 저장 버튼 */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          취소
        </button>
        <button onClick={() => onPreview(wo)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <Printer size={14} />PDF 미리보기
        </button>
        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-5 py-2 bg-pink-500 text-white text-sm font-semibold rounded-xl hover:bg-pink-600 transition-colors">
          <Save size={14} />저장
        </button>
      </div>
    </div>
  );
}
