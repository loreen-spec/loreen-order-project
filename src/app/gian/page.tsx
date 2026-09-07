"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, FilePlus, Building2, RefreshCw, Clock, Upload, Copy, Check,
  ArrowRight, Trash2, Puzzle, AlertTriangle, X, Plus, Send,
} from "lucide-react";
import type { Statement, Vendor, GianDoc, Recurring, StatementItem } from "@/lib/gian/types";
import { buildApprovalLine, needsCeoApproval } from "@/lib/gian/approvalLine";
import {
  won, buildTitle, buildBodyHtml, buildBodyText, buildNote, summarizeItems,
  recalcTotals, BODY_INTRO,
} from "@/lib/gian/generate";
import { prepareFile } from "@/lib/gian/parseFile";
import {
  uid, getVendors, saveVendor, deleteVendor, matchVendor,
  getDocs, saveDoc, deleteDoc, getRecurring, saveRecurring, deleteRecurring,
} from "@/lib/gian/store";

const V = "#836CE0";
const VD = "#5B44C4";
type Screen = "home" | "create" | "vendors" | "recurring" | "history";

// ── '기안 대기'(초안) 목록을 확장프로그램으로 동기화 ──────────────
// 초안 상태 문서들의 하이웍스 입력용 payload를 localStorage에 저장하고
// 확장(content-app.js)에 갱신 신호를 보낸다. 확장은 이를 하이웍스 패널에 리스트로 표시.
function syncPending() {
  if (typeof window === "undefined") return;
  const drafts = getDocs().filter((d) => d.status === "초안");
  const list = drafts.map((d) => {
    const vendor = matchVendor(d.statement.vendor);
    return {
      id: d.id,
      title: d.title,
      grandTotal: d.statement.grandTotal,
      vendor: d.statement.vendor,
      bodyHtml: buildBodyHtml(d.statement, vendor),
      note: buildNote(d.statement, vendor),
      approval: d.approval,
    };
  });
  try { localStorage.setItem("gm_pending_hiworks_list", JSON.stringify(list)); } catch {}
  window.postMessage({ source: "gianmate-synclist" }, "*");
}

export default function GianMate() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    syncPending(); // 대기 목록을 확장에 동기화
    if (typeof window !== "undefined" && window.location.hash === "#demo") setScreen("create");
  }, []);
  if (!mounted) return <div style={{ minHeight: "100vh", background: "#FAF9FC" }} />;

  return (
    <div className="flex min-h-screen" style={{ background: "#FAF9FC" }}>
      <Side screen={screen} setScreen={setScreen} />
      <main className="flex-1 min-w-0 px-6 lg:px-8 py-7 max-w-[1120px]">
        {screen === "home" && <HomeScreen go={setScreen} />}
        {screen === "create" && <CreateScreen go={setScreen} />}
        {screen === "vendors" && <VendorsScreen />}
        {screen === "recurring" && <RecurringScreen />}
        {screen === "history" && <HistoryScreen />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────── Sidebar
function Side({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const items: [Screen, string, any][] = [
    ["home", "홈", Home],
    ["create", "새 기안서 작성", FilePlus],
    ["vendors", "업체 관리", Building2],
    ["recurring", "정기결제", RefreshCw],
    ["history", "기안 이력", Clock],
  ];
  return (
    <aside className="w-[220px] shrink-0 border-r bg-white px-3 py-5 sticky top-0 h-screen flex flex-col"
      style={{ borderColor: "#E9E5F2" }}>
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white font-extrabold"
          style={{ background: `linear-gradient(135deg,${V},${VD})` }}>기</div>
        <div>
          <div className="font-extrabold text-[15px] leading-tight">GianMate</div>
          <div className="text-[11px] text-gray-400 font-semibold">거래명세서 → 기안서</div>
        </div>
      </div>
      {items.map(([key, label, Icon]) => (
        <button key={key} onClick={() => setScreen(key)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold mb-0.5 transition-colors"
          style={screen === key ? { background: "#EFEAFB", color: VD } : { color: "#6B6579" }}>
          <Icon size={18} /> {label}
        </button>
      ))}
      <a href="/" className="mt-auto text-[12px] text-gray-400 px-3 py-2 hover:text-gray-600">← 대시보드로</a>
    </aside>
  );
}

// ─────────────────────────────────────────────── 공용 UI
function Card({ children, className = "" }: any) {
  return <div className={`bg-white border rounded-2xl ${className}`} style={{ borderColor: "#E9E5F2", boxShadow: "0 1px 2px rgba(30,27,46,.04),0 8px 24px rgba(91,68,196,.05)" }}>{children}</div>;
}
function Pill({ children, tone = "gray" }: { children: any; tone?: "gray" | "ok" | "warn" | "draft" }) {
  const map: any = {
    gray: ["#F4F2FA", "#6B6579"], ok: ["#E7F5EC", "#16A34A"],
    warn: ["#FBF0DF", "#D97706"], draft: ["#EFEAFB", VD],
  };
  const [bg, c] = map[tone];
  return <span className="inline-flex items-center gap-1 text-[11.5px] font-bold rounded-full px-2.5 py-0.5" style={{ background: bg, color: c }}>{children}</span>;
}
function Btn({ children, kind = "pri", ...p }: any) {
  const base = "inline-flex items-center justify-center gap-1.5 font-bold text-[13.5px] rounded-[10px] px-4 py-2.5 cursor-pointer transition-colors disabled:opacity-50";
  const style = kind === "pri"
    ? { background: V, color: "#fff" }
    : { background: "#fff", color: "#1E1B2E", border: "1px solid #DDD7EC" };
  return <button className={base} style={style} {...p}>{children}</button>;
}
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, text: string, html?: string) {
    try {
      if (html && (navigator.clipboard as any)?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      alert("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  }
  return { copied, copy };
}

// ─────────────────────────────────────────────── 홈
function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const docs = getDocs();
  const recs = getRecurring().filter((r) => r.active);
  const now = new Date();
  const thisMonth = docs.filter((d) => new Date(d.createdAt).getMonth() === now.getMonth());
  const waiting = docs.filter((d) => d.status === "초안" || d.status === "확인필요");
  const monthAmt = thisMonth.reduce((a, d) => a + d.statement.grandTotal, 0);

  return (
    <>
      <Header title="안녕하세요 👋" sub="이번 달 기안 현황과 오늘 처리할 일이에요."
        action={<Btn onClick={() => go("create")}><Plus size={16} /> 새 기안서 작성</Btn>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <Stat k="이번 달 기안" v={`${thisMonth.length}건`} dot={V} />
        <Stat k="상신 대기" v={`${waiting.length}건`} dot="#D97706" d="검토 후 상신하세요" />
        <Stat k="등록 업체" v={`${getVendors().length}곳`} dot="#16A34A" />
        <Stat k="이번 달 금액" v={`₩${won(monthAmt)}`} dot={VD} />
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4.5" style={{ gap: 18 }}>
        <Card className="p-5">
          <SecTitle title="상신 대기 중" link="전체 보기 →" onLink={() => go("history")} />
          {waiting.length === 0 ? (
            <Empty text="아직 작성한 기안서가 없어요. '새 기안서 작성'으로 시작해보세요." />
          ) : (
            <table className="w-full">
              <thead><Tr head cells={["업체", "제목", "금액", "상태"]} align={["l", "l", "r", "l"]} /></thead>
              <tbody>
                {waiting.slice(0, 6).map((d) => (
                  <Tr key={d.id} cells={[
                    <b>{d.statement.vendor}</b>, d.title.replace(/^\[지출결의서\]\s*/, ""),
                    <span className="tabular-nums">₩{won(d.statement.grandTotal)}</span>,
                    <Pill tone={d.status === "확인필요" ? "warn" : "draft"}>{d.status}</Pill>,
                  ]} align={["l", "l", "r", "l"]} />
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="p-5">
          <SecTitle title="정기결제" link="관리 →" onLink={() => go("recurring")} />
          {recs.length === 0 ? <Empty text="등록된 정기결제가 없어요." /> : (
            <div>
              {recs.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3 border-t first:border-t-0" style={{ borderColor: "#E9E5F2" }}>
                  <div className="w-9 h-9 rounded-[10px] grid place-items-center font-bold text-[12px]" style={{ background: "#EFEAFB", color: VD }}>{r.name.slice(0, 2)}</div>
                  <div><div className="font-bold text-[13.5px]">{r.name}</div><div className="text-[12px] text-gray-400">매월 {r.dayOfMonth}일</div></div>
                  <div className="ml-auto font-extrabold tabular-nums">₩{won(r.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────── 새 기안서 작성 (핵심 흐름)
type Step = 1 | 2 | 3;
function CreateScreen({ go }: { go: (s: Screen) => void }) {
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [st, setSt] = useState<Statement | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 예시 미리보기: 주소 끝에 #demo 를 붙이면 샘플 명세서로 흐름을 확인할 수 있어요.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#demo") {
      const demo = recalcTotals({
        vendor: "(주)대한부자재", bizNo: "214-81-45210", date: new Date().toISOString().slice(0, 10),
        items: [
          { name: "EVA 폼시트 3T", unitPrice: 12000, qty: 200, supply: 2400000, vat: 240000, total: 2640000 },
          { name: "부직포 접착심지", unitPrice: 3500, qty: 100, supply: 350000, vat: 35000, total: 385000 },
          { name: "포장용 PE백", unitPrice: 90, qty: 4000, supply: 359091, vat: 35909, total: 395000 },
        ],
        supplyTotal: 0, vatTotal: 0, grandTotal: 0,
        confidence: { vendor: 0.98, date: 0.96, grandTotal: 0.99, vat: 0.55 },
      });
      setSt(demo); setVendor(matchVendor(demo.vendor)); setStep(3);
    }
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];
    setErr(""); setBusy(true); setFileName(file.name);
    setImgUrl(/^image\//.test(file.type) ? URL.createObjectURL(file) : null);
    try {
      const input = await prepareFile(file);
      const res = await fetch("/api/gian/extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.kind === "image"
          ? { imageBase64: input.imageBase64, mimeType: input.mimeType }
          : { text: input.text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인식 실패");
      const statement: Statement = recalcTotals(data.statement);
      setSt(statement);
      setVendor(matchVendor(statement.vendor));
      setStep(2);
    } catch (e: any) {
      setErr(e.message || "인식 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="새 기안서 작성" sub="거래명세서를 올리면 내용을 읽어 기안서를 자동으로 채워드려요." />
      <Steps step={step} />
      {err && <div className="mb-4 flex items-center gap-2 text-[13px] rounded-xl px-4 py-3" style={{ background: "#FBF0DF", color: "#B45309" }}><AlertTriangle size={16} /> {err}</div>}

      {step === 1 && (
        <div className="grid md:grid-cols-2 gap-4.5" style={{ gap: 18 }}>
          <div>
            <div onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
              className="border-2 border-dashed rounded-2xl p-9 text-center cursor-pointer transition-colors bg-white hover:bg-[#EFEAFB]"
              style={{ borderColor: "#DDD7EC" }}>
              <div className="w-13 h-13 rounded-2xl grid place-items-center mx-auto mb-3.5" style={{ width: 52, height: 52, background: "#EFEAFB", color: VD }}>
                {busy ? <RefreshCw size={26} className="animate-spin" /> : <Upload size={26} />}
              </div>
              <h4 className="font-bold text-[15px] mb-1.5">{busy ? "인식 중…" : "여기로 파일을 끌어다 놓으세요"}</h4>
              <p className="text-gray-400 text-[12.5px]">{busy ? fileName : "또는 클릭해서 선택 · 사진·PDF·엑셀·캡쳐"}</p>
              <div className="flex gap-1.5 justify-center mt-3.5 flex-wrap">
                {["📷 사진", "📄 PDF", "📊 엑셀", "🖼 캡쳐"].map((c) => (
                  <span key={c} className="text-[11px] font-bold px-2.5 py-1 rounded-md" style={{ background: "#F4F2FA", color: "#6B6579" }}>{c}</span>
                ))}
              </div>
              <input ref={inputRef} type="file" hidden accept="image/*,.pdf,.xlsx,.xls,.csv"
                onChange={(e) => onFiles(e.target.files)} />
            </div>
            <p className="text-[12.5px] text-gray-400 mt-2">💡 엑셀·전자PDF는 오차 없이 정확 인식, 사진·캡쳐는 자동 인식 후 확인만 하면 됩니다.</p>
          </div>
          {imgUrl && (
            <Card className="overflow-hidden">
              <img src={imgUrl} alt="미리보기" className="w-full max-h-[340px] object-contain bg-[#F4F2FA]" />
              <div className="px-3 py-2.5 text-[12px] text-gray-500 border-t" style={{ borderColor: "#E9E5F2" }}>{fileName}</div>
            </Card>
          )}
        </div>
      )}

      {step === 2 && st && (
        <ReviewStep st={st} setSt={setSt} vendor={vendor} setVendor={setVendor}
          onNext={() => setStep(3)} imgUrl={imgUrl} fileName={fileName} />
      )}

      {step === 3 && st && (
        <PreviewStep st={st} vendor={vendor} onBack={() => setStep(2)} onSaved={() => go("history")} />
      )}
    </>
  );
}

function Steps({ step }: { step: Step }) {
  const labels = ["명세서 업로드", "인식 결과 확인", "기안서 미리보기"];
  return (
    <div className="flex gap-2 mb-5 flex-wrap">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const on = n === step, done = n < step;
        return (
          <div key={l} className="flex items-center gap-2 text-[12.5px] font-bold px-3 py-1.5 rounded-full border"
            style={done ? { color: "#16A34A", borderColor: "#16A34A", background: "#E7F5EC" }
              : on ? { color: VD, borderColor: V, background: "#EFEAFB" }
                : { color: "#9B94AA", borderColor: "#E9E5F2", background: "#fff" }}>
            <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] text-white"
              style={{ background: done ? "#16A34A" : on ? V : "#C9C2DA" }}>{done ? "✓" : n}</span>
            {l}
          </div>
        );
      })}
    </div>
  );
}

// ── 2단계: 인식 결과 확인 (편집 가능) ──
function ReviewStep({ st, setSt, vendor, setVendor, onNext, imgUrl, fileName }: {
  st: Statement; setSt: (s: Statement) => void; vendor: Vendor | null;
  setVendor: (v: Vendor | null) => void; onNext: () => void; imgUrl: string | null; fileName: string;
}) {
  const vendors = getVendors();
  const conf = st.confidence || {};
  function set<K extends keyof Statement>(k: K, v: Statement[K]) { setSt({ ...st, [k]: v }); }
  function setItem(i: number, k: keyof StatementItem, v: any) {
    const items = st.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it);
    setSt(recalcTotals({ ...st, items }));
  }
  function addItem() {
    setSt({ ...st, items: [...st.items, { name: "", unitPrice: 0, qty: 1, supply: 0, vat: 0, total: 0 }] });
  }
  function delItem(i: number) { setSt(recalcTotals({ ...st, items: st.items.filter((_, idx) => idx !== i) })); }

  const vatLow = (conf.vat ?? 1) < 0.7;

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4.5" style={{ gap: 18 }}>
      <div>
        {imgUrl ? (
          <Card className="overflow-hidden mb-3">
            <img src={imgUrl} alt="명세서" className="w-full max-h-[360px] object-contain bg-[#F4F2FA]" />
            <div className="px-3 py-2 text-[12px] text-gray-500 border-t flex items-center gap-2" style={{ borderColor: "#E9E5F2" }}>
              <Pill tone="ok">✓ 인식 완료</Pill> {fileName}
            </div>
          </Card>
        ) : (
          <Card className="p-4 mb-3 text-[13px] text-gray-500 flex items-center gap-2">
            <Pill tone="ok">✓ 인식 완료</Pill> {fileName}
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="거래처(업체)" conf={conf.vendor}>
            <input className="gm-inp" value={st.vendor} onChange={(e) => { set("vendor", e.target.value); setVendor(matchVendor(e.target.value)); }}
              list="vendor-list" />
            <datalist id="vendor-list">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
          </Field>
          <Field label="거래일자" conf={conf.date}>
            <input className="gm-inp" type="date" value={st.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="사업자번호" conf={vendor ? 1 : conf.bizNo}>
            <input className="gm-inp" value={st.bizNo || vendor?.bizNo || ""} onChange={(e) => set("bizNo", e.target.value)} />
          </Field>
          <Field label={<>계정과목 {vendor && <Pill tone="draft">DB 자동</Pill>}</>}>
            <input className="gm-inp" value={vendor?.account || ""} onChange={(e) => setVendor(vendor ? { ...vendor, account: e.target.value } : { id: uid(), name: st.vendor, account: e.target.value })} placeholder="예: 원부자재비" />
          </Field>
        </div>
        {!vendor && st.vendor && (
          <div className="text-[12px] rounded-lg px-3 py-2 mb-2" style={{ background: "#EFEAFB", color: VD }}>
            💡 처음 보는 업체예요. 미리보기에서 저장하면 다음부터 자동으로 채워집니다.
          </div>
        )}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-[15px]">품목 · 금액</h3>
          <Pill tone="gray">자동 채움</Pill>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12.5px]" style={{ minWidth: 460 }}>
            <thead><Tr head cells={["항목", "단가", "수량", "공급가액", "세액", ""]} align={["l", "r", "r", "r", "r", "l"]} /></thead>
            <tbody>
              {st.items.map((it, i) => (
                <tr key={i}>
                  <td className="py-1 pr-1"><input className="gm-inp !py-1.5" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} /></td>
                  <td className="py-1 px-1"><input className="gm-inp !py-1.5 text-right tabular-nums w-[80px]" value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", Number(e.target.value.replace(/[^\d]/g, "")))} /></td>
                  <td className="py-1 px-1"><input className="gm-inp !py-1.5 text-right w-[52px]" value={it.qty} onChange={(e) => setItem(i, "qty", Number(e.target.value.replace(/[^\d]/g, "")))} /></td>
                  <td className="py-1 px-1"><input className="gm-inp !py-1.5 text-right tabular-nums w-[90px]" value={it.supply} onChange={(e) => setItem(i, "supply", Number(e.target.value.replace(/[^\d]/g, "")))} /></td>
                  <td className="py-1 px-1"><input className={`gm-inp !py-1.5 text-right tabular-nums w-[80px] ${vatLow ? "gm-flag" : ""}`} value={it.vat} onChange={(e) => setItem(i, "vat", Number(e.target.value.replace(/[^\d]/g, "")))} /></td>
                  <td className="py-1"><button onClick={() => delItem(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addItem} className="text-[12.5px] font-bold mt-2 flex items-center gap-1" style={{ color: VD }}><Plus size={14} /> 품목 추가</button>

        <div className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#EFEAFB" }}>
          <span className="font-bold" style={{ color: VD }}>합계 금액</span>
          <span className="text-[20px] font-extrabold tabular-nums" style={{ color: VD }}>₩ {won(st.grandTotal)}</span>
        </div>
        {needsCeoApproval(st.grandTotal) && (
          <div className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: "#D97706" }}>
            <AlertTriangle size={14} /> 100만원 이상 — <b>대표님(Hans최철용) 결재</b>가 결재선에 추가됩니다.
          </div>
        )}
        {vatLow && <div className="text-[12px] mt-2 text-gray-500">⚠️ 세액은 자동 추정값이에요. 명세서와 대조해 확인해주세요.</div>}
        <Btn onClick={onNext} style={{ width: "100%", marginTop: 14 }}>기안서 미리보기 <ArrowRight size={16} /></Btn>
      </Card>
    </div>
  );
}

// ── 3단계: 미리보기 + 하이웍스로 보내기 ──
function PreviewStep({ st, vendor, onBack, onSaved }: {
  st: Statement; vendor: Vendor | null; onBack: () => void; onSaved: () => void;
}) {
  const { copied, copy } = useCopy();
  const [sent, setSent] = useState(false);
  const title = useMemo(() => buildTitle(st), [st]);
  const bodyHtml = useMemo(() => buildBodyHtml(st, vendor), [st, vendor]);
  const bodyText = useMemo(() => buildBodyText(st, vendor), [st, vendor]);
  const approval = useMemo(() => buildApprovalLine(st.grandTotal), [st.grandTotal]);
  const note = buildNote(st, vendor);

  function persist(status: GianDoc["status"]) {
    const doc: GianDoc = {
      id: uid(), createdAt: new Date().toISOString(), title, bodyIntro: BODY_INTRO,
      statement: st, approval, status,
    };
    saveDoc(doc);
    // 업체 자동 저장/갱신
    if (st.vendor) {
      const v: Vendor = vendor
        ? { ...vendor, lastUsed: st.date }
        : { id: uid(), name: st.vendor, bizNo: st.bizNo, type: "건별", lastUsed: st.date };
      saveVendor(v);
    }
    syncPending(); // 대기 목록 갱신 → 확장 패널에 반영
  }
  function queueDraft() {
    // 기안 대기(초안)로 담기 → 확장 패널 리스트에 뜸
    persist("초안");
    setSent(true);
  }
  function openHiworks() {
    window.open("https://approval.office.hiworks.com/openhan.kr/approval/document/write", "_blank");
  }

  return (
    <>
      <div className="flex justify-end mb-3"><Btn kind="ghost" onClick={onBack}>← 인식 결과로</Btn></div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-4.5 items-start" style={{ gap: 18 }}>
        {/* 문서 미리보기 */}
        <Card className="p-7">
          <h2 className="text-center text-[20px] font-extrabold tracking-[0.2em] mb-1">지 출 결 의 서</h2>
          <div className="text-center text-gray-400 text-[12px] mb-5">기안일: {new Date().toLocaleDateString("ko-KR")} · 기안자: Loreen박정은</div>

          {/* 결재선 */}
          <div className="border rounded-lg overflow-hidden mb-4 text-[12px]" style={{ borderColor: "#DDD7EC" }}>
            <div className="grid" style={{ gridTemplateColumns: `70px repeat(${approval.approvers.length}, 1fr)` }}>
              <div className="bg-[#F4F2FA] p-2 font-bold text-gray-500 border-r grid place-items-center" style={{ borderColor: "#E9E5F2" }}>결재</div>
              {approval.approvers.map((a, i) => (
                <div key={i} className="p-2 border-r last:border-r-0 text-center" style={{ borderColor: "#E9E5F2" }}>
                  <div className="text-[10px] text-gray-400">{a.role}</div>
                  <div className="font-semibold mt-1">{a.name}</div>
                </div>
              ))}
            </div>
            <div className="grid border-t" style={{ gridTemplateColumns: "70px 1fr", borderColor: "#E9E5F2" }}>
              <div className="bg-[#F4F2FA] p-2 font-bold text-gray-500 border-r grid place-items-center" style={{ borderColor: "#E9E5F2" }}>참조</div>
              <div className="p-2 text-gray-600">{approval.references.map((r) => r.name).join(", ")}</div>
            </div>
          </div>

          <div className="mb-1 text-[12px] text-gray-400 font-bold">제목</div>
          <div className="font-bold text-[15px] mb-4">{title}</div>

          <p className="text-center font-bold my-3">{BODY_INTRO}</p>
          <div className="overflow-x-auto"><HiworksTable st={st} /></div>
          <div className="mt-3 text-[13px]"><b>[비고]</b> {note}</div>

          <div className="mt-4 rounded-lg px-4 py-3 flex items-center justify-between" style={{ background: "#EFEAFB" }}>
            <span className="font-bold" style={{ color: VD }}>합계 지급금액</span>
            <span className="text-[20px] font-extrabold tabular-nums" style={{ color: VD }}>₩ {won(st.grandTotal)}</span>
          </div>
        </Card>

        {/* 보내기 패널 */}
        <div className="space-y-3">
          <Card className="p-5">
            <div className="gm-eyebrow">하이웍스로 보내기</div>
            <div className="flex gap-3 items-start rounded-xl p-3.5 mt-2 mb-3" style={{ background: "#EFEAFB", border: "1px solid #DDD7EC" }}>
              <Puzzle size={20} style={{ color: VD }} className="shrink-0 mt-0.5" />
              <div className="text-[12.5px]">① <b style={{ color: VD }}>기안 대기에 담기</b> → ② 하이웍스 열기 → ③ 우측 패널 <b>목록에서 골라 [채우기]</b>. 여러 건을 담아두고 하나씩 처리해요.</div>
            </div>
            {sent ? (
              <>
                <div className="flex items-center gap-2 text-[13px] font-bold mb-2" style={{ color: "#16A34A" }}>
                  <Check size={16} /> 기안 대기에 담았어요!
                </div>
                <Btn onClick={openHiworks} style={{ width: "100%" }}><Send size={16} /> 하이웍스 열기</Btn>
              </>
            ) : (
              <Btn onClick={queueDraft} style={{ width: "100%" }}><Plus size={16} /> 기안 대기에 담기</Btn>
            )}

            <div className="h-px my-4" style={{ background: "#E9E5F2" }} />

            <div className="gm-eyebrow">확장 없이 · 복사해서 붙여넣기</div>
            <div className="space-y-2 mt-2">
              <Btn kind="ghost" onClick={() => copy("title", title)} style={{ width: "100%" }}>
                {copied === "title" ? <Check size={15} /> : <Copy size={15} />} 제목 복사</Btn>
              <Btn kind="ghost" onClick={() => copy("body", bodyText, bodyHtml)} style={{ width: "100%" }}>
                {copied === "body" ? <Check size={15} /> : <Copy size={15} />} 본문(표 포함) 복사</Btn>
              <Btn kind="ghost" onClick={() => copy("ref", approval.references.map((r) => r.name).join(", "))} style={{ width: "100%" }}>
                {copied === "ref" ? <Check size={15} /> : <Copy size={15} />} 참조자 복사</Btn>
            </div>
          </Card>
          <Card className="p-4">
            <Btn kind="ghost" onClick={() => { if (!sent) persist("초안"); onSaved(); }} style={{ width: "100%" }}>기안 대기에 담고 목록 보기</Btn>
            <p className="text-[12px] text-gray-400 mt-2 text-center">담은 기안은 '기안 이력'과 하이웍스 패널에서 볼 수 있어요.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function HiworksTable({ st }: { st: Statement }) {
  const cell = "border p-1.5 text-center text-[12px]";
  return (
    <table className="w-full border-collapse" style={{ minWidth: 520 }}>
      <thead>
        <tr>
          {["거래처", "항 목", "단가", "수량", "공급가액", "세액", "총 금액"].map((h) => (
            <th key={h} className={cell + " font-bold"} style={{ borderColor: "#333", background: "#f2f2f2" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {st.items.map((it, i) => (
          <tr key={i}>
            <td className={cell} style={{ borderColor: "#333" }}>{st.vendor}</td>
            <td className={cell + " !text-left"} style={{ borderColor: "#333" }}>{it.name}</td>
            <td className={cell + " tabular-nums"} style={{ borderColor: "#333" }}>{won(it.unitPrice)}</td>
            <td className={cell} style={{ borderColor: "#333" }}>{it.qty}</td>
            <td className={cell + " tabular-nums"} style={{ borderColor: "#333" }}>{won(it.supply)}</td>
            <td className={cell + " tabular-nums"} style={{ borderColor: "#333" }}>{won(it.vat)}</td>
            <td className={cell + " tabular-nums"} style={{ borderColor: "#333" }}>{won(it.total)}</td>
          </tr>
        ))}
        <tr>
          <td className={cell + " font-bold"} colSpan={4} style={{ borderColor: "#333", background: "#fafafa" }}>합 계</td>
          <td className={cell + " tabular-nums font-bold"} style={{ borderColor: "#333" }}>{won(st.supplyTotal)}</td>
          <td className={cell + " tabular-nums font-bold"} style={{ borderColor: "#333" }}>{won(st.vatTotal)}</td>
          <td className={cell + " tabular-nums font-bold"} style={{ borderColor: "#333" }}>{won(st.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────── 업체 관리
function VendorsScreen() {
  const [list, setList] = useState<Vendor[]>([]);
  const [edit, setEdit] = useState<Vendor | null>(null);
  useEffect(() => setList(getVendors()), []);
  function save(v: Vendor) { setList(saveVendor(v)); setEdit(null); }
  function remove(id: string) { if (confirm("이 업체를 삭제할까요?")) setList(deleteVendor(id)); }

  return (
    <>
      <Header title="업체 관리" sub="한 번 저장해두면 다음부터 업체 선택만으로 기안서가 채워져요."
        action={<Btn onClick={() => setEdit({ id: uid(), name: "", type: "건별" })}><Plus size={16} /> 업체 추가</Btn>} />
      <Card className="p-5">
        <table className="w-full">
          <thead><Tr head cells={["업체명", "사업자번호", "계정과목", "결제조건", "유형", ""]} align={["l", "l", "l", "l", "l", "r"]} /></thead>
          <tbody>
            {list.map((v) => (
              <Tr key={v.id} onClick={() => setEdit(v)} cells={[
                <b>{v.name}</b>, <span className="tabular-nums">{v.bizNo || "-"}</span>,
                v.account || "-", v.payment || "-",
                <Pill tone={v.type === "정기" ? "draft" : "gray"}>{v.type || "건별"}</Pill>,
                <button onClick={(e) => { e.stopPropagation(); remove(v.id); }} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>,
              ]} align={["l", "l", "l", "l", "l", "r"]} />
            ))}
          </tbody>
        </table>
      </Card>
      {edit && <VendorModal v={edit} onClose={() => setEdit(null)} onSave={save} />}
    </>
  );
}
function VendorModal({ v, onClose, onSave }: { v: Vendor; onClose: () => void; onSave: (v: Vendor) => void }) {
  const [f, setF] = useState<Vendor>(v);
  const set = (k: keyof Vendor, val: any) => setF({ ...f, [k]: val });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(30,27,46,.4)" }} onClick={onClose}>
      <Card className="p-6 w-full max-w-[440px]" >
        <div className="flex items-center justify-between mb-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-extrabold text-[16px]">{v.name ? "업체 수정" : "업체 추가"}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <Field label="업체명"><input className="gm-inp" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="사업자번호"><input className="gm-inp" value={f.bizNo || ""} onChange={(e) => set("bizNo", e.target.value)} /></Field>
            <Field label="계정과목"><input className="gm-inp" value={f.account || ""} onChange={(e) => set("account", e.target.value)} placeholder="원부자재비" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="결제조건"><input className="gm-inp" value={f.payment || ""} onChange={(e) => set("payment", e.target.value)} placeholder="계좌이체(말일)" /></Field>
            <Field label="유형">
              <select className="gm-inp" value={f.type} onChange={(e) => set("type", e.target.value)}>
                <option value="건별">건별</option><option value="정기">정기</option>
              </select>
            </Field>
          </div>
          <Btn onClick={() => f.name.trim() ? onSave(f) : alert("업체명을 입력하세요.")} style={{ width: "100%", marginTop: 6 }}>저장</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────── 정기결제
function RecurringScreen() {
  const [list, setList] = useState<Recurring[]>([]);
  const [adding, setAdding] = useState(false);
  useEffect(() => setList(getRecurring()), []);
  const vendors = getVendors();
  const total = list.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);

  function add(r: Recurring) { setList(saveRecurring(r)); setAdding(false); }
  function remove(id: string) { if (confirm("삭제할까요?")) setList(deleteRecurring(id)); }

  return (
    <>
      <Header title="정기결제" sub="매월 반복되는 결제를 등록해두세요. (자동 생성은 다음 단계에서 연결됩니다)"
        action={<Btn onClick={() => setAdding(true)}><Plus size={16} /> 정기결제 등록</Btn>} />
      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <Stat k="등록된 정기결제" v={`${list.length}건`} dot={V} />
        <Stat k="월 정기 결제액" v={`₩${won(total)}`} dot={VD} />
        <Stat k="활성" v={`${list.filter((r) => r.active).length}건`} dot="#16A34A" />
      </div>
      <Card className="p-5">
        {list.length === 0 ? <Empty text="등록된 정기결제가 없어요. '정기결제 등록'으로 추가하세요." /> : (
          <table className="w-full">
            <thead><Tr head cells={["결제명", "업체", "결제일", "월 금액", ""]} align={["l", "l", "l", "r", "r"]} /></thead>
            <tbody>
              {list.map((r) => (
                <Tr key={r.id} cells={[
                  <b>{r.name}</b>, r.vendorName, `매월 ${r.dayOfMonth}일`,
                  <span className="tabular-nums">₩{won(r.amount)}</span>,
                  <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>,
                ]} align={["l", "l", "l", "r", "r"]} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {adding && <RecurringModal vendors={vendors} onClose={() => setAdding(false)} onSave={add} />}
    </>
  );
}
function RecurringModal({ vendors, onClose, onSave }: { vendors: Vendor[]; onClose: () => void; onSave: (r: Recurring) => void }) {
  const [f, setF] = useState<Recurring>({ id: uid(), name: "", vendorId: "", vendorName: "", dayOfMonth: 5, amount: 0, active: true });
  const set = (k: keyof Recurring, v: any) => setF({ ...f, [k]: v });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(30,27,46,.4)" }} onClick={onClose}>
      <Card className="p-6 w-full max-w-[440px]">
        <div className="flex items-center justify-between mb-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-extrabold text-[16px]">정기결제 등록</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <Field label="결제명"><input className="gm-inp" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: AWS 클라우드" /></Field>
          <Field label="업체">
            <select className="gm-inp" value={f.vendorId} onChange={(e) => { const v = vendors.find((x) => x.id === e.target.value); set("vendorId", e.target.value); setF((s) => ({ ...s, vendorId: e.target.value, vendorName: v?.name || "" })); }}>
              <option value="">선택하세요</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="결제일(매월)"><input className="gm-inp" type="number" min={1} max={31} value={f.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))} /></Field>
            <Field label="월 금액"><input className="gm-inp text-right tabular-nums" value={f.amount} onChange={(e) => set("amount", Number(e.target.value.replace(/[^\d]/g, "")))} /></Field>
          </div>
          <Btn onClick={() => f.name.trim() && f.vendorId ? onSave(f) : alert("결제명과 업체를 입력하세요.")} style={{ width: "100%", marginTop: 6 }}>등록</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────── 기안 이력
function HistoryScreen() {
  const [list, setList] = useState<GianDoc[]>([]);
  useEffect(() => setList(getDocs()), []);

  // 상신 안 한(초안/확인필요) 건 = 정리 대상
  const draftCount = list.filter((d) => d.status === "초안" || d.status === "확인필요").length;

  function removeOne(id: string) {
    if (confirm("이 기안 이력을 삭제할까요? (되돌릴 수 없어요)")) { setList(deleteDoc(id)); syncPending(); }
  }
  function clearDrafts() {
    if (!draftCount) return;
    if (!confirm(`상신하지 않은 초안 ${draftCount}건을 모두 삭제할까요?\n(상신완료·결재 문서는 남습니다)`)) return;
    let next = getDocs();
    next.filter((d) => d.status === "초안" || d.status === "확인필요").forEach((d) => { next = deleteDoc(d.id); });
    setList(next);
    syncPending();
  }

  return (
    <>
      <Header title="기안 이력" sub="작성한 기안서와 결재 진행 상황을 한눈에."
        action={draftCount > 0 ? (
          <Btn kind="ghost" onClick={clearDrafts}><Trash2 size={15} /> 상신 안 한 초안 {draftCount}건 정리</Btn>
        ) : undefined} />
      <Card className="p-5">
        {list.length === 0 ? <Empty text="아직 작성한 기안서가 없어요." /> : (
          <table className="w-full">
            <thead><Tr head cells={["기안일", "제목", "업체", "금액", "상태", ""]} align={["l", "l", "l", "r", "l", "r"]} /></thead>
            <tbody>
              {list.map((d) => (
                <Tr key={d.id} cells={[
                  <span className="tabular-nums">{new Date(d.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>,
                  d.title.replace(/^\[지출결의서\]\s*/, ""), d.statement.vendor,
                  <span className="tabular-nums">₩{won(d.statement.grandTotal)}</span>,
                  <Pill tone={d.status === "결재완료" ? "ok" : d.status === "확인필요" ? "warn" : d.status === "상신완료" ? "ok" : "draft"}>{d.status}</Pill>,
                  <button onClick={() => removeOne(d.id)} className="text-gray-300 hover:text-red-500" title="삭제"><Trash2 size={15} /></button>,
                ]} align={["l", "l", "l", "r", "l", "r"]} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-[12.5px] text-gray-400 mt-4">💡 인식만 하고 상신 안 한 초안은 <b>[상신 안 한 초안 정리]</b>로 한 번에 지울 수 있어요. 🔗 공식 API가 연결되면 결재 진행중/완료 상태가 자동 갱신됩니다.</p>
    </>
  );
}

// ─────────────────────────────────────────────── 작은 조각들
function Header({ title, sub, action }: { title: string; sub?: string; action?: any }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
      <div><h1 className="text-[23px] font-extrabold tracking-tight">{title}</h1>{sub && <p className="text-gray-500 text-[13.5px] mt-1">{sub}</p>}</div>
      {action}
    </div>
  );
}
function Stat({ k, v, d, dot }: { k: string; v: string; d?: string; dot: string }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-gray-500 font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{k}</div>
      <div className="text-[26px] font-extrabold tracking-tight mt-1.5 tabular-nums">{v}</div>
      {d && <div className="text-[12px] text-gray-400 font-semibold mt-0.5">{d}</div>}
    </Card>
  );
}
function SecTitle({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return <div className="flex items-center justify-between mb-3.5"><h3 className="font-extrabold text-[15px]">{title}</h3>{link && <button onClick={onLink} className="text-[12.5px] font-bold" style={{ color: VD }}>{link}</button>}</div>;
}
function Field({ label, conf, children }: { label: any; conf?: number; children: any }) {
  const low = conf !== undefined && conf < 0.7;
  return (
    <div className="mb-3">
      <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 mb-1.5">
        {label}
        {conf !== undefined && (
          <span className="ml-auto text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={low ? { background: "#FBF0DF", color: "#D97706" } : { background: "#E7F5EC", color: "#16A34A" }}>
            {low ? "확인 필요" : `확신 ${Math.round(conf * 100)}%`}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-gray-400 text-[13.5px]">{text}</div>;
}
type Align = "l" | "r" | "c";
function Tr({ cells, align, head, onClick }: { cells: any[]; align?: Align[]; head?: boolean; onClick?: () => void }) {
  const a = (i: number) => (align?.[i] === "r" ? "text-right" : align?.[i] === "c" ? "text-center" : "text-left");
  if (head) return <tr>{cells.map((c, i) => <th key={i} className={`text-[11px] uppercase tracking-wide text-gray-400 font-bold pb-2.5 px-2.5 ${a(i)}`}>{c}</th>)}</tr>;
  return <tr onClick={onClick} className={onClick ? "cursor-pointer hover:bg-[#F4F2FA]" : ""}>{cells.map((c, i) => <td key={i} className={`py-3 px-2.5 border-t text-[13.5px] ${a(i)}`} style={{ borderColor: "#E9E5F2" }}>{c}</td>)}</tr>;
}
