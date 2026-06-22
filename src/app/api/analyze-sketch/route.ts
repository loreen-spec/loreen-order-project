export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from "next/server";

const MATERIAL_CATEGORIES = [
  "주원단A", "안감A", "안감B", "안감C",
  "배색B", "배색C", "테이프",
  "웰론(몸판)", "웰론(소매)", "지퍼", "슬라이더", "와펜",
  "E/BAND", "아일렛", "스트링", "스토퍼", "재봉사",
  "완사입가(VAT+)", "기타",
];

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 없음" }, { status: 500 });

  const { imageBase64, mimeType = "image/jpeg" } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "이미지 없음" }, { status: 400 });

  const prompt = `당신은 아동복 패션 MD입니다. 아래 의류 도식화(스케치) 이미지를 보고 이 제품을 만드는 데 필요한 원부자재 목록을 분석해주세요.

다음 카테고리 목록에서 필요한 것들을 선택하고, 각 항목에 대한 정보를 채워주세요:
${MATERIAL_CATEGORIES.join(", ")}

응답은 반드시 아래 JSON 배열 형식으로만 답해주세요. 다른 설명 없이 JSON만:
[
  {
    "category": "카테고리명 (위 목록 중 하나)",
    "name": "예상 자재명 (모르면 빈 문자열)",
    "color": "예상 색상 (모르면 빈 문자열)",
    "spec": "규격 (모르면 빈 문자열)",
    "yield": "요척 숫자만 (예: 1.5, 모르면 빈 문자열)",
    "yieldUnit": "YD 또는 M 또는 EA",
    "unitPrice": "",
    "orderUnit": "",
    "notes": "특이사항"
  }
]

규칙:
- 주원단이 있으면 반드시 포함
- 안감이 보이면 안감A 포함
- 지퍼가 보이면 지퍼와 슬라이더 세트로 포함
- 후드끈/스트링이 보이면 스트링+스토퍼+아일렛 세트로 포함
- 밴드/고무줄이 보이면 E/BAND 포함
- 와펜/자수가 보이면 와펜 포함
- 패딩/솜이 보이면 웰론(몸판), 웰론(소매) 포함
- 재봉사는 항상 포함
- 불확실한 항목은 제외하고 확실한 것만 포함
- yield는 일반적인 수치 사용 (원단류: 1.2~2.0 YD, 지퍼: 1 EA, 재봉사: 1 EA 등)`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // JSON 배열 추출
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: "파싱 실패", raw: text }, { status: 500 });

    const materials = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ materials });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
