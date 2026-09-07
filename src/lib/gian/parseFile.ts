"use client";
import * as XLSX from "xlsx";

// ── 업로드 파일을 인식 API 입력으로 변환 ─────────────────────
//  · 이미지/PDF → base64 (Gemini 비전)
//  · 엑셀/CSV   → 시트 텍스트 (Gemini 텍스트)  ※ 정확 파싱

export type ExtractInput =
  | { kind: "image"; imageBase64: string; mimeType: string; fileName: string }
  | { kind: "text"; text: string; fileName: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1)); // data:...;base64, 제거
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const isExcel = (f: File) =>
  /\.(xlsx|xls|csv)$/i.test(f.name) ||
  /spreadsheet|excel|csv/i.test(f.type);

export async function prepareFile(file: File): Promise<ExtractInput> {
  if (isExcel(file)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const chunks: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) chunks.push(`[시트: ${name}]\n${csv}`);
    }
    return { kind: "text", text: chunks.join("\n\n").slice(0, 20000), fileName: file.name };
  }
  // 이미지 / PDF
  const mimeType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg");
  const imageBase64 = await fileToBase64(file);
  return { kind: "image", imageBase64, mimeType, fileName: file.name };
}

/** 미리보기용 data URL (이미지일 때만) */
export function previewUrl(file: File): string | null {
  if (/^image\//.test(file.type)) return URL.createObjectURL(file);
  return null;
}
