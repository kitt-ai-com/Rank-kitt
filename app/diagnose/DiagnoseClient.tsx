"use client";

import { useState, type KeyboardEvent } from "react";

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

const LOADING_MSGS = [
  "브랜드를 웹에서 조사하는 중…",
  "네이버·구글·YouTube 노출 확인 중…",
  "소셜·커뮤니티 채널 점검 중…",
  "AI 인용 가능성을 추정하는 중…",
  "행동전략을 구성하는 중…",
];

const effClass = (e = "") => (/낮/.test(e) ? "low" : /높/.test(e) ? "high" : "mid");
const statClass = (s = "") => (/있/.test(s) ? "ok" : /부분/.test(s) ? "part" : /없/.test(s) ? "no" : "na");
const impClass = (i = "") => (/높/.test(i) ? "high" : /낮/.test(i) ? "low" : "mid");

export default function DiagnoseClient() {
  const [url, setUrl] = useState("");
  const [biz, setBiz] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [lmsg, setLmsg] = useState(LOADING_MSGS[0]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

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
        body: JSON.stringify({ url, biz, email }),
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
    <div className="root">
      <header className="topbar">
        <div className="wrap tb">
          <div className="brand">Kitt<span> AI</span> · AI 가시성 진단기</div>
          <div className="by">powered by Claude</div>
        </div>
      </header>

      {/* INPUT */}
      <section className="panel">
        <div className="wrap">
          <div className="eyebrow">AEO / GEO Diagnostic</div>
          <h1>사이트를 넣으면,<br /><em>맞춤 행동전략</em>이 나옵니다.</h1>
          <p className="lede">브랜드를 실제로 웹에서 조사해, 지금 AI 검색에서의 노출 상태를 진단하고
            네이버·구글·YouTube·소셜 등 채널별로 무엇을 해야 하는지 정리합니다.</p>
          <div className="form">
            <div className="field">
              <label htmlFor="url">사이트 주소</label>
              <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={onKey} placeholder="예: kitt.ai.kr 또는 브랜드명" autoComplete="off" />
            </div>
            <div className="field small">
              <label htmlFor="biz">업종 · 지역 (선택)</label>
              <input id="biz" type="text" value={biz} onChange={(e) => setBiz(e.target.value)}
                onKeyDown={onKey} placeholder="예: 서울 인테리어" autoComplete="off" />
            </div>
            <button className="btn" onClick={generate} disabled={loading}>전략 생성 →</button>
          </div>
          <div className="field email">
            <label htmlFor="email">이메일 (선택 · 리포트 받기)</label>
            <input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKey} placeholder="you@company.com" autoComplete="off" />
          </div>
          <div className="hint">실제 웹 검색으로 브랜드를 조사합니다 · 15~40초 소요</div>
          {error && <div className="err">{error}</div>}
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
              <a href="mailto:partner@kitt.ai.kr?subject=AEO/GEO%20실행%20문의">실행 문의하기 →</a>
            </div>
          </div>
        </section>
      )}

      <div className="foot">Kitt AI inc. · partner@kitt.ai.kr · kitt.ai.kr</div>

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
        .by{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.05em}

        .panel{padding:52px 0 44px;border-bottom:1px solid var(--line)}
        .panel h1{font-weight:900;font-size:clamp(26px,3.8vw,40px);line-height:1.16;letter-spacing:-.025em;margin:16px 0 14px}
        .panel h1 em{font-style:normal;position:relative;white-space:nowrap}
        .panel h1 em::after{content:"";position:absolute;left:-2px;right:-2px;bottom:2px;height:.30em;background:var(--accent-soft);z-index:-1}
        .lede{font-size:16px;color:#3a382f;max-width:38em;margin-bottom:26px}
        .form{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch}
        .field{flex:1;min-width:240px;display:flex;flex-direction:column;gap:6px}
        .field.small{flex:0 0 200px;min-width:160px}
        .field.email{max-width:360px;margin-top:14px}
        .field label{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
        input{font-family:var(--kr);font-size:16px;padding:13px 15px;border:1px solid var(--line-strong);border-radius:10px;background:#fff;color:var(--ink);width:100%;transition:border-color .15s,box-shadow .15s}
        input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .btn{font-family:var(--mono);font-size:14px;font-weight:700;letter-spacing:.03em;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px 26px;cursor:pointer;align-self:flex-end;transition:transform .15s,box-shadow .2s,opacity .2s;min-height:48px;white-space:nowrap}
        .btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 24px -12px rgba(46,43,230,.7)}
        .btn:disabled{opacity:.55;cursor:not-allowed}
        .hint{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:16px}
        .err{margin-top:14px;font-size:13.5px;color:var(--bad);font-family:var(--mono)}

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
        .rcta a{display:inline-block;font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:.03em;background:var(--accent);color:#fff;text-decoration:none;padding:13px 24px;border-radius:9px}

        .foot{border-top:1px solid var(--line);padding:22px 0;font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:center;letter-spacing:.03em}

        @media(max-width:640px){
          .wrap{padding:0 18px}
          .by{display:none}
          .brand{font-size:13px;letter-spacing:-.01em}
          .panel{padding:36px 0 34px}
          .lede{font-size:15px}
          .form{flex-direction:column;gap:14px}
          .field,.field.small,.field.email{flex:1 1 auto;min-width:0;width:100%;max-width:none}
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
          .rcta a{display:block;text-align:center}
        }
        @media(max-width:380px){ .panel h1 em{white-space:normal} }
      `}</style>
    </div>
  );
}
