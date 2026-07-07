"use client";

import { useState, useEffect, type KeyboardEvent } from "react";

/* ---------------- 타입 ---------------- */
type Channel = { name: string; status: string; impact: string; note: string; action: string };
type QuickWin = { action: string; why: string; effort: string };
type Phase = { phase: string; when: string; actions: string[]; deliverable: string };
type Result = {
  brand: string;
  summary: string;
  visibility: { score: number; status: string; note: string };
  findings: string[];
  channels: Channel[];
  quickWins: QuickWin[];
  phases: Phase[];
  priorities: string[];
};

/* ---------------- API 키 설정 ---------------- */
type ApiKeyDef = { provider: string; key: string; name: string; placeholder: string; hint: string };
const API_KEYS: ApiKeyDef[] = [
  { provider: "opencode", key: "opencode_api_key", name: "OpenCode Zen (무료 모델)", placeholder: "OpenCode Zen 키", hint: "무료 · 권장 → opencode.ai/zen" },
  { provider: "google", key: "google_api_key", name: "Google Gemini", placeholder: "AIzaSy...", hint: "무료(지역 제한 가능) → aistudio.google.com" },
  { provider: "anthropic", key: "anthropic_api_key", name: "Anthropic (Claude)", placeholder: "sk-ant-...", hint: "유료 · 웹검색 지원" },
];
const STORAGE_KEY = "kitt_settings";

const LOADING_MSGS = [
  "브랜드를 웹에서 조사하는 중…",
  "네이버·구글·YouTube 노출 확인 중…",
  "소셜·커뮤니티 채널 점검 중…",
  "AI 인용 가능성을 추정하는 중…",
  "행동전략을 구성하는 중…",
];

/* 진단 대상 AI 검색·플랫폼 (브랜드 컬러 인라인 SVG · 공식 로고 파일 아님) */
const PLATFORMS = [
  { name: "ChatGPT", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#10A37F" /><g stroke="#fff" strokeWidth="1.3" strokeLinecap="round"><path d="M12 6v12M6 12h12M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4" /></g></svg>
  ) },
  { name: "Perplexity", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#20808D" /><g stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round"><path d="M12 5v14" /><path d="M12 8l5 3-5 3" /><path d="M12 8L7 11l5 3" /></g></svg>
  ) },
  { name: "Google AI", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="3" fill="#4285F4" /><circle cx="19.5" cy="12" r="3" fill="#EA4335" /><circle cx="12" cy="19.5" r="3" fill="#FBBC05" /><circle cx="4.5" cy="12" r="3" fill="#34A853" /></svg>
  ) },
  { name: "Gemini", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.5 5.5 4.5 9.5 10 10-5.5.5-9.5 4.5-10 10-.5-5.5-4.5-9.5-10-10 5.5-.5 9.5-4.5 10-10z" fill="#4285F4" /></svg>
  ) },
  { name: "NAVER", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#03C75A" /><path d="M8 17V7h2.6l2.8 5.2V7H16v10h-2.6l-2.8-5.2V17z" fill="#fff" /></svg>
  ) },
  { name: "Copilot", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#2B7DE9" /><path d="M6.5 14.5c1-4.2 3-5.5 5.5-5.5s3.5 2.8 5.5 2.8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
  ) },
  { name: "YouTube", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="5" width="22" height="14" rx="4" fill="#FF0000" /><path d="M10 8.3v7.4l6.4-3.7z" fill="#fff" /></svg>
  ) },
  { name: "나무위키", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#008275" /><path d="M12 5l4.2 6.2h-2.6l2.6 4H7.8l2.6-4H7.8z" fill="#fff" /><rect x="11.2" y="14.5" width="1.6" height="4" fill="#fff" /></svg>
  ) },
  { name: "Claude", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#D97757" /><g stroke="#fff" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5.5v13M6.2 8.2l11.6 7.6M17.8 8.2 6.2 15.8" /></g></svg>
  ) },
  { name: "Bing", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#0D8484" /><path d="M8.5 5.5l3 1.2v7.3l3.4-2-2-.9 1.2-3-5.6-2.6z" fill="#fff" /></svg>
  ) },
  { name: "Grok", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#141414" /><path d="M8 16l6.5-8M10 8h5v5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) },
  { name: "다음", icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#0A5AF5" /><path d="M8 6.5h3.5a5.5 5.5 0 0 1 0 11H8zm2.4 3v5h1.1a2.5 2.5 0 0 0 0-5z" fill="#fff" fillRule="evenodd" /></svg>
  ) },
];

const effClass = (e = "") => (/낮/.test(e) ? "low" : /높/.test(e) ? "high" : "mid");
const statClass = (s = "") => (/있/.test(s) ? "ok" : /부분/.test(s) ? "part" : /없/.test(s) ? "no" : "na");
const impClass = (i = "") => (/높/.test(i) ? "high" : /낮/.test(i) ? "low" : "mid");

export default function DiagnoseClient() {
  const [url, setUrl] = useState("");
  const [biz, setBiz] = useState("");
  const [loading, setLoading] = useState(false);
  const [lmsg, setLmsg] = useState(LOADING_MSGS[0]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);


  /* ---- API 설정 모달 ---- */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setApiKeys(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function saveApiKeys() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch { /* ignore */ }
  }

  const configured = API_KEYS.filter((a) => (apiKeys[a.key] || "").trim()).length;

  async function generate() {
    setError("");
    if (!url.trim()) { setError("사이트 주소나 브랜드명을 입력하세요."); return; }
    setResult(null);
    setLoading(true);

    let i = 0;
    setLmsg(LOADING_MSGS[0]);
    const timer = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setLmsg(LOADING_MSGS[i]); }, 4500);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url, biz,
          keys: {
            opencode: (apiKeys.opencode_api_key || "").trim() || undefined,
            anthropic: (apiKeys.anthropic_api_key || "").trim() || undefined,
            google: (apiKeys.google_api_key || "").trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setResult(data as Result);
    } catch (err) {
      setError("전략 생성 실패: " + (err instanceof Error ? err.message : String(err)) + " — 다시 시도해 주세요.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") generate(); };
  const sc = result ? Math.max(0, Math.min(100, Math.round(result.visibility?.score || 0))) : 0;

  return (
    <div className="root" suppressHydrationWarning>
      <header className="topbar">
        <div className="wrap tb">
          <div className="brand">Rank<span> kitt</span> · AEO, GEO 진단 분석기</div>
          <div className="header-right">
            <a className="kakao-btn" href="http://pf.kakao.com/_BDanX/chat" target="_blank" rel="noreferrer">
              <span className="kmark">💬</span> 카톡 문의
            </a>
            <button className="settings-link" onClick={() => setSettingsOpen(true)}>
              <span className="gear">⚙</span> API 설정
              {configured > 0 && <span className="badge">{configured}</span>}
            </button>
            <div className="by">powered by kitt AI</div>
          </div>
        </div>
      </header>

      {/* HERO + SEARCH */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">AEO / GEO · 무료 진단</div>
              <h1 className="thesis">고객은 이제 검색하지 않고,<br /><em>AI에게 묻습니다.</em></h1>
              <p className="hero-sub">그 답변에 <b>당신 브랜드가 인용되는지</b> — 사이트만 넣으면 30초 만에 무료 진단.</p>
              <div className="search">
                <div className="search-main">
                  <input id="url" className="search-url" type="text" value={url}
                    onChange={(e) => setUrl(e.target.value)} onKeyDown={onKey}
                    placeholder="사이트 주소 또는 브랜드명" autoComplete="off" autoFocus />
                  <button className="search-btn" onClick={generate} disabled={loading}>무료 진단 →</button>
                </div>
                <input id="biz" className="search-biz" type="text" value={biz}
                  onChange={(e) => setBiz(e.target.value)} onKeyDown={onKey}
                  placeholder="업종·지역 (선택 · 예: 서울 인테리어)" autoComplete="off" />
              </div>
              {error && <div className="err">{error}</div>}
            </div>
            <div className="hero-card">
              <div className="ai-card">
                <div className="ai-q"><span className="qmark">Q</span> 서울에서 믿을만한 곳 어디가 좋아?</div>
                <div className="ai-a">
                  <span className="ai-badge">AI 답변</span>
                  <p>
                    <span className="ai-seg s1">○○업체</span>, <span className="ai-seg s2">△△업체</span>가 있고,
                    특히 <span className="brand-cite">당신의 브랜드<i>✓ 인용</i></span> 는 후기·전문 콘텐츠가 풍부해 가장 신뢰도가 높습니다.
                  </p>
                </div>
                <div className="ai-cites">
                  <span className="cite-chip s3">naver.com</span>
                  <span className="cite-chip s4 hot">당신의 브랜드 · 공식</span>
                  <span className="cite-chip s5">namu.wiki</span>
                </div>
              </div>
              <div className="card-cap">AI 답변에 인용되면 → 고객이 당신을 <b>먼저</b> 만납니다</div>
            </div>
          </div>
          <div className="platforms">
            <div className="plabel">이런 AI 검색·플랫폼에서 브랜드 노출을 진단합니다</div>
            <div className="marquee">
              <div className="marquee-track">
                {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
                  <span className="pchip" key={i}><span className="picon">{p.icon}</span>{p.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOADING */}
      {loading && (
        <div className="loading">
          <div className="wrap">
            <div className="spin" />
            <div className="msg">{lmsg}</div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {result && (
        <section className="results">
          <div className="wrap">
            <div className="rhead">
              <div className="eyebrow">진단 결과</div>
              <div className="brandname">{result.brand || "브랜드"}</div>
              <div className="rsummary">{result.summary}</div>
            </div>

            <div className="gauge">
              <div className="top">
                <span className="glabel">현재 AI 검색 가시성 (추정)</span>
                <span className="score">{sc} / 100 · {result.visibility?.status}</span>
              </div>
              <div className="track"><div className="fill" style={{ width: sc + "%" }} /></div>
              <div className="gnote">{result.visibility?.note}</div>
            </div>

            <div className="sblock">
              <div className="h"><span className="k">Findings</span><h2>현재 상태</h2></div>
              <ul className="findings">
                {(result.findings || []).map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>

            <div className="sblock">
              <div className="h"><span className="k">Channels</span><h2>채널별 진단</h2></div>
              <div className="chan-legend">
                <span><i className="d ok" />있음</span>
                <span><i className="d part" />부분</span>
                <span><i className="d no" />없음</span>
                <span><i className="d na" />확인불가</span>
                <span className="sep">·</span>
                <span>임팩트 = 외부 AI 인용 영향력</span>
              </div>
              <div className="chans">
                {(result.channels || []).map((c, i) => (
                  <div className="chan" key={i}>
                    <div className="ctop">
                      <i className={"d " + statClass(c.status)} />
                      <span className="cname">{c.name}</span>
                      <span className={"imp " + impClass(c.impact)}>{c.impact || "중"} 임팩트</span>
                    </div>
                    <div className="cnote">{c.status} · {c.note}</div>
                    {c.action && <div className="caction">{c.action}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="sblock">
              <div className="h"><span className="k">Quick Wins</span><h2>지금 바로 할 것</h2></div>
              <div className="qwins">
                {(result.quickWins || []).map((q, i) => (
                  <div className="qw" key={i}>
                    <div className="qa">{q.action}</div>
                    <div className="qwhy">{q.why}</div>
                    <span className={"eff " + effClass(q.effort)}>노력 {q.effort || "중"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sblock">
              <div className="h"><span className="k">Roadmap</span><h2>단계별 실행 전략</h2></div>
              {(result.phases || []).map((p, i) => (
                <div className="phase" key={i}>
                  <div className="phase-head">
                    <span className="phase-no">0{i + 1}</span>
                    <h3>{p.phase}</h3>
                    <span className="phase-when">{p.when}</span>
                  </div>
                  <div className="pacts">
                    {(p.actions || []).map((a, k) => <div className="pact" key={k}>{a}</div>)}
                  </div>
                  <div className="pdeliver"><b>산출물</b>{p.deliverable}</div>
                </div>
              ))}
            </div>

            <div className="sblock">
              <div className="h"><span className="k">Priority</span><h2>우선순위</h2></div>
              <ol className="prio">
                {(result.priorities || []).map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </div>

            <div className="rcta">
              <div className="eyebrow">Next Step</div>
              <h2>이 전략, Kitt AI가 실행까지 대행합니다.</h2>
              <p>진단은 시작일 뿐입니다. 구조화·인용 자산 구축·월간 모니터링까지 전 과정을 맡길 수 있습니다.</p>
              <div className="rcta-btns">
                <a className="rcta-kakao" href="http://pf.kakao.com/_BDanX/chat" target="_blank" rel="noreferrer">💬 카카오톡 상담</a>
                <a className="rcta-mail" href="mailto:partner@kitt.ai.kr?subject=AEO/GEO%20실행%20문의">이메일 문의 →</a>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="foot">Kitt AI inc. · <a href="mailto:partner@kitt.ai.kr">partner@kitt.ai.kr</a> · <a href="https://kitt.ai.kr" target="_blank" rel="noreferrer">kitt.ai.kr</a></div>

      {/* API 설정 모달 */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Settings</div>
                <h2>AI 모델 API 키</h2>
              </div>
              <button className="close" onClick={() => setSettingsOpen(false)} aria-label="닫기">×</button>
            </div>
            <p className="modal-lede">무료로 쓰려면 <b>OpenCode Zen</b> 또는 <b>Gemini</b> 키를 등록하세요. 여러 개면 <b>OpenCode → Gemini → Claude</b> 순으로 사용됩니다. 키는 이 브라우저에만 저장되며 진단 시에만 서버로 전송됩니다.
              <br /><span style={{ fontSize: "11.5px", color: "var(--warn)" }}>※ OpenCode 무료 모델은 실시간 웹검색 미지원(지식 기반 진단) · 실시간 웹 조사는 Claude(sk-ant/Max)에서 동작</span></p>

            <div className="keys">
              {API_KEYS.map((a) => {
                const val = apiKeys[a.key] || "";
                return (
                  <div className="keyrow" key={a.key}>
                    <div className="keylabel">
                      <span className="kname">{a.name}</span>
                      <span className="khint">{a.hint}</span>
                    </div>
                    <div className="keyinput">
                      <input
                        type="password"
                        value={val}
                        onChange={(e) => { setApiKeys((p) => ({ ...p, [a.key]: e.target.value })); setSavedMsg(false); }}
                        placeholder={a.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <i className={"dot " + (val.trim() ? "on" : "off")} title={val.trim() ? "등록됨" : "미등록"} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions">
              {savedMsg && <span className="saved-msg">✓ 저장되었습니다</span>}
              <button className="mbtn ghost" onClick={() => { setApiKeys({}); localStorage.removeItem(STORAGE_KEY); }}>모두 지우기</button>
              <button className="mbtn primary" onClick={saveApiKeys}>저장</button>
            </div>

            <div className="modal-note">
              🔒 브라우저 로컬 저장 · 서버 미전송 · 공용 PC 사용 주의
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .root{
          --paper:#FBFAF6;--ink:#15140F;--muted:#6C6B60;--line:#E6E3D9;--line-strong:#CFCBBD;
          --accent:#2E2BE6;--accent-soft:#EDECFD;--warn:#c7761b;--good:#1f9d5b;--bad:#c93b3b;
          --kr:var(--font-noto,'Noto Sans KR'),system-ui,sans-serif;--mono:var(--font-mono,'JetBrains Mono'),ui-monospace,monospace;
          background:var(--paper);color:var(--ink);font-family:var(--kr);line-height:1.6;
          -webkit-font-smoothing:antialiased;min-height:100vh;
        }
        .wrap{max-width:960px;margin:0 auto;padding:0 28px}
        .eyebrow{font-family:var(--mono);font-size:12px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}

        .topbar{border-bottom:1px solid var(--line)}
        .tb{display:flex;align-items:center;justify-content:space-between;height:58px}
        .brand{font-family:var(--mono);font-weight:700;font-size:15px}
        .brand span{color:var(--accent)}
        .header-right{display:flex;align-items:center;gap:18px}
        .settings-link{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--ink);background:#fff;border:1px solid var(--line-strong);border-radius:8px;padding:7px 13px;cursor:pointer;display:flex;align-items:center;gap:7px;text-decoration:none;transition:border-color .15s,background .15s,transform .15s}
        .settings-link:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px)}
        .settings-link .gear{font-size:13px;line-height:1}
        .settings-link .badge{font-family:var(--mono);font-size:10px;font-weight:700;background:var(--accent);color:#fff;min-width:16px;height:16px;padding:0 4px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;line-height:1}
        .kakao-btn{font-family:var(--mono);font-size:12px;font-weight:700;color:#3c1e1e;background:#FEE500;border:1px solid #ecd400;border-radius:8px;padding:7px 13px;cursor:pointer;display:flex;align-items:center;gap:6px;text-decoration:none;transition:transform .15s,box-shadow .2s}
        .kakao-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px -8px rgba(254,229,0,.9)}
        .kakao-btn .kmark{font-size:12px;line-height:1}
        .by{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.05em;white-space:nowrap}

        /* API 설정 모달 */
        .modal-overlay{position:fixed;inset:0;background:rgba(21,20,15,.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;z-index:100;animation:fade .18s ease}
        @keyframes fade{from{opacity:0}to{opacity:1}}
        .modal{background:var(--paper);border:1px solid var(--line-strong);border-radius:18px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:26px 26px 22px;box-shadow:0 30px 60px -20px rgba(21,20,15,.5);animation:pop .2s cubic-bezier(.2,.8,.2,1)}
        @keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
        .modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px}
        .modal-head h2{font-weight:900;font-size:21px;letter-spacing:-.02em;margin-top:6px}
        .close{background:none;border:none;font-size:26px;line-height:1;color:var(--muted);cursor:pointer;padding:0 4px;transition:color .15s}
        .close:hover{color:var(--ink)}
        .modal-lede{font-size:13.5px;color:var(--muted);line-height:1.55;margin:8px 0 20px}
        .keys{display:flex;flex-direction:column;gap:15px}
        .keyrow{display:flex;flex-direction:column;gap:7px}
        .keylabel{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
        .kname{font-weight:700;font-size:13.5px;letter-spacing:-.01em}
        .khint{font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.03em;white-space:nowrap}
        .keyinput{position:relative;display:flex;align-items:center}
        .keyinput input{font-family:var(--mono);font-size:13px;padding:11px 34px 11px 13px;border:1px solid var(--line-strong);border-radius:9px;background:#fff;color:var(--ink);width:100%;transition:border-color .15s,box-shadow .15s}
        .keyinput input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .dot{position:absolute;right:12px;width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .dot.on{background:var(--good)}
        .dot.off{background:var(--line-strong)}
        .modal-actions{display:flex;align-items:center;gap:10px;margin-top:22px;flex-wrap:wrap}
        .saved-msg{font-family:var(--mono);font-size:12px;color:var(--good);font-weight:600;margin-right:auto}
        .mbtn{font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.02em;border-radius:9px;padding:11px 20px;cursor:pointer;transition:transform .15s,box-shadow .2s,background .15s;border:1px solid transparent}
        .mbtn.primary{background:var(--accent);color:#fff;margin-left:auto}
        .mbtn.primary:hover{transform:translateY(-1px);box-shadow:0 10px 20px -10px rgba(46,43,230,.7)}
        .mbtn.ghost{background:#fff;color:var(--muted);border-color:var(--line-strong)}
        .mbtn.ghost:hover{color:var(--bad);border-color:var(--bad)}
        .modal-note{margin-top:18px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.02em;text-align:center}

        /* HERO + SEARCH */
        .hero{border-bottom:1px solid var(--line);padding:38px 0 30px}
        .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center}
        .thesis{font-weight:900;font-size:clamp(23px,3vw,34px);line-height:1.17;letter-spacing:-.03em;margin:12px 0 12px}
        .thesis em{font-style:normal;color:var(--accent)}
        .hero-sub{font-size:15px;color:#3a382f;max-width:26em;line-height:1.6}
        .hero-sub b{color:var(--ink);box-shadow:inset 0 -8px 0 var(--accent-soft)}

        /* 검색바 (강조) */
        .search{margin-top:20px}
        .search-main{display:flex;gap:9px}
        .search-url{flex:1;min-width:0;font-family:var(--kr);font-size:16px;font-weight:500;padding:15px 18px;border:2px solid var(--line-strong);border-radius:12px;background:#fff;color:var(--ink)}
        .search-url:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft);outline:none}
        .search-btn{font-family:var(--mono);font-size:15px;font-weight:700;letter-spacing:.02em;background:var(--accent);color:#fff;border:none;border-radius:12px;padding:0 26px;cursor:pointer;white-space:nowrap;box-shadow:0 12px 26px -10px rgba(46,43,230,.65);transition:transform .15s,box-shadow .2s,opacity .2s}
        .search-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 30px -12px rgba(46,43,230,.75)}
        .search-btn:disabled{opacity:.55;cursor:not-allowed}
        .search-biz{width:100%;margin-top:9px;font-family:var(--kr);font-size:14px;padding:11px 16px;border:1px solid var(--line-strong);border-radius:10px;background:#fff;color:var(--ink)}
        .search-biz:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);outline:none}

        .ai-card{background:#fff;border:1px solid var(--line-strong);border-radius:16px;padding:17px 19px;box-shadow:0 22px 54px -26px rgba(21,20,15,.45)}
        .ai-q{font-size:14px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:9px;padding-bottom:14px;border-bottom:1px solid var(--line)}
        .ai-q .qmark{width:22px;height:22px;border-radius:7px;background:var(--ink);color:#fff;font-family:var(--mono);font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
        .ai-a{padding-top:14px}
        .ai-badge{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);font-weight:700;display:block;margin-bottom:8px}
        .ai-a p{font-size:14px;line-height:1.75;color:#2b2a22}
        .ai-seg{opacity:0;animation:fadeUp .5s ease forwards}
        .ai-seg.s1{animation-delay:.35s}.ai-seg.s2{animation-delay:.75s}
        .brand-cite{opacity:0;font-weight:700;color:var(--accent);background:var(--accent-soft);padding:2px 8px;border-radius:6px;white-space:nowrap;animation:fadeUp .5s ease 1.4s forwards,citePulse 2.6s ease-in-out 2s infinite}
        .brand-cite i{font-style:normal;font-family:var(--mono);font-size:10px;margin-left:6px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px}
        .ai-cites{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
        .cite-chip{font-family:var(--mono);font-size:11px;color:var(--muted);background:#f6f5ef;border:1px solid var(--line);border-radius:999px;padding:4px 10px;opacity:0;animation:fadeUp .4s ease forwards}
        .cite-chip.s3{animation-delay:1.8s}.cite-chip.s4{animation-delay:2.1s}.cite-chip.s5{animation-delay:2.4s}
        .cite-chip.hot{color:var(--accent);background:var(--accent-soft);border-color:var(--accent);font-weight:700}
        .card-cap{margin-top:15px;font-family:var(--mono);font-size:12px;color:var(--muted);text-align:center;letter-spacing:.01em}
        .card-cap b{color:var(--accent)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
        @keyframes citePulse{0%,100%{box-shadow:0 0 0 0 rgba(46,43,230,0)}50%{box-shadow:0 0 0 4px rgba(46,43,230,.13)}}

        .panel{padding:34px 0 40px;border-bottom:1px solid var(--line)}
        .panel h1{font-weight:800;font-size:clamp(18px,2.2vw,24px);line-height:1.28;letter-spacing:-.02em;margin:12px 0 10px}
        .panel h1 em{font-style:normal;position:relative;white-space:nowrap}
        .panel h1 em::after{content:"";position:absolute;left:-2px;right:-2px;bottom:2px;height:.30em;background:var(--accent-soft);z-index:-1}
        .lede{font-size:14px;color:var(--muted);max-width:40em;margin-bottom:22px;line-height:1.55}
        .form{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch}
        .field{flex:1;min-width:240px;display:flex;flex-direction:column;gap:6px}
        .field.small{flex:0 0 200px;min-width:160px}
        .field label{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
        input{font-family:var(--kr);font-size:16px;padding:13px 15px;border:1px solid var(--line-strong);border-radius:10px;background:#fff;color:var(--ink);width:100%;transition:border-color .15s,box-shadow .15s}
        input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .btn{font-family:var(--mono);font-size:14px;font-weight:700;letter-spacing:.03em;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px 26px;cursor:pointer;align-self:flex-end;transition:transform .15s,box-shadow .2s,opacity .2s;min-height:48px;white-space:nowrap}
        .btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 24px -12px rgba(46,43,230,.7)}
        .btn:disabled{opacity:.55;cursor:not-allowed}
        .hint{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:16px}
        .err{margin-top:14px;font-size:13.5px;color:var(--bad);font-family:var(--mono)}

        .platforms{margin-top:26px;padding-top:22px;border-top:1px solid var(--line)}
        .plabel{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:13px}
        .marquee{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)}
        .marquee-track{display:flex;width:max-content;animation:marquee 34s linear infinite}
        .marquee:hover .marquee-track{animation-play-state:paused}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .pchip{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;white-space:nowrap;margin-right:9px;font-family:var(--mono);font-size:12px;font-weight:500;color:#3a382f;background:#fff;border:1px solid var(--line-strong);border-radius:999px;padding:6px 13px;letter-spacing:.01em;transition:border-color .15s}
        .pchip:hover{border-color:var(--accent)}
        .pchip .picon{display:inline-flex;width:17px;height:17px;flex-shrink:0}
        .pchip .picon svg{width:17px;height:17px;display:block}

        .loading{padding:56px 0;text-align:center}
        .spin{width:34px;height:34px;border:3px solid var(--accent-soft);border-top-color:var(--accent);border-radius:50%;margin:0 auto 20px;animation:sp 800ms linear infinite}
        @keyframes sp{to{transform:rotate(360deg)}}
        .msg{font-family:var(--mono);font-size:13px;color:var(--muted);letter-spacing:.03em}

        .results{padding:48px 0}
        .rhead{margin-bottom:32px}
        .brandname{font-weight:900;font-size:clamp(22px,3vw,30px);letter-spacing:-.02em;margin:8px 0 10px}
        .rsummary{font-size:16px;color:#3a382f;max-width:44em}

        .gauge{border:1px solid var(--line-strong);border-radius:14px;background:#fff;padding:24px 26px;margin-bottom:30px}
        .gauge .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;flex-wrap:wrap;gap:8px}
        .glabel{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
        .score{font-family:var(--mono);font-weight:700;font-size:15px}
        .track{height:12px;border-radius:999px;background:#f0efe7;overflow:hidden}
        .fill{height:100%;border-radius:999px;background:var(--accent);transition:width 1s cubic-bezier(.2,.8,.2,1)}
        .gnote{font-size:13.5px;color:var(--muted);margin-top:12px}

        .sblock{margin-bottom:34px}
        .sblock > .h{display:flex;align-items:center;gap:10px;margin-bottom:16px}
        .sblock > .h .k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:700}
        .sblock > .h h2{font-weight:900;font-size:20px;letter-spacing:-.015em}

        .findings{list-style:none;display:flex;flex-direction:column;gap:10px;padding:0;margin:0}
        .findings li{font-size:14.5px;color:#2b2a22;display:flex;gap:11px;line-height:1.55;padding:12px 16px;background:#fff;border:1px solid var(--line);border-radius:10px}
        .findings li::before{content:"—";color:var(--accent);font-weight:700;flex-shrink:0}

        .chan-legend{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:16px;font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.02em}
        .chan-legend span{display:flex;align-items:center;gap:6px}
        .chan-legend .sep{color:var(--line-strong)}
        .d{width:9px;height:9px;border-radius:50%;flex-shrink:0;display:inline-block}
        .d.ok{background:var(--good)}.d.part{background:var(--warn)}.d.no{background:var(--bad)}.d.na{background:var(--line-strong)}
        .chans{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .chan{border:1px solid var(--line-strong);border-radius:12px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:8px}
        .ctop{display:flex;align-items:center;gap:9px}
        .cname{font-weight:700;font-size:14.5px;letter-spacing:-.01em;flex:1}
        .imp{font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;white-space:nowrap}
        .imp.high{background:var(--accent-soft);color:var(--accent)}
        .imp.mid{background:#f1f0e8;color:#6a6858}
        .imp.low{background:#f4f3ee;color:#9a988c}
        .cnote{font-size:12.5px;color:var(--muted);line-height:1.5}
        .caction{font-size:12.5px;color:#241f9c;line-height:1.5;padding-top:8px;border-top:1px dashed var(--line);display:flex;gap:7px}
        .caction::before{content:"▸";color:var(--accent);flex-shrink:0}

        .qwins{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
        .qw{border:1px solid var(--line-strong);border-radius:12px;background:#fff;padding:18px 20px}
        .qa{font-weight:700;font-size:15px;margin-bottom:6px;letter-spacing:-.01em}
        .qwhy{font-size:13px;color:var(--muted);line-height:1.55}
        .eff{margin-top:12px;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;display:inline-block;padding:4px 10px;border-radius:999px}
        .eff.low{background:#e6f6ec;color:var(--good)}.eff.mid{background:#fbf0e0;color:var(--warn)}.eff.high{background:#fdecec;color:var(--bad)}

        .phase{border:1px solid var(--line-strong);border-radius:14px;background:#fff;margin-bottom:16px;overflow:hidden}
        .phase-head{display:flex;align-items:center;gap:16px;padding:18px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap}
        .phase-no{font-family:var(--mono);font-weight:700;font-size:22px;color:var(--accent)}
        .phase-head h3{flex:1;font-weight:900;font-size:17px;letter-spacing:-.01em}
        .phase-when{font-family:var(--mono);font-size:11px;font-weight:700;color:#fff;background:var(--ink);border-radius:999px;padding:5px 12px;white-space:nowrap}
        .pacts{padding:16px 22px 6px}
        .pact{display:flex;gap:11px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:14px;color:#2b2a22;line-height:1.5}
        .pact:last-child{border-bottom:none}
        .pact::before{content:"→";color:var(--accent);font-weight:700;flex-shrink:0}
        .pdeliver{margin:4px 22px 18px;padding:11px 16px;background:var(--accent-soft);border-radius:9px;font-size:13px;color:#241f9c}
        .pdeliver b{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-right:8px}

        .prio{list-style:none;counter-reset:p;display:flex;flex-direction:column;gap:10px;padding:0;margin:0}
        .prio li{counter-increment:p;display:flex;gap:14px;align-items:flex-start;font-size:15px;color:#2b2a22;padding:14px 18px;background:#fff;border:1px solid var(--line);border-radius:10px;line-height:1.5}
        .prio li::before{content:counter(p);font-family:var(--mono);font-weight:700;font-size:13px;color:#fff;background:var(--accent);width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}

        .rcta{margin-top:38px;background:var(--ink);color:#fff;border-radius:16px;padding:34px 30px}
        .rcta .eyebrow{color:#8f8dfb}
        .rcta h2{font-weight:900;font-size:22px;letter-spacing:-.015em;margin:12px 0 10px}
        .rcta p{color:#c9c7bd;font-size:14.5px;max-width:38em;margin-bottom:22px}
        .rcta-btns{display:flex;gap:11px;flex-wrap:wrap}
        .rcta-btns a{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.03em;text-decoration:none;padding:13px 22px;border-radius:9px;transition:transform .15s,box-shadow .2s}
        .rcta .rcta-kakao{background:#FEE500;color:#3c1e1e}
        .rcta .rcta-kakao:hover{transform:translateY(-2px);box-shadow:0 12px 26px -10px rgba(254,229,0,.65)}
        .rcta .rcta-mail{background:var(--accent);color:#fff}
        .rcta .rcta-mail:hover{transform:translateY(-2px);box-shadow:0 12px 24px -12px rgba(46,43,230,.7)}

        .foot{border-top:1px solid var(--line);padding:22px 0;font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:center;letter-spacing:.03em}
        .foot a{color:var(--muted);text-decoration:none;border-bottom:1px solid var(--line-strong);transition:color .15s,border-color .15s}
        .foot a:hover{color:var(--accent);border-color:var(--accent)}

        @media(max-width:640px){
          .wrap{padding:0 18px}
          .hero{padding:28px 0 26px}
          .hero-grid{grid-template-columns:1fr;gap:22px}
          .hero-sub{font-size:14.5px}
          .search-main{flex-direction:column}
          .search-btn{padding:14px 0}
          .header-right{gap:8px}
          .settings-link{font-size:11px;padding:6px 10px}
          .kakao-btn{font-size:11px;padding:6px 10px}
          .by{display:none}
          .brand{font-size:13px;letter-spacing:-.01em}
          .modal{padding:22px 18px 18px;border-radius:14px}
          .modal-head h2{font-size:19px}
          .mbtn.primary{flex:1}
          .panel{padding:36px 0 34px}
          .lede{font-size:15px}
          .form{flex-direction:column;gap:14px}
          .field,.field.small{flex:1 1 auto;min-width:0;width:100%;max-width:none}
          .btn{align-self:stretch;width:100%;padding:15px 20px}
          .results{padding:34px 0}
          .rsummary{font-size:15px}
          .gauge{padding:20px 18px}
          .score{font-size:13.5px}
          .sblock{margin-bottom:28px}
          .sblock > .h h2{font-size:18px}
          .findings li{font-size:14px;padding:12px 14px}
          .chans{grid-template-columns:1fr}
          .qwins{grid-template-columns:1fr}
          .qw{padding:16px}
          .phase-head{padding:16px;gap:12px}
          .phase-head h3{font-size:16px;flex:1 1 100%;order:3}
          .phase-no{font-size:20px}
          .pacts{padding:14px 16px 4px}
          .pdeliver{margin:4px 16px 16px}
          .prio li{font-size:14.5px;padding:13px 15px}
          .rcta{padding:26px 20px;border-radius:14px}
          .rcta-btns{flex-direction:column}
          .rcta-btns a{justify-content:center}
        }
        @media(max-width:380px){ .panel h1 em{white-space:normal} }
      `}</style>
    </div>
  );
}
