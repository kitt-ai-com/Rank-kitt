import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

export async function POST() {
  try {
    await execFileAsync("ant", ["auth", "logout"], { timeout: 10000 });
  } catch {
    /* 이미 로그아웃 상태여도 무시 */
  }
  return NextResponse.json({ ok: true });
}
