import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

// dev 서버(단일 프로세스)에서 유지되는 로그인 진행 상태
type AuthState = { running: boolean; url: string; lastExit: number | null };
const g = globalThis as unknown as { __antAuth?: AuthState };
if (!g.__antAuth) g.__antAuth = { running: false, url: "", lastExit: null };
const state = g.__antAuth;

export async function POST() {
  if (state.running) {
    return NextResponse.json({ started: true, running: true, url: state.url });
  }

  state.running = true;
  state.url = "";
  state.lastExit = null;

  let child;
  try {
    // ant auth login: 브라우저를 열고 로컬 콜백을 기다림 (최대 5분)
    child = spawn("ant", ["auth", "login"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
  } catch {
    state.running = false;
    return NextResponse.json(
      { started: false, error: "ant 실행 실패 — 설치/PATH를 확인하세요." },
      { status: 500 },
    );
  }

  const capture = (buf: Buffer) => {
    const text = buf.toString();
    const m = text.match(/https?:\/\/\S+/);
    if (m && !state.url) state.url = m[0];
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  child.on("exit", (code) => {
    state.running = false;
    state.lastExit = code ?? -1;
  });
  child.on("error", () => {
    state.running = false;
    state.lastExit = -1;
  });

  // 인증 URL이 잡힐 때까지 잠깐 대기 (브라우저가 안 열릴 때 폴백 링크용)
  const t0 = Date.now();
  while (!state.url && state.running && Date.now() - t0 < 4000) {
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ started: true, running: state.running, url: state.url });
}
