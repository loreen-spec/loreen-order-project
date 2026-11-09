"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import WorkOrderPDFView from "@/components/WorkOrderPDFView";
import ShoeWorkOrderPDFView from "@/components/ShoeWorkOrderPDFView";
import type { WorkOrder, ShoeWorkOrder } from "@/types";

/**
 * 임베드용 작업지시서 미리보기.
 * 제품보드(ohlab) 등 외부에서 iframe으로 띄움.
 *   /embed/wo?name=원피스-캔디샤베트   (상품명 매칭)
 *   /embed/wo?styleNo=O27PO01GC700     (스타일넘버 매칭)
 *   /embed/wo?pageId=<노션페이지ID>     (노션 제품ID 매칭)
 * 매칭되는 작지가 없으면 "작성된 작업지시서 없음" 표시.
 */
function EmbedInner() {
  const sp = useSearchParams();
  const name = (sp.get("name") || "").trim();
  const styleNo = (sp.get("styleNo") || "").trim();
  const pageId = (sp.get("pageId") || "").trim();

  const [wo, setWo] = useState<WorkOrder | ShoeWorkOrder | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none" | "err">("loading");

  useEffect(() => {
    const nk = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();
    const sid = (s: string) => (s || "").replace(/-/g, "");
    fetch(`/api/work-orders?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        const arr = Array.isArray(list) ? list : [];
        const found = arr.find((o) =>
          (styleNo && nk(o.styleNo) === nk(styleNo)) ||
          (pageId && o.notionProductId && sid(o.notionProductId) === sid(pageId)) ||
          (name && (nk(o.productName) === nk(name) ||
                    nk(o.productName).includes(nk(name)) ||
                    nk(name).includes(nk(o.productName))))
        );
        if (found) { setWo(found); setState("ok"); }
        else setState("none");
      })
      .catch(() => setState("err"));
  }, [name, styleNo, pageId]);

  if (state === "loading")
    return <div style={{ padding: 40, textAlign: "center", color: "#888", fontFamily: "sans-serif" }}>작업지시서 불러오는 중…</div>;
  if (state === "err")
    return <div style={{ padding: 40, textAlign: "center", color: "#c00", fontFamily: "sans-serif" }}>불러오기 실패. 잠시 후 다시 시도해주세요.</div>;
  if (state === "none" || !wo)
    return <div style={{ padding: 40, textAlign: "center", color: "#888", fontFamily: "sans-serif" }}>작성된 작업지시서가 없습니다.</div>;

  return (wo as ShoeWorkOrder).board === "슈즈"
    ? <ShoeWorkOrderPDFView wo={wo as ShoeWorkOrder} onClose={() => {}} />
    : <WorkOrderPDFView wo={wo as WorkOrder} onClose={() => {}} />;
}

export default function EmbedWorkOrderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#888" }}>로딩…</div>}>
      <EmbedInner />
    </Suspense>
  );
}
