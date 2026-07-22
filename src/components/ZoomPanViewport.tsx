"use client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * 작업지시서 미리보기용 확대/축소 + 자유 드래그 이동 뷰포트.
 * - 처음 열릴 때 전체 작지가 화면에 다 보이도록 자동으로 맞춰(fit) 표시
 * - 상단 툴바: 축소 / 배율 / 확대 / 전체보기(fit)
 * - 본문: 마우스로 드래그하면 이동, Ctrl+휠로 확대/축소
 * - contentEditable(언어별 수정 입력) 위에서는 드래그를 시작하지 않아 편집과 충돌하지 않음
 *
 * contentWidth/Height = 내부 A4 용지의 기준 픽셀 크기(가로 297mm ≈ 1122px, 세로 210mm ≈ 793.6px)
 */
export default function ZoomPanViewport({
  children,
  height = "80vh",
  contentWidth = 1122,
  contentHeight = 793.6,
}: {
  children: React.ReactNode;
  height?: string;
  contentWidth?: number;
  contentHeight?: number;
}) {
  const vpRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const readyRef = useRef(false);
  const drag = useRef({ sx: 0, sy: 0, ox: 0, oy: 0, active: false });

  const clamp = (z: number) => Math.min(3, Math.max(0.2, +z.toFixed(3)));

  // 뷰포트 크기를 측정해 전체가 보이는 배율(fit) 계산 — 처음 한 번은 그 배율로 시작
  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const measure = () => {
      const padding = 40; // 좌우/상하 여백(20px)
      const availW = el.clientWidth - padding;
      const availH = el.clientHeight - padding;
      if (availW <= 0 || availH <= 0) return;
      const f = clamp(Math.min(availW / contentWidth, availH / contentHeight));
      setFit(f);
      if (!readyRef.current) {
        setZoom(f);
        setPan({ x: 0, y: 0 });
        readyRef.current = true;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentWidth, contentHeight]);

  const fitView = () => { setZoom(fit); setPan({ x: 0, y: 0 }); };

  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[contenteditable="true"]')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, active: true };
    setDragging(true);
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    setPan({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    });
  };
  const onUp = () => { drag.current.active = false; setDragging(false); };
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return; // Ctrl 눌렀을 때만 확대/축소 (일반 스크롤과 구분)
    setZoom((z) => clamp(z + (e.deltaY < 0 ? 0.1 : -0.1)));
  };

  const iconBtn =
    "w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-xl leading-none select-none";

  return (
    <div>
      {/* 확대/축소 툴바 */}
      <div
        style={{
          display: "flex", gap: 8, alignItems: "center", justifyContent: "center",
          padding: "8px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb",
        }}
      >
        <button className={iconBtn} onClick={() => setZoom((z) => clamp(z - 0.2))} title="축소">−</button>
        <span style={{ minWidth: 54, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className={iconBtn} onClick={() => setZoom((z) => clamp(z + 0.2))} title="확대">+</button>
        <button
          className="px-3 h-8 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm select-none"
          onClick={fitView}
          title="전체가 보이도록 맞춤"
        >
          전체보기
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
          드래그로 이동 · Ctrl+휠로 확대/축소
        </span>
      </div>

      {/* 뷰포트 (드래그 이동 영역) */}
      <div
        ref={vpRef}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onWheel={onWheel}
        style={{
          background: "#d1d5db", padding: "20px", height, overflow: "hidden",
          position: "relative", cursor: dragging ? "grabbing" : "grab",
          userSelect: dragging ? "none" : "auto",
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top center",
            transition: dragging ? "none" : "transform .08s ease-out",
            display: "flex", justifyContent: "center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
