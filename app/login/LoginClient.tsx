"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Status = { loggedIn: boolean; running: boolean; url: string; workspace: string };

export default function LoginClient() {
  const [status, setStatus] = useState<Status>({ loggedIn: false, running: false, url: "", workspace: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const data = (await res.json()) as Status;
      setStatus(data);
      setChecked(true);
      return data;
    } catch {
      setChecked(true);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  async function startLogin() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "로그인 시작 실패");
      // 브라우저가 자동으로 열립니다. 상태 폴링은 이미 동작 중.
      if (data.url) setStatus((s) => ({ ...s, url: data.url, running: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  }

  const st = status.loggedIn ? "ok" : status.running ? "wait" : "off";

  return (
    <div className="root" suppressHydrationWarning>
      <header className="topbar">
        <div className="wrap tb">
          <div className="brand">
            <a href="/diagnose" className="back">← 진단으로</a>
            <span>Max 로그인</span>
          </div>
          <div className="by">OAuth · ant CLI</div>
        </div>
      </header>

      <section className="panel">
        <div className="wrap">
          <div className="eyebrow">Authentication</div>
          <h1>Claude Max 계정 연결</h1>
          <p className="lede">Max 구독으로 진단 엔진을 인증합니다. 아래 버튼을 누르면 브라우저에서 Anthropic 로그인 창이 열리고, 완료되면 자동으로 연결됩니다.</p>

          {/* 상태 카드 */}
          <div className={"statecard " + st}>
            <div className="dot" />
            <div className="stext">
              {!checked && "상태 확인 중…"}
              {checked && status.loggedIn && (
                <>연결됨 — Max 계정으로 인증되었습니다{status.workspace ? ` · ${status.workspace}` : ""}.</>
              )}
              {checked && !status.loggedIn && status.running && "브라우저에서 로그인을 완료해 주세요…"}
              {checked && !status.loggedIn && !status.running && "아직 로그인되지 않았습니다."}
            </div>
          </div>

          {/* 액션 */}
          {!status.loggedIn && (
            <div className="actions">
              <button className="btn primary" onClick={startLogin} disabled={busy || status.running}>
                {status.running ? "로그인 대기 중…" : "Max 계정으로 로그인 →"}
              </button>
              {status.url && (
                <a className="urllink" href={status.url} target="_blank" rel="noreferrer">
                  브라우저가 안 열리면 여기를 클릭
                </a>
              )}
            </div>
          )}

          {status.loggedIn && (
            <div className="actions">
              <a className="btn primary" href="/diagnose">진단 시작하기 →</a>
              <button className="btn ghost" onClick={logout} disabled={busy}>로그아웃</button>
            </div>
          )}

          {error && <div className="err">{error}</div>}

          <div className="info">
            <h3>동작 방식</h3>
            <ul>
              <li><b>1.</b> 버튼 클릭 → 서버가 <code>ant auth login</code>을 실행하고 브라우저를 엽니다.</li>
              <li><b>2.</b> Anthropic 로그인 창에서 Max 계정으로 로그인 → 조직·워크스페이스를 선택합니다.</li>
              <li><b>3.</b> 이 페이지가 자동으로 연결 상태를 감지합니다(2.5초마다 확인).</li>
              <li><b>4.</b> 이후 진단은 요청마다 단기 토큰을 발급해 Max 구독으로 처리됩니다.</li>
            </ul>
            <div className="note">🔒 개인·로컬 전용 · 실제 로그인은 Anthropic 공식 페이지에서 진행됩니다 · 자격증명은 이 컴퓨터에만 저장됩니다.</div>
          </div>
        </div>
      </section>

      <div className="foot">Kitt AI inc. · <a href="mailto:partner@kitt.ai.kr">partner@kitt.ai.kr</a> · <a href="https://kitt.ai.kr" target="_blank" rel="noreferrer">kitt.ai.kr</a></div>

      <style jsx>{`
        .root {
          --paper: #fbfaf6; --ink: #15140f; --muted: #6c6b60; --line: #e6e3d9;
          --line-strong: #cfcbbd; --accent: #2e2be6; --accent-soft: #edecfd;
          --good: #1f9d5b; --warn: #c7761b; --bad: #c93b3b;
          --kr: var(--font-noto, "Noto Sans KR"), system-ui, sans-serif;
          --mono: var(--font-mono, "JetBrains Mono"), ui-monospace, monospace;
          background: var(--paper); color: var(--ink); font-family: var(--kr);
          line-height: 1.6; -webkit-font-smoothing: antialiased; min-height: 100vh;
        }
        .wrap { max-width: 720px; margin: 0 auto; padding: 0 28px; }
        .eyebrow { font-family: var(--mono); font-size: 12px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
        .topbar { border-bottom: 1px solid var(--line); }
        .tb { display: flex; align-items: center; justify-content: space-between; height: 58px; }
        .brand { font-family: var(--mono); font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 12px; }
        .back { color: var(--accent); text-decoration: none; font-size: 13px; transition: opacity .15s; }
        .back:hover { opacity: .7; }
        .by { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: .05em; }
        .panel { padding: 52px 0 44px; }
        .panel h1 { font-weight: 900; font-size: clamp(24px, 3.6vw, 36px); line-height: 1.16; letter-spacing: -.025em; margin: 16px 0 14px; }
        .lede { font-size: 16px; color: #3a382f; max-width: 40em; margin-bottom: 28px; }

        .statecard { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border: 1px solid var(--line-strong); border-radius: 12px; background: #fff; margin-bottom: 22px; }
        .statecard .dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
        .statecard.ok { border-color: #bce6cd; background: #f2fbf5; }
        .statecard.ok .dot { background: var(--good); }
        .statecard.wait { border-color: #f0dfc2; background: #fdf8ef; }
        .statecard.wait .dot { background: var(--warn); animation: pulse 1.1s ease-in-out infinite; }
        .statecard.off .dot { background: var(--line-strong); }
        .stext { font-size: 14px; color: #2b2a22; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

        .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 24px; }
        .btn { font-family: var(--mono); font-size: 14px; font-weight: 700; letter-spacing: .02em; border: 1px solid transparent; border-radius: 10px; padding: 13px 24px; cursor: pointer; text-decoration: none; display: inline-block; transition: transform .15s, box-shadow .2s, opacity .2s; }
        .btn.primary { background: var(--accent); color: #fff; }
        .btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 24px -12px rgba(46,43,230,.7); }
        .btn.ghost { background: #fff; color: var(--muted); border-color: var(--line-strong); }
        .btn.ghost:hover:not(:disabled) { color: var(--bad); border-color: var(--bad); }
        .btn:disabled { opacity: .55; cursor: not-allowed; }
        .urllink { font-family: var(--mono); font-size: 12.5px; color: var(--accent); }

        .err { margin-bottom: 20px; padding: 12px 16px; background: #fdecec; color: var(--bad); border-radius: 8px; font-family: var(--mono); font-size: 13px; }

        .info { margin-top: 14px; padding: 22px 24px; background: #f9f8f3; border: 1px solid var(--line); border-radius: 12px; }
        .info h3 { font-size: 14px; font-weight: 700; margin: 0 0 12px; }
        .info ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 9px; }
        .info li { font-size: 13.5px; color: #3a382f; line-height: 1.55; }
        .info li b { color: var(--accent); font-family: var(--mono); margin-right: 4px; }
        .info code { font-family: var(--mono); font-size: 12px; background: #efeee7; padding: 1px 6px; border-radius: 4px; }
        .note { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: .01em; }

        .foot { border-top: 1px solid var(--line); padding: 22px 0; font-family: var(--mono); font-size: 11.5px; color: var(--muted); text-align: center; letter-spacing: .03em; }
        .foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--line-strong); transition: color .15s, border-color .15s; }
        .foot a:hover { color: var(--accent); border-color: var(--accent); }

        @media (max-width: 640px) {
          .wrap { padding: 0 18px; }
          .by { display: none; }
          .panel { padding: 36px 0 34px; }
          .actions { flex-direction: column; align-items: stretch; }
          .btn { text-align: center; }
        }
      `}</style>
    </div>
  );
}
