"use client";
import { useRef, useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import type { WorkOrder } from "@/types";

interface Props { wo: WorkOrder; onClose: () => void; }

/* ─────────────────────────────────────────────────────
   A4 가로: 297mm × 210mm  여백 5mm
   컬럼: 도식화(42%) | 사이즈스펙(22%) | 원부자재(36%)
   폰트: 기본 8pt (이전 7pt 대비 +15%)
───────────────────────────────────────────────────── */

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{
    width:297mm;height:210mm;overflow:hidden;
    font-family:'Noto Sans KR','Malgun Gothic',sans-serif;
    font-size:8.6pt;color:#111;background:#fff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  @page{size:A4 landscape;margin:5mm}
  .sheet{
    width:287mm;height:200mm;
    display:flex;flex-direction:column;gap:2px;
    overflow:hidden;
  }
  table{border-collapse:collapse;width:100%}
  td,th{border:.3pt solid #888;padding:1.5pt 2.5pt;vertical-align:middle;text-align:center;font-size:8pt;line-height:1.25}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;

/* 폰트 크기 4단계 통일 */
const FS = "5.5pt";  // 캡션·고정문구
const FM = "6.5pt";  // 테이블 라벨 헤더
const FL = "7.5pt";  // 기본 데이터
const FX = "8.5pt";  // 강조 (상품명·담당자·원가)

/* 기본 셀: 중앙 정렬 + 중앙 수직 */
const S = {
  cell: { border: ".3pt solid #888", textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FL },
  lbl:  { border: ".3pt solid #888", background: "#e8e8e8", fontWeight: 700, textAlign: "center" as const, verticalAlign: "middle" as const, fontSize: FM },
};
const td  = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.cell, ...x });
const lbl = (x?: React.CSSProperties): React.CSSProperties => ({ ...S.lbl,  ...x });
// 원부자재 전용 셀 — 줄바꿈 금지로 행 높이 균일 유지
const matTd = (x?: React.CSSProperties): React.CSSProperties => ({
  ...S.cell, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...x,
});

function ImgBox({ src, label, style }: { src: string; label: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      border: ".3pt solid #888",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#fafafa", overflow: "hidden", ...style,
    }}>
      {src
        ? <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <span style={{ fontSize: "8pt", color: "#ccc" }}>{label}</span>
      }
    </div>
  );
}

/* 원부자재 최소 표시 행 수 */
const MAT_MIN_ROWS = 23;

interface LabelPreset { id: string; group: string; name: string; imageData?: string; }

export default function WorkOrderPDFView({ wo, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sizes = wo.sizes || [];
  const colTotal = (sz: string) => wo.colorSizeTable.reduce((s, r) => s + (r.sizes[sz] || 0), 0);

  // COL B flex 비율: 컬러 수에 따라 발주표 높이 동적 계산
  const _colorRows      = wo.colorSizeTable.length;
  const _colorTotalRows = Math.max(6, _colorRows + 2);  // 헤더+데이터+합계, 최소 6
  const colBColorFlex   = _colorTotalRows * 3;           // 3 flex = 1행
  const colBLabelFlex   = 14;
  const colBSpecFlex    = Math.max(50, 110 - colBColorFlex - colBLabelFlex);

  // 선택된 라벨 다이어그램 이미지 로드 (브라우저에서만)
  const [selectedLabelImages, setSelectedLabelImages] = useState<{ name: string; group: string; imageData: string }[]>([]);
  useEffect(() => {
    const selected = wo.labelDiagramSelected ?? [];
    if (selected.length === 0) return;
    fetch("/api/label-presets")
      .then(r => r.json())
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) return;
        const presets: LabelPreset[] = rows.map(r => ({
          id: r.id, group: r.group_name, name: r.name,
          imageData: r.image_data ?? undefined,
        }));
        setSelectedLabelImages(
          presets
            .filter(p => selected.includes(p.id) && p.imageData)
            .map(p => ({ name: p.name, group: p.group, imageData: p.imageData! }))
        );
      })
      .catch(() => {});
  }, [wo.labelDiagramSelected]);

  function handlePrint() {
    const node = sheetRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=1500,height=1000");
    if (!win) return;
    // sheet 클래스 부여해서 인쇄 시 A4 정확히 맞춤
    const clone = node.cloneNode(true) as HTMLElement;
    clone.className = "sheet";
    clone.removeAttribute("style");
    win.document.write(`<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8"/>
      <title>작업지시서 — ${wo.styleNo} ${wo.productName} ${wo.orderCount}차</title>
      <style>${PRINT_CSS}</style>
    </head><body>${clone.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 700);
  }

  const FIXED_LABELS: [keyof WorkOrder["labels"], string][] = [
    ["main","메인라벨"],["care","케어라벨"],["reorderInfo","취급주의라벨"],
    ["priceTag","가격택"],["qualityTag","품질보증택"],["polybag","폴리백"],
    ["wappen","와펜"],["pointLabel","포인트라벨"],["artworkLabel","아트웍라벨"],
  ];
  const customLabels = wo.customLabels ?? [];
  const hasCustom = customLabels.length > 0;

  const BASE: React.CSSProperties = {
    fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif",
    fontSize: "8pt",
    color: "#111",
  };

  /* 원부자재 행 계산 */
  const matCount   = wo.materials.length;
  const compact    = matCount > MAT_MIN_ROWS;
  const emptyCount = compact ? 0 : MAT_MIN_ROWS - matCount;
  const matRatio   = compact ? Math.max(0.6, MAT_MIN_ROWS / matCount) : 1;
  const rowPad     = compact ? `${Math.round(0.9 * matRatio)}px 2px` : "2.5px 2px";
  // 원부자재 셀 폰트: 비압축 시 8pt (FL보다 0.5pt 크게), 압축 시 비율 축소
  const matFS      = compact ? `${(8 * matRatio).toFixed(1)}pt` : "8pt";
  const matHdrFS   = compact ? `${(7 * matRatio).toFixed(1)}pt` : "7pt";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: "1180px" }}>

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">작업지시서 미리보기</div>
            <div className="text-xs text-gray-400">
              {[wo.styleNo, wo.productName, `${wo.orderCount}차`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors">
              <Printer size={14} />인쇄 / PDF 저장
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── A4 가로 미리보기 ── */}
        <div className="overflow-auto" style={{ background: "#d1d5db", padding: "20px" }}>
          {/* A4 landscape 실제 비율: 297mm × 210mm */}
          <div style={{
            width: "min(100%, 1122px)",   /* 297mm @ 96dpi ≈ 1122px */
            aspectRatio: "297 / 210",
            background: "#fff", margin: "0 auto",
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "18pt", fontWeight: 900, letterSpacing: "6pt" }}>작 업 지 시 서</span>
              <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}>
                <img
                  src="/ozkiz-logo.png"
                  alt="OZKIZ"
                  style={{ height: "31px", maxWidth: "112px", objectFit: "contain", display: "inline-block" }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const span = document.createElement("span");
                    span.style.cssText = "font-size:16pt;font-weight:900;color:#cc0000;letter-spacing:2pt";
                    span.textContent = "OZKIZ";
                    target.parentElement?.appendChild(span);
                  }}
                />
              </div>
            </div>

            {/* ══ ROW 2: 제품정보 바 ══ */}
            <table style={{ tableLayout: "fixed", flexShrink: 0 }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "8%" }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <td style={lbl()}>STYLE NO</td>
                  <td style={lbl()}>상품명</td>
                  <td style={lbl()}>작업처</td>
                  <td style={lbl()}>차수</td>
                  <td style={lbl()}>SAMPLE NO.</td>
                  <td style={lbl()}>담당</td>
                  <td style={lbl()}>실장</td>
                  <td style={lbl()}>작성일</td>
                  <td style={lbl()}>납품예정일</td>
                </tr>
                <tr>
                  <td style={td({ fontSize: FL })}>{wo.styleNo}</td>
                  <td style={td({ fontWeight: 700, fontSize: FX })}>{wo.productName}</td>
                  <td style={td({ fontSize: FX })}>{wo.vendor}</td>
                  <td style={td({ fontWeight: 900, fontSize: "10pt", color: "#1a56db" })}>{wo.orderCount}차</td>
                  <td style={td({ fontSize: FL })}>{wo.sampleNo}</td>
                  <td style={td({ verticalAlign: "middle" })}>
                    {(() => {
                      const m = wo.manager?.match(/^([^(]+)(\([^)]+\))?$/);
                      return m ? (
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          <div style={{ fontSize: FX }}>{m[1].trim()}</div>
                          {m[2] && <div style={{ fontSize: FM, color: "#555", fontWeight: 500 }}>{m[2]}</div>}
                        </div>
                      ) : <div style={{ fontWeight: 700, fontSize: FX }}>{wo.manager}</div>;
                    })()}
                  </td>
                  <td style={td({ verticalAlign: "middle" })}>
                    {(() => {
                      const m = wo.director?.match(/^([^(]+)(\([^)]+\))?$/);
                      return m ? (
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          <div style={{ fontSize: FX }}>{m[1].trim()}</div>
                          {m[2] && <div style={{ fontSize: FM, color: "#555", fontWeight: 500 }}>{m[2]}</div>}
                        </div>
                      ) : <div style={{ fontWeight: 700, fontSize: FX }}>{wo.director}</div>;
                    })()}
                  </td>
                  <td style={td()}>{wo.issueDate}</td>
                  <td style={td({ color: "#cc0000", fontWeight: 700 })}>{wo.deliveryDate}</td>
                </tr>
              </tbody>
            </table>

            {/* ══ BODY: 3컬럼 (42% | 22% | 36%) ══ */}
            <div style={{
              display: "grid", gridTemplateColumns: "42% 22% 36%",
              gap: "2px", flex: 1, minHeight: 0,
            }}>

              {/* ── COL A: 도식화 / 제품사진+비고 / 고정문구 ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

                <ImgBox src={wo.sketchImage} label="도식화"
                  style={{ flex: "0 0 50%", minHeight: 0 }} />

                <div style={{ display: "grid", gridTemplateColumns: "38% 1fr", gap: "2px", flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ ...S.cell, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
                    <div style={{ ...S.lbl, padding: "1.5px 4px", flexShrink: 0, textAlign: "left" }}>제품사진</div>
                    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                      {wo.productImage
                        ? <img src={wo.productImage} alt="제품사진" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: "7pt", color: "#ccc" }}>제품사진</span>
                      }
                    </div>
                  </div>
                  <div style={{ ...S.cell, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                    <div style={{ ...S.lbl, padding: "1.5px 4px", flexShrink: 0, textAlign: "left" }}>주의사항</div>
                    <div style={{
                      flex: 1, padding: "3px 4px", textAlign: "left",
                      fontSize: FL, lineHeight: 1.5,
                      whiteSpace: "pre-wrap", overflow: "hidden",
                    }}>
                      {wo.productionNotes}
                    </div>
                  </div>
                </div>

                <div style={{
                  ...S.cell, flexShrink: 0,
                  padding: "2px 4px", fontSize: FS, textAlign: "left",
                  lineHeight: 1.45,
                }}>
                  {wo.fixedNotes.split("\n").map((line, i) => {
                    const isBullet = line.trimStart().startsWith("*");
                    const isEmpty  = line.trim() === "";
                    return (
                      <div key={i} style={{
                        fontWeight: (!isBullet && !isEmpty) ? 600 : 400,
                        marginBottom: isEmpty ? "1.5px" : 0,
                      }}>
                        {isEmpty ? " " : line}
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* ── COL B: 사이즈스펙 / 발주수량 / 라벨위치 ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

                {(() => {
                  const SPEC_MIN = 15;
                  const filled = wo.measurements.filter(m => m.item);
                  const dataRows = filled.filter(m => !m.isHeader).length;
                  const emptyRows = Math.max(0, SPEC_MIN - dataRows);
                  // 컬러 수에 따라 발주표 높이 동적 계산 (헤더+데이터+합계 = colorRows+2)
                  return (
                    <div style={{ flex: `${colBSpecFlex} 0 0`, overflow: "hidden", minHeight: 0 }}>
                      <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={lbl({ textAlign: "center", padding: "1px 3px", width: "28%" })}></th>
                            {sizes.map(s => (
                              <th key={s} style={lbl({ padding: "1px" })}>{s}</th>
                            ))}
                            <th style={lbl({ padding: "1px", width: "12%" })}>편차</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filled.map((m, i) => m.isHeader ? (
                            // ── 구분 헤더 행 ──
                            <tr key={i}>
                              <td colSpan={sizes.length + 2} style={{
                                ...S.lbl,
                                background: "#d4d8e8",
                                fontSize: "6.3pt",
                                padding: "1.5px 4px",
                                textAlign: "center",
                                fontWeight: 800,
                                letterSpacing: "0.3pt",
                              }}>{m.item}</td>
                            </tr>
                          ) : (
                            // ── 일반 측정 행 ──
                            <tr key={i}>
                              <td style={td({ fontWeight: 600, background: "#f8f8f8", padding: "1px 2px" })}>{m.item}</td>
                              {sizes.map(s => (
                                <td key={s} style={td({ padding: "1px" })}>{m.values[s] || ""}</td>
                              ))}
                              <td style={td({ padding: "1px" })}>{m.diff}</td>
                            </tr>
                          ))}
                          {/* 15줄 고정 — 기존과 동일한 패딩으로 공란 */}
                          {Array.from({ length: emptyRows }).map((_, i) => (
                            <tr key={`sp${i}`}>
                              <td style={td({ padding: "1px 2px" })}>&nbsp;</td>
                              {sizes.map(s => <td key={s} style={td({ padding: "1px" })} />)}
                              <td style={td({ padding: "1px" })} />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                <div style={{ flex: `${colBColorFlex} 0 0`, minHeight: 0 }}>
                  <table style={{ width: "100%", height: "100%" }}>
                    <thead>
                      <tr>
                        <th style={lbl({ padding: "1px 3px", width: "28%" })}>COLOR</th>
                        {sizes.map(s => (
                          <th key={s} style={lbl({ padding: "1px" })}>{s}</th>
                        ))}
                        <th style={{ ...S.lbl, background: "#dde8ff", color: "#1a56db", padding: "1px", width: "12%" }}>계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.colorSizeTable.map((row, i) => (
                        <tr key={i}>
                          <td style={td({ fontWeight: 600, padding: "1.5px 2px" })}>{row.color}</td>
                          {sizes.map(s => (
                            <td key={s} style={td({ padding: "1.5px" })}>{row.sizes[s] || 0}</td>
                          ))}
                          <td style={td({ fontWeight: 700, color: "#1a56db", padding: "1.5px" })}>{row.total}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 4 - wo.colorSizeTable.length) }).map((_, i) => (
                        <tr key={`e${i}`}>
                          <td style={td({ padding: "1.5px 2px" })}>&nbsp;</td>
                          {sizes.map(s => <td key={s} style={td({ padding: "1.5px" })}></td>)}
                          <td style={td({ padding: "1.5px" })}></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px 2px" }}>계</td>
                        {sizes.map(s => (
                          <td key={s} style={{ ...S.cell, background: "#f0f0f0", fontWeight: 700, padding: "1.5px" }}>{colTotal(s)}</td>
                        ))}
                        <td style={{ ...S.cell, background: "#dde8ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "1.5px" }}>
                          {wo.totalQuantity}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 라벨 위치 다이어그램 — 선택된 이미지 그리드 */}
                {(() => {
                  const count = selectedLabelImages.length;
                  const cols = Math.min(count || 1, 3);
                  const colPct = `${(100 / cols).toFixed(1)}%`;
                  return (
                    <div style={{
                      flex: `${colBLabelFlex} 0 0`, minHeight: 0,
                      border: ".3pt solid #888", background: "#fafafa",
                      display: "flex", flexDirection: "row",
                      alignItems: "stretch",
                      justifyContent: count === 0 ? "center" : "flex-start",
                      overflow: "hidden",
                    }}>
                      {count === 0 ? (
                        <span style={{ fontSize: FL, color: "#ccc", margin: "auto" }}>라벨 위치 다이어그램</span>
                      ) : selectedLabelImages.map((item, i) => (
                        <div key={i} style={{
                          width: colPct, flexShrink: 0,
                          display: "flex", flexDirection: "column", alignItems: "center",
                          borderRight: i < count - 1 ? ".3pt solid #ddd" : "none",
                          padding: "2px 1px 1px",
                          overflow: "hidden",
                        }}>
                          <img src={item.imageData} alt={item.name}
                            style={{ width: "100%", flex: 1, objectFit: "contain", minHeight: 0 }} />
                          <div style={{
                            fontSize: FS, color: "#555", textAlign: "center",
                            lineHeight: 1.2, marginTop: "1px", flexShrink: 0,
                          }}>
                            {item.group} · {item.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>

              {/* ── COL C: 원부자재(박스1) / 라벨(박스2) / 업체(박스3) ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minHeight: 0 }}>

                {/* ── 박스1: 원부자재 테이블 + 최종원가 (57% 고정) ── */}
                <div style={{ flex: "0 0 57%", overflow: "hidden", display: "flex", flexDirection: "column" }}>

                  {/* 원부자재 데이터 — 남은 공간 채움 */}
                  <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                    <table style={{ width: "100%", height: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                      <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {["품목","자재명","색상","규격","요척","단가","원단발주","비고"].map((name) => (
                            <th key={name} style={lbl({ fontSize: matHdrFS })}>{name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sameGroup = (a: typeof wo.materials[0], b: typeof wo.materials[0]) =>
                            a.category === b.category && a.name === b.name;
                          const spans: number[] = wo.materials.map((m, i) => {
                            if (i > 0 && sameGroup(wo.materials[i - 1], m)) return 0;
                            let span = 1;
                            while (i + span < wo.materials.length && sameGroup(m, wo.materials[i + span])) span++;
                            return span;
                          });
                          return wo.materials.map((m, i) => {
                            // 자재명 줄 수에 맞게 폰트 비례 축소 → 행 높이 균일 유지
                            const lines = m.name.split("\n").length;
                            const rFS   = lines > 1 ? `${(parseFloat(matFS) / lines).toFixed(1)}pt` : matFS;
                            const rPad  = lines > 1 ? `0px 2px` : rowPad;
                            return (
                              <tr key={i}>
                                {spans[i] > 0 && (
                                  <td rowSpan={spans[i]} style={matTd({ fontSize: rFS, padding: rPad, verticalAlign: "middle" })}>
                                    {m.category}
                                  </td>
                                )}
                                <td style={matTd({ fontSize: rFS, padding: rPad, whiteSpace: "pre-line", lineHeight: 1.25 })}>{m.name}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.color}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.spec}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.yield}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.unitPrice}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad })}>{m.orderUnit}</td>
                                <td style={matTd({ fontSize: rFS, padding: rPad, textAlign: "left" })}>{m.notes}</td>
                              </tr>
                            );
                          });
                        })()}
                        {Array.from({ length: emptyCount }).map((_, i) => (
                          <tr key={`em${i}`}>
                            {Array.from({ length: 8 }).map((__, j) => (
                              <td key={j} style={matTd({ padding: "0 2px" })}>&nbsp;</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 최종원가 — 항상 하단에 고정 표시 */}
                  <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", flexShrink: 0 }}>
                    <colgroup>
                      <col style={{ width: "12%" }} /><col style={{ width: "22%" }} /><col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} /><col style={{ width: "9%" }} />
                      <col style={{ width: "8%" }} /><col style={{ width: "9%" }} /><col style={{ width: "20%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan={5} style={{ ...S.cell, background: "#f0f4ff", fontWeight: 800, fontSize: FL, letterSpacing: "0.5pt", padding: "2.5px 2px" }}>
                          최종원가
                        </td>
                        <td colSpan={3} style={{ ...S.cell, background: "#f0f4ff", fontWeight: 900, color: "#1a56db", fontSize: FX, padding: "2.5px 2px" }}>
                          {wo.totalCost}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                </div>

                {/* ── 박스2: 라벨 체크 ── */}
                <div style={{ flexShrink: 0, border: "1px solid #e5e7eb" }}>
                  <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: "collapse" }}>
                    <colgroup>
                      {FIXED_LABELS.map(([, name]) => <col key={name} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        {FIXED_LABELS.map(([, name]) => (
                          <th key={name} style={lbl({ padding: '1px 1px' })}>{name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {FIXED_LABELS.map(([key, name]) => (
                          <td key={name} style={td({ fontSize: FX, padding: '2px 1px' })}>
                            {wo.labels[key] ? '✓' : ''}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        {FIXED_LABELS.map(([key, name]) => (
                          <td key={name} style={td({ fontSize: FM, color: '#555', padding: '1.5px 1px' })}>
                            {wo.labels[key] ? '1EA' : ' '}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  {hasCustom && (
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: "collapse", marginTop: '1px' }}>
                      <colgroup>{customLabels.map((_, i) => <col key={i} />)}</colgroup>
                      <thead>
                        <tr>{customLabels.map((name, i) => <th key={i} style={lbl({ padding: '1px 1px' })}>{name}</th>)}</tr>
                      </thead>
                      <tbody>
                        <tr>{customLabels.map((_, i) => <td key={i} style={td({ fontSize: FX, padding: '2px 1px' })}>✓</td>)}</tr>
                        <tr>{customLabels.map((_, i) => <td key={i} style={td({ fontSize: FM, color: '#555', padding: '1.5px 1px' })}>1EA</td>)}</tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* ── 박스3: 원부자재 업체 정보 — 4줄 고정, 원부자재 표와 동일 간격 ── */}
                {(() => {
                  const rows = wo.vendorInfoTable ?? [];
                  const VENDOR_ROWS = 3;
                  const displayRows = rows.length >= VENDOR_ROWS ? rows.slice(0, VENDOR_ROWS) : [
                    ...rows,
                    ...Array.from({ length: VENDOR_ROWS - rows.length }, (_, i) => ({
                      id: `empty-${i}`, materialType: "", vendorName: "", manager: "", contact: "", notes: "",
                    })),
                  ];
                  const border = "1px solid #e5e7eb";
                  const vPad = "1px 3px";
                  return (
                    <div style={{ flexShrink: 0, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "24%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "24%" }} />
                          <col style={{ width: "18%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: "#f3f4f6" }}>
                            {["종류", "업체명", "담당자", "연락처", "비고"].map((h) => (
                              <th key={h} style={{ border, padding: vPad, fontWeight: 700, textAlign: "center", fontSize: FM }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row) => (
                            <tr key={row.id}>
                              <td style={{ border, padding: vPad, fontSize: FS, verticalAlign: "middle" }}>{row.materialType}</td>
                              <td style={{ border, padding: vPad, fontSize: FS, verticalAlign: "middle" }}>{row.vendorName}</td>
                              <td style={{ border, padding: vPad, fontSize: FS, verticalAlign: "middle" }}>{(row as any).manager ?? ""}</td>
                              <td style={{ border, padding: vPad, fontSize: FS, verticalAlign: "middle" }}>{row.contact}</td>
                              <td style={{ border, padding: vPad, fontSize: FS, verticalAlign: "middle" }}>{row.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

              </div>
            </div>{/* end body grid */}

          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
