# Atelier — AI Creative Marketplace on Solana

## Context

PumpFun hackathon opportunity. Atelier is a marketplace where users browse, hire, and pay AI agents for visual content. Lives in the AgentGram repo under `/atelier` routes with its own branding (violet accent, standalone layout). Reuses existing DB, services, orders, agents infrastructure. Adds Solana wallet connect and external agent registration.

Full spec: `ATELIER_SPEC.md` in repo root.

---

## Phase 1: Foundation

### 1.1 Add Atelier colors to Tailwind
**Modify:** `tailwind.config.js`
- Add `atelier` color family: `#8B5CF6` (DEFAULT), `#A78BFA` (bright), `#7C3AED` (dark), `#8B5CF633` (glow)
- Add `gradient-atelier`: `linear-gradient(135deg, #8B5CF6, #A78BFA)`
- Add `glow-atelier` and `pulse-atelier` animations + keyframes

### 1.2 Add CSS utility classes
**Modify:** `src/app/globals.css`
- Add `.text-gradient-atelier` (violet gradient text, same pattern as `.text-gradient-orange`)

### 1.3 Make `/atelier` standalone
**Modify:** `src/components/AppLayout.tsx`
- Add `'/atelier'` to `STANDALONE_ROUTES` array (line 7)

### 1.4 Install Solana packages
```bash
npm install @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

**Verify:** `npm run build` passes, `/atelier` renders without sidebar

---

## Phase 2: Atelier Shell (Layout + Wallet)

### 2.1 SolanaWalletProvider
**Create:** `src/components/atelier/SolanaWalletProvider.tsx`
- `ConnectionProvider` + `WalletProvider` (Phantom, Solflare) + `WalletModalProvider`
- Uses `NEXT_PUBLIC_SOLANA_RPC_URL` env var, falls back to mainnet-beta
- Imports `@solana/wallet-adapter-react-ui/styles.css`

### 2.2 AtelierNav
**Create:** `src/components/atelier/AtelierNav.tsx`
- Fixed top nav, same pattern as landing page nav (backdrop blur, border-b)
- Logo: "Atelier" text in font-display
- Links: Browse (`/atelier/browse`), How It Works (anchor)
- Right side: `WalletMultiButton` styled with `bg-gradient-atelier`

### 2.3 AtelierFooter
**Create:** `src/components/atelier/AtelierFooter.tsx`
- Minimal footer: Atelier wordmark, links ($ATELIER, Twitter, "Powered by AgentGram")

### 2.4 AtelierLayout
**Create:** `src/components/atelier/AtelierLayout.tsx`
- Wraps children in `SolanaWalletProvider` > `AtelierNav` + `main` + `AtelierFooter`
- All Atelier pages use this as their top-level wrapper

**Verify:** Nav renders with wallet button, footer shows, wallet connect modal opens

---

## Phase 3: Database (parallel with Phase 2)

### 3.1 External agents table
**Modify:** `src/lib/db.ts`
- Add `atelier_external_agents` table in `initDb()`:
  - `id`, `name`, `description`, `avatar_url`, `endpoint_url`, `capabilities` (JSON), `api_key`, `verified`, `active`, `total_orders`, `completed_orders`, `avg_rating`, `created_at`
  - Indexes on `api_key` and `active`

### 3.2 Query functions
**Modify:** `src/lib/db.ts`
- `registerAtelierAgent()` — insert external agent, return id + api_key
- `getAtelierExternalAgent(id)` — get by id
- `getAtelierExternalAgentByApiKey(apiKey)` — get by api key

### 3.3 Unified agent query
**Modify:** `src/lib/db.ts`
- `getAtelierAgents(filters)` — UNION query joining AgentGram agents (that have active services) with external agents. Returns `AtelierAgentListItem[]` with: id, name, description, avatar_url, source ('agentgram'|'external'), verified, blue_check, services_count, avg_rating, completed_orders, categories[]
- Supports: category filter, search, source filter, sortBy (popular/newest/rating), limit, offset

**Verify:** Functions return correct shapes, UNION query works

---

## Phase 4: API Routes

### 4.1 External agent registration
**Create:** `src/app/api/atelier/agents/register/route.ts`
- `POST` — validates name, description, endpoint_url, capabilities
- Rate limited (reuse `rateLimiters.registration`)
- Returns `{ agent_id, api_key, protocol_spec }` with required endpoints listed

### 4.2 Agent list
**Create:** `src/app/api/atelier/agents/route.ts`
- `GET` — query params: category, search, source, sortBy, limit, offset
- Calls `getAtelierAgents()`

### 4.3 Agent detail
**Create:** `src/app/api/atelier/agents/[id]/route.ts`
- `GET` — for AgentGram agents: calls existing `getAgent()`, `getServicesByAgent()`, `getAgentPosts()`, `getServiceReviews()`
- For external agents: calls `getAtelierExternalAgent()`
- Returns unified shape: `{ agent, services, portfolio, stats, reviews }`

**Verify:** All 3 endpoints return correct data, rate limiting works, error handling follows `{ success, error }` pattern

---

## Phase 5: Frontend Pages

### 5.1 Landing page
**Create:** `src/app/atelier/page.tsx`
- `'use client'`, standalone page (same pattern as `src/app/landing/page.tsx`)
- Copy `useReveal()` and `Section` component inline
- Sections: Hero → Categories → Featured Agents → How It Works → Protocol Spec → Token → CTA → Footer
- All orange references → atelier violet (`text-gradient-atelier`, `bg-gradient-atelier`, `border-atelier/30`, etc.)
- Wrap in `AtelierLayout`

### 5.2 Browse page
**Create:** `src/app/atelier/browse/page.tsx`
- Server component with `searchParams` for filters (same pattern as marketplace page)
- Category pills, source filter (All/AgentGram/External), sort, search
- Agent grid: 3-col desktop, 1-col mobile
- Uses `AgentCard` component

### 5.3 Agent profile page
**Create:** `src/app/atelier/agents/[id]/page.tsx`
- `'use client'` (needs wallet interaction)
- Wrapped in `AtelierLayout`
- Sections: Profile header → Services list → Portfolio grid → Reviews
- "Hire" button → creates order via existing `/api/services/[id]/orders`

### 5.4 Shared components
**Create:** `src/components/atelier/AgentCard.tsx` — card for browse grid (avatar, name, badges, rating, categories, "View Profile" CTA)
**Create:** `src/components/atelier/ServiceCard.tsx` — service card for agent profile (title, price, category, turnaround)

**Verify:** All pages load, filters work, navigation works, mobile responsive, `npm run build` passes

---

## Files Summary

### New files (11)
```
src/components/atelier/SolanaWalletProvider.tsx
src/components/atelier/AtelierNav.tsx
src/components/atelier/AtelierFooter.tsx
src/components/atelier/AtelierLayout.tsx
src/components/atelier/AgentCard.tsx
src/components/atelier/ServiceCard.tsx
src/app/atelier/page.tsx
src/app/atelier/browse/page.tsx
src/app/atelier/agents/[id]/page.tsx
src/app/api/atelier/agents/register/route.ts
src/app/api/atelier/agents/route.ts
src/app/api/atelier/agents/[id]/route.ts
```

### Modified files (4)
```
tailwind.config.js          — atelier colors, gradients, animations
src/app/globals.css          — .text-gradient-atelier
src/components/AppLayout.tsx — add '/atelier' to STANDALONE_ROUTES
src/lib/db.ts                — external agents table + queries
```

---

## Verification

1. `npm run build` passes (no TS errors, no regressions)
2. Existing AgentGram routes unaffected (spot-check `/`, `/marketplace`, `/agents/[id]`)
3. `/atelier` — landing renders, animations work, violet branding
4. `/atelier/browse` — agent grid loads, filters work, search works
5. `/atelier/agents/[id]` — profile loads, services/portfolio/reviews display
6. Wallet connect modal opens, Phantom/Solflare detected
7. `POST /api/atelier/agents/register` — returns api_key, rate limited
8. `GET /api/atelier/agents` — returns mixed AgentGram + external agents
