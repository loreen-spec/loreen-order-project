export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

// ── 거래명세서 → 구조화 데이터 추출 (Gemini 비전) ────────────────
// 입력: { imageBase64, mimeType }  (사진/캡쳐/PDF)  또는  { text }  (엑셀·붙여넣기)
// 출력: { statement: Statement }
// ─────────────────────────────────────────────────────────────

const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.5-flash"];

const SCHEMA_PROMPT = `당신은 한국 회계 담당자입니다. 아래 거래명세서(세금계산서/거래명세표)를 읽고 지출결의서 작성에 필요한 정보를 추출하세요.

반드시 아래 JSON 형식으로만 답하세요. 설명·코드블록 없이 JSON 객체 하나만:
{
  "vendor": "거래처(공급자) 상호명",
  "bizNo": "공급자 사업자등록번호 (예: 214-81-45210, 없으면 \\"\\")",
  "date": "거래일자 YYYY-MM-DD (여러 날짜면 대표 발행일)",
  "items": [
    { "name": "품목명", "spec": "규격(없으면 \\"\\")", "unitPrice": 숫자, "qty": 숫자, "supply": 공급가액숫자, "vat": 세액숫자, "total": 합계숫자 }
  ],
  "supplyTotal": 공급가액합계숫자,
  "vatTotal": 세액합계숫자,
  "grandTotal": 총합계숫자,
  "note": "특이사항(없으면 \\"\\")",
  "confidence": { "vendor": 0~1, "date": 0~1, "grandTotal": 0~1, "vat": 0~1 }
}

규칙:
- 모든 금액은 콤마·원 표시 없이 정수 숫자로만.
- 공급자(파는 쪽)를 vendor로. 공급받는자(우리 회사)가 아님.
- 부가세(세액)가 명시 안 됐으면 공급가액의 10%로 추정하고 confidence.vat 를 0.5로.
- 합계가 여러 값이면 '합계금액' 또는 '총액'을 grandTotal 로.
- 글자가 흐릿해 확신이 낮은 칸은 confidence 값을 낮게(0.4 이하) 주세요.
- items 는 실제 품목 행만. 소계/합계 행은 items에 넣지 말고 *Total 필드로.`;

function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`JSON 없음: ${cleaned.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

// 안전한 숫자 변환
const num = (v: any) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function normalize(raw: any) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const cleanItems = items.map((it: any) => {
    const supply = num(it.supply);
    let vat = num(it.vat);
    const unitPrice = num(it.unitPrice);
    const qty = num(it.qty);
    if (!vat && supply) vat = Math.round(supply * 0.1);
    const total = num(it.total) || supply + vat;
    return { name: String(it.name ?? "").trim(), spec: String(it.spec ?? "").trim(), unitPrice, qty, supply, vat, total };
  });
  const supplyTotal = num(raw.supplyTotal) || cleanItems.reduce((a: number, b: any) => a + b.supply, 0);
  const vatTotal = num(raw.vatTotal) || cleanItems.reduce((a: number, b: any) => a + b.vat, 0);
  const grandTotal = num(raw.grandTotal) || supplyTotal + vatTotal;
  return {
    vendor: String(raw.vendor ?? "").trim(),
    bizNo: String(raw.bizNo ?? "").trim(),
    date: String(raw.date ?? "").trim() || new Date().toISOString().slice(0, 10),
    items: cleanItems,
    supplyTotal,
    vatTotal,
    grandTotal,
    note: String(raw.note ?? "").trim(),
    confidence: raw.confidence ?? {},
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다. (Vercel 환경변수 확인)" },
      { status: 500 }
    );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { imageBase64, mimeType = "image/jpeg", text } = body;
  if (!imageBase64 && !text)
    return NextResponse.json({ error: "이미지 또는 텍스트가 필요합니다." }, { status: 400 });

  const parts: any[] = [{ text: SCHEMA_PROMPT }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
  } else {
    parts.push({ text: `\n\n다음은 거래명세서 표 데이터입니다:\n${text}` });
  }

  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  });

  try {
    let response: Response | null = null;
    let lastErr = "";
    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }
      );
      if (r.ok) { response = r; break; }
      lastErr = await r.text();
    }
    if (!response)
      return NextResponse.json({ error: lastErr.slice(0, 300) || "Gemini 호출 실패" }, { status: 500 });

    const result = await response.json();
    const rparts: any[] = result.candidates?.[0]?.content?.parts ?? [];
    const outText = rparts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
    if (!outText) return NextResponse.json({ error: "인식 결과가 비어있습니다." }, { status: 500 });

    const statement = normalize(extractJson(outText));
    return NextResponse.json({ statement });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "추출 오류" }, { status: 500 });
  }
}
