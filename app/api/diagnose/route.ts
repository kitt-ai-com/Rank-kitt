import { NextResponse } from "next/server";
import { saveLead } from "@/lib/supabase";
import { sendReport } from "@/lib/email";

// Vercel: 웹검색 + pause_turn 은 시간이 걸리므로 실행 시간을 넉넉히
export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.DIAGNOSE_MODEL || "claude-sonnet-5";

type Block = { type: string; text?: string; [k: string]: unknown };
type ApiResponse = { content?: Block[]; stop_reason?: string; error?: { message?: string } };

/* ---------------- Anthropic 호출 ---------------- */
async function callApi(messages: unknown[], useSearch: boolean): Promise<ApiResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다");

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 6000,
    messages,
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }];
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as ApiResponse | null;
  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as ApiResponse;
}

/* ---------------- JSON 파싱 · 복구 ---------------- */
function repairJson(s: string): string {
  let out = "", inStr = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!inStr) {
      out += c;
      if (c === '"') inStr = true;
      i++;
    } else {
      if (c === "\\") { out += c + (s[i + 1] || ""); i += 2; continue; }
      if (c === '"') {
        let j = i + 1; while (j < s.length && /\s/.test(s[j])) j++;
        const nx = s[j];
        if (nx === ":" || nx === "," || nx === "}" || nx === "]" || nx === undefined) { out += '"'; inStr = false; i++; }
        else { out += '\\"'; i++; }
      } else if (c === "\n" || c === "\r") { out += "\\n"; i++; }
      else if (c === "\t") { out += "\\t"; i++; }
      else { out += c; i++; }
    }
  }
  return out;
}

function repairTruncated(t: string): unknown {
  const cut = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (cut === -1) throw new Error("unrepairable");
  let cand = t.slice(0, cut + 1);
  const stack: string[] = []; let inStr = false, esc = false;
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === "{" || c === "[") stack.push(c); else if (c === "}" || c === "]") stack.pop(); }
  }
  cand = cand.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) cand += stack[i] === "{" ? "}" : "]";
  return JSON.parse(repairJson(cand));
}

function extractJson(text: string): unknown {
  const t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s === -1) throw new Error("no json");
  let core = e > s ? t.slice(s, e + 1) : t.slice(s);
  core = core.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(core); } catch { /* next */ }
  try { return JSON.parse(repairJson(core)); } catch { /* next */ }
  return repairTruncated(core);
}

/* ---------------- 진단 실행 ---------------- */
function buildPrompt(url: string, biz: string): string {
  return `당신은 Kitt AI inc.의 시니어 AEO/GEO 컨설턴트입니다. AEO(Answer Engine Optimization)와 GEO(Generative Engine Optimization)는 ChatGPT·Perplexity·Google AI·네이버 Cue: 같은 생성형 AI 검색 답변에 브랜드가 인용·추천되도록 만드는 작업입니다.

대상 사이트/브랜드: "${url}"${biz ? `\n업종·지역: "${biz}"` : ""}

web_search 도구로 이 브랜드를 실제로 조사하세요. 브랜드명, 사업 영역, 지역, 웹 존재감(공식 사이트·네이버·구글·매체 언급·리뷰), 실제 구매의도 질문에서 AI가 이 브랜드를 언급할 가능성을 파악합니다. 그런 다음 이 브랜드에 특화된(일반론 금지) 구체적 행동전략을 작성하세요.

또한 아래 8개 채널 각각에서 이 브랜드가 노출되는지 조사하세요: 네이버(블로그·카페·지식iN·플레이스), 구글, YouTube, 나무위키·위키백과, 커뮤니티(Reddit·국내 카페/디시/클리앙), Threads, Instagram, TikTok. 채널마다 실제 검색으로 확인하고, 확인이 어려우면 status는 확인불가로 두세요. impact는 그 채널이 외부 AI(ChatGPT·Perplexity·구글 AI) 인용에 주는 영향력입니다(YouTube·나무위키·네이버·커뮤니티는 대체로 높음, Threads·Instagram·TikTok은 대체로 낮음~중).

핵심 원칙: AI 인용은 기술적 SEO 트릭이 아니라 브랜드가 웹 전반에서 얼마나 일관되게 언급·신뢰받는가에서 나옵니다. 한국 시장은 네이버 개체 정합이 필수입니다.

반드시 아래 JSON만 출력하세요. 마크다운·설명·코드펜스 없이 순수 JSON 객체 하나만. 모든 값은 한국어. 액션은 이 브랜드에 맞게 구체적으로.

[JSON 규칙 — 엄수]
- 문자열 값 안에 큰따옴표(")를 절대 쓰지 마세요. 강조가 필요하면 홑따옴표(')나 「」를 쓰세요.
- 문자열 값 안에 줄바꿈을 넣지 마세요. 한 줄로 작성하세요.
- 각 문자열은 짧고 간결하게(한 문장, 되도록 40자 이내). 배열 개수는 지시한 범위를 넘기지 마세요.
{
 "brand":"추정 브랜드명",
 "summary":"1문장 진단 요약",
 "visibility":{"score":0~100 정수,"status":"낮음|보통|높음","note":"점수 근거 1문장"},
 "findings":["현재 상태 관찰 3개, 이 브랜드 특화"],
 "channels":[
  {"name":"네이버","status":"있음|부분|없음|확인불가","impact":"높음|중|낮음","note":"현황 짧게","action":"보완 액션 짧게"},
  {"name":"구글","status":"","impact":"","note":"","action":""},
  {"name":"YouTube","status":"","impact":"","note":"","action":""},
  {"name":"나무위키·위키","status":"","impact":"","note":"","action":""},
  {"name":"커뮤니티","status":"","impact":"","note":"","action":""},
  {"name":"Threads","status":"","impact":"","note":"","action":""},
  {"name":"Instagram","status":"","impact":"","note":"","action":""},
  {"name":"TikTok","status":"","impact":"","note":"","action":""}
 ],
 "quickWins":[{"action":"당장 할 액션","why":"효과 1문장","effort":"낮음|중|높음"} (2개)],
 "phases":[
  {"phase":"진단","when":"W1","actions":["이 브랜드용 액션 2개"],"deliverable":"산출물"},
  {"phase":"구조화","when":"W2-3","actions":["2개"],"deliverable":"산출물"},
  {"phase":"인용 자산","when":"W4-7","actions":["2개"],"deliverable":"산출물"},
  {"phase":"모니터링","when":"W8~","actions":["2개"],"deliverable":"산출물"}
 ],
 "priorities":["실행 우선순위 3개, 순서대로"]
}`;
}

async function runDiagnosis(url: string, biz: string): Promise<unknown> {
  const messages: unknown[] = [{ role: "user", content: buildPrompt(url, biz) }];
  let data = await callApi(messages, true);

  // 웹검색 긴 턴은 pause_turn 으로 중단될 수 있음 → 이어서 완성 (최대 4회)
  let hops = 0;
  while (data.stop_reason === "pause_turn" && hops < 4) {
    messages.push({ role: "assistant", content: data.content });
    data = await callApi(messages, true);
    hops++;
  }

  const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "");
  if (!textBlocks.length) throw new Error("응답에 텍스트가 없습니다");

  for (let i = textBlocks.length - 1; i >= 0; i--) {
    try { return extractJson(textBlocks[i]); } catch { /* try next */ }
  }
  try { return extractJson(textBlocks.join("\n")); } catch { /* fallback */ }

  // 최후 폴백: 분석 텍스트를 JSON으로 재정리 (검색 없이 1회)
  const raw = textBlocks.join("\n").slice(0, 6000);
  const fix = await callApi([{ role: "user", content:
`아래 분석 내용을 지시된 JSON 스키마로만 변환하세요. 설명·코드펜스 없이 순수 JSON 하나만. 값 안에 큰따옴표·줄바꿈 금지.

[분석 내용]
${raw}

[스키마]
{"brand":"","summary":"","visibility":{"score":0,"status":"","note":""},"findings":[""],"channels":[{"name":"","status":"","impact":"","note":"","action":""}],"quickWins":[{"action":"","why":"","effort":""}],"phases":[{"phase":"","when":"","actions":[""],"deliverable":""}],"priorities":[""]}` }], false);
  const fixText = (fix.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("\n");
  return extractJson(fixText);
}

/* ---------------- 핸들러 ---------------- */
export async function POST(req: Request) {
  try {
    const { url, biz, email } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "사이트 주소를 입력하세요." }, { status: 400 });
    }

    const result = await runDiagnosis(url.trim(), (biz || "").trim());

    // 리드 저장 + 리포트 이메일 (이메일이 있을 때만) — 실패해도 응답은 반환
    if (email && typeof email === "string") {
      const e = email.trim();
      try { await saveLead({ email: e, url: url.trim(), biz: (biz || "").trim(), result }); }
      catch (err) { console.error("lead save failed:", err); }
      try { await sendReport({ email: e, url: url.trim(), biz: (biz || "").trim(), result }); }
      catch (err) { console.error("email send failed:", err); }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("diagnose error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
