"use client";
import { useState } from "react";
import { FilePlus, History } from "lucide-react";
import type { WorkOrder, ShoeWorkOrder } from "@/types";
import Sidebar, { type SidebarPage, type CategoryFilter } from "@/components/Sidebar";
import OrderManagement from "@/components/OrderManagement";
import WorkOrderList from "@/components/WorkOrderList";
import WorkOrderForm from "@/components/WorkOrderForm";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";
import ShoeWorkOrderForm from "@/components/ShoeWorkOrderForm";
import ShoeWorkOrderPDFView from "@/components/ShoeWorkOrderPDFView";

// ─── 준비중 페이지 ─────────────────────────────────────────
function ComingSoon({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-violet-400" />
      </div>
      <div className="font-bold text-gray-700 text-lg mb-1">{title}</div>
      <div className="text-gray-400 text-sm">준비 중입니다</div>
    </div>
  );
}

type WorkTab = "작업지시서목록" | "작업지시서작성" | "발주관리";

const TABS: { key: WorkTab; label: string }[] = [
  { key: "작업지시서목록", label: "작업지시서 목록" },
  { key: "작업지시서작성", label: "작업지시서 작성" },
  { key: "발주관리",       label: "발주 관리" },
];

// ─── 작업지시서 전체 페이지 (사이드바 없는 풀 레이아웃) ─────
function WorkOrderFullPage({
  categoryFilter,
  onCategoryChange,
}: {
  categoryFilter: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkTab>("작업지시서목록");
  const [view,      setView]      = useState<"list" | "form">("list");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing,   setEditing]   = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewing, setPreview]  = useState<any>(null);

  function isShoeOrder(wo: unknown): wo is ShoeWorkOrder {
    return (wo as ShoeWorkOrder)?.board === "슈즈";
  }
  const shoeFormMode = categoryFilter === "슈즈" || isShoeOrder(editing);

  /* ── 탭 클릭 ── */
  function handleTabClick(tab: WorkTab) {
    setActiveTab(tab);
    if (tab === "작업지시서작성") {
      setView("form");
      setEditing(null);
    } else if (tab === "작업지시서목록") {
      setView("list");
      setEditing(null);
    }
  }

  /* ── Supabase 저장 로직 유지 ── */
  async function handleSave(wo: WorkOrder | ShoeWorkOrder) {
    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wo),
    });
    if (!res.ok) {
      alert("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setActiveTab("작업지시서목록");
    setView("list");
    setEditing(null);
  }

  function handleEdit(wo: WorkOrder | ShoeWorkOrder) {
    setEditing(wo);
    setView("form");
    setActiveTab("작업지시서작성");
  }

  function handleNew() {
    setEditing(null);
    setView("form");
    setActiveTab("작업지시서작성");
  }

  function handlePreview(wo: WorkOrder | ShoeWorkOrder) {
    setPreview(wo);
  }

  function handleCancel() {
    setActiveTab("작업지시서목록");
    setView("list");
    setEditing(null);
  }

  /* form 상태이면 "작업지시서작성" 탭을 강조 */
  const displayTab: WorkTab =
    activeTab === "발주관리" ? "발주관리"
    : view === "form"        ? "작업지시서작성"
    : "작업지시서목록";

  return (
    <div className="min-h-screen" style={{ background: "#F8F8FB" }}>
      {/* ── 탭 + 카테고리 토글 — sticky 고정 ─────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="flex items-center">
            {/* 왼쪽: 탭 메뉴 */}
            <div className="flex overflow-x-auto scrollbar-hide">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
                  className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    displayTab === key
                      ? "border-violet-600 text-violet-600"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 오른쪽: 카테고리 토글 */}
            <div className="ml-auto py-2 flex-shrink-0">
              <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200">
                {([["의류", "👕"], ["슈즈", "🩴"]] as [CategoryFilter, string][]).map(([val, icon]) => (
                  <button
                    key={val}
                    onClick={() => onCategoryChange(val)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all select-none ${
                      categoryFilter === val ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                    style={categoryFilter === val ? { background: "#836CE0" } : {}}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문 영역 (탭 아래 스크롤) ──────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8">

        {/* ── PDF 미리보기 오버레이 ──────────────────────── */}
        {previewing && isShoeOrder(previewing) && (
          <ShoeWorkOrderPDFView
            wo={previewing as ShoeWorkOrder}
            onClose={() => setPreview(null)}
          />
        )}
        {previewing && !isShoeOrder(previewing) && (
          <WorkOrderPDFView
            wo={previewing as WorkOrder}
            onClose={() => setPreview(null)}
          />
        )}

        {/* ── 발주 관리 탭 ──────────────────────────────── */}
        {displayTab === "발주관리" && (
          <OrderManagement categoryFilter={categoryFilter} />
        )}

        {/* ── 작업지시서 목록 탭 ────────────────────────── */}
        {displayTab !== "발주관리" && view === "list" && (
          <WorkOrderList
            onNew={handleNew}
            onEdit={handleEdit}
            onPreview={handlePreview}
            categoryFilter={categoryFilter}
          />
        )}

        {/* ── 작업지시서 작성 탭 — 슈즈 ─────────────────── */}
        {displayTab !== "발주관리" && view === "form" && shoeFormMode && (
          <ShoeWorkOrderForm
            initial={isShoeOrder(editing) ? editing : null}
            onSave={handleSave}
            onCancel={handleCancel}
            onPreview={handlePreview}
          />
        )}

        {/* ── 작업지시서 작성 탭 — 의류 ─────────────────── */}
        {displayTab !== "발주관리" && view === "form" && !shoeFormMode && (
          <WorkOrderForm
            initial={editing as WorkOrder | null}
            onSave={handleSave}
            onCancel={handleCancel}
            onPreview={handlePreview}
          />
        )}

      </div>{/* 본문 영역 끝 */}
    </div>{/* 루트 끝 */}
  );
}

// ─── 메인 앱 ──────────────────────────────────────────────
export default function App() {
  const [activePage,     setActivePage]     = useState<SidebarPage>("작업지시서목록");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("의류");

  // 작업지시서 관련 페이지 → 풀 레이아웃 (사이드바 없음)
  const isWorkOrderPage = (["작업지시서목록", "작업지시서작성", "발주관리"] as SidebarPage[]).includes(activePage);

  if (isWorkOrderPage) {
    return (
      <WorkOrderFullPage
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
      />
    );
  }

  // 그 외 페이지 — 기존 사이드바 레이아웃 유지
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F8F8FB" }}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          {activePage === "발주서작성" && <ComingSoon title="발주서 작성" icon={FilePlus} />}
          {activePage === "발주이력"   && <ComingSoon title="발주 이력"   icon={History}  />}
        </div>
      </main>
    </div>
  );
}
