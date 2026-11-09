"use client";
import { useEffect, useState } from "react";
import type { WorkOrder, ShoeWorkOrder } from "@/types";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";
import ShoeWorkOrderPDFView from "@/components/ShoeWorkOrderPDFView";

function isShoeOrder(wo: any): wo is ShoeWorkOrder {
  return wo?.board === "슈즈";
}

export default function WorkOrderShareView({ id }: { id: string }) {
  const [wo, setWo] = useState<WorkOrder | ShoeWorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/work-orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setWo)
      .catch(() => setError("작업지시서를 찾을 수 없습니다."));
  }, [id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-3">
        <div className="text-4xl">📋</div>
        <div className="text-gray-600 font-medium">{error}</div>
        <div className="text-gray-400 text-sm">URL을 다시 확인해 주세요.</div>
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400 text-sm animate-pulse">불러오는 중...</div>
      </div>
    );
  }

  // 닫기 버튼 없는 임베드 전용 뷰 — onClose는 no-op
  const noop = () => {};

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
        <div className="text-sm font-bold text-gray-800">{wo.productName}</div>
        <div className="text-xs text-gray-400">{(wo as WorkOrder).styleNo}</div>
        <div className="ml-auto text-xs text-gray-400">작업지시서 미리보기</div>
      </div>

      {/* PDF 미리보기 */}
      {isShoeOrder(wo) ? (
        <ShoeWorkOrderPDFView wo={wo} onClose={noop} embed />
      ) : (
        <WorkOrderPDFView wo={wo as WorkOrder} onClose={noop} embed />
      )}
    </div>
  );
}
