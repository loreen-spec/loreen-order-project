"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Loader2, ClipboardList, FilePlus, History } from "lucide-react";
import type { Product, WorkOrder } from "@/types";
import { getThisWeekSummary } from "@/lib/utils";
import Sidebar, { type SidebarPage } from "@/components/Sidebar";
import OrderManagement from "@/components/OrderManagement";
import WeekBanner from "@/components/WeekBanner";
import ArrivalCalendar from "@/components/ArrivalCalendar";
import DateDetailPanel from "@/components/DateDetailPanel";
import WeekVendorList from "@/components/WeekVendorList";
import DelayAlert from "@/components/DelayAlert";
import WorkOrderList from "@/components/WorkOrderList";
import WorkOrderForm from "@/components/WorkOrderForm";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";

const BOARDS = [
  { key: "전체", label: "전체" },
  { key: "의류", label: "의류" },
  { key: "슈즈", label: "슈즈" },
  { key: "잡화", label: "잡화" },
] as const;
type BoardKey = (typeof BOARDS)[number]["key"];

// ─── 준비중 페이지 ─────────────────────────────────────────
function ComingSoon({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-indigo-400" />
      </div>
      <div className="font-bold text-gray-700 text-lg mb-1">{title}</div>
      <div className="text-gray-400 text-sm">준비 중입니다</div>
    </div>
  );
}

// ─── 입고 캘린더 페이지 ────────────────────────────────────
function CalendarPage({ products, loading, fetching, error, onRefresh }: {
  products: Product[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [activeBoard, setActiveBoard] = useState<BoardKey>("전체");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateProducts, setSelectedDateProducts] = useState<Product[]>([]);

  const filtered = activeBoard === "전체" ? products : products.filter((p) => p.board === activeBoard);
  const weekSummary = getThisWeekSummary(filtered);

  const boardCounts = BOARDS.reduce((acc, b) => {
    acc[b.key] = b.key === "전체" ? products.length : products.filter((p) => p.board === b.key).length;
    return acc;
  }, {} as Record<string, number>);

  function handleDateSelect(date: string | null, prods: Product[]) {
    setSelectedDate(date);
    setSelectedDateProducts(date ? prods : []);
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-100">
          {BOARDS.map((b) => (
            <button
              key={b.key}
              onClick={() => setActiveBoard(b.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeBoard === b.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {b.label}
              <span className={`ml-1.5 text-[11px] font-semibold ${activeBoard === b.key ? "text-indigo-200" : "text-gray-300"}`}>
                {boardCounts[b.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {fetching && (
            <span className="flex items-center gap-1 text-xs text-indigo-500">
              <Loader2 size={12} className="animate-spin" /> 노션 동기화 중...
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={fetching}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50 bg-white border border-gray-100 px-3 py-1.5 rounded-lg"
          >
            <RefreshCw size={12} className={fetching ? "animate-spin" : ""} />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm text-amber-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-indigo-100 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-[480px] bg-white rounded-2xl animate-pulse" />
            <div className="h-[480px] bg-white rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* 이번 주 배너 */}
          <WeekBanner summary={weekSummary} />

          {/* 지연 알림 */}
          <DelayAlert products={filtered} />

          {/* 달력 + 날짜 상세 패널 (좌우 배치) */}
          <div className="grid grid-cols-2 gap-5 items-start">
            <ArrivalCalendar
              products={filtered}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
            {selectedDate ? (
              <DateDetailPanel
                date={selectedDate}
                products={selectedDateProducts}
                onClose={() => handleDateSelect(null, [])}
              />
            ) : (
              /* 날짜 미선택 시 플레이스홀더 */
              <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200">
                <div className="text-3xl mb-3">📅</div>
                <div className="text-sm font-medium text-gray-400 mb-1">날짜를 선택하세요</div>
                <div className="text-xs text-gray-300">달력에서 입고 날짜를 클릭하면<br />해당 제품 목록이 표시됩니다</div>
              </div>
            )}
          </div>

          {/* 이번 주 업체별 현황 (하단 전체 너비) */}
          <WeekVendorList products={filtered} />
        </>
      )}
    </div>
  );
}

// ─── 작업지시서 섹션 ──────────────────────────────────────
function WorkOrderSection({ initialPage }: { initialPage: "list" | "new" }) {
  const [view, setView]       = useState<"list" | "form" | "pdf">(initialPage === "new" ? "form" : "list");
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [previewing, setPreview] = useState<WorkOrder | null>(null);

  async function handleSave(wo: WorkOrder) {
    // Supabase 저장 (메인 저장소)
    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wo),
    });

    if (!res.ok) {
      alert("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // localStorage는 캐시로만 업데이트
    try {
      const raw = localStorage.getItem("workOrders");
      const all: WorkOrder[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((o) => o.id === wo.id);
      if (idx >= 0) all[idx] = wo; else all.unshift(wo);
      localStorage.setItem("workOrders", JSON.stringify(all));
    } catch {}

    setView("list");
    setEditing(null);
  }

  function handleEdit(wo: WorkOrder) {
    setEditing(wo);
    setView("form");
  }

  function handleNew() {
    setEditing(null);
    setView("form");
  }

  function handlePreview(wo: WorkOrder) {
    setPreview(wo);
  }

  return (
    <>
      {previewing && (
        <WorkOrderPDFView wo={previewing} onClose={() => setPreview(null)} />
      )}
      {view === "list" && (
        <WorkOrderList
          onNew={handleNew}
          onEdit={handleEdit}
          onPreview={handlePreview}
        />
      )}
      {view === "form" && (
        <WorkOrderForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setView("list"); setEditing(null); }}
          onPreview={handlePreview}
        />
      )}
    </>
  );
}

// ─── 메인 앱 ──────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState<SidebarPage>("입고캘린더");
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetching, setFetching]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function load(showFullLoader = false) {
    if (showFullLoader) setLoading(true);
    setFetching(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch("/api/products", { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("API 오류");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.name === "AbortError"
        ? "노션 응답이 느립니다. 잠시 후 새로고침 해주세요."
        : "노션 연결 실패. API 키와 데이터베이스를 확인해주세요.");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => { load(true); }, []);

  const PAGE_META: Record<SidebarPage, { title: string; sub: string }> = {
    "입고캘린더":    { title: "입고 캘린더",      sub: "노션 제품DB 기반 입고 일정 및 발주 현황" },
    "발주관리":      { title: "발주 관리",         sub: "진행 중인 발주 현황 관리" },
    "발주서작성":    { title: "발주서 작성",        sub: "신규 발주서 작성" },
    "발주이력":      { title: "발주 이력",          sub: "완료된 발주 이력 조회" },
    "작업지시서목록": { title: "작업지시서",         sub: "제품별 작업지시서 아카이브 및 관리" },
    "작업지시서작성": { title: "새 작업지시서 작성", sub: "원단·부자재·발주수량 입력 후 PDF 자동 생성" },
  };

  const isWorkOrder = activePage === "작업지시서목록" || activePage === "작업지시서작성";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f8f9fb" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {!isWorkOrder && (
            <div className="mb-6">
              <h1 className="font-bold text-gray-900 text-xl">{PAGE_META[activePage].title}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{PAGE_META[activePage].sub}</p>
            </div>
          )}

          {activePage === "입고캘린더" && (
            <CalendarPage
              products={products}
              loading={loading}
              fetching={fetching}
              error={error}
              onRefresh={() => load(false)}
            />
          )}
          {activePage === "발주관리"   && <OrderManagement />}
          {activePage === "발주서작성" && <ComingSoon title="발주서 작성" icon={FilePlus} />}
          {activePage === "발주이력"   && <ComingSoon title="발주 이력" icon={History} />}

          {activePage === "작업지시서목록" && (
            <WorkOrderSection initialPage="list" />
          )}
          {activePage === "작업지시서작성" && (
            <WorkOrderSection initialPage="new" />
          )}
        </div>
      </main>
    </div>
  );
}
