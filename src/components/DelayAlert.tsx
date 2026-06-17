"use client";
import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { Product } from "@/types";
import ProductDetailModal from "./ProductDetailModal";

interface Props {
  products: Product[];
}

export default function DelayAlert({ products }: Props) {
  const delayed = products.filter((p) => p.status === "delayed");
  const [selected, setSelected] = useState<Product | null>(null);

  if (delayed.length === 0) return null;

  return (
    <>
      <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle size={13} className="text-red-500" />
          </div>
          <h4 className="font-semibold text-red-700 text-sm">지연 알림 {delayed.length}건</h4>
        </div>
        <div className="space-y-2">
          {delayed.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3 hover:border-red-300 transition-colors text-left group"
            >
              <div>
                <div className="font-medium text-sm text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.vendor} · {p.arrivalDate}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500 font-medium group-hover:underline">댓글 달기</span>
                <ChevronRight size={14} className="text-red-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
