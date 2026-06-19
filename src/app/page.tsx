"use client";
import { useState } from "react";
import { FilePlus, History, ClipboardList } from "lucide-react";
import type { WorkOrder } from "@/types";
import Sidebar, { type SidebarPage } from "@/components/Sidebar";
import OrderManagement from "@/components/OrderManagement";
import WorkOrderList from "@/components/WorkOrderList";
import WorkOrderForm from "@/components/WorkOrderForm";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";

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
function WorkOrderSection({ initialPage }: { initialPage: "list" | "new" }) {
  const [view, setView]       = useState<"list" | "form" | "pdf">(initialPage === "new" ? "form" : "list");
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [previewing, setPreview] = useState<WorkOrder | null>(null);

  async function handleSave(wo: WorkOrder) {
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
  const [activePage, setActivePage] = useState<SidebarPage>("작업지시서목록");

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
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {!isWorkOrder && (
            <div className="mb-6">
              <h1 className="font-bold text-gray-900 text-xl">{PAGE_META[activePage].title}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{PAGE_META[activePage].sub}</p>
            </div>
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
