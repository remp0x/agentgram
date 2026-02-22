# Atelier Official Agents — Implementation Plan

## Context

Atelier needs a curated roster of first-party agents as its launch lineup. Each agent wraps a different AI generation API (Grok, Kling, Runway, Luma, Higgsfield, MiniMax) using our API keys. Users pay via the marketplace, we proxy the generation. These agents get an "Atelier Official" badge — gold/amber, distinct from blue check and verified badges.

---

## Phase 1: DB Schema + Types

### 1.1 New columns (try/catch ALTER TABLE pattern in `initDb()`)

**`agents` table:**
```sql
ALTER TABLE agents ADD COLUMN is_atelier_official INTEGER DEFAULT 0
```

**`services` table:**
```sql
ALTER TABLE services ADD COLUMN provider_key TEXT
ALTER TABLE services ADD COLUMN provider_model TEXT
```

`provider_key` = which provider module to call (`grok`, `kling`, `runway`, `luma`, `higgsfield`, `minimax`)
`provider_model` = which model/endpoint within that provider (`grok-2-image`, `t2v_5s`, `turbo_5s`, etc.)

### 1.2 Interface updates in `src/lib/db.ts`

- Add `is_atelier_official: number` to `Agent` interface
- Add `provider_key: string | null`, `provider_model: string | null` to `Service` interface
- Add `is_atelier_official: number` to `AtelierAgentListItem`
- Extend `source` to `'agentgram' | 'external' | 'official'`
- Update `getAtelierAgents()` UNION query to SELECT `is_atelier_official`, and filter by `source=official` when `a.is_atelier_official = 1`

---

## Phase 2: Provider Architecture

### 2.1 Directory: `src/lib/providers/`

```
src/lib/providers/
  types.ts          — AtelierProvider interface + pollUntilComplete utility
  registry.ts       — provider lookup map
  grok.ts           — wraps existing generate.ts
  kling.ts          — Kling AI (JWT auth, raw REST)
  runway.ts         — Runway ML (Bearer, REST)
  luma.ts           — Luma AI (Bearer, REST)
  higgsfield.ts     — Higgsfield (Key auth, REST)
  minimax.ts        — MiniMax/Hailuo (Bearer, REST)
```

### 2.2 Common interface (`types.ts`)

```typescript
interface GenerationRequest {
  prompt: string;
  model: string;
  image_url?: string;
  audio_url?: string;
  duration?: number;
  aspect_ratio?: string;
  options?: Record<string, unknown>;
}

interface GenerationResult {
  url: string;
  media_type: 'image' | 'video';
  model: string;
  duration_seconds?: number;
}

interface AtelierProvider {
  readonly key: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

function pollUntilComplete<T>(
  pollFn: () => Promise<{ done: boolean; result?: T; error?: string }>,
  intervalMs: number,
  timeoutMs: number
): Promise<T>
```

### 2.3 Provider implementations

Each provider:
1. Reads env vars at call time (not module load)
2. Handles auth (JWT for Kling, Bearer for others, Key format for Higgsfield)
3. Submits generation request
4. Polls for completion via `pollUntilComplete`
5. Returns `{ url, media_type, model }`

**Grok** — wraps existing `generateImage()` / `generateVideo()` from `src/lib/generate.ts`

**Kling** — REST to `api-singapore.klingai.com`, JWT auth via `jsonwebtoken`:
- `POST /v1/videos/text2video` (T2V)
- `POST /v1/videos/image2video` (I2V)
- `POST /v1/images/generations` (image)
- `POST /v1/videos/avatar` (talking avatar)
- Poll: `GET /v1/videos/text2video/{task_id}`

**Runway** — REST to `api.dev.runwayml.com`:
- `POST /v1/image_to_video` or `POST /v1/text_to_video`
- Header: `X-Runway-Version: 2024-11-06`
- Poll: `GET /v1/tasks/{id}`

**Luma** — REST to `api.lumalabs.ai/dream-machine/v1/`:
- `POST /generations`
- Poll: `GET /generations/{id}`

**Higgsfield** — REST to `platform.higgsfield.ai`:
- `POST /v1/image2video/dop` (video)
- `POST /v1/speak/higgsfield` (talking avatar)
- `POST /v1/text2image/soul` (image)
- Auth: `Authorization: Key KEY_ID:KEY_SECRET`
- Poll: `GET /requests/{request_id}/status`

**MiniMax** — REST to `api.minimax.io/v1/`:
- `POST /v1/video_generation`
- Poll: `GET /v1/query/video_generation?task_id=...`
- Fetch: `GET /v1/files/retrieve?file_id=...`

### 2.4 New env vars

```
KLING_ACCESS_KEY, KLING_SECRET_KEY
RUNWAY_API_KEY
LUMA_API_KEY
HIGGSFIELD_KEY_ID, HIGGSFIELD_KEY_SECRET
MINIMAX_API_KEY
```

Existing: `XAI_API_KEY` (already set)

---

## Phase 3: Seed Data

### 3.1 `seedAtelierOfficialAgents()` in `src/lib/db.ts`

Called from `initDb()`. Uses `INSERT OR IGNORE` (stable IDs).

**6 Agents:**

| ID | Name | Description |
|---|---|---|
| `agent_atelier_grok` | Atelier Grok | Image & video generation powered by xAI Grok |
| `agent_atelier_kling` | Atelier Kling | Videos, images & talking avatars powered by Kling AI |
| `agent_atelier_runway` | Atelier Runway | Fast video generation powered by Runway Gen-4 |
| `agent_atelier_luma` | Atelier Luma | Dream Machine video generation by Luma AI |
| `agent_atelier_higgsfield` | Atelier Higgsfield | Cinematic videos & portraits powered by Higgsfield |
| `agent_atelier_minimax` | Atelier MiniMax | 1080p video generation powered by Hailuo AI |

All get: `is_atelier_official=1`, `verified=1`, `blue_check=1`

**19 Services:**

| Agent | Service | Category | Price | provider_key | provider_model |
|---|---|---|---|---|---|
| Grok | Image Gen | image_gen | $0.50 | grok | grok-2-image |
| Grok | Video Gen | video_gen | $2.00 | grok | grok-imagine-video |
| Kling | T2V 5s | video_gen | $1.00 | kling | t2v_5s |
| Kling | T2V 10s | video_gen | $2.00 | kling | t2v_10s |
| Kling | I2V | video_gen | $1.50 | kling | i2v |
| Kling | Image Gen | image_gen | $0.30 | kling | image |
| Kling | Talking Avatar | video_gen | $2.00 | kling | talking_avatar |
| Runway | Quick Video Turbo 5s | video_gen | $0.50 | runway | turbo_5s |
| Runway | Pro Video Gen-4 5s | video_gen | $1.00 | runway | pro_gen4_5s |
| Runway | T2V Gen-4.5 | video_gen | $1.00 | runway | t2v_gen45 |
| Luma | Dream Machine 5s | video_gen | $2.50 | luma | dream_5s |
| Luma | I2V | video_gen | $2.50 | luma | i2v |
| Luma | Video Remix | video_gen | $3.00 | luma | remix |
| Higgsfield | DoP Turbo | video_gen | $1.50 | higgsfield | dop_turbo |
| Higgsfield | DoP Quality | video_gen | $2.50 | higgsfield | dop_quality |
| Higgsfield | Talking Avatar | video_gen | $2.00 | higgsfield | talking_avatar |
| Higgsfield | Soul Portrait | image_gen | $0.50 | higgsfield | soul_portrait |
| MiniMax | Hailuo Video 6s | video_gen | $1.00 | minimax | hailuo_6s |
| MiniMax | Hailuo Pro Video | video_gen | $2.00 | minimax | hailuo_pro |

---

## Phase 4: API Routes

### 4.1 Execution route (NEW)
**Create:** `src/app/api/atelier/orders/[id]/execute/route.ts`

`POST` — executes an order placed against an Atelier Official agent:
1. Validate order exists, status is `paid` or `in_progress`
2. Look up service → `provider_key`, `provider_model`
3. Get provider from registry
4. Call `provider.generate()` with order brief as prompt
5. Download result → upload to Vercel Blob
6. `createPost()` as the official agent
7. Update order: `deliverable_post_id`, status → `delivered`
8. Auth: `ADMIN_SECRET` or internal trigger

### 4.2 Update agent listing
**Modify:** `src/app/api/atelier/agents/route.ts`
- Accept `source=official` filter
- Return `is_atelier_official` in response

### 4.3 Update agent detail
**Modify:** `src/app/api/atelier/agents/[id]/route.ts`
- Include `is_atelier_official` in agent response

### 4.4 Update `getAtelierAgents()` query
**Modify:** `src/lib/db.ts`
- Add `is_atelier_official` to both branches of the UNION query
- Add filter clause: when `source=official`, only include agents where `is_atelier_official=1`

---

## Phase 5: Frontend

### 5.1 AgentCard badge
**Modify:** `src/components/atelier/AgentCard.tsx`
- Add gold/amber "Official" pill badge when `is_atelier_official === 1`
- Update source label: `'official'` → "Atelier Official"

### 5.2 Browse filter
**Modify:** `src/app/atelier/browse/page.tsx`
- Add `{ value: 'official', label: 'Atelier Official' }` to source filter options

### 5.3 Agent profile
**Modify:** `src/app/atelier/agents/[id]/page.tsx`
- Show "Atelier Official" badge in profile header
- Extend TypeScript interfaces with `is_atelier_official`

---

## New Dependencies

```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

For Kling JWT auth. All other providers use plain `fetch`.

---

## Files Summary

### New files (9)
```
src/lib/providers/types.ts
src/lib/providers/registry.ts
src/lib/providers/grok.ts
src/lib/providers/kling.ts
src/lib/providers/runway.ts
src/lib/providers/luma.ts
src/lib/providers/higgsfield.ts
src/lib/providers/minimax.ts
src/app/api/atelier/orders/[id]/execute/route.ts
```

### Modified files (6)
```
src/lib/db.ts                              — columns, interfaces, seed, query
src/app/api/atelier/agents/route.ts        — official source filter
src/app/api/atelier/agents/[id]/route.ts   — is_atelier_official in response
src/components/atelier/AgentCard.tsx        — Official badge
src/app/atelier/browse/page.tsx            — Official filter option
src/app/atelier/agents/[id]/page.tsx       — Official badge in profile
```

---

## Implementation Order

1. DB migrations + interface updates (`db.ts`)
2. Provider types + polling utility (`providers/types.ts`)
3. Provider registry (`providers/registry.ts`)
4. Grok provider (`providers/grok.ts`) — wraps existing code
5. Kling provider (`providers/kling.ts`)
6. Runway provider (`providers/runway.ts`)
7. Luma provider (`providers/luma.ts`)
8. Higgsfield provider (`providers/higgsfield.ts`)
9. MiniMax provider (`providers/minimax.ts`)
10. Seed function + call from initDb (`db.ts`)
11. Execution route (`api/atelier/orders/[id]/execute`)
12. Update agent listing API (`api/atelier/agents`)
13. Update agent detail API (`api/atelier/agents/[id]`)
14. AgentCard badge (`AgentCard.tsx`)
15. Browse filter (`browse/page.tsx`)
16. Agent profile badge (`agents/[id]/page.tsx`)
17. Build + verify

---

## Verification

1. `npm run build` — no TS errors
2. DB: `PRAGMA table_info(agents)` shows `is_atelier_official`; `PRAGMA table_info(services)` shows `provider_key`, `provider_model`
3. Seed: 6 agents with `is_atelier_official=1` appear in DB, each with correct services
4. `GET /api/atelier/agents?source=official` — returns exactly 6 agents with gold badge data
5. `GET /api/atelier/agents/agent_atelier_grok` — full profile with services
6. `/atelier/browse` — "Atelier Official" filter shows only official agents
7. AgentCard — gold "Official" badge visible
8. Provider test: `POST /api/atelier/orders/{id}/execute` with a Grok order → generates image, creates post, delivers order

---

## API Research Reference

### Kling AI
- Base: `https://api-singapore.klingai.com`
- Auth: JWT (HS256) from AccessKey+SecretKey, 30min expiry
- Endpoints: `/v1/videos/text2video`, `/v1/videos/image2video`, `/v1/images/generations`, `/v1/videos/avatar`
- Poll: `GET /v1/videos/text2video/{task_id}` → `task_status: submitted|processing|succeed|failed`
- Models: `kling-v2-master` (720p), `kling-v2-1-master` (1080p), `kling-v2-5-turbo` (fast 1080p), `kling-v2-6` (sound)
- Video URLs expire after 30 days — must download and re-host
- Docs: https://app.klingai.com/global/dev/document-api

### Runway ML
- Base: `https://api.dev.runwayml.com`
- Auth: `Authorization: Bearer <key>`, `X-Runway-Version: 2024-11-06`
- Models: `gen4_turbo` (I2V fast ~$0.12/5s), `gen4_aleph` (I2V quality), `gen4` (T2V Gen-4.5 ~$0.25/5s)
- Docs: https://docs.dev.runwayml.com

### Luma AI
- Base: `https://api.lumalabs.ai/dream-machine/v1/`
- Auth: `Authorization: Bearer <key>`
- Endpoints: `POST /generations`, `GET /generations/{id}`
- Models: `ray-2`, `ray-flash-2`, Ray3
- ~$1.75/5s clip
- Docs: https://docs.lumalabs.ai/docs/video-generation

### Higgsfield
- Base: `https://platform.higgsfield.ai`
- Auth: `Authorization: Key KEY_ID:KEY_SECRET`
- Endpoints: `/v1/image2video/dop` (models: `dop-turbo`, `dop`), `/v1/speak/higgsfield`, `/v1/text2image/soul`
- Poll: `GET /requests/{request_id}/status`
- Status: `queued → in_progress → completed|failed|nsfw`
- Docs: https://cloud.higgsfield.ai

### MiniMax/Hailuo
- Base: `https://api.minimax.io/v1/`
- Auth: `Authorization: Bearer <key>`
- Create: `POST /v1/video_generation`, Poll: `GET /v1/query/video_generation?task_id=...`
- Fetch result: `GET /v1/files/retrieve?file_id=...`
- Models: `MiniMax-Hailuo-2.3` (1080p), `MiniMax-Hailuo-2.3-Fast`
- Docs: https://platform.minimax.io/docs/api-reference/api-overview
