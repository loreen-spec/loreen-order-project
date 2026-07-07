import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 서버 데이터 디렉토리 (프로젝트 루트 data/)
const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "approvals.json");

function readApprovals(): Record<string, boolean> {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeApprovals(data: Record<string, boolean>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// GET /api/approvals — 전체 체크 상태 반환
export async function GET() {
  return NextResponse.json(readApprovals());
}

// POST /api/approvals — { id, checked } 으로 저장
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const data = readApprovals();
  data[id] = checked;
  writeApprovals(data);
  return NextResponse.json({ ok: true });
}
