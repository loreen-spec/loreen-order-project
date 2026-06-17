"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Building2, Layers } from "lucide-react";
import type { Product } from "@/types";
import { STATUS_COLOR, STATUS_LABEL, groupByVendor } from "@/lib/utils";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import ProductDetailModal from "./ProductDetailModal";

interface Props { products: Product[] }

const BOARD_STYLE: Record<string, string> = {
  슈즈: "bg-amber-100 text-amber-700",
  잡화: "bg-emerald-100 text-emerald-700",
  의류: "bg-indigo-100 text-indigo-700",
};

export default function WeekVendorList({ products }: Props) {
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  // 이번 주 제품만 필터
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // 일요일 시작
  const weekEnd   = endOfWeek(now,   { weekStartsOn: 0 });

  const thisWeekProducts = products.filter((p) => {
    if (!p.arrivalDate) return false;
    try { return isWithinInterval(parseISO(p.arrivalDate), { start: weekStart, end: weekEnd }); }
    catch { return false; }
  });

  const vendors = groupByVendor(thisWeekProducts);

  return (
    <>
      <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">이번 주 입고 업체</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            {vendors.length}개 업체
          </span>
        </div>

        {vendors.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">이번 주 입고 예정 업체 없음</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {vendors.map((v) => (
              <div key={v.vendor} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenVendor(openVendor === v.vendor ? null : v.vendor)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Building2 size={13} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{v.vendor || "업체미정"}</div>
                    <div className="text-xs text-gray-400">
                      {v.totalItems}건 · {v.totalQuantity > 0 ? `${v.totalQuantity.toLocaleString()}장` : "수량미정"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {v.products.some((p) => p.status === "delayed") && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    )}
                    {openVendor === v.vendor
                      ? <ChevronUp size={13} className="text-gray-300" />
                      : <ChevronDown size={13} className="text-gray-300" />}
                  </div>
                </button>

                {openVendor === v.vendor && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50 animate-slide-down">
                    {v.products.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-indigo-50/50 transition-colors text-left"
                      >
                        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${BOARD_STYLE[p.board] ?? BOARD_STYLE["의류"]}`}>
                          {p.board || "의류"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.arrivalDate}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-bold text-indigo-600">
                            {p.orderQuantity > 0 ? `${p.orderQuantity.toLocaleString()}장` : "—"}
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLOR[p.status]}`}>
                            {p.statusLabel || STATUS_LABEL[p.status]}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
