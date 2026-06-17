"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Layers } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { getCalendarDays, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import type { Product } from "@/types";
import ProductDetailModal from "./ProductDetailModal";

interface Props {
  products: Product[];
  onDateSelect?: (date: string | null, products: Product[]) => void;
  selectedDate?: string | null;
}

// 일월화수목금토
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const BOARD_STYLE: Record<string, string> = {
  슈즈: "bg-amber-200/70 text-amber-800",
  잡화: "bg-emerald-200/70 text-emerald-800",
  의류: "bg-indigo-200/70 text-indigo-900",
};

export default function ArrivalCalendar({ products, onDateSelect, selectedDate }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const activeDate = selectedDate !== undefined ? selectedDate : localSelected;

  const days = getCalendarDays(products, year, month);
  // 일요일 시작 (getDay() 그대로)
  const firstDayOfWeek = days[0].date.getDay(); // 0=일, 1=월...

  const handleDateClick = (dateStr: string, dayProducts: Product[]) => {
    const next = activeDate === dateStr ? null : dateStr;
    if (onDateSelect) {
      onDateSelect(next, dayProducts);
    } else {
      setLocalSelected(next);
    }
  };

  const prev = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  return (
    <>
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">입고 달력</h3>
          <div className="flex items-center gap-1">
            <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={15} className="text-gray-400" />
            </button>
            <span className="font-medium text-sm text-gray-700 w-20 text-center">{year}년 {month}월</span>
            <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={15} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* 요일 헤더 — 일월화수목금토 */}
        <div className="grid grid-cols-7">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
          {days.map((day) => {
            const hasItems = day.products.length > 0;
            const today = isToday(day.date);
            const isSelected = activeDate === day.dateStr;
            const dow = day.date.getDay();

            return (
              <button
                key={day.dateStr}
                onClick={() => handleDateClick(day.dateStr, day.products)}
                className={`min-h-[58px] rounded-xl p-1.5 text-left transition-all ${
                  isSelected ? "bg-indigo-600 ring-2 ring-indigo-500 ring-offset-1"
                  : hasItems ? "bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
                  : "hover:bg-gray-50 cursor-default"
                }`}
              >
                <div className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                  isSelected ? "bg-white text-indigo-600"
                  : today ? "bg-indigo-600 text-white"
                  : dow === 0 ? "text-red-400"
                  : dow === 6 ? "text-blue-400"
                  : "text-gray-600"
                }`}>
                  {day.label}
                </div>
                <div className="space-y-0.5">
                  {day.products.slice(0, 2).map((p) => (
                    <div key={p.id} className={`text-[9px] font-medium px-1 py-0.5 rounded truncate ${
                      isSelected ? "bg-white/25 text-white"
                      : p.status === "delayed" ? "bg-red-100 text-red-700"
                      : BOARD_STYLE[p.board] ?? BOARD_STYLE["의류"]
                    }`}>
                      {p.name}
                    </div>
                  ))}
                  {day.products.length > 2 && (
                    <div className={`text-[9px] pl-1 ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                      +{day.products.length - 2}건
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
          {[["bg-indigo-400","의류"],["bg-amber-400","슈즈"],["bg-emerald-400","잡화"],["bg-red-400","지연"]].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className={`w-2 h-2 rounded-full ${c}`} />{l}
            </div>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}
