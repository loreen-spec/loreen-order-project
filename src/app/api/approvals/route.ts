import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "approvals.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFile(): Record<string, boolean> {
  try {
    ensureDir();
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("[approvals] read error:", e);
    return {};
  }
}

function writeFile(data: Record<string, boolean>) {
  try {
    ensureDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[approvals] write error:", e);
  }
}

// GET /api/approvals — 파일에서 직접 읽기
export async function GET() {
  const data = readFile();
  return NextResponse.json(data);
}

// POST /api/approvals  { id, checked }
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const data = readFile();
  data[id] = checked;
  writeFile(data);
  return NextResponse.json({ ok: true });
}
