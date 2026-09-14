import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// openhan-gianmate.vercel.app 로 접속하면 루트(/)를 기안메이트(/gian)로 보낸다.
// 작업지시서 주소(loreen-order-project.vercel.app)는 그대로 루트=작업지시서 유지.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  // 기안메이트 전용 프로젝트(openhan-gianmate = loreen-order-project-5erz)로 접속하면
  // 루트를 /gian 으로 보낸다. 작업지시서 메인(loreen-order-project.vercel.app)은 제외.
  const isGianMateHost = host.includes("openhan-gianmate") || host.includes("loreen-order-project-5erz");
  if (isGianMateHost && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/gian", req.url));
  }
  return NextResponse.next();
}

// 루트 경로에서만 동작 (다른 경로/정적파일엔 영향 없음)
export const config = { matcher: "/" };
