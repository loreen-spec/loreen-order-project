"use client";
import { useRef } from "react";
import { X, Printer } from "lucide-react";
import type { ShoeWorkOrder } from "@/types";

interface Props { wo: ShoeWorkOrder; onClose: () => void; }

/* ─────────────────────────────────────────────────────────
   A4 가로: 297mm × 210mm  여백 5mm  — 슈즈 전용
   폰트: 의류 PDF 대비 +35% (FS 5.5→7.5 / FM 6.5→9 / FL 7.5→10 / FX 8.5→11.5)
   COL A flex: 대표사진(3) + 디테일사진(2) — COL B 발주수량(3) + 주의사항(2)에 맞춤
───────────────────────────────────────────────────────── */

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{
    width:297mm;height:210mm;overflow:hidden;
    font-family:'Noto Sans KR','Malgun Gothic',sans-serif;
    font-size:11pt;color:#111;background:#fff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  @page{size:A4 landscape;margin:5mm}
  .sheet{
    width:287mm;height:200mm;
    display:flex;flex-direction:column;gap:2px;
    overflow:hidden;
  }
  table{border-collapse:collapse;width:100%}
  td,th{border:.3pt solid #888;padding:2pt 3pt;vertical-align:middle;text-align:center;font-size:10pt;line-height:1.25}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;

// ── 폰트 4단계 (의류 기준 ×1.35) ──────────────────────────
const FS = "7.5pt";   // 주의사항 본문  (5.5 × 1.35 ≈ 7.4)
const FM = "9pt";     // 테이블 헤더    (6.5 × 1.35 ≈ 8.8)
const FL = "10pt";    // 기본 데이터    (7.5 × 1.35 ≈ 10.1)
const FX = "11.5pt";  // 강조 (상품명 등) (8.5 × 1.35 ≈ 11.5)

const S = {
  cell: {
    border: ".3pt solid #888",
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    fontSize: FL,
  },
  lbl: {
    border: ".3pt solid #888",
    background: "#e8e8e8",
    fontWeight: 700,
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    fontSize: FM,
  },
};
const td  = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.cell, ...x });
const lbl = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.lbl,  ...x });

export default function ShoeWorkOrderPDFView({ wo, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const colTotal = (sz: string) =>
    wo.colorSizeTable.reduce((s, r) => s + (r.sizes[sz] || 0), 0);

  function handlePrint() {
    const node = sheetRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=1500,height=1000");
    if (!win) return;
    const clone = node.cloneNode(true) as HTMLElement;
    clone.className = "sheet";
    clone.removeAttribute("style");
    win.document.write(
      `<!DOCTYPE html><html lang="ko"><head>
        <meta charset="UTF-8"/>
        <title>슈즈 작업지시서 — ${wo.styleNo} ${wo.productName} ${wo.orderCount}차</title>
        <style>${PRINT_CSS}</style>
      </head><body>${clone.outerHTML}</body></html>`
    );
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 700);
  }

  const BASE: React.CSSProperties = {
    fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif",
    fontSize: "11pt",
    color: "#111",
  };

  // 발주수량 테이블 최소 4줄 확보
  const emptyColorRows = Math.max(0, 4 - wo.colorSizeTable.length);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: "1180px" }}>

        {/* ── 모달 헤더 ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">슈즈 작업지시서 미리보기</div>
            <div className="text-xs text-gray-400">
              {[wo.styleNo, wo.productName, `${wo.orderCount}차`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors" style={{ background: "#836CE0" }} onMouseOver={e=>(e.currentTarget.style.background="#7c3aed")} onMouseOut={e=>(e.currentTarget.style.background="#836CE0")}>
              <Printer size={14} />인쇄 / PDF 저장
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── A4 미리보기 ──────────────────────────────────── */}
        <div className="overflow-auto" style={{ background: "#d1d5db", padding: "20px" }}>
          <div style={{
            width: "min(100%, 1122px)",
            aspectRatio: "297 / 210",
            background: "#fff",
            margin: "0 auto",
            boxShadow: "0 4px 32px rgba(0,0,0,.25)",
            overflow: "hidden",
          }}>
            <div ref={sheetRef} style={{
              width: "100%", height: "100%",
              padding: "10px 12px",
              display: "flex", flexDirection: "column", gap: "2px",
              overflow: "hidden",
              ...BASE,
            }}>

              {/* ══ ROW 1: 타이틀 ══ */}
              <div style={{
                ...S.cell,
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "4px", flexShrink: 0,
              }}>
                <span style={{ fontSize: "18pt", fontWeight: 900, letterSpacing: "6pt" }}>
                  작 업 지 시 서
                </span>
                <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}>
                  <img
                    src="/ozkiz-logo.png"
                    alt="OZKIZ"
                    style={{ height: "31px", maxWidth: "112px", objectFit: "contain", display: "inline-block" }}
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const span = document.createElement("span");
                      span.style.cssText = "font-size:16pt;font-weight:900;color:#cc0000;letter-spacing:2pt";
                      span.textContent = "OZKIZ";
                      t.parentElement?.appendChild(span);
                    }}
                  />
                </div>
              </div>

              {/* ══ ROW 2: 정보 바 ══
                  STYLE NO ↔ 상품명: 동일 너비(13%)
                  업체단가: 입고예정일과 동일(9%)로 축소, 남는 공간은 작업처로 배분
              */}
              <table style={{ tableLayout: "fixed", flexShrink: 0 }}>
                <colgroup>
                  <col style={{ width: "13%" }} />{/* STYLE NO — 상품명과 동일 */}
                  <col style={{ width: "13%" }} />{/* 상품명 */}
                  <col style={{ width: "4%" }}  />{/* 차수 */}
                  <col style={{ width: "14%" }} />{/* 작업처 */}
                  <col style={{ width: "9%" }}  />{/* 담당 */}
                  <col style={{ width: "9%" }}  />{/* 실장 */}
                  <col style={{ width: "9%" }}  />{/* 발주일 */}
                  <col style={{ width: "9%" }}  />{/* 입고예정일 */}
                  <col style={{ width: "9%" }}  />{/* 업체단가 — 입고예정일과 동일 */}
                </colgroup>
                <tbody>
                  <tr>
                    {["STYLE NO","상품명","차수","작업처","담당","실장","발주일","입고 예정일","업체단가"].map((h) => (
                      <th key={h} style={lbl({ padding: "2px 2px", fontSize: FM })}>{h}</th>
                    ))}
                  </tr>
                  <tr>
                    <td style={td({ fontSize: FL })}>{wo.styleNo}</td>
                    <td style={td({ fontWeight: 700, fontSize: FX })}>{wo.productName}</td>
                    <td style={td({ fontWeight: 900, fontSize: "13pt", color: "#1a56db" })}>{wo.orderCount}차</td>
                    <td style={td({ fontSize: FL })}>{wo.vendor}</td>
                    <td style={td({ fontWeight: 700, fontSize: FX })}>{wo.manager}</td>
                    <td style={td({ fontWeight: 700, fontSize: FX })}>{wo.director}</td>
                    <td style={td({ fontSize: FL })}>{wo.orderDate}</td>
                    <td style={td({ color: "#cc0000", fontWeight: 700, fontSize: FL })}>{wo.deliveryDate}</td>
                    <td style={td({ fontWeight: 700, color: "#1a56db", fontSize: FX })}>{wo.vendorUnitPrice}</td>
                  </tr>
                </tbody>
              </table>

              {/* ══ ROW 3: 본문 3컬럼 ══ */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "32% 43% 25%",
                gap: "2px",
                flex: 1,
                minHeight: 0,
              }}>

                {/* ── COL A: 대표사진(flex 3) + 디테일사진(flex 2) ──
                    COL B의 발주수량(flex 3) + 주의사항(flex 2)과 비율 동일
                    → 대표사진 하단 = 발주수량 하단, 디테일사진 상단 = 주의사항 상단
                */}
                <div style={{
                  display: "flex", flexDirection: "column",
                  gap: "2px", minHeight: 0, height: "100%",
                }}>

                  {/* 대표사진 — flex 3 (COL B 발주수량과 동일 비율) */}
                  <div style={{
                    flex: "3 0 0", ...S.cell,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", minHeight: 0,
                  }}>
                    <div style={{ ...S.lbl, padding: "2px 4px", flexShrink: 0, textAlign: "left", fontSize: FM }}>
                      대표사진
                    </div>
                    <div style={{
                      flex: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#fafafa", minHeight: 0, overflow: "hidden",
                    }}>
                      {wo.productImage
                        ? <img
                            src={wo.productImage}
                            alt="대표사진"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (!wo.notionProductId || img.dataset.retried) return;
                              img.dataset.retried = "1";
                              fetch(`/api/notion-image?pageId=${wo.notionProductId}`)
                                .then(r => r.json())
                                .then(({ url }) => { if (url) img.src = url; })
                                .catch(() => {});
                            }}
                          />
                        : <span style={{ fontSize: FL, color: "#ccc" }}>대표사진</span>
                      }
                    </div>
                  </div>

                  {/* 디테일사진 — flex 2 (COL B 주의사항과 동일 비율) */}
                  <div style={{
                    flex: "2 0 0", ...S.cell,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", minHeight: 0,
                  }}>
                    <div style={{ ...S.lbl, padding: "2px 4px", flexShrink: 0, textAlign: "left", fontSize: FM }}>
                      디테일사진
                    </div>
                    <div style={{
                      flex: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#fafafa", minHeight: 0, overflow: "hidden",
                    }}>
                      {wo.detailImage
                        ? <img src={wo.detailImage} alt="디테일사진" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: FL, color: "#ccc" }}>디테일사진</span>
                      }
                    </div>
                  </div>
                </div>

                {/* ── COL B: 발주수량(flex 3) + 주의사항(flex 2) ── */}
                <div style={{
                  display: "flex", flexDirection: "column",
                  gap: "2px", minHeight: 0, height: "100%",
                }}>

                  {/* 발주수량 테이블 */}
                  <div style={{ flex: "3 0 0", overflow: "hidden", minHeight: 0 }}>
                    <table style={{
                      width: "100%", height: "100%",
                      borderCollapse: "collapse", tableLayout: "fixed",
                    }}>
                      <colgroup>
                        <col style={{ width: "20%" }} />
                        {wo.sizes.map((_, i) => <col key={i} />)}
                        <col style={{ width: "11%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={lbl({ padding: "1.5px 3px", fontSize: FM })}>발주수량</th>
                          {wo.sizes.map((sz) => (
                            <th key={sz} style={lbl({ padding: "1.5px", fontSize: FM })}>{sz}</th>
                          ))}
                          <th style={{ ...S.lbl, background: "#dde8ff", color: "#1a56db", padding: "1.5px", fontSize: FM }}>
                            계
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {wo.colorSizeTable.map((row, i) => (
                          <tr key={i}>
                            <td style={td({ fontWeight: 600, padding: "2px 3px", fontSize: FL })}>{row.color}</td>
                            {wo.sizes.map((sz) => (
                              <td key={sz} style={td({ padding: "2px", fontSize: FL })}>{row.sizes[sz] || 0}</td>
                            ))}
                            <td style={td({ fontWeight: 700, color: "#1a56db", padding: "2px", fontSize: FL })}>
                              {row.total}
                            </td>
                          </tr>
                        ))}
                        {Array.from({ length: emptyColorRows }).map((_, i) => (
                          <tr key={`e${i}`}>
                            <td style={td({ padding: "2px" })}>&nbsp;</td>
                            {wo.sizes.map((sz) => <td key={sz} style={td({ padding: "2px" })} />)}
                            <td style={td({ padding: "2px" })} />
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "2px 3px", fontSize: FL }}>
                            계
                          </td>
                          {wo.sizes.map((sz) => (
                            <td key={sz} style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "2px", fontSize: FL }}>
                              {colTotal(sz)}
                            </td>
                          ))}
                          <td style={{ ...S.cell, background: "#dde8ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "2px" }}>
                            {wo.totalQuantity}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* 주의사항 — flex 2 (COL A 디테일사진과 동일 비율, 시작점 맞춤) */}
                  <div style={{
                    flex: "2 0 0", ...S.cell,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", minHeight: 0,
                  }}>
                    <div style={{ ...S.lbl, padding: "2px 4px", flexShrink: 0, textAlign: "left", fontSize: FM }}>
                      주의 사항
                    </div>
                    <div style={{
                      padding: "5px 7px",
                      textAlign: "left",
                      fontSize: FS,
                      lineHeight: 1.7,
                      color: "#cc0000",
                      flex: 1,
                      overflow: "hidden",
                    }}>
                      {wo.cautions.split("\n").filter(Boolean).map((line, i) => (
                        <div key={i}>• {line}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── COL C: 제품사양(flex 3) + 오즈키즈 제공 부자재(flex 2) ── */}
                <div style={{
                  display: "flex", flexDirection: "column",
                  gap: "2px", minHeight: 0, height: "100%",
                }}>

                  {/* 제품 사양 */}
                  <div style={{
                    flex: "3 0 0", ...S.cell,
                    overflow: "hidden", minHeight: 0,
                    display: "flex", flexDirection: "column",
                  }}>
                    <table style={{
                      width: "100%", height: "100%",
                      borderCollapse: "collapse", tableLayout: "fixed",
                    }}>
                      <colgroup>
                        <col style={{ width: "44%" }} />
                        <col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th colSpan={2} style={lbl({ padding: "2px 4px", fontSize: FM })}>
                            제품 사양
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {wo.specs.map((spec, i) => (
                          <tr key={i}>
                            <td style={lbl({ fontSize: FM, padding: "2px 3px" })}>{spec.item}</td>
                            <td style={td({ fontSize: FL, padding: "2px 3px", textAlign: "left" })}>
                              {spec.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 오즈키즈 제공 부자재 */}
                  <div style={{
                    flex: "2 0 0", ...S.cell,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", minHeight: 0,
                  }}>
                    <div style={{ ...S.lbl, padding: "2px 4px", flexShrink: 0, textAlign: "left", fontSize: FM }}>
                      오즈키즈 제공 부자재
                    </div>
                    <div style={{
                      padding: "5px 7px",
                      textAlign: "left",
                      fontSize: FL,
                      lineHeight: 1.5,
                      flex: 1,
                      overflow: "hidden",
                    }}>
                      {wo.suppliedMaterials || "제공 없음"}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
