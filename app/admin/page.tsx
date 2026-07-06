import { listLeads } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function score(result: unknown): string {
  try {
    const s = (result as { visibility?: { score?: number } })?.visibility?.score;
    return s == null ? "-" : String(s);
  } catch { return "-"; }
}

export default async function AdminPage() {
  let leads: Awaited<ReturnType<typeof listLeads>> = [];
  let err = "";
  try { leads = await listLeads(200); }
  catch (e) { err = e instanceof Error ? e.message : "조회 실패"; }

  return (
    <main style={{ fontFamily: "'Noto Sans KR',system-ui,sans-serif", maxWidth: 1000, margin: "0 auto", padding: "40px 24px", color: "#15140F" }}>
      <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: ".15em", color: "#2e2be6" }}>KITT AI · ADMIN</div>
      <h1 style={{ fontSize: 26, margin: "8px 0 4px" }}>진단 리드</h1>
      <p style={{ color: "#666", marginTop: 0 }}>최근 200건 · 총 {leads.length}건</p>

      {err && <p style={{ color: "#c93b3b" }}>Supabase 조회 오류: {err}</p>}
      {!err && leads.length === 0 && <p style={{ color: "#666" }}>아직 리드가 없습니다. (또는 Supabase 미설정)</p>}

      {leads.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", fontSize: 12, borderBottom: "2px solid #e6e3d9" }}>
              <th style={{ padding: "8px 10px" }}>일시</th>
              <th style={{ padding: "8px 10px" }}>이메일</th>
              <th style={{ padding: "8px 10px" }}>사이트</th>
              <th style={{ padding: "8px 10px" }}>업종</th>
              <th style={{ padding: "8px 10px" }}>점수</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 10px", color: "#666", whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("ko-KR")}</td>
                <td style={{ padding: "8px 10px", fontWeight: 600 }}>{l.email}</td>
                <td style={{ padding: "8px 10px" }}><a href={/^https?:/.test(l.site_url) ? l.site_url : `https://${l.site_url}`} target="_blank" rel="noreferrer" style={{ color: "#2e2be6" }}>{l.site_url}</a></td>
                <td style={{ padding: "8px 10px", color: "#666" }}>{l.industry || "-"}</td>
                <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700 }}>{score(l.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
