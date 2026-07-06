import { NextRequest, NextResponse } from "next/server";

// /admin 을 HTTP Basic Auth 로 보호. ADMIN_USER / ADMIN_PASS 환경변수 사용.
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  // 미설정이면 접근 차단 (안전 기본값)
  if (!user || !pass) {
    return new NextResponse("Admin not configured", { status: 503 });
  }

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6)); // "user:pass"
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch { /* fallthrough */ }
  }

  return new NextResponse("인증이 필요합니다", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kitt AI Admin"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
