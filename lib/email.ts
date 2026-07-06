// Resend로 진단 리포트 발송. RESEND_API_KEY 미설정 시 조용히 스킵.
// 발신 도메인은 Resend에서 kitt.ai.kr 인증 후 EMAIL_FROM에 설정.

type Channel = { name: string; status: string; impact: string; note: string; action: string };
type Phase = { phase: string; when: string; actions: string[]; deliverable: string };
type Result = {
  brand?: string;
  summary?: string;
  visibility?: { score?: number; status?: string; note?: string };
  findings?: string[];
  channels?: Channel[];
  quickWins?: { action: string; why: string; effort: string }[];
  phases?: Phase[];
  priorities?: string[];
};

type ReportInput = { email: string; url: string; biz: string; result: unknown };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function buildHtml(r: Result, site: string): string {
  const v = r.visibility || {};
  const sc = Math.max(0, Math.min(100, Math.round(Number(v.score) || 0)));
  const li = (items?: string[]) =>
    (items || []).map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join("");
  const chans = (r.channels || [])
    .map(
      (c) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:700">${esc(c.name)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(c.status)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(c.impact)} 임팩트</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555">${esc(c.action)}</td>
        </tr>`
    )
    .join("");
  const phases = (r.phases || [])
    .map(
      (p) =>
        `<div style="margin:10px 0;padding:12px 14px;border:1px solid #e6e3d9;border-radius:10px">
          <b>${esc(p.phase)}</b> <span style="color:#888">· ${esc(p.when)}</span>
          <ul style="margin:6px 0 4px;padding-left:18px">${li(p.actions)}</ul>
          <div style="font-size:12px;color:#2e2be6">산출물: ${esc(p.deliverable)}</div>
        </div>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#FBFAF6;font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;color:#15140F">
  <div style="max-width:640px;margin:0 auto;padding:28px 22px">
    <div style="font-family:monospace;font-size:12px;letter-spacing:.15em;color:#2e2be6">KITT AI · AEO/GEO 진단 리포트</div>
    <h1 style="font-size:24px;margin:10px 0 4px">${esc(r.brand || site)}</h1>
    <p style="color:#3a382f;margin:0 0 18px">${esc(r.summary)}</p>

    <div style="padding:16px;border:1px solid #cfcbbd;border-radius:12px;background:#fff;margin-bottom:20px">
      <div style="font-family:monospace;font-size:11px;color:#888;text-transform:uppercase">AI 검색 가시성 (추정)</div>
      <div style="font-size:22px;font-weight:800;margin:4px 0">${sc} / 100 · ${esc(v.status)}</div>
      <div style="height:10px;background:#f0efe7;border-radius:99px;overflow:hidden"><div style="height:100%;width:${sc}%;background:#2e2be6"></div></div>
      <div style="color:#666;font-size:13px;margin-top:8px">${esc(v.note)}</div>
    </div>

    <h3 style="margin:0 0 6px">현재 상태</h3>
    <ul style="margin:0 0 18px;padding-left:18px">${li(r.findings)}</ul>

    <h3 style="margin:0 0 6px">채널별 진단</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">
      <thead><tr style="text-align:left;color:#888;font-size:11px">
        <th style="padding:4px 10px">채널</th><th style="padding:4px 10px">상태</th><th style="padding:4px 10px">임팩트</th><th style="padding:4px 10px">보완</th>
      </tr></thead><tbody>${chans}</tbody></table>

    <h3 style="margin:0 0 6px">단계별 실행 전략</h3>
    ${phases}

    <h3 style="margin:16px 0 6px">우선순위</h3>
    <ol style="margin:0 0 22px;padding-left:20px">${li(r.priorities)}</ol>

    <div style="background:#15140F;color:#fff;border-radius:12px;padding:22px">
      <div style="font-family:monospace;font-size:11px;color:#8f8dfb;letter-spacing:.1em">NEXT STEP</div>
      <div style="font-size:17px;font-weight:800;margin:8px 0">이 전략, Kitt AI가 실행까지 대행합니다.</div>
      <a href="mailto:partner@kitt.ai.kr?subject=AEO/GEO 실행 문의" style="display:inline-block;margin-top:8px;background:#2e2be6;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:11px 20px;border-radius:8px">실행 문의하기 →</a>
    </div>

    <div style="text-align:center;color:#999;font-size:11px;font-family:monospace;margin-top:20px">Kitt AI inc. · partner@kitt.ai.kr · kitt.ai.kr</div>
  </div></body></html>`;
}

async function send(payload: Record<string, unknown>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // 미설정이면 스킵
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${t}`);
  }
}

export async function sendReport(input: ReportInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const from = process.env.EMAIL_FROM || "Kitt AI <onboarding@resend.dev>";
  const admin = process.env.EMAIL_ADMIN || "partner@kitt.ai.kr";
  const r = input.result as Result;
  const site = input.url;
  const html = buildHtml(r, site);

  // 1) 리드에게 리포트
  await send({
    from,
    to: [input.email],
    subject: `[Kitt AI] ${r.brand || site} AI 가시성 진단 리포트`,
    html,
  });

  // 2) 관리자 알림 (간단)
  await send({
    from,
    to: [admin],
    subject: `새 진단 리드: ${input.email} · ${site}`,
    html: `<p><b>이메일:</b> ${esc(input.email)}<br><b>사이트:</b> ${esc(site)}<br><b>업종:</b> ${esc(input.biz)}<br><b>가시성:</b> ${esc(r.visibility?.score)}/100</p>`,
  }).catch(() => { /* 관리자 알림 실패는 무시 */ });
}
