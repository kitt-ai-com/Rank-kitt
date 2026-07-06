# Kitt AI · AI 가시성 진단기 (프로덕션)

kitt.ai.kr 리드마그넷. 사이트를 넣으면 AI 검색 노출 상태를 진단하고 채널별 행동전략을 제안 → 이메일로 리포트 발송 → 리드 저장 → 관리자 대시보드에서 확인.

- `/diagnose` — 진단 도구 (공개)
- `/api/diagnose` — 서버 프록시 (Anthropic 키 서버 보관)
- `/admin` — 리드 대시보드 (Basic Auth)

## 아키텍처

```
브라우저 ──POST /api/diagnose──▶ 서버 라우트 ──x-api-key──▶ Anthropic (web_search)
                                     │
                                     ├─▶ Supabase (geo_leads 저장)
                                     └─▶ Resend (리드에게 리포트 + 관리자 알림)
```
API 키는 서버 환경변수에만 존재. 클라이언트에 절대 노출되지 않음.

## 파일 구조

```
app/
  layout.tsx            폰트(next/font) + 전역
  page.tsx              / → /diagnose 리다이렉트
  globals.css
  diagnose/page.tsx
  diagnose/DiagnoseClient.tsx   진단 UI
  api/diagnose/route.ts         서버 프록시
  admin/page.tsx                리드 대시보드
lib/
  supabase.ts           리드 저장/조회
  email.ts              Resend 리포트 발송
middleware.ts           /admin Basic Auth
Dockerfile / vercel.json / .env.example
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (최소 ANTHROPIC_API_KEY)
npm run dev                  # http://localhost:3000/diagnose
```

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API 키 |
| `DIAGNOSE_MODEL` | | 기본 `claude-sonnet-5` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | | 리드 저장·대시보드 |
| `RESEND_API_KEY` | | 리포트 이메일 발송 |
| `EMAIL_FROM` / `EMAIL_ADMIN` | | 발신/관리자 주소 |
| `ADMIN_USER` / `ADMIN_PASS` | | /admin 접근 (둘 다 필요) |

선택 변수는 미설정 시 해당 기능만 조용히 스킵되고 진단은 정상 동작.

## Supabase 테이블

```sql
create table public.geo_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  site_url text not null,
  industry text,
  result jsonb,
  created_at timestamptz default now()
);
alter table public.geo_leads enable row level security;
-- 서버(서비스 롤)로만 접근하므로 별도 정책 불필요.
```

## Resend (이메일)

1. resend.com 가입 → API 키 발급 → `RESEND_API_KEY`
2. 도메인 인증: kitt.ai.kr DNS에 Resend가 준 레코드 추가 → `EMAIL_FROM=Kitt AI <noreply@kitt.ai.kr>`
3. 인증 전 테스트는 `EMAIL_FROM` 생략 시 `onboarding@resend.dev`로 발송됨.

## 배포 A — Vercel (권장, 가장 간단)

```bash
git init && git add -A && git commit -m "init"
# GitHub에 레포 만들고 push
```
1. vercel.com → New Project → 해당 GitHub 레포 import
2. Environment Variables에 위 변수 등록
3. Deploy. `vercel.json`이 진단 함수 실행시간을 60초로 설정.
4. 커스텀 도메인에 `diagnose.kitt.ai.kr` 또는 `kitt.ai.kr/diagnose` 연결.

> 이미 kitt.ai.kr이 다른 곳(Railway 등)에 있으면, 이 앱을 서브도메인(`geo.kitt.ai.kr`)으로 붙이는 게 깔끔.

## 배포 B — Railway (기존 스택 유지 시)

방법 1) Dockerfile 사용 — 레포에 포함된 `Dockerfile`을 Railway가 자동 인식.
방법 2) Nixpacks — Dockerfile 삭제 시 Railway가 Next.js 자동 빌드.

1. railway.app → New Project → Deploy from GitHub repo
2. Variables에 환경변수 등록
3. 도메인/서브도메인 연결 (Gabia DNS에 CNAME).

Railway는 실행 시간 제한이 없어 웹검색 지연에 안전.

## 배포 후 체크리스트

- [ ] `/diagnose`에서 실제 사이트로 진단 성공
- [ ] 이메일 입력 시 리포트 수신 + 관리자 알림 수신
- [ ] Supabase `geo_leads`에 행 생성 확인
- [ ] `/admin` Basic Auth 로그인 후 리드 목록 표시
- [ ] 모바일에서 레이아웃 정상

## 리드 게이트(선택)

이메일 입력해야 결과를 보이게 하려면 `DiagnoseClient.tsx`의 `generate()` 시작부에:
```ts
if (!email.trim()) { setError("이메일을 입력하면 리포트를 보여드립니다."); return; }
```
