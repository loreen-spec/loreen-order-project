"use client";
import { useRef, useState } from "react";
import { X, FileSpreadsheet, Upload, Eye, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { WorkOrder } from "@/types";
import { parseWorkbook, type ParsedOrder } from "@/lib/importWorkOrders";
import WorkOrderPDFView from "./WorkOrderPDFView";

interface Row extends ParsedOrder { fileName: string; checked: boolean; }

export default function ImportWorkOrdersModal({
  onClose, onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<WorkOrder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 노션 제품 조회 → 이미지/기본정보. 전체명 → (없으면) '카테고리-' 뒤 이름으로 재시도
  async function lookupNotion(productName: string): Promise<any | null> {
    const tries = [productName, productName.split("-").slice(1).join("-").replace(/\(.*?\)/g, "").trim()]
      .filter((s, i, arr) => s && arr.indexOf(s) === i);
    for (const q of tries) {
      try {
        const res = await fetch(`/api/notion-product-lookup?q=${encodeURIComponent(q)}`);
        const data = res.ok ? await res.json() : null;
        if (data) return data;
      } catch { /* 무시 */ }
    }
    return null;
  }

  async function handleFiles(files: FileList | File[]) {
    setParsing(true);
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(xlsx|xls)$/i.test(file.name)) continue;
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseWorkbook(buf, file.name);
        parsed.forEach((p) => next.push({ ...p, fileName: file.name, checked: true }));
      } catch {
        next.push({
          fileName: file.name, sheet: "-", warnings: ["파일을 읽을 수 없습니다"],
          checked: false, order: { productName: `(읽기 실패) ${file.name}` } as WorkOrder,
        });
      }
    }
    // 노션 조회로 제품 이미지·빈 기본정보 자동 채움 (이미 값이 있으면 유지)
    await Promise.all(next.map(async (r) => {
      if (!r.order.styleNo && !r.order.productName) return;
      const data = await lookupNotion(r.order.productName || "");
      if (!data) return;
      const o = r.order;
      o.productImage    = o.productImage    || data.imageUrl        || "";
      o.notionProductId = o.notionProductId || data.notionProductId || "";
      o.vendor          = o.vendor          || data.vendor          || "";
      o.manager         = o.manager         || data.manager         || "";
      o.season          = o.season          || data.season          || "";
      o.year            = o.year            || data.year            || "";
      o.category        = o.category        || data.category        || "";
    }));
    setRows((prev) => [...prev, ...next]);
    setParsing(false);
  }

  function toggle(i: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, checked: !r.checked } : r)));
  }
  const allChecked = rows.length > 0 && rows.every((r) => r.checked);
  function toggleAll() {
    const v = !allChecked;
    setRows((prev) => prev.map((r) => ({ ...r, checked: v })));
  }

  async function saveSelected() {
    const targets = rows.filter((r) => r.checked && r.order.styleNo);
    if (!targets.length) { alert("저장할 작업지시서를 선택하세요."); return; }
    if (!confirm(`선택한 ${targets.length}건을 저장하시겠습니까?`)) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const r of targets) {
      try {
        const res = await fetch("/api/work-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r.order),
        });
        res.ok ? ok++ : fail++;
      } catch { fail++; }
    }
    setSaving(false);
    alert(`저장 완료: ${ok}건${fail ? ` / 실패 ${fail}건` : ""}`);
    onImported();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: "980px" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">엑셀에서 작업지시서 가져오기</div>
            <div className="text-xs text-gray-400">기존 엑셀 작업지시서(오즈키즈 템플릿)를 읽어 목록으로 저장합니다</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* 업로드 영역 */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
            className="border-2 border-dashed border-violet-200 rounded-2xl p-6 bg-violet-50/40 hover:bg-violet-50 transition-colors cursor-pointer flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              {parsing ? <Loader2 size={22} className="text-violet-500 animate-spin" /> : <Upload size={22} className="text-violet-500" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-violet-700">엑셀 파일 선택 또는 드래그 (여러 개 가능)</div>
              <div className="text-xs text-gray-400">.xlsx / .xls · 한 파일에 여러 스타일이 있어도 자동으로 분리됩니다</div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />

          {/* 파싱 결과 목록 */}
          {rows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-violet-600" />
                <span className="w-28">스타일넘버</span>
                <span className="flex-1">품명</span>
                <span className="w-24">작업처</span>
                <span className="w-28">색상/수량</span>
                <span className="w-16 text-center">미리보기</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 text-sm hover:bg-violet-50/40">
                    <input type="checkbox" checked={r.checked} onChange={() => toggle(i)} className="accent-violet-600" disabled={!r.order.styleNo} />
                    <span className="w-28 font-mono text-xs text-gray-600 truncate">{r.order.styleNo || "—"}</span>
                    <span className="flex-1 truncate">
                      <span className="font-semibold text-gray-800">{r.order.productName || "(품명 없음)"}</span>
                      {r.warnings.length > 0 && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-amber-600" title={r.warnings.join(", ")}>
                          <AlertTriangle size={11} />{r.warnings.length}
                        </span>
                      )}
                      <span className="ml-2 text-[11px] text-gray-300">{r.fileName}{r.sheet !== "-" ? ` · ${r.sheet}` : ""}</span>
                    </span>
                    <span className="w-24 text-xs text-gray-500 truncate">{r.order.vendor || "—"}</span>
                    <span className="w-28 text-xs text-gray-500 truncate">
                      {(r.order.colorSizeTable ?? []).length}색 · {(r.order.totalQuantity || 0).toLocaleString()}장
                    </span>
                    <span className="w-16 text-center">
                      {r.order.styleNo && (
                        <button onClick={() => setPreview(r.order)} className="inline-flex items-center justify-center p-1.5 rounded-lg text-violet-500 hover:bg-violet-100" title="미리보기">
                          <Eye size={15} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            {rows.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={13} className="text-violet-500" />
                {rows.filter((r) => r.checked && r.order.styleNo).length} / {rows.filter((r) => r.order.styleNo).length}건 선택됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={saveSelected} disabled={saving || rows.length === 0}
              className="px-5 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              style={{ background: "#836CE0" }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : "선택 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 개별 미리보기 */}
      {preview && <WorkOrderPDFView wo={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
