"use client";
import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, FileText, PenLine,
  ChevronDown, Edit3, Trash2,
  CheckCircle2, Clock, Settings2, Check, X,
  ExternalLink, Loader2, SlidersHorizontal
} from "lucide-react";
import type { WorkOrder } from "@/types";

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:           { label: "작성중",   bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400"   },
  pending_confirm: { label: "컨펌대기", bg: "bg-violet-50",  text: "text-violet-600", dot: "bg-violet-400"  },
  completed:       { label: "완료",     bg: "bg-emerald-50", text: "text-emerald-600",dot: "bg-emerald-500" },
  custom:          { label: "기타",     bg: "bg-purple-50",  text: "text-purple-600", dot: "bg-purple-400"  },
  // 구버전 호환
  issued:          { label: "발행완료", bg: "bg-blue-50",    text: "text-blue-600",   dot: "bg-blue-400"    },
  in_production:   { label: "생산중",   bg: "bg-green-50",   text: "text-green-600",  dot: "bg-green-500"   },
};

const STATUS_OPTIONS: { value: WorkOrder["status"]; label: string }[] = [
  { value: "draft",           label: "작성중"   },
  { value: "pending_confirm", label: "컨펌대기" },
  { value: "completed",       label: "완료"     },
  { value: "custom",          label: "직접입력" },
];

const SEASONS = ["전체", "봄", "여름", "가을", "겨울", "사계절"];
const YEARS   = ["전체", "2026", "2025", "2024", "2023"];
const STATUS_FILTER_OPTIONS = [
  { label: "전체",     value: "전체"           },
  { label: "작성중",   value: "draft"           },
  { label: "컨펌대기", value: "pending_confirm" },
  { label: "완료",     value: "completed"       },
];

function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const isFiltered = value !== "전체" && value !== options[0]?.value;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
          isFiltered
            ? "bg-[#836CE0] text-white border-[#836CE0]"
            : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600"
        }`}
      >
        <span className={`text-[10px] font-semibold ${isFiltered ? "text-violet-200" : "text-gray-400"}`}>{label}</span>
        <span>{isFiltered ? selected?.label : "전체"}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[110px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                value === opt.value
                  ? "bg-violet-50 text-violet-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 의류/슈즈 카테고리 분류 키워드
const SHOE_KEYWORDS = ["슈즈", "신발", "부츠", "샌들", "스니커", "로퍼", "플랫", "힐", "슬리퍼"];

function getCategoryGroup(wo: WorkOrder): "의류" | "슈즈" {
  const target = [wo.category, wo.productName, wo.styleNo].join(" ").toLowerCase();
  if (SHOE_KEYWORDS.some((k) => target.includes(k.toLowerCase()))) return "슈즈";
  return "의류";
}

interface Props {
  onNew: () => void;
  onEdit: (wo: WorkOrder) => void;
  onPreview: (wo: WorkOrder) => void;
  categoryFilter?: "전체" | "의류" | "슈즈";
}

export default function WorkOrderList({ onNew, onEdit, onPreview, categoryFilter = "전체" }: Props) {
  const [orders, setOrders]       = useState<WorkOrder[]>([]);
  const [search, setSearch]       = useState("");
  const [yearFilter, setYear]     = useState("전체");
  const [seasonFilter, setSeason] = useState("전체");
  const [statusFilter, setStatus] = useState<string>("전체");
  const [managerFilter, setManager] = useState("전체");
  const [vendorFilter, setVendor]   = useState("전체");

  // 노션 제품명 → 페이지 URL 맵 (1시간 캐시)
  const CACHE_KEY = "notion_map_cache";
  const CACHE_TTL = 60 * 60 * 1000; // 1시간

  const [notionMap, setNotionMap] = useState<Record<string, string>>({});
  const [notionLoading, setNotionLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, map } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) {
          setNotionMap(map);
          if (Object.keys(map).length > 0) { setNotionLoading(false); return; }
        }
      }
    } catch {}
    fetch("/api/notion-search")
      .then((r) => r.json())
      .then((map: Record<string, string>) => {
        setNotionMap(map);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map })); } catch {}
      })
      .catch(() => {})
      .finally(() => setNotionLoading(false));
  }, []);

  // 실장 승인자 이름 (설정값, 변경 가능)
  const [directorName, setDirectorName] = useState<string>("임은영(ANNA)");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("setting_directorName");
      if (saved) setDirectorName(saved);
    } catch {}
  }, []);
  const [editingDirector, setEditingDirector] = useState(false);
  const [directorInput, setDirectorInput]     = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // localStorage 캐시로 즉시 표시 (로딩 중 빈 화면 방지)
    try {
      const raw = localStorage.getItem("workOrders");
      if (raw) setOrders(JSON.parse(raw));
    } catch {}

    // Supabase에서 최신 데이터 로드 (메인) — 브라우저 캐시 방지
    fetch("/api/work-orders", { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data);
          // localStorage 캐시 갱신
          try { localStorage.setItem("workOrders", JSON.stringify(data)); } catch {}
        }
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  function syncLocal(list: WorkOrder[]) {
    localStorage.setItem("workOrders", JSON.stringify(list));
  }

  async function deleteOrder(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    const next = orders.filter((o) => o.id !== id);
    setOrders(next);
    syncLocal(next);

    try {
      const res = await fetch(`/api/work-orders/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.deletedCount === 0) {
        alert(`삭제가 서버에 반영되지 않았습니다.\nid: ${id}\n관리자에게 문의해주세요.`);
      }
    } catch {
      alert("삭제 요청 실패 (네트워크). 다시 시도해주세요.");
    }

    // 서버 기준으로 최신 목록 재동기화 (localStorage 잔상 제거)
    try {
      const r = await fetch("/api/work-orders", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          setOrders(data);
          syncLocal(data);
        }
      }
    } catch {}
  }

  async function toggleApproval(id: string, approved: boolean) {
    const patch = {
      directorApproved: approved,
      status: approved ? "completed" : "pending_confirm" as WorkOrder["status"],
      updatedAt: new Date().toISOString(),
    };
    const next = orders.map((o) =>
      o.id !== id ? o : {
        ...o, ...patch,
        director: approved ? directorName : (o.director === directorName ? "" : o.director),
      }
    );
    setOrders(next);
    syncLocal(next);
    await fetch(`/api/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  async function updateStatus(id: string, status: WorkOrder["status"], customStatus?: string) {
    const patch = { status, customStatus: customStatus, updatedAt: new Date().toISOString() };
    const next = orders.map((o) =>
      o.id !== id ? o : { ...o, ...patch }
    );
    setOrders(next);
    syncLocal(next);
    await fetch(`/api/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  // ── 발주 DB 차수 팝업 ─────────────────────────────────────
  type Batch = {
    batch: string; batchNum: number; totalQuantity: number; orderDate: string;
    sizes?: string[];
    colorSizeTable?: { color: string; colorCode: string; sizes: Record<string, number>; total: number }[];
  };
  const [batchPopup, setBatchPopup] = useState<{
    id: string; loading: boolean; batches: Batch[]; error: boolean;
  } | null>(null);

  async function openBatchPopup(o: WorkOrder) {
    setBatchPopup({ id: o.id, loading: true, batches: [], error: false });
    try {
      const qs = o.notionProductId
        ? `pageId=${encodeURIComponent(o.notionProductId)}`
        : `name=${encodeURIComponent(o.productName || "")}`;
      const res = await fetch(`/api/order-batches?${qs}`, { cache: "no-store" });
      const data = await res.json();
      setBatchPopup({
        id: o.id,
        loading: false,
        batches: Array.isArray(data.batches) ? data.batches : [],
        error: false,
      });
    } catch {
      setBatchPopup({ id: o.id, loading: false, batches: [], error: true });
    }
  }

  // 차수 선택 → 총 발주수량 + 발주일 + 차수 + 색상×사이즈 표 반영 후 저장
  async function applyBatch(id: string, b: Batch) {
    setBatchPopup(null); // 선택 즉시 모달 닫기
    const patch: Record<string, unknown> = {
      orderCount: b.batchNum,
      totalQuantity: b.totalQuantity,
      issueDate: b.orderDate,   // 의류 PDF 날짜 필드
      orderDate: b.orderDate,   // 슈즈 날짜 필드
      updatedAt: new Date().toISOString(),
    };
    // 색상×사이즈 표가 있으면 함께 반영
    if (b.colorSizeTable && b.colorSizeTable.length > 0) {
      patch.colorSizeTable = b.colorSizeTable;
      if (b.sizes && b.sizes.length > 0) patch.sizes = b.sizes;
    }
    const next = orders.map((o) => (o.id !== id ? o : { ...o, ...patch }));
    setOrders(next);
    syncLocal(next);
    await fetch(`/api/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  function saveDirectorName() {
    const name = directorInput.trim();
    if (!name) return;
    setDirectorName(name);
    localStorage.setItem("setting_directorName", name);
    setEditingDirector(false);
    setDirectorInput("");
  }

  // 드롭다운 옵션 동적 생성
  const yearOptions  = ["전체", ...Array.from(new Set(orders.map(o => o.year).filter(Boolean))).sort((a,b) => b.localeCompare(a))];
  const managerOpts  = ["전체", ...Array.from(new Set(orders.map(o => o.manager).filter(Boolean))).sort()];
  const vendorOpts   = ["전체", ...Array.from(new Set(orders.map(o => o.vendor).filter(Boolean))).sort()];

  const activeFilterCount = [yearFilter, seasonFilter, statusFilter, managerFilter, vendorFilter].filter(v => v !== "전체").length;

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      o.productName.toLowerCase().includes(q) ||
      o.styleNo.toLowerCase().includes(q) ||
      o.vendor.toLowerCase().includes(q);
    const matchYear    = yearFilter    === "전체" || o.year    === yearFilter;
    const matchSeason  = seasonFilter  === "전체" || o.season  === seasonFilter;
    const matchStatus  = statusFilter  === "전체" || o.status  === statusFilter;
    const matchManager  = managerFilter  === "전체" || o.manager === managerFilter;
    const matchVendor   = vendorFilter   === "전체" || o.vendor  === vendorFilter;
    const matchCategory = categoryFilter === "전체" || getCategoryGroup(o) === categoryFilter;
    return matchQ && matchYear && matchSeason && matchStatus && matchManager && matchVendor && matchCategory;
  });

  const totalQty = filtered.reduce((s, o) => s + (o.totalQuantity || 0), 0);

  // 팝업 대상 작업지시서 (모달 헤더 표시용)
  const batchTarget = batchPopup ? orders.find((o) => o.id === batchPopup.id) : null;

  return (
    <div className="space-y-5">
      {/* ── 발주 DB 차수 선택 모달 ─────────────────────────── */}
      {batchPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setBatchPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-800">발주 DB 차수 선택</div>
                <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">
                  {batchTarget?.productName || ""}
                </div>
              </div>
              <button
                onClick={() => setBatchPopup(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none px-2"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto">
              {batchPopup.loading ? (
                <div className="px-5 py-8 text-sm text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> 발주 DB 조회 중...
                </div>
              ) : batchPopup.batches.length === 0 ? (
                <div className="px-5 py-8 text-sm text-gray-400 text-center">
                  {batchPopup.error ? "조회에 실패했습니다" : "발주 내역이 없습니다"}
                </div>
              ) : (
                <div className="py-1">
                  {batchPopup.batches.map((b) => {
                    const selected = batchTarget?.orderCount === b.batchNum;
                    return (
                      <button
                        key={b.batch}
                        onClick={() => applyBatch(batchPopup.id, b)}
                        className={`w-full text-left px-5 py-3 text-sm flex items-center gap-3 transition-colors border-b border-gray-50 ${
                          selected ? "bg-violet-100" : "hover:bg-violet-50"
                        }`}
                      >
                        <span className="w-4 text-violet-600 font-bold">{selected ? "✓" : ""}</span>
                        <span className={`font-bold w-12 ${selected ? "text-violet-800" : "text-violet-700"}`}>{b.batch}</span>
                        <span className="text-gray-800 font-semibold flex-1 text-right">
                          {b.totalQuantity.toLocaleString()}장
                        </span>
                        <span className="text-gray-400 text-xs w-24 text-right">{b.orderDate || "—"}</span>
                        {selected && (
                          <span className="text-[10px] font-bold text-violet-600 bg-white border border-violet-200 rounded-full px-1.5 py-0.5 ml-1">현재</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supabase 연결 오류 배너 */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          ⚠️ 서버 저장소 연결 실패 — Vercel 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)를 확인해주세요. 현재 로컬 캐시를 표시 중입니다.
        </div>
      )}

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "전체 작업지시서",
            value: filtered.length,
            icon: FileText,
            iconBg: "bg-violet-100",
            iconColor: "text-violet-500",
            numColor: "text-gray-800",
          },
          {
            label: "작성중",
            value: filtered.filter(o => o.status === "draft").length,
            icon: PenLine,
            iconBg: "bg-gray-100",
            iconColor: "text-gray-500",
            numColor: "text-gray-600",
          },
          {
            label: "컨펌대기",
            value: filtered.filter(o => o.status === "pending_confirm").length,
            icon: Clock,
            iconBg: "bg-amber-100",
            iconColor: "text-amber-500",
            numColor: "text-violet-600",
          },
          {
            label: "완료",
            value: filtered.filter(o => o.status === "completed").length,
            icon: CheckCircle2,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-500",
            numColor: "text-emerald-600",
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
                <Icon size={20} className={c.iconColor} />
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-0.5">{c.label}</div>
                <div className={`text-2xl font-bold ${c.numColor}`}>{c.value}<span className="text-sm font-semibold ml-0.5">건</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 필터 + 검색 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="스타일넘버, 품명, 업체 검색..."
              className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
            />
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors" style={{ background: "#836CE0" }} onMouseOver={e=>(e.currentTarget.style.background="#7c3aed")} onMouseOut={e=>(e.currentTarget.style.background="#836CE0")}
          >
            <Plus size={14} />새 작업지시서
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-gray-400">
            <SlidersHorizontal size={13} />
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 bg-[#836CE0] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </div>

          <FilterDropdown
            label="년도" value={yearFilter}
            options={yearOptions.map(y => ({ label: y, value: y }))}
            onChange={setYear}
          />
          <FilterDropdown
            label="시즌" value={seasonFilter}
            options={SEASONS.map(s => ({ label: s, value: s }))}
            onChange={setSeason}
          />
          <FilterDropdown
            label="디자이너" value={managerFilter}
            options={managerOpts.map(m => ({ label: m, value: m }))}
            onChange={setManager}
          />
          <FilterDropdown
            label="작업처" value={vendorFilter}
            options={vendorOpts.map(v => ({ label: v, value: v }))}
            onChange={setVendor}
          />
          <FilterDropdown
            label="진행상태" value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatus}
          />

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setYear("전체"); setSeason("전체"); setStatus("전체"); setManager("전체"); setVendor("전체"); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-xl hover:border-red-200 transition-colors"
            >
              <X size={10} />필터 초기화
            </button>
          )}

          {filtered.length !== orders.length && (
            <span className="ml-auto text-xs text-gray-400">{filtered.length}건 표시 중</span>
          )}
        </div>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl py-24 flex flex-col items-center justify-center text-center border border-dashed border-gray-200">
          <FileText size={32} className="text-gray-300 mb-3" />
          <div className="text-sm font-medium text-gray-400 mb-1">
            {orders.length === 0 ? "작업지시서가 없습니다" : "검색 결과가 없습니다"}
          </div>
          <div className="text-xs text-gray-300 mb-5">
            {orders.length === 0 ? "새 작업지시서를 작성해 보세요" : "검색 조건을 변경해 보세요"}
          </div>
          {orders.length === 0 && (
            <button onClick={onNew}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors" style={{ background: "#836CE0" }} onMouseOver={e=>(e.currentTarget.style.background="#7c3aed")} onMouseOut={e=>(e.currentTarget.style.background="#836CE0")}
            >
              <Plus size={14} />첫 작업지시서 작성
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["스타일넘버", "품명", "이미지", "시즌", "차수", "총수량", "작업처", "담당", "미리보기", "상태"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-violet-500 whitespace-nowrap">
                  {editingDirector ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        value={directorInput}
                        onChange={(e) => setDirectorInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveDirectorName(); if (e.key === "Escape") setEditingDirector(false); }}
                        placeholder={directorName}
                        autoFocus
                        className="w-20 px-1.5 py-0.5 text-xs border border-violet-300 rounded-lg focus:outline-none focus:border-violet-400 text-gray-800 font-normal"
                      />
                      <button onClick={saveDirectorName} className="text-violet-600 hover:text-violet-700"><Check size={12} /></button>
                      <button onClick={() => setEditingDirector(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 justify-center">
                      <span>실장 승인</span>
                      <button
                        onClick={() => { setDirectorInput(directorName); setEditingDirector(true); }}
                        className="text-gray-300 hover:text-violet-500 transition-colors"
                        title="승인자 이름 변경"
                      ><Settings2 size={11} /></button>
                    </div>
                  )}
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const meta = STATUS_META[o.status] ?? STATUS_META["draft"];
                const displayLabel = o.status === "custom" ? (o.customStatus || "기타") : meta.label;
                return (
                  <tr key={o.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.styleNo || "—"}</td>
                    <td className="px-4 py-3" style={{ background: "rgba(245, 243, 255, 0.5)" }}>
                      {(() => {
                        // notionProductId 직접 링크 우선, 없으면 notionMap 이름 매칭
                        const directId = o.notionProductId?.replace(/-/g, "");
                        const notionUrl = directId
                          ? `https://www.notion.so/${directId}`
                          : notionMap[o.productName?.trim()];
                        return notionUrl ? (
                          <a
                            href={notionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-1 font-semibold text-gray-900 hover:text-gray-700 hover:underline transition-colors"
                          >
                            {o.productName}
                            <ExternalLink size={11} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                          </a>
                        ) : (
                          <div className="font-semibold text-gray-900 flex items-center gap-1">
                            {o.productName}
                            {notionLoading && <Loader2 size={10} className="text-gray-300 animate-spin" />}
                          </div>
                        );
                      })()}
                      <div className="text-xs text-gray-400">{o.year}년 {o.season}</div>
                    </td>
                    <td className="px-4 py-3">
                      {o.productImage ? (
                        <img
                          src={o.productImage}
                          alt={o.productName}
                          className="w-10 h-12 object-cover rounded-lg border border-gray-100"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (!o.notionProductId || img.dataset.retried) return;
                            img.dataset.retried = "1";
                            fetch(`/api/notion-image?pageId=${o.notionProductId}`)
                              .then(r => r.json())
                              .then(({ url }) => { if (url) img.src = url; })
                              .catch(() => {});
                          }}
                        />
                      ) : (
                        <div className="w-10 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-300 text-xs">없음</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{o.year}/{o.season}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openBatchPopup(o)}
                        title="발주 DB에서 차수 불러오기"
                        className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 hover:ring-1 hover:ring-violet-300 transition-all inline-flex items-center gap-1"
                      >
                        {o.orderCount}차
                        <ChevronDown size={10} className="opacity-60" />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{(o.totalQuantity||0).toLocaleString()}장</td>
                    <td className="px-4 py-3 text-gray-600">{o.vendor}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{o.manager}</td>
                    {/* 미리보기 */}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => onPreview(o)}
                        className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600 transition-colors"
                        title="작업지시서 미리보기 / PDF"
                      ><FileText size={15} /></button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative group/status">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${meta.bg} ${meta.text} hover:opacity-80 transition-opacity`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {displayLabel}
                          <ChevronDown size={10} className="opacity-50" />
                        </div>
                        {/* 드롭다운 */}
                        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[110px] hidden group-hover/status:block">
                          {STATUS_OPTIONS.map(opt => {
                            const m = STATUS_META[opt.value];
                            return (
                              <button key={opt.value}
                                onClick={() => updateStatus(o.id, opt.value)}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${o.status === opt.value ? "font-semibold" : ""}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                                <span className={m.text}>{opt.label}</span>
                              </button>
                            );
                          })}
                          {o.status === "custom" && (
                            <input
                              className="mx-2 mt-1 mb-1 px-2 py-1 text-xs border border-gray-200 rounded-lg w-[calc(100%-16px)] focus:outline-none focus:border-violet-400"
                              placeholder="직접 입력..."
                              defaultValue={o.customStatus || ""}
                              onBlur={(e) => updateStatus(o.id, "custom", e.target.value)}
                              onKeyDown={(e) => { if(e.key==="Enter") (e.target as HTMLInputElement).blur(); }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    {/* 실장 승인 체크박스 */}
                    <td className="px-4 py-3 text-center">
                      <label className="inline-flex flex-col items-center gap-1 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!o.directorApproved}
                          onChange={(e) => toggleApproval(o.id, e.target.checked)}
                          className="w-4 h-4 accent-violet-500 cursor-pointer"
                        />
                        {o.directorApproved && (
                          <span className="text-xs font-medium text-violet-600 whitespace-nowrap">{directorName}</span>
                        )}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(o)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
                          title="수정"
                        ><Edit3 size={14} /></button>
                        <button onClick={() => deleteOrder(o.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="삭제"
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">{filtered.length}개 작업지시서</span>
              <span className="text-xs font-semibold text-gray-600">총 {totalQty.toLocaleString()}장</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
