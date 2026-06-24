"use client";
import { useEffect, useState, useMemo, memo, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Loader2, RefreshCw,
  Layers, Calendar, Package, Shirt, Footprints, ShoppingBag,
  Bell
} from "lucide-react";
import type { OrderProduct } from "@/app/api/orders/route";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import { ko } from "date-fns/locale";

function parseColorSize(raw: string) {
  const parts = raw.split(",").map((s) => s.replace(/^:/, "").trim());
  return { color: parts[0] ?? "", size: parts[1] ?? "" };
}

const BOARD_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  의류: { label: "의류", icon: Shirt,       color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-200" },
  슈즈: { label: "슈즈", icon: Footprints,  color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200"  },
  잡화: { label: "잡화", icon: ShoppingBag, color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200" },
};

// ── 색상×사이즈 테이블: memo로 열린 카드에서만 계산
const ColorSizeTable = memo(function ColorSizeTable({ rows }: { rows: OrderProduct["rows"] }) {
  const colors = useMemo(() => [...new Set(rows.map((r) => parseColorSize(r.colorSize).color))].filter(Boolean), [rows]);
  const sizes  = useMemo(() => [...new Set(rows.map((r) => parseColorSize(r.colorSize).size))].filter(Boolean), [rows]);

  const qtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const { color, size } = parseColorSize(r.colorSize);
      m[`${color}__${size}`] = (m[`${color}__${size}`] ?? 0) + r.quantity;
    });
    return m;
  }, [rows]);

  if (colors.length === 0 && sizes.length === 0) {
    return (
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-500">{r.colorSize || "—"}</span>
            <span className="font-semibold text-indigo-700">{r.quantity.toLocaleString()}장</span>
          </div>
        ))}
      </div>
    );
  }

  const colTotals = sizes.map((sz) => colors.reduce((s, c) => s + (qtyMap[`${c}__${sz}`] ?? 0), 0));
  const rowTotals = colors.map((c)  => sizes.reduce((s, sz) => s + (qtyMap[`${c}__${sz}`] ?? 0), 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-2.5 py-1.5 text-gray-400 font-medium rounded-tl-lg w-20">색상 ＼ 사이즈</th>
            {sizes.map((sz) => <th key={sz} className="px-2 py-1.5 text-center text-gray-600 font-semibold min-w-[44px]">{sz}</th>)}
            <th className="px-2.5 py-1.5 text-center text-gray-700 font-bold bg-indigo-50 rounded-tr-lg">합계</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((color, ci) => (
            <tr key={color} className={ci % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              <td className="px-2.5 py-1.5 font-semibold text-gray-700">{color}</td>
              {sizes.map((sz) => {
                const q = qtyMap[`${color}__${sz}`] ?? 0;
                return <td key={sz} className={`px-2 py-1.5 text-center ${q > 0 ? "text-gray-800 font-medium" : "text-gray-200"}`}>{q > 0 ? q.toLocaleString() : "—"}</td>;
              })}
              <td className="px-2.5 py-1.5 text-center font-bold text-indigo-700 bg-indigo-50/60">{rowTotals[ci].toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-indigo-50/80 border-t border-indigo-100">
            <td className="px-2.5 py-1.5 font-bold text-gray-700 text-xs">합계</td>
            {colTotals.map((t, i) => <td key={i} className="px-2 py-1.5 text-center font-bold text-gray-700">{t.toLocaleString()}</td>)}
            <td className="px-2.5 py-1.5 text-center font-bold text-indigo-800">{rowTotals.reduce((a, b) => a + b, 0).toLocaleString()}장</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

// ── 제품 카드: memo로 다른 카드 열어도 이 카드는 리렌더 안 함
const ProductCard = memo(function ProductCard({ product }: { product: OrderProduct }) {
  const [open, setOpen] = useState(false);
  const arrivalDate = product.arrivalDate || product.rows[0]?.arrivalDate;

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      <button onClick={toggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
        {/* 이미지: lazy loading */}
        <div className="shrink-0 w-10 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">없음</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-900 truncate block">{product.name}</span>
          {arrivalDate && (
            <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Calendar size={10} />
              {format(parseISO(arrivalDate), "M/d", { locale: ko })}
            </span>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {product.latestBatch && (
            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-md font-bold">
              {product.latestBatch}
            </span>
          )}
          <span className="flex items-center gap-1 font-bold text-sm text-indigo-700">
            <Layers size={12} />
            {product.totalQuantity > 0 ? product.totalQuantity.toLocaleString() : "미정"}
          </span>
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* 세부 테이블: 열렸을 때만 마운트 */}
      {open && (
        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/40">
          {product.rows.length === 0
            ? <p className="text-xs text-gray-400 py-2 text-center">데이터 없음</p>
            : <ColorSizeTable rows={product.rows} />
          }
        </div>
      )}
    </div>
  );
});

// ── 보드 패널: 업체 필터 포함
const BoardPanel = memo(function BoardPanel({ board, products }: { board: string; products: OrderProduct[] }) {
  const meta = BOARD_META[board] ?? BOARD_META["의류"];
  const Icon = meta.icon;
  const [selectedVendor, setSelectedVendor] = useState("전체");

  const vendors = useMemo(
    () => ["전체", ...Array.from(new Set(products.map((p) => p.vendor).filter(Boolean)))],
    [products]
  );

  const filtered = useMemo(
    () => selectedVendor === "전체" ? products : products.filter((p) => p.vendor === selectedVendor),
    [products, selectedVendor]
  );

  const totalQty = useMemo(() => filtered.reduce((s, p) => s + p.totalQuantity, 0), [filtered]);

  return (
    <div className={`flex flex-col bg-white rounded-2xl overflow-hidden border ${meta.border}`}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div className={`flex items-center gap-2.5 px-4 py-3.5 ${meta.bg}`}>
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
          <Icon size={16} className={meta.color} />
        </div>
        <span className={`font-bold text-base ${meta.color}`}>{meta.label}</span>
        <span className="text-xs text-gray-400">{products.length}건</span>
        <span className="ml-auto text-sm font-bold text-gray-700">
          {totalQty > 0 ? `${totalQty.toLocaleString()}장` : ""}
        </span>
      </div>

      {vendors.length > 2 && (
        <div className="px-4 py-2.5 border-b border-gray-100 flex gap-1.5 flex-wrap bg-gray-50/50">
          {vendors.map((v) => (
            <button key={v} onClick={() => setSelectedVendor(v)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                selectedVendor === v
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {v === "전체" ? `전체 (${products.length})` : v}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ maxHeight: "calc(100vh - 340px)" }}>
        {filtered.length === 0
          ? <div className="text-center py-10 text-gray-300 text-sm">해당 업체 제품 없음</div>
          : filtered.map((p) => <ProductCard key={p.id} product={p} />)
        }
      </div>
    </div>
  );
});

// ── 새 발주 게시판
const NEW_DAYS = 7;
const BULLETIN_BOARD_COLOR = {
  의류: { bg: "bg-indigo-50", text: "text-indigo-600" },
  슈즈: { bg: "bg-amber-50",  text: "text-amber-600"  },
} as const;

const NewOrdersBulletin = memo(function NewOrdersBulletin({
  orders, loading, categoryFilter,
}: { orders: OrderProduct[]; loading: boolean; categoryFilter?: "의류" | "슈즈" }) {
  const recentProducts = useMemo(() => {
    return orders
      .filter((product) => !categoryFilter || product.board === categoryFilter)
      .filter((product) => {
        const latestRow = product.rows.filter((r) => r.orderDate).sort((a, b) => (b.orderDate > a.orderDate ? 1 : -1))[0];
        if (!latestRow) return false;
        try {
          const d = parseISO(latestRow.orderDate);
          return isValid(d) && differenceInDays(new Date(), d) <= NEW_DAYS;
        } catch { return false; }
      })
      .map((product) => {
        const latestRow = product.rows.filter((r) => r.orderDate).sort((a, b) => (b.orderDate > a.orderDate ? 1 : -1))[0];
        return { id: product.id, name: product.name, image: product.imageUrl, board: product.board, batch: product.latestBatch, orderDate: latestRow.orderDate };
      })
      .sort((a, b) => (b.orderDate > a.orderDate ? 1 : -1));
  }, [orders]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shrink-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center">
          <Bell size={12} className="text-rose-500" />
        </div>
        <span className="font-bold text-sm text-gray-800">새 발주 알림</span>
        <span className="text-[10px] text-gray-400">최근 {NEW_DAYS}일</span>
        {!loading && recentProducts.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">{recentProducts.length}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-gray-400">실시간</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {[1,2].map(i => (
            <div key={i} className="p-3 space-y-1.5">
              {[1,2,3].map(j => <div key={j} className="h-7 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {(["의류", "슈즈"] as const).map((board) => {
            const items = recentProducts.filter(p => p.board === board);
            const bc = BULLETIN_BOARD_COLOR[board];
            return (
              <div key={board}>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 ${bc.bg}`}>
                  <span className={`text-[10px] font-bold ${bc.text}`}>{board}</span>
                  <span className="text-[10px] text-gray-400">{items.length}건</span>
                </div>
                <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: "120px" }}>
                  {items.length === 0 ? (
                    <div className="py-4 text-[11px] text-gray-300 text-center">없음</div>
                  ) : items.map((item) => {
                    const daysAgo = differenceInDays(new Date(), parseISO(item.orderDate));
                    return (
                      <div key={item.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                        <div className="w-6 h-7 rounded-md overflow-hidden bg-gray-100 shrink-0">
                          {item.image
                            ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gray-200" />
                          }
                        </div>
                        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{item.name}</span>
                        {item.batch && <span className="text-[10px] font-bold text-orange-500 shrink-0">{item.batch}</span>}
                        <span className="text-[10px] text-gray-400 shrink-0 w-10 text-right">
                          {daysAgo === 0 ? "오늘" : `${daysAgo}일 전`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── 클라이언트 캐시
const CLIENT_CACHE_KEY = "orders_cache";
const CLIENT_CACHE_TTL = 5 * 60 * 1000;

function readClientCache(): OrderProduct[] | null {
  try {
    const raw = localStorage.getItem(CLIENT_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < CLIENT_CACHE_TTL) return data;
  } catch {}
  return null;
}

// ── 메인
export default function OrderManagement({ categoryFilter }: { categoryFilter?: "의류" | "슈즈" }) {
  const [orders, setOrders]     = useState<OrderProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (showFull = false) => {
    if (showFull && orders.length === 0) setLoading(true);
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/orders");
      const data: OrderProduct[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
      setLastUpdated(new Date());
      try { localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch {}
    } catch {
      setError("발주 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  // 현재 카테고리에 해당하는 발주만
  const filteredOrders = useMemo(
    () => categoryFilter ? orders.filter((o) => o.board === categoryFilter) : orders,
    [orders, categoryFilter]
  );
  const clothes  = useMemo(() => filteredOrders.filter((o) => o.board === "의류"), [filteredOrders]);
  const shoes    = useMemo(() => filteredOrders.filter((o) => o.board === "슈즈"), [filteredOrders]);
  const totalQty = useMemo(() => filteredOrders.reduce((s, o) => s + o.totalQuantity, 0), [filteredOrders]);

  const summaryCards = useMemo(() => [
    { label: "생산요청 총 건수", value: `${filteredOrders.length}건`,     icon: Package,   color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "총 발주 수량",     value: `${totalQty.toLocaleString()}장`, icon: Layers,    color: "text-violet-600", bg: "bg-violet-50" },
    { label: "업데이트",         value: lastUpdated?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) ?? "—", icon: RefreshCw, color: "text-emerald-600", bg: "bg-emerald-50" },
  ], [filteredOrders.length, totalQty, lastUpdated]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {lastUpdated && !fetching && (
            <span className="text-xs text-gray-400">
              {lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
            </span>
          )}
          {fetching && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-500">
              <Loader2 size={12} className="animate-spin" /> 노션 동기화 중...
            </span>
          )}
        </div>
        <button onClick={() => load(false)} disabled={fetching}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50 bg-white border border-gray-100 px-3 py-1.5 rounded-lg"
        >
          <RefreshCw size={12} className={fetching ? "animate-spin" : ""} />새로고침
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm text-amber-700 shrink-0">⚠️ {error}</div>
      )}

      {/* 새 발주 게시판 */}
      <NewOrdersBulletin orders={orders} loading={loading} categoryFilter={categoryFilter} />

      {/* 요약 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 shrink-0">
          {summaryCards.map((c) => {
            const CIcon = c.icon;
            return (
              <div key={c.label} className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                  <CIcon size={18} className={c.color} />
                </div>
                <div className="min-w-0">
                  <div className={`font-bold text-lg leading-tight ${c.color}`}>{c.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 카테고리별 보드 */}
      {loading ? (
        <div className="h-64 bg-white rounded-2xl animate-pulse" />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium text-gray-500 mb-1">생산 요청 중인 제품이 없어요</div>
          <div className="text-xs">노션에서 진행상태를 "생산 요청(국내/해외)"로 변경하면 자동으로 표시됩니다</div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          {(!categoryFilter || categoryFilter === "의류") && (
            <BoardPanel board="의류" products={clothes} />
          )}
          {(!categoryFilter || categoryFilter === "슈즈") && (
            <BoardPanel board="슈즈" products={shoes} />
          )}
        </div>
      )}
    </div>
  );
}
