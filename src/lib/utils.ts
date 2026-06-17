import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  isSameDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import type { Product, WeekSummary, VendorSummary } from "@/types";

export function getThisWeekSummary(products: Product[]): WeekSummary {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 0 }); // 일요일 시작
  const end = endOfWeek(now, { weekStartsOn: 0 });

  const thisWeek = products.filter((p) => {
    if (!p.arrivalDate) return false;
    try {
      const d = parseISO(p.arrivalDate);
      return isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  });

  return {
    weekLabel: `${format(start, "M월 d일", { locale: ko })} ~ ${format(end, "M월 d일", { locale: ko })}`,
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    totalItems: thisWeek.length,
    totalQuantity: thisWeek.reduce((s, p) => s + p.orderQuantity, 0),
    products: thisWeek,
  };
}

export function getCalendarDays(products: Product[], year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  const days = eachDayOfInterval({ start, end });

  return days.map((day) => ({
    date: day,
    dateStr: format(day, "yyyy-MM-dd"),
    label: format(day, "d"),
    dayOfWeek: format(day, "EEE", { locale: ko }),
    products: products.filter((p) => {
      if (!p.arrivalDate) return false;
      try {
        return isSameDay(parseISO(p.arrivalDate), day);
      } catch {
        return false;
      }
    }),
  }));
}

export function groupByVendor(products: Product[]): VendorSummary[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.vendor || "기타";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([vendor, prods]) => ({
    vendor,
    totalItems: prods.length,
    totalQuantity: prods.reduce((s, p) => s + p.orderQuantity, 0),
    products: prods,
  }));
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "입고예정",
  in_transit: "운송중",
  arrived: "입고완료",
  delayed: "지연",
};

export const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-600 border-blue-100",
  in_transit: "bg-amber-50 text-amber-600 border-amber-100",
  arrived: "bg-emerald-50 text-emerald-600 border-emerald-100",
  delayed: "bg-red-50 text-red-600 border-red-100",
};
