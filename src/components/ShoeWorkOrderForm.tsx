"use client";
import { useState, useRef, useEffect } from "react";
import { Search, Plus, Trash2, Save, Eye, Upload } from "lucide-react";
import type { ShoeWorkOrder, ShoeColorSizeRow, ShoeSpec } from "@/types";

// ── 기본값 상수 ─────────────────────────────────────────────
const DEFAULT_SIZES = ["150", "160", "170", "180", "190", "200"];

const DEFAULT_CAUTIONS = `장식 떨어지지 않도록 튼튼하게 고정해주세요
글리터 원단, 가루 떨어지지 않도록 신경써서 작업해주세요
LED 좌우 센서 불량건 없는지 확인 후 포장 진행 해주세요
접합 부위에 본드 자국이 노출이 되지 않도록 깨끗이 마감 될 수 있도록 해주세요
아동 착용 제품으로, 마감 및 위험 부분이 없도록 깨끗이 마감 될 수 있게해주세요`;

const SPEC_DEFAULTS: [string, string][] = [
  ["외피",     "원단명"],
  ["내피",     "샘플동일"],
  ["로고위치", "인솔에 불박"],
  ["가격택",   "1 EA"],
  ["바코드택", "1 EA"],
  ["간지",     "1 EA"],
  ["인박스",   "1 EA"],
  ["택끈",     "1 EA"],
  ["폴리백",   "1 EA"],
  ["별봉",     "1 EA"],
  ["LED",      "1 EA"],
];

function emptyShoeOrder(): ShoeWorkOrder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    board: "슈즈",
    category: "슈즈",
    styleNo: "",
    productName: "",
    vendor: "",
    season: "",
    orderCount: 1,
    manager: "",
    director: "",
    orderDate: now.slice(0, 10),
    deliveryDate: "",
    vendorUnitPrice: "",
    productImage: "",
    detailImage: "",
    sizes: [...DEFAULT_SIZES],
    colorSizeTable: [],
    totalQuantity: 0,
    suppliedMaterials: "제공 없음",
    cautions: DEFAULT_CAUTIONS,
    specs: SPEC_DEFAULTS.map(([item, value], i) => ({
      id: `spec_${i}`,
      item,
      value,
    })),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

// ── 공통 UI 컴포넌트 ────────────────────────────────────────
function SectionCard({
  title,
  accentColor = "#ec4899",
  children,
}: {
  title: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100"
        style={{ background: "linear-gradient(135deg, #fff8fc 0%, #fff 100%)" }}>
        <div className="w-1 h-4 rounded-full" style={{ background: accentColor }} />
        <span className="text-sm font-bold text-gray-800">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 w-full ${className}`}
    />
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
interface Props {
  initial?: ShoeWorkOrder | null;
  onSave: (wo: ShoeWorkOrder) => void;
  onCancel: () => void;
  onPreview: (wo: ShoeWorkOrder) => void;
}

export default function ShoeWorkOrderForm({ initial, onSave, onCancel, onPreview }: Props) {
  const [wo, setWo] = useState<ShoeWorkOrder>(() =>
    initial ? { ...initial } : emptyShoeOrder()
  );
  const [notionStatus, setNotionStatus] = useState<
    "idle" | "loading" | "found" | "notfound"
  >("idle");
  const notionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const detailImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial) setWo({ ...initial });
    else setWo(emptyShoeOrder());
  }, [initial]);

  function set<K extends keyof ShoeWorkOrder>(key: K, value: ShoeWorkOrder[K]) {
    setWo((w) => ({ ...w, [key]: value }));
  }

  // ── 노션 이미지 URL → base64 변환 (만료 URL 문제 방지) ────────
  async function fetchImageAsBase64(url: string): Promise<string> {
    try {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) return url; // 프록시 실패 시 원본 URL 유지
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }

  // ── 노션 자동완성 ──────────────────────────────────────────
  async function lookupNotion(name: string) {
    if (!name.trim() || name.trim().length < 2) {
      setNotionStatus("idle");
      return;
    }
    setNotionStatus("loading");
    try {
      const res = await fetch(
        `/api/notion-product-lookup?q=${encodeURIComponent(name.trim())}`
      );
      const data = await res.json();
      if (!data) { setNotionStatus("notfound"); return; }
      setNotionStatus("found");

      // 노션 이미지 URL을 base64로 변환해서 저장 (만료 URL 문제 방지)
      let imageUrl = data.imageUrl || "";
      if (imageUrl && !imageUrl.startsWith("data:")) {
        imageUrl = await fetchImageAsBase64(imageUrl);
      }

      setWo((prev) => ({
        ...prev,
        notionProductId: prev.notionProductId || data.notionProductId || "",
        vendor:         prev.vendor || data.vendor || "",
        season:         prev.season || data.season || "",
        productImage:   prev.productImage || imageUrl,
        sizes:          prev.colorSizeTable.length > 0
          ? prev.sizes
          : data.sizes?.length
            ? data.sizes
            : DEFAULT_SIZES,
        colorSizeTable: prev.colorSizeTable.length > 0
          ? prev.colorSizeTable
          : (data.colorSizeTable ?? []),
        totalQuantity:  prev.colorSizeTable.length > 0
          ? prev.totalQuantity
          : (data.totalQuantity ?? 0),
      }));
    } catch {
      setNotionStatus("notfound");
    }
  }

  function handleProductNameChange(name: string) {
    set("productName", name);
    if (notionTimer.current) clearTimeout(notionTimer.current);
    setNotionStatus("idle");
    notionTimer.current = setTimeout(() => lookupNotion(name), 700);
  }

  // ── 색상×사이즈 테이블 ─────────────────────────────────────
  function colTotal(sz: string) {
    return wo.colorSizeTable.reduce((s, r) => s + (r.sizes[sz] || 0), 0);
  }

  function addColor() {
    const newRow: ShoeColorSizeRow = {
      color: "",
      sizes: Object.fromEntries(wo.sizes.map((s) => [s, 0])),
      total: 0,
    };
    setWo((w) => ({ ...w, colorSizeTable: [...w.colorSizeTable, newRow] }));
  }

  function removeColor(idx: number) {
    setWo((w) => {
      const next = w.colorSizeTable.filter((_, i) => i !== idx);
      return {
        ...w,
        colorSizeTable: next,
        totalQuantity: next.reduce((s, r) => s + r.total, 0),
      };
    });
  }

  function updateColorRow(idx: number, field: string, value: string | number) {
    setWo((w) => {
      const next = w.colorSizeTable.map((row, i) => {
        if (i !== idx) return row;
        if (field === "color") return { ...row, color: value as string };
        const sizes = { ...row.sizes, [field]: Number(value) || 0 };
        const total = Object.values(sizes).reduce((s, v) => s + v, 0);
        return { ...row, sizes, total };
      });
      return {
        ...w,
        colorSizeTable: next,
        totalQuantity: next.reduce((s, r) => s + r.total, 0),
      };
    });
  }

  function addSizeColumn() {
    const input = prompt("추가할 사이즈를 입력하세요 (예: 210)");
    const newSz = input?.trim();
    if (!newSz) return;
    setWo((w) => ({
      ...w,
      sizes: [...w.sizes, newSz],
      colorSizeTable: w.colorSizeTable.map((row) => ({
        ...row,
        sizes: { ...row.sizes, [newSz]: 0 },
      })),
    }));
  }

  // ── 이미지 업로드 ──────────────────────────────────────────
  function handleImageFile(file: File, field: "productImage" | "detailImage" = "productImage") {
    const reader = new FileReader();
    reader.onload = (e) => set(field, e.target?.result as string ?? "");
    reader.readAsDataURL(file);
  }

  // ── 제품 사양 ──────────────────────────────────────────────
  function updateSpec(id: string, field: "item" | "value", value: string) {
    setWo((w) => ({
      ...w,
      specs: w.specs.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  }

  function removeSpec(id: string) {
    setWo((w) => ({ ...w, specs: w.specs.filter((s) => s.id !== id) }));
  }

  function addSpec() {
    setWo((w) => ({
      ...w,
      specs: [...w.specs, { id: crypto.randomUUID(), item: "", value: "" }],
    }));
  }

  // ── 저장 ──────────────────────────────────────────────────
  function handleSave() {
    onSave({ ...wo, updatedAt: new Date().toISOString() });
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── 본문 ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-5">

        {/* ── 노션 제품 DB 자동완성 ───────────────────────────── */}
        <SectionCard title="노션 제품 DB 자동완성" accentColor="#7c3aed">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={wo.productName}
                onChange={(e) => handleProductNameChange(e.target.value)}
                placeholder="제품명을 입력하면 노션 DB에서 발주수량·작업처·대표사진을 자동으로 불러옵니다"
                className="border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-full"
              />
            </div>
            {notionStatus === "loading" && (
              <span className="text-xs text-purple-500 animate-pulse whitespace-nowrap">검색 중…</span>
            )}
            {notionStatus === "found" && (
              <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ 자동완성 완료</span>
            )}
            {notionStatus === "notfound" && (
              <span className="text-xs text-red-500 whitespace-nowrap">결과 없음</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            * 발주수량(색상/사이즈), 작업처, 대표사진이 자동으로 입력됩니다. 자동 입력된 값도 모두 직접 수정 가능합니다.
          </p>
        </SectionCard>

        {/* ── 기본 정보 ────────────────────────────────────────── */}
        <SectionCard title="기본 정보">
          <div className="grid grid-cols-3 gap-4">
            <Field label="STYLE NO">
              <Inp value={wo.styleNo} onChange={(v) => set("styleNo", v)} placeholder="예) SH-2026-001" />
            </Field>
            <Field label="상품명">
              <Inp value={wo.productName} onChange={(v) => handleProductNameChange(v)} placeholder="제품명" />
            </Field>
            <Field label="차수">
              <input
                type="number"
                min={1}
                value={wo.orderCount}
                onChange={(e) => set("orderCount", Number(e.target.value) || 1)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 w-full"
              />
            </Field>
            <Field label="작업처">
              <Inp value={wo.vendor} onChange={(v) => set("vendor", v)} placeholder="공장명" />
            </Field>
            <Field label="담당">
              <Inp value={wo.manager} onChange={(v) => set("manager", v)} placeholder="담당자명" />
            </Field>
            <Field label="실장">
              <Inp value={wo.director} onChange={(v) => set("director", v)} placeholder="실장명" />
            </Field>
            <Field label="시즌">
              <Inp value={wo.season} onChange={(v) => set("season", v)} placeholder="예) 여름·겨울·사계절" />
            </Field>
            <Field label="발주일">
              <Inp value={wo.orderDate} onChange={(v) => set("orderDate", v)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="입고 예정일">
              <Inp value={wo.deliveryDate} onChange={(v) => set("deliveryDate", v)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="업체단가">
              <Inp value={wo.vendorUnitPrice} onChange={(v) => set("vendorUnitPrice", v)} placeholder="예) ₩15,000" />
            </Field>
          </div>
        </SectionCard>

        {/* ── 대표사진 + 발주수량 ─────────────────────────────── */}
        <SectionCard title="대표사진 & 디테일사진 & 발주 수량">
          <div className="flex gap-6 items-start">

            {/* 대표사진 + 디테일사진 (세로 배치) */}
            <div className="flex flex-col gap-3 shrink-0" style={{ width: "180px" }}>
              {/* 대표사진 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500">대표사진</span>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-pink-300 transition-colors flex items-center justify-center"
                  style={{ height: "140px", background: "#fafafa" }}
                  onClick={() => imageInputRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.type.startsWith("image/")) handleImageFile(file, "productImage");
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {wo.productImage ? (
                    <img
                      src={wo.productImage}
                      alt="대표사진"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!wo.notionProductId || img.dataset.retried) return;
                        img.dataset.retried = "1";
                        fetch(`/api/notion-image?pageId=${wo.notionProductId}`)
                          .then(r => r.json())
                          .then(({ url }) => { if (url) { img.src = url; set("productImage", url); } })
                          .catch(() => {});
                      }}
                    />
                  ) : (
                    <div className="text-center text-gray-400 text-xs px-4">
                      <Upload size={18} className="mx-auto mb-1 text-gray-300" />
                      클릭/드래그
                    </div>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "productImage"); }} />
                <input type="text"
                  value={wo.productImage.startsWith("data:") ? "" : wo.productImage}
                  onChange={(e) => set("productImage", e.target.value)}
                  placeholder="URL 직접 입력"
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>

              {/* 디테일사진 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500">디테일사진</span>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-blue-300 transition-colors flex items-center justify-center"
                  style={{ height: "140px", background: "#fafafa" }}
                  onClick={() => detailImageInputRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.type.startsWith("image/")) handleImageFile(file, "detailImage");
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {wo.detailImage ? (
                    <img src={wo.detailImage} alt="디테일사진" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-gray-400 text-xs px-4">
                      <Upload size={18} className="mx-auto mb-1 text-gray-300" />
                      클릭/드래그
                    </div>
                  )}
                </div>
                <input ref={detailImageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "detailImage"); }} />
                <input type="text"
                  value={wo.detailImage?.startsWith("data:") ? "" : (wo.detailImage ?? "")}
                  onChange={(e) => set("detailImage", e.target.value)}
                  placeholder="URL 직접 입력"
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>

            {/* 발주수량 테이블 */}
            <div className="flex-1 overflow-x-auto min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">발주 수량 (색상 × 사이즈)</span>
                <div className="flex gap-2">
                  <button
                    onClick={addSizeColumn}
                    className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-2 py-1 transition-colors"
                  >
                    + 사이즈 추가
                  </button>
                  <button
                    onClick={addColor}
                    className="text-xs text-violet-500 hover:text-pink-700 border border-pink-200 rounded-lg px-2 py-1 transition-colors"
                  >
                    + 색상 추가
                  </button>
                </div>
              </div>
              <table className="w-full border-collapse text-xs" style={{ minWidth: "380px" }}>
                <thead>
                  <tr>
                    <th className="border border-gray-200 px-2 py-1.5 bg-gray-50 font-semibold text-gray-600 text-left" style={{ width: "80px" }}>
                      COLOR
                    </th>
                    {wo.sizes.map((sz) => (
                      <th key={sz} className="border border-gray-200 px-2 py-1.5 bg-gray-50 font-semibold text-gray-600 text-center">
                        {sz}
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-1.5 bg-blue-50 font-semibold text-blue-600 text-center">
                      계
                    </th>
                    <th className="border border-gray-200 px-1 py-1.5 bg-gray-50 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {wo.colorSizeTable.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-200 p-0">
                        <input
                          value={row.color}
                          onChange={(e) => updateColorRow(idx, "color", e.target.value)}
                          placeholder="색상명"
                          className="w-full px-2 py-1.5 text-xs focus:outline-none focus:bg-violet-50 bg-transparent"
                        />
                      </td>
                      {wo.sizes.map((sz) => (
                        <td key={sz} className="border border-gray-200 p-0">
                          <input
                            type="number"
                            min={0}
                            value={row.sizes[sz] ?? 0}
                            onChange={(e) => updateColorRow(idx, sz, e.target.value)}
                            className="w-full px-1 py-1.5 text-xs text-center focus:outline-none focus:bg-violet-50 bg-transparent"
                          />
                        </td>
                      ))}
                      <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-blue-600">
                        {row.total}
                      </td>
                      <td className="border border-gray-200 px-1 py-1 text-center">
                        <button
                          onClick={() => removeColor(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {wo.colorSizeTable.length === 0 && (
                    <tr>
                      <td
                        colSpan={wo.sizes.length + 3}
                        className="border border-gray-200 px-4 py-6 text-center text-gray-400 text-xs"
                      >
                        색상을 추가하거나 제품명을 입력해 노션에서 자동으로 불러오세요
                      </td>
                    </tr>
                  )}
                  {wo.colorSizeTable.length > 0 && (
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1.5 font-semibold text-gray-600 text-center text-xs">
                        계
                      </td>
                      {wo.sizes.map((sz) => (
                        <td key={sz} className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-xs">
                          {colTotal(sz)}
                        </td>
                      ))}
                      <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-blue-700">
                        {wo.totalQuantity}
                      </td>
                      <td className="border border-gray-200" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        {/* ── 오즈키즈 제공 부자재 + 주의사항 ─────────────────── */}
        <div className="grid grid-cols-2 gap-5">
          <SectionCard title="오즈키즈 제공 부자재" accentColor="#0ea5e9">
            <textarea
              value={wo.suppliedMaterials}
              onChange={(e) => set("suppliedMaterials", e.target.value)}
              rows={5}
              placeholder="제공되는 부자재를 입력하거나 '제공 없음'으로 입력"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </SectionCard>
          <SectionCard title="주의 사항 (빨간 글씨로 PDF 표시)" accentColor="#ef4444">
            <textarea
              value={wo.cautions}
              onChange={(e) => set("cautions", e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 text-red-600"
            />
          </SectionCard>
        </div>

        {/* ── 제품 사양 ─────────────────────────────────────────── */}
        <SectionCard title="제품 사양" accentColor="#10b981">
          <div className="grid grid-cols-2 gap-3">
            {wo.specs.map((spec) => (
              <div key={spec.id} className="flex items-center gap-2">
                <input
                  value={spec.item}
                  onChange={(e) => updateSpec(spec.id, "item", e.target.value)}
                  placeholder="항목명"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50 font-semibold shrink-0"
                  style={{ width: "110px" }}
                />
                <input
                  value={spec.value}
                  onChange={(e) => updateSpec(spec.id, "value", e.target.value)}
                  placeholder="값 입력"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 flex-1 min-w-0"
                />
                <button
                  onClick={() => removeSpec(spec.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addSpec}
            className="mt-3 flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border border-green-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Plus size={12} /> 사양 항목 추가
          </button>
        </SectionCard>

        {/* ── 하단 버튼 ─────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={() => onPreview(wo)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Eye size={14} />PDF 미리보기
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 transition-colors">
            <Save size={14} />저장
          </button>
        </div>

      </div>
    </div>
  );
}
