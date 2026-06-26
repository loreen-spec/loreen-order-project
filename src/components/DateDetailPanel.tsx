"use client";
import { useState } from "react";
import { X, Layers, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import type { Product } from "@/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import ProductDetailModal from "./ProductDetailModal";

interface Props {
  date: string;
  products: Product[];
  onClose: () => void;
}

const BOARD_STYLE: Record<string, string> = {
  슈즈: "bg-amber-100 text-amber-700",
  잡화: "bg-emerald-100 text-emerald-700",
  의류: "bg-violet-100 text-indigo-700",
};

export default function DateDetailPanel({ date, products, onClose }: Props) {
  const [selected, setSelected] = useState<Product | null>(null);

  const totalQty = products.reduce((s, p) => s + p.orderQuantity, 0);

  return (
    <>
      <div className="bg-white rounded-2xl flex flex-col h-full" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Calendar size={15} className="text-violet-500" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">
                {format(parseISO(date), "M월 d일 (EEE)", { locale: ko })}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {products.length}건 · {totalQty > 0 ? `${totalQty.toLocaleString()}장` : "수량미정"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* 제품 리스트 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {products.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">입고 예정 제품 없음</div>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full flex items-start gap-3 bg-gray-50 hover:bg-violet-50 rounded-xl px-3.5 py-3 transition-colors text-left group"
              >
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${BOARD_STYLE[p.board] ?? BOARD_STYLE["의류"]}`}>
                  {p.board || "의류"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.vendor || "업체미정"} · {p.category}</div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1 text-xs font-bold text-violet-600">
                    <Layers size={11} />
                    {p.orderQuantity > 0 ? `${p.orderQuantity.toLocaleString()}장` : "—"}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[p.status]}`}>
                    {p.statusLabel || STATUS_LABEL[p.status]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
