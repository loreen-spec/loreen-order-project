import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "approvals.json");

// 서버 메모리 캐시 (재시작 전까지 유지)
const memStore: Record<string, boolean> = {};
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      Object.assign(memStore, parsed);
    }
  } catch {}
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(memStore, null, 2), "utf-8");
  } catch {}
}

// GET /api/approvals
export async function GET() {
  load();
  return NextResponse.json(memStore);
}

// POST /api/approvals  { id, checked }
export async function POST(req: Request) {
  load();
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  memStore[id] = checked;
  save();
  return NextResponse.json({ ok: true });
}
