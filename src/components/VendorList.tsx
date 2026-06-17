"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Building2, Layers } from "lucide-react";
import type { VendorSummary, Product } from "@/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import ProductDetailModal from "./ProductDetailModal";

interface Props { vendors: VendorSummary[] }

const BOARD_STYLE: Record<string, string> = {
  슈즈: "bg-amber-100 text-amber-700",
  잡화: "bg-emerald-100 text-emerald-700",
  의류: "bg-indigo-100 text-indigo-700",
};

export default function VendorList({ vendors }: Props) {
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 text-lg mb-4">업체별 입고 현황</h3>

        {vendors.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">데이터 없음</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {vendors.map((v) => (
              <div key={v.vendor} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenVendor(openVendor === v.vendor ? null : v.vendor)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Building2 size={15} className="text-indigo-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm text-gray-900">{v.vendor || "업체 미정"}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {v.totalItems}건 · {v.totalQuantity > 0 ? `${v.totalQuantity.toLocaleString()}장` : "수량미정"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.products.some((p) => p.status === "delayed") && (
                      <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-medium">지연</span>
                    )}
                    {openVendor === v.vendor
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {openVendor === v.vendor && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50 animate-slide-down">
                    {v.products.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/50 transition-colors text-left"
                      >
                        {/* 보드 뱃지 */}
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${BOARD_STYLE[p.board] ?? BOARD_STYLE["의류"]}`}>
                          {p.board || "의류"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 truncate">{p.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{p.arrivalDate} · {p.category}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600">
                            <Layers size={11} />
                            {p.orderQuantity > 0 ? `${p.orderQuantity.toLocaleString()}장` : "—"}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[p.status]}`}>
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
