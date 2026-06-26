"use client";
import { ChevronDown, ChevronUp, Package, Layers } from "lucide-react";
import { useState } from "react";
import type { WeekSummary } from "@/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import ProductDetailModal from "./ProductDetailModal";
import type { Product } from "@/types";

interface Props {
  summary: WeekSummary;
}

export default function WeekBanner({ summary }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const delayedCount = summary.products.filter((p) => p.status === "delayed").length;

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-600 text-white shadow-float overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-xs font-medium tracking-widest uppercase mb-1">이번 주 입고</p>
            <h2 className="font-display font-bold text-2xl">{summary.weekLabel}</h2>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-3xl font-display font-bold">{summary.totalItems}</div>
              <div className="text-violet-200 text-xs mt-0.5">건</div>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-display font-bold">{summary.totalQuantity.toLocaleString()}</div>
              <div className="text-violet-200 text-xs mt-0.5">장</div>
            </div>
            {delayedCount > 0 && (
              <>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-3xl font-display font-bold text-red-300">{delayedCount}</div>
                  <div className="text-violet-200 text-xs mt-0.5">지연</div>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <span>이번 주 입고 리스트 {open ? "접기" : "펼치기"}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div className="animate-slide-down px-4 pb-4 space-y-2">
            {summary.products.length === 0 ? (
              <div className="text-center py-6 text-violet-200 text-sm">이번 주 입고 예정 없음</div>
            ) : (
              summary.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-violet-200 text-xs mt-0.5">{p.vendor} · {p.arrivalDate}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 text-violet-100 text-xs">
                      <Layers size={12} />
                      {p.orderQuantity.toLocaleString()}장
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      p.status === "delayed"
                        ? "bg-red-400/30 text-red-100 border-red-300/30"
                        : "bg-white/20 text-white border-white/20"
                    }`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
