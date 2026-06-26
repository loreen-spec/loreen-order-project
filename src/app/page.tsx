"use client";
import { useState } from "react";
import { FilePlus, History, ClipboardList } from "lucide-react";
import type { WorkOrder, ShoeWorkOrder } from "@/types";
import Sidebar, { type SidebarPage, type CategoryFilter } from "@/components/Sidebar";
import OrderManagement from "@/components/OrderManagement";
import WorkOrderList from "@/components/WorkOrderList";
import WorkOrderForm from "@/components/WorkOrderForm";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";
import ShoeWorkOrderForm from "@/components/ShoeWorkOrderForm";
import ShoeWorkOrderPDFView from "@/components/ShoeWorkOrderPDFView";

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

// ─── 작업지시서 섹션 ──────────────────────────────────────
function WorkOrderSection({ initialPage, categoryFilter }: { initialPage: "list" | "new"; categoryFilter: CategoryFilter }) {
  const [view, setView]       = useState<"list" | "form">(initialPage === "new" ? "form" : "list");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewing, setPreview] = useState<any>(null);

  // 슈즈 작업지시서인지 판별 (board 필드 또는 category 필드로 확인)
  function isShoeOrder(wo: unknown): wo is ShoeWorkOrder {
    return (wo as ShoeWorkOrder)?.board === "슈즈";
  }

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

    setView("list");
    setEditing(null);
  }

  function handleEdit(wo: WorkOrder | ShoeWorkOrder) {
    setEditing(wo);
    setView("form");
  }

  function handleNew() {
    setEditing(null);
    setView("form");
  }

  function handlePreview(wo: WorkOrder | ShoeWorkOrder) {
    setPreview(wo);
  }

  // 현재 폼이 슈즈 모드인지: 사이드바가 슈즈이거나, 편집 중인 항목이 슈즈인 경우
  const shoeFormMode = categoryFilter === "슈즈" || isShoeOrder(editing);

  return (
    <>
      {/* PDF 미리보기: 슈즈/의류 분기 */}
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

      {view === "list" && (
        <WorkOrderList
          onNew={handleNew}
          onEdit={handleEdit}
          onPreview={handlePreview}
          categoryFilter={categoryFilter}
        />
      )}

      {/* 작업지시서 폼: 슈즈/의류 분기 */}
      {view === "form" && shoeFormMode && (
        <ShoeWorkOrderForm
          initial={isShoeOrder(editing) ? (editing as ShoeWorkOrder) : null}
          onSave={handleSave}
          onCancel={() => { setView("list"); setEditing(null); }}
          onPreview={handlePreview}
        />
      )}
      {view === "form" && !shoeFormMode && (
        <WorkOrderForm
          initial={editing as WorkOrder | null}
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
  const [activePage, setActivePage] = useState<SidebarPage>("작업지시서목록");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("의류");

  const PAGE_META: Record<SidebarPage, { title: string; sub: string }> = {
    "발주관리":       { title: "발주 관리",         sub: "진행 중인 발주 현황 관리" },
    "발주서작성":     { title: "발주서 작성",        sub: "신규 발주서 작성" },
    "발주이력":       { title: "발주 이력",          sub: "완료된 발주 이력 조회" },
    "작업지시서목록": { title: "작업지시서",         sub: "제품별 작업지시서 아카이브 및 관리" },
    "작업지시서작성": { title: "새 작업지시서 작성", sub: "원단·부자재·발주수량 입력 후 PDF 자동 생성" },
  };

  const isWorkOrder = activePage === "작업지시서목록" || activePage === "작업지시서작성";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f8f9fb" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          {!isWorkOrder && (
            <div className="mb-6">
              <h1 className="font-bold text-gray-900 text-xl">{PAGE_META[activePage].title}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{PAGE_META[activePage].sub}</p>
            </div>
          )}

          {activePage === "발주관리"   && <OrderManagement categoryFilter={categoryFilter} />}
          {activePage === "발주서작성" && <ComingSoon title="발주서 작성" icon={FilePlus} />}
          {activePage === "발주이력"   && <ComingSoon title="발주 이력" icon={History} />}

          {activePage === "작업지시서목록" && (
            <WorkOrderSection initialPage="list" categoryFilter={categoryFilter} />
          )}
          {activePage === "작업지시서작성" && (
            <WorkOrderSection initialPage="new" categoryFilter={categoryFilter} />
          )}
        </div>
      </main>
    </div>
  );
}
