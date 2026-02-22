# Atelier — Per-Agent Token System (PumpFun Hackathon)

## Context

Atelier already has a working marketplace MVP (browse, agent profiles, wallet connect). The next feature adds MoltLaunch-style token support: each agent can launch a token on PumpFun, link an existing token (BYOT), or stay tokenless. This mirrors MoltLaunch's 3-mode pattern but on Solana via PumpFun instead of Flaunch on Base.

---

## Phase 1: DB Schema + Interfaces

**Modify:** `src/lib/db.ts`

### 1.1 Add token columns to both tables
Via try/catch ALTER TABLE (existing pattern):
```
agents:                          atelier_external_agents:
  token_mint TEXT                  token_mint TEXT
  token_name TEXT                  token_name TEXT
  token_symbol TEXT                token_symbol TEXT
  token_image_url TEXT             token_image_url TEXT
  token_mode TEXT                  token_mode TEXT  ('pumpfun'|'byot')
  token_creator_wallet TEXT        token_creator_wallet TEXT
  token_tx_hash TEXT               token_tx_hash TEXT
  token_created_at DATETIME        token_created_at DATETIME
```

### 1.2 New interface
```typescript
export interface AgentTokenInfo {
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_mode: 'pumpfun' | 'byot' | null;
  token_creator_wallet: string | null;
  token_tx_hash: string | null;
  token_created_at: string | null;
}
```

### 1.3 New DB functions
- `updateAgentToken(agentId, source, tokenData)` — writes token info to correct table based on source
- `getAgentTokenInfo(agentId, source)` — reads token info

### 1.4 Update existing queries
- Add `token_mint` to `Agent` and `AtelierExternalAgent` interfaces
- Add `token_mint` to `AtelierAgentListItem` interface
- Add `token_mint` to both SELECT branches in `getAtelierAgents()` UNION query

---

## Phase 2: API Routes

### 2.1 Token CRUD endpoint (new)
**Create:** `src/app/api/atelier/agents/[id]/token/route.ts`

`GET` — returns token info for agent (public, no auth)
`POST` — persists token after on-chain confirmation
- Body: `{ token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash }`
- Validates: agent exists, no existing token (`token_mint IS NULL`), mint is valid base58 (32-44 chars)
- Rate limited

### 2.2 IPFS proxy (new)
**Create:** `src/app/api/atelier/token/ipfs/route.ts`

`POST` — accepts FormData (file, name, symbol, description), forwards to `https://pump.fun/api/ipfs`, returns `{ metadataUri }`.
Needed because pump.fun blocks browser CORS. Stateless proxy, rate limited.

### 2.3 Update agent detail response
**Modify:** `src/app/api/atelier/agents/[id]/route.ts`

Include `token` fields in the response for both agentgram and external agents. Add to the response object:
```typescript
token: {
  mint: agent.token_mint,
  name: agent.token_name,
  symbol: agent.token_symbol,
  image_url: agent.token_image_url,
  mode: agent.token_mode,
  creator_wallet: agent.token_creator_wallet,
  tx_hash: agent.token_tx_hash,
}
```

---

## Phase 3: Client-Side PumpFun Integration

### 3.1 New dependencies
```bash
npm install @coral-xyz/anchor @solana/spl-token bn.js
npm install -D @types/bn.js
```
Required peer deps of `@pump-fun/pump-sdk` (already installed at v1.28.0).

### 3.2 PumpFun launch lib (new)
**Create:** `src/lib/pumpfun-client.ts`

Client-side only (runs in browser). Uses the official `@pump-fun/pump-sdk` — no PumpPortal dependency, no API key, no fee.

Three functions:

1. `uploadTokenMetadata(metadata)` — POST FormData to our IPFS proxy (`/api/atelier/token/ipfs`), returns `metadataUri`
2. `buildCreateTransaction(params)` — builds tx using official SDK:
   ```typescript
   import { PUMP_SDK, getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk';
   import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
   import { Keypair, VersionedTransaction, TransactionMessage } from '@solana/web3.js';

   // For create-only:
   const ix = await PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator, user });

   // For create + initial buy:
   const onlineSdk = new OnlinePumpSdk(connection);
   const global = await onlineSdk.fetchGlobal();
   const amount = getBuyTokenAmountFromSolAmount(global, null, solAmount);
   const ixs = await PUMP_SDK.createV2AndBuyInstructions({ global, mint, name, symbol, uri, creator, user, amount, solAmount });
   ```
3. `launchPumpFunToken(params)` — orchestrates the full flow:
   - Upload metadata via IPFS proxy → get `metadataUri`
   - Generate ephemeral mint `Keypair`
   - Build instructions via `PUMP_SDK.createV2Instruction()` or `createV2AndBuyInstructions()` (if dev buy > 0)
   - Compile into `VersionedTransaction` with recent blockhash
   - Partial-sign with mint keypair (`.sign([mintKeypair])`)
   - Sign with wallet adapter (`signTransaction(tx)`)
   - Send and confirm via `connection.sendRawTransaction()`
   - POST mint address to our token API
   - Returns `{ mint, txSignature }`

**Key difference from PumpPortal approach**: Transaction is built locally using on-chain program instructions (Anchor IDL). No external API call for tx building. The only network call before signing is `fetchGlobal()` (reads PumpFun global state from chain) which happens through the user's RPC.

### 3.3 CSP update
**Modify:** `next.config.js`

Add `https://pump.fun` to `connect-src` (for IPFS metadata upload proxy target). No PumpPortal domain needed.

---

## Phase 4: UI Components

### 4.1 TokenLaunchSection (new)
**Create:** `src/components/atelier/TokenLaunchSection.tsx`

Client component using `useWallet()` and `useConnection()`.

**Three render states:**

**No token + wallet connected:**
- Two buttons: "Launch on PumpFun" / "Link Existing Token"
- PumpFun form: name, symbol, description, image, dev buy amount (SOL)
- BYOT form: mint address, name (optional), symbol (optional)
- Submit triggers `launchPumpFunToken()` or direct POST to token API

**Launch in progress:**
- Step indicator: Uploading → Signing → Confirming
- Spinner, disable all inputs

**Has token (read-only):**
- Token card: name, $SYMBOL, mode badge, truncated mint address (links to pump.fun), creator wallet
- PumpFun link: `https://pump.fun/coin/{mint}`

### 4.2 Update AgentCard
**Modify:** `src/components/atelier/AgentCard.tsx`

Add token badge when `agent.token_mint` is set — small pill with coin icon + `$SYMBOL` or generic "Has Token" indicator near the existing verified badges.

### 4.3 Update agent profile page
**Modify:** `src/app/atelier/agents/[id]/page.tsx`

- Extend `AgentDetail` and `AgentData` interfaces with token fields
- Render `<TokenLaunchSection>` between profile header and services section
- Pass token info from API response + callback to refresh on launch

---

## Files Summary

### New files (4)
```
src/lib/pumpfun-client.ts                           — client-side PumpFun launch logic
src/components/atelier/TokenLaunchSection.tsx         — token UI (launch form + info display)
src/app/api/atelier/agents/[id]/token/route.ts       — GET/POST token info
src/app/api/atelier/token/ipfs/route.ts              — IPFS upload proxy
```

### Modified files (5)
```
src/lib/db.ts                                        — token columns, interfaces, queries
src/app/api/atelier/agents/[id]/route.ts             — include token in detail response
src/app/atelier/agents/[id]/page.tsx                 — render TokenLaunchSection
src/components/atelier/AgentCard.tsx                  — token badge
next.config.js                                       — CSP connect-src + pump.fun
```

---

## Implementation Order

1. DB migrations + interfaces + query functions (`db.ts`)
2. Token API routes (GET/POST)
3. IPFS proxy route
4. Update agent detail API to include token fields
5. Client-side PumpFun lib (`pumpfun-client.ts`)
6. TokenLaunchSection component
7. Integrate into agent profile page
8. AgentCard token badge
9. Update `getAtelierAgents` UNION query for browse grid
10. CSP update in `next.config.js`
11. Build + verify

---

## Verification

1. `npm run build` passes
2. Browse page shows token badges on agents that have tokens
3. Agent profile shows TokenLaunchSection
4. With wallet connected: PumpFun launch form appears, BYOT form appears
5. Without wallet: read-only token info (or "Connect wallet to launch")
6. IPFS proxy works: `curl -X POST /api/atelier/token/ipfs` with FormData returns metadataUri
7. Token API works: `POST /api/atelier/agents/{id}/token` stores token, `GET` retrieves it
8. Full PumpFun flow (mainnet): metadata upload → tx build → sign → confirm → stored in DB

## Risks / Notes

- **Token2022**: `createV2Instruction()` uses `TOKEN_2022_PROGRAM_ID` (not legacy `TOKEN_PROGRAM_ID`). The v1 `createInstruction()` is deprecated. Ensure wallet adapter and any token account lookups use Token2022.
- **PumpFun mainnet only**: No devnet support. Test with small amounts.
- **Race condition**: Two users launching simultaneously → SQLite serialized writes + `token_mint IS NULL` check prevents double-creation.
- **Dev buy amount**: PumpFun may require a minimum buy on creation (non-zero). Default to 0.01 SOL, let user configure.
- **Anchor bundle size**: `@coral-xyz/anchor` is heavy (~500KB). Since we only use the SDK's instruction builders (not Anchor directly), tree-shaking should help, but monitor bundle size. If problematic, the SDK's instruction builders can potentially be extracted.
- **`fetchGlobal()` RPC call**: Required before `createV2AndBuyInstructions()` to get fee config. Uses the user's RPC endpoint via `useConnection()`. Single RPC call, no rate limit concern.

## SDK Reference

Package: `@pump-fun/pump-sdk@1.28.0` (official, MIT, pump-fun org on npm)

Key exports used:
- `PUMP_SDK` — singleton `PumpSdk` instance (offline, no Connection needed)
- `OnlinePumpSdk` — needs `Connection`, used for `fetchGlobal()` and bonding curve reads
- `getBuyTokenAmountFromSolAmount(global, bondingCurve, solAmount)` — calculates token amount for dev buy
- `PUMP_PROGRAM_ID` — `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- `PUMP_AMM_PROGRAM_ID` — `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`
