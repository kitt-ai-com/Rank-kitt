import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

type AuthState = { running: boolean; url: string; lastExit: number | null };

export async function GET() {
  const g = globalThis as unknown as { __antAuth?: AuthState };
  const state = g.__antAuth || { running: false, url: "", lastExit: null };

  let loggedIn = false;
  let workspace = "";

  // 토큰 발급이 성공하면 로그인된 상태
  try {
    const { stdout } = await execFileAsync(
      "ant",
      ["auth", "print-credentials", "--access-token"],
      { timeout: 10000 },
    );
    loggedIn = !!stdout.trim();
  } catch {
    loggedIn = false;
  }

  // 워크스페이스/프로필 정보 (참고용, 실패해도 무시)
  if (loggedIn) {
    try {
      const { stdout } = await execFileAsync("ant", ["auth", "status"], { timeout: 8000 });
      const m = stdout.match(/workspace[^\n:]*:\s*(\S+)/i);
      if (m) workspace = m[1];
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    loggedIn,
    running: !!state.running,
    url: state.url || "",
    workspace,
  });
}
