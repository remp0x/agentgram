import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const oldDb = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const newDb = createClient({
    url: process.env.ATELIER_TURSO_DATABASE_URL || 'file:local-atelier.db',
    authToken: process.env.ATELIER_TURSO_AUTH_TOKEN,
  });

  const counts: Record<string, number> = {};

  try {
    // 1. Migrate external agents → atelier_agents with source='external'
    const extAgents = await oldDb.execute('SELECT * FROM atelier_external_agents');
    for (const row of extAgents.rows) {
      await newDb.execute({
        sql: `INSERT INTO atelier_agents (id, name, description, avatar_url, endpoint_url, capabilities, api_key, verified, active, total_orders, completed_orders, avg_rating, owner_wallet, source,
              token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash, token_created_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'external',
              ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, description=excluded.description, avatar_url=excluded.avatar_url,
              endpoint_url=excluded.endpoint_url, capabilities=excluded.capabilities,
              total_orders=excluded.total_orders, completed_orders=excluded.completed_orders, avg_rating=excluded.avg_rating,
              owner_wallet=excluded.owner_wallet,
              token_mint=excluded.token_mint, token_name=excluded.token_name, token_symbol=excluded.token_symbol,
              token_image_url=excluded.token_image_url, token_mode=excluded.token_mode,
              token_creator_wallet=excluded.token_creator_wallet, token_tx_hash=excluded.token_tx_hash, token_created_at=excluded.token_created_at`,
        args: [
          row.id, row.name, row.description, row.avatar_url, row.endpoint_url, row.capabilities, row.api_key,
          row.verified, row.active, row.total_orders, row.completed_orders, row.avg_rating, row.owner_wallet,
          row.token_mint, row.token_name, row.token_symbol, row.token_image_url, row.token_mode,
          row.token_creator_wallet, row.token_tx_hash, row.token_created_at, row.created_at,
        ],
      });
    }
    counts.external_agents = extAgents.rows.length;

    // 2. Migrate AgentGram agents that have services → atelier_agents
    const agAgents = await oldDb.execute(`
      SELECT DISTINCT a.* FROM agents a
      INNER JOIN services s ON s.agent_id = a.id
      WHERE a.id NOT LIKE 'ext_%'
    `);
    for (const row of agAgents.rows) {
      const source = (row.is_atelier_official as number) === 1 ? 'official' : 'agentgram';
      await newDb.execute({
        sql: `INSERT INTO atelier_agents (id, name, description, bio, avatar_url, verified, blue_check, is_atelier_official, owner_wallet, source,
              twitter_username, bankr_wallet,
              token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash, token_created_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, description=excluded.description, bio=excluded.bio, avatar_url=excluded.avatar_url,
              verified=excluded.verified, blue_check=excluded.blue_check, is_atelier_official=excluded.is_atelier_official,
              owner_wallet=excluded.owner_wallet, source=excluded.source, twitter_username=excluded.twitter_username,
              bankr_wallet=excluded.bankr_wallet,
              token_mint=excluded.token_mint, token_name=excluded.token_name, token_symbol=excluded.token_symbol,
              token_image_url=excluded.token_image_url, token_mode=excluded.token_mode,
              token_creator_wallet=excluded.token_creator_wallet, token_tx_hash=excluded.token_tx_hash, token_created_at=excluded.token_created_at`,
        args: [
          row.id, row.name, row.description, row.bio, row.avatar_url, row.verified, row.blue_check,
          row.is_atelier_official, row.owner_wallet, source,
          row.twitter_username, row.bankr_wallet,
          row.token_mint, row.token_name, row.token_symbol, row.token_image_url, row.token_mode,
          row.token_creator_wallet, row.token_tx_hash, row.token_created_at, row.created_at,
        ],
      });
    }
    counts.agentgram_agents = agAgents.rows.length;

    // 3. Copy services
    const services = await oldDb.execute('SELECT * FROM services');
    for (const row of services.rows) {
      await newDb.execute({
        sql: `INSERT INTO services (id, agent_id, category, title, description, price_usd, price_type, turnaround_hours, deliverables, portfolio_post_ids, demo_url, active, total_orders, completed_orders, avg_rating, provider_key, provider_model, system_prompt, quota_limit, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [
          row.id, row.agent_id, row.category, row.title, row.description, row.price_usd, row.price_type,
          row.turnaround_hours, row.deliverables, row.portfolio_post_ids, row.demo_url, row.active,
          row.total_orders, row.completed_orders, row.avg_rating, row.provider_key, row.provider_model,
          row.system_prompt, row.quota_limit, row.created_at,
        ],
      });
    }
    counts.services = services.rows.length;

    // 4. Copy service_orders
    const orders = await oldDb.execute('SELECT * FROM service_orders');
    for (const row of orders.rows) {
      await newDb.execute({
        sql: `INSERT INTO service_orders (id, service_id, client_agent_id, client_wallet, provider_agent_id, brief, reference_urls, quoted_price_usd, platform_fee_usd, payment_method, status, escrow_tx_hash, payout_tx_hash, deliverable_post_id, deliverable_url, deliverable_media_type, quota_total, quota_used, workspace_expires_at, delivered_at, review_deadline, completed_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [
          row.id, row.service_id, row.client_agent_id, row.client_wallet, row.provider_agent_id,
          row.brief, row.reference_urls, row.quoted_price_usd, row.platform_fee_usd, row.payment_method,
          row.status, row.escrow_tx_hash, row.payout_tx_hash, row.deliverable_post_id,
          row.deliverable_url, row.deliverable_media_type, row.quota_total, row.quota_used,
          row.workspace_expires_at, row.delivered_at, row.review_deadline, row.completed_at, row.created_at,
        ],
      });
    }
    counts.service_orders = orders.rows.length;

    // 5. Copy service_reviews
    const reviews = await oldDb.execute('SELECT * FROM service_reviews');
    for (const row of reviews.rows) {
      await newDb.execute({
        sql: `INSERT INTO service_reviews (id, order_id, service_id, reviewer_agent_id, reviewer_name, rating, comment, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [row.id, row.order_id, row.service_id, row.reviewer_agent_id, row.reviewer_name, row.rating, row.comment, row.created_at],
      });
    }
    counts.service_reviews = reviews.rows.length;

    // 6. Copy order_deliverables
    const deliverables = await oldDb.execute('SELECT * FROM order_deliverables');
    for (const row of deliverables.rows) {
      await newDb.execute({
        sql: `INSERT INTO order_deliverables (id, order_id, prompt, deliverable_url, deliverable_media_type, status, error, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [row.id, row.order_id, row.prompt, row.deliverable_url, row.deliverable_media_type, row.status, row.error, row.created_at],
      });
    }
    counts.order_deliverables = deliverables.rows.length;

    // 7. Copy atelier_profiles
    const profiles = await oldDb.execute('SELECT * FROM atelier_profiles');
    for (const row of profiles.rows) {
      await newDb.execute({
        sql: `INSERT INTO atelier_profiles (wallet, display_name, bio, avatar_url, twitter_handle, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(wallet) DO NOTHING`,
        args: [row.wallet, row.display_name, row.bio, row.avatar_url, row.twitter_handle, row.created_at, row.updated_at],
      });
    }
    counts.atelier_profiles = profiles.rows.length;

    // 8. Copy creator_fee_sweeps
    const sweeps = await oldDb.execute('SELECT * FROM creator_fee_sweeps');
    for (const row of sweeps.rows) {
      await newDb.execute({
        sql: `INSERT INTO creator_fee_sweeps (id, amount_lamports, tx_hash, swept_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [row.id, row.amount_lamports, row.tx_hash, row.swept_at],
      });
    }
    counts.creator_fee_sweeps = sweeps.rows.length;

    // 9. Copy creator_fee_payouts
    const payouts = await oldDb.execute('SELECT * FROM creator_fee_payouts');
    for (const row of payouts.rows) {
      await newDb.execute({
        sql: `INSERT INTO creator_fee_payouts (id, recipient_wallet, agent_id, token_mint, amount_lamports, tx_hash, status, created_at, paid_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [row.id, row.recipient_wallet, row.agent_id, row.token_mint, row.amount_lamports, row.tx_hash, row.status, row.created_at, row.paid_at],
      });
    }
    counts.creator_fee_payouts = payouts.rows.length;

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Migration failed', counts },
      { status: 500 }
    );
  }
}
