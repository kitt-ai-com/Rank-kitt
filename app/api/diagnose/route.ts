import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { saveLead } from "@/lib/supabase";
import { sendReport } from "@/lib/email";

const execFileAsync = promisify(execFile);

// Vercel: 웹검색 + pause_turn 은 시간이 걸리므로 실행 시간을 넉넉히
export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.DIAGNOSE_MODEL || "claude-haiku-4-5";

type Block = { type: string; text?: string; [k: string]: unknown };
type ApiResponse = { content?: Block[]; stop_reason?: string; error?: { message?: string } };

// Google Gemini (무료 티어)
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const geminiUrl = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

// OpenCode Zen (무료 모델 · OpenAI 호환 엔드포인트, Bearer 인증)
// ※ Anthropic 호환 /messages 는 게이트웨이 버그로 400 발생 → OpenAI 호환 /chat/completions 사용
const OPENCODE_URL = "https://opencode.ai/zen/v1/chat/completions";
// deepseek-v4-flash-free는 순수 추론 모델(답을 reasoning에만 씀) → mimo가 content를 직접 반환
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || "mimo-v2.5-free";

/* ---------------- 공급자 선택 ----------------
   우선순위: OpenCode(무료) → Gemini(무료) → Claude(Max OAuth) → Claude(API 키) */
type AnthropicAuth = { type: "oauth"; token: string } | { type: "apikey"; key: string };
type Provider =
  | { kind: "opencode"; key: string }
  | { kind: "gemini"; key: string }
  | { kind: "anthropic"; auth: AnthropicAuth };
type Keys = { anthropic?: string; google?: string; opencode?: string } | undefined;
// Messages API(Anthropic 호환) 호출 대상
type MsgTarget = { url: string; model: string; headers: Record<string, string> };

// ant CLI 프로필(= Max 구독 로그인)에서 단기 OAuth 토큰을 발급.
async function getOAuthToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "ant",
      ["auth", "print-credentials", "--access-token"],
      { timeout: 15000 },
    );
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

async function resolveProvider(keys: Keys): Promise<Provider> {
  // 1) OpenCode Zen (무료 모델)
  const ockey = (keys?.opencode || "").trim() || process.env.OPENCODE_API_KEY;
  if (ockey) return { kind: "opencode", key: ockey };

  // 2) Google Gemini 무료 티어 — 모달 키만 사용(env 폴백 없음)
  const gkey = (keys?.google || "").trim();
  if (gkey) return { kind: "gemini", key: gkey };

  // 3) Claude Max 구독 OAuth
  const token = await getOAuthToken();
  if (token) return { kind: "anthropic", auth: { type: "oauth", token } };

  // 4) Claude API 키
  const akey = (keys?.anthropic || "").trim() || process.env.ANTHROPIC_API_KEY;
  if (akey) return { kind: "anthropic", auth: { type: "apikey", key: akey } };

  throw new Error(
    "인증 정보가 없습니다. '⚙ API 설정'에서 OpenCode Zen 무료 키 또는 Gemini 무료 키를 등록하거나, Claude 로그인/API 키를 설정하세요.",
  );
}

// 호출 대상 빌더
function anthropicTarget(auth: AnthropicAuth): MsgTarget {
  const headers: Record<string, string> = {};
  if (auth.type === "oauth") {
    headers["authorization"] = `Bearer ${auth.token}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
  } else {
    headers["x-api-key"] = auth.key;
  }
  return { url: ANTHROPIC_URL, model: MODEL, headers };
}
/* ---------------- OpenCode Zen 호출 (OpenAI 호환) ---------------- */
async function callOpenCode(prompt: string, key: string): Promise<string> {
  const res = await fetch(OPENCODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string; reasoning_content?: string; reasoning?: string } }[]; error?: { message?: string } }
    | null;
  if (!res.ok) {
    const msg = data?.error?.message || `OpenCode HTTP ${res.status}`;
    throw new Error(msg);
  }
  const msg = data?.choices?.[0]?.message;
  // content 우선, 비었으면 추론 필드에서 폴백(추론 모델 대비)
  const text = (msg?.content || msg?.reasoning_content || msg?.reasoning || "").trim();
  if (!text) throw new Error("OpenCode 응답에 텍스트가 없습니다");
  return text;
}

/* ---------------- Gemini 호출 (무료 티어 + 구글 검색 그라운딩) ---------------- */
async function callGemini(prompt: string, useSearch: boolean, key: string): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8000 },
  };
  // 구글 검색 그라운딩 (Gemini 2.x). JSON 강제(responseMimeType)와는 동시 사용 불가 → 프롬프트로 JSON 유도.
  if (useSearch) body.tools = [{ google_search: {} }];

  const res = await fetch(geminiUrl(key), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as
    | { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } }
    | null;
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    throw new Error(msg);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("");
  if (!text.trim()) throw new Error("Gemini 응답에 텍스트가 없습니다");
  return text;
}

/* ---------------- Messages API 호출 (Anthropic · OpenCode 공통) ---------------- */
async function callApi(messages: unknown[], useSearch: boolean, t: MsgTarget): Promise<ApiResponse> {
  const body: Record<string, unknown> = {
    model: t.model,
    max_tokens: 6000,
    messages,
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }];
  }

  const res = await fetch(t.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      ...t.headers,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as ApiResponse | null;
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
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

const FIX_PROMPT = (raw: string) =>
  `아래 분석 내용을 지시된 JSON 스키마로만 변환하세요. 설명·코드펜스 없이 순수 JSON 하나만. 값 안에 큰따옴표·줄바꿈 금지.

[분석 내용]
${raw}

[스키마]
{"brand":"","summary":"","visibility":{"score":0,"status":"","note":""},"findings":[""],"channels":[{"name":"","status":"","impact":"","note":"","action":""}],"quickWins":[{"action":"","why":"","effort":""}],"phases":[{"phase":"","when":"","actions":[""],"deliverable":""}],"priorities":[""]}`;

async function runDiagnosis(url: string, biz: string, provider: Provider): Promise<unknown> {
  // ── 텍스트 기반 무료 공급자 (Gemini / OpenCode) — 단일 호출 + JSON 추출 ──
  if (provider.kind === "gemini" || provider.kind === "opencode") {
    const key = provider.key;
    const isGemini = provider.kind === "gemini";
    // Gemini는 구글검색 그라운딩, OpenCode 무료모델은 검색 미지원(지식 기반)
    const call = (prompt: string, search: boolean) =>
      isGemini ? callGemini(prompt, search, key) : callOpenCode(prompt, key);
    const text = await call(buildPrompt(url, biz), true);
    try { return extractJson(text); } catch { /* 아래 재정리로 폴백 */ }
    const fixText = await call(FIX_PROMPT(text.slice(0, 6000)), false);
    return extractJson(fixText);
  }

  // ── Claude (Anthropic) — Messages API + web_search ──
  const target = anthropicTarget(provider.auth);
  const messages: unknown[] = [{ role: "user", content: buildPrompt(url, biz) }];
  let data = await callApi(messages, true, target);

  // 웹검색 긴 턴은 pause_turn 으로 중단될 수 있음 → 이어서 완성 (최대 4회)
  let hops = 0;
  while (data.stop_reason === "pause_turn" && hops < 4) {
    messages.push({ role: "assistant", content: data.content });
    data = await callApi(messages, true, target);
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
  const fix = await callApi([{ role: "user", content: FIX_PROMPT(raw) }], false, target);
  const fixText = (fix.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("\n");
  return extractJson(fixText);
}

/* ---------------- 결과 정규화 (무료 모델의 느슨한 스키마 보정) ---------------- */
function normalizeResult(r: unknown): unknown {
  if (!r || typeof r !== "object") return r;
  const o = r as Record<string, unknown>;
  const vis = o.visibility as Record<string, unknown> | undefined;
  // findings 가 visibility 안에 들어간 경우 최상위로 끌어올림
  if (!Array.isArray(o.findings) && vis && Array.isArray(vis.findings)) {
    o.findings = vis.findings;
  }
  // 배열 필드 기본값 보정 (누락 시 화면 렌더 안전)
  for (const k of ["findings", "channels", "quickWins", "phases", "priorities"]) {
    if (!Array.isArray(o[k])) o[k] = [];
  }
  return o;
}

/* ---------------- 핸들러 ---------------- */
export async function POST(req: Request) {
  try {
    const { url, biz, email, keys } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "사이트 주소를 입력하세요." }, { status: 400 });
    }

    const provider = await resolveProvider(keys as Keys);
    const result = normalizeResult(await runDiagnosis(url.trim(), (biz || "").trim(), provider));

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
