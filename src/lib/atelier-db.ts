import { createClient, Client } from '@libsql/client';
import { randomBytes } from 'crypto';

const atelierClient: Client = createClient({
  url: process.env.ATELIER_TURSO_DATABASE_URL || 'file:local-atelier.db',
  authToken: process.env.ATELIER_TURSO_AUTH_TOKEN,
});

let initialized = false;

async function initAtelierDb(): Promise<void> {
  if (initialized) return;

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS atelier_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      bio TEXT,
      source TEXT NOT NULL DEFAULT 'external',
      endpoint_url TEXT,
      capabilities TEXT DEFAULT '[]',
      api_key TEXT UNIQUE,
      verified INTEGER DEFAULT 0,
      blue_check INTEGER DEFAULT 0,
      is_atelier_official INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      avg_rating REAL,
      twitter_username TEXT,
      bankr_wallet TEXT,
      owner_wallet TEXT,
      token_mint TEXT,
      token_name TEXT,
      token_symbol TEXT,
      token_image_url TEXT,
      token_mode TEXT,
      token_creator_wallet TEXT,
      token_tx_hash TEXT,
      token_created_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_atelier_agents_api_key ON atelier_agents(api_key)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_atelier_agents_active ON atelier_agents(active)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_atelier_agents_source ON atelier_agents(source)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_atelier_agents_owner_wallet ON atelier_agents(owner_wallet)');

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_usd TEXT NOT NULL,
      price_type TEXT NOT NULL DEFAULT 'fixed',
      turnaround_hours INTEGER DEFAULT 48,
      deliverables TEXT DEFAULT '[]',
      portfolio_post_ids TEXT DEFAULT '[]',
      demo_url TEXT,
      active INTEGER DEFAULT 1,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      avg_rating REAL,
      provider_key TEXT,
      provider_model TEXT,
      system_prompt TEXT,
      quota_limit INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES atelier_agents(id)
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_services_agent_id ON services(agent_id)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_services_category ON services(category)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_services_active ON services(active)');

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      client_agent_id TEXT,
      client_wallet TEXT,
      provider_agent_id TEXT NOT NULL,
      brief TEXT NOT NULL,
      reference_urls TEXT,
      quoted_price_usd TEXT,
      platform_fee_usd TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'pending_quote',
      escrow_tx_hash TEXT,
      payout_tx_hash TEXT,
      deliverable_post_id INTEGER,
      deliverable_url TEXT,
      deliverable_media_type TEXT,
      quota_total INTEGER DEFAULT 0,
      quota_used INTEGER DEFAULT 0,
      workspace_expires_at DATETIME,
      delivered_at DATETIME,
      review_deadline DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (provider_agent_id) REFERENCES atelier_agents(id)
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_service_id ON service_orders(service_id)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_client ON service_orders(client_agent_id)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_provider ON service_orders(provider_agent_id)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_wallet ON service_orders(client_wallet)');

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS service_reviews (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      reviewer_agent_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES service_orders(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_reviews_service ON service_reviews(service_id)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_service_reviews_order ON service_reviews(order_id)');

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS order_deliverables (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      deliverable_url TEXT,
      deliverable_media_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES service_orders(id)
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_order_deliverables_order ON order_deliverables(order_id)');

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS atelier_profiles (
      wallet TEXT PRIMARY KEY,
      display_name TEXT,
      bio TEXT,
      avatar_url TEXT,
      twitter_handle TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS creator_fee_sweeps (
      id TEXT PRIMARY KEY,
      amount_lamports INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      swept_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await atelierClient.execute(`
    CREATE TABLE IF NOT EXISTS creator_fee_payouts (
      id TEXT PRIMARY KEY,
      recipient_wallet TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    )
  `);

  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_fee_payouts_wallet ON creator_fee_payouts(recipient_wallet)');
  await atelierClient.execute('CREATE INDEX IF NOT EXISTS idx_fee_payouts_agent ON creator_fee_payouts(agent_id)');

  try {
    await seedAtelierOfficialAgents();
  } catch (e) {
    console.error('Atelier seed failed (non-fatal):', e);
  }

  initialized = true;
}

// ─── Seed Official Agents ───

async function seedAtelierOfficialAgents(): Promise<void> {
  const agents = [
    {
      id: 'agent_atelier_animestudio',
      name: 'AnimeStudio',
      description: 'On-demand anime-style images and videos. Consistent character design, manga panels, and vibrant anime aesthetics — generate exactly what you need, when you need it.',
      avatar_url: 'https://awbojlikpadohvp1.public.blob.vercel-storage.com/atelier-avatars/animestudio-gsUMZzmSTICYY4vpAK9TB6jRZvuKNf.png',
    },
    {
      id: 'agent_atelier_ugcfactory',
      name: 'UGC Factory',
      description: 'Scroll-stopping UGC content for brands. Product unboxings, lifestyle shots, testimonial-style visuals — authentic creator aesthetics, all on-brand, all day.',
      avatar_url: 'https://awbojlikpadohvp1.public.blob.vercel-storage.com/atelier-avatars/ugcfactory-JxBJHQoxj1LJyPWjnpfsrvQwIwgv2S.png',
    },
    {
      id: 'agent_atelier_lenscraft',
      name: 'LensCraft',
      description: 'Studio-quality product photography on demand. Clean backgrounds, lifestyle flatlays, hero shots, and detail close-ups — unlimited renders in a consistent premium style.',
      avatar_url: 'https://awbojlikpadohvp1.public.blob.vercel-storage.com/atelier-avatars/lenscraft-8N9SqsrbOdpPtfWLWrFQ71knF8CYzS.png',
    },
  ];

  const ATELIER_OWNER_WALLET = 'EZkoXXZ5HEWdKwfv7wua7k6Dqv8aQxxHWNakq2gG2Qpb';

  for (const a of agents) {
    await atelierClient.execute({
      sql: `INSERT INTO atelier_agents (id, name, description, avatar_url, source, verified, blue_check, is_atelier_official, owner_wallet)
            VALUES (?, ?, ?, ?, 'official', 1, 1, 1, ?)
            ON CONFLICT(id) DO UPDATE SET avatar_url = ?, owner_wallet = ?`,
      args: [a.id, a.name, a.description, a.avatar_url, ATELIER_OWNER_WALLET, a.avatar_url, ATELIER_OWNER_WALLET],
    });
  }

  const services: Array<{
    id: string;
    agent_id: string;
    category: string;
    title: string;
    description: string;
    price_usd: string;
    provider_key: string;
    provider_model: string;
    turnaround_hours?: number;
    system_prompt?: string;
    quota_limit?: number;
  }> = [
    {
      id: 'svc_animestudio_images',
      agent_id: 'agent_atelier_animestudio',
      category: 'image_gen',
      title: 'Anime Image Pack — 15 Images',
      description: '15 anime-style images you generate on demand. Open your workspace, submit prompts one at a time, and get consistent character designs, manga panels, or social content — all in a cohesive visual style. 24h to use all generations.',
      price_usd: '25.00',
      provider_key: 'grok',
      provider_model: 'grok-2-image',
      turnaround_hours: 24,
      quota_limit: 15,
      system_prompt: [
        'You are AnimeStudio. Every image you produce MUST be in anime/manga style — no exceptions, regardless of what the user describes.',
        '',
        'ABSOLUTE RULES:',
        '- NEVER generate photorealistic, 3D-rendered, or live-action-looking images. Everything must look hand-drawn in Japanese animation style.',
        '- If the user requests a real person, celebrity, or cartoon character (e.g. "Homer Simpson", "Elon Musk"), reinterpret them fully as an anime character. Capture their recognizable traits (hair color, outfit, body shape) but render entirely in anime style.',
        '- If the user provides a vague or non-visual prompt, interpret it creatively and produce a compelling anime illustration anyway.',
        '',
        'VISUAL STYLE:',
        '- Cel-shaded coloring with clean, confident linework. Lines should be visible and deliberate, not blended or airbrushed.',
        '- Large, expressive eyes with detailed irises, light reflections, and visible pupils. Eyes are the emotional anchor of every character.',
        '- Vibrant, saturated color palette. Use bold contrasts — deep shadows against bright highlights. Avoid muddy, desaturated, or overly muted tones.',
        '- Dynamic compositions: diagonal lines, dramatic perspective, foreshortening, and motion lines where appropriate.',
        '- Hair should have volume, flow, and distinct strands/chunks with specular highlights. Never flat or blobby.',
        '- Backgrounds should complement the mood: painted skies, speed lines, sparkle effects, abstract color gradients, or detailed environments in anime style.',
        '',
        'CHARACTER CONSISTENCY:',
        '- Within a session, maintain consistent character features: same face shape, eye color, hair style, and color palette across all outputs.',
        '- Clothing and accessories should stay consistent unless the user explicitly requests a change.',
        '',
        'SUBSTYLES (adapt based on context):',
        '- Shonen: bold lines, high energy, action poses, intense expressions, speed effects',
        '- Shoujo: softer lines, flower/sparkle motifs, pastel accents, gentle expressions',
        '- Slice-of-life: warm lighting, everyday settings, relaxed poses, cozy atmosphere',
        '- Chibi: super-deformed proportions (large head, small body) for cute/comedic requests',
        '- Dark/seinen: heavier shadows, muted palette with selective color pops, mature tone',
        '',
        'OUTPUT QUALITY:',
        '- Every image should be striking enough for social media, print, or wallpaper use.',
        '- Frame compositions for vertical (9:16) or square (1:1) aspect ratios unless specified otherwise.',
        '- Include fine details: fabric folds, hair physics, atmospheric lighting, subtle textures.',
      ].join('\n'),
    },
    {
      id: 'svc_animestudio_videos',
      agent_id: 'agent_atelier_animestudio',
      category: 'video_gen',
      title: 'Anime Video Pack — 5 Videos',
      description: '5 anime-style short videos you generate on demand. Open your workspace, describe each scene, and get dynamic anime animations with vibrant aesthetics. Perfect for reels, intros, or storytelling. 24h to use all generations.',
      price_usd: '35.00',
      provider_key: 'grok',
      provider_model: 'grok-imagine-video',
      turnaround_hours: 24,
      quota_limit: 5,
      system_prompt: [
        'You are AnimeStudio. Every video you produce MUST be in anime/manga animation style — no exceptions, regardless of what the user describes.',
        '',
        'ABSOLUTE RULES:',
        '- NEVER generate photorealistic, 3D-rendered, or live-action-looking footage. Everything must look like Japanese animation.',
        '- If the user requests a real person, celebrity, or cartoon character, reinterpret them fully as an anime character. Capture recognizable traits but render entirely in anime style.',
        '- If the user provides a vague prompt, interpret it creatively and produce a compelling anime animation.',
        '',
        'VISUAL STYLE:',
        '- Cel-shaded look with clean linework visible throughout the animation.',
        '- Vibrant, saturated colors with bold contrasts. Deep shadows against bright highlights.',
        '- Large, expressive character eyes with detailed irises and light reflections.',
        '- Hair with volume, flow, and physics — strands should move naturally with character motion.',
        '- Anime-style motion: exaggerated key poses, dynamic camera angles, speed lines, impact frames, and smear frames for fast action.',
        '',
        'ANIMATION QUALITY:',
        '- Smooth, fluid character movement. Avoid stiff or robotic motion.',
        '- Include secondary motion: hair bounce, clothing sway, environmental particles.',
        '- Camera work should feel cinematic: slow pans, dramatic zooms, parallax depth on backgrounds.',
        '- Backgrounds in painted anime style — not photographic or 3D.',
        '',
        'CHARACTER CONSISTENCY:',
        '- Maintain consistent character features across all frames: face shape, eye color, hair style, outfit.',
        '- Within a session, characters should look the same across all generated videos.',
        '',
        'SUBSTYLES (adapt based on context):',
        '- Action/shonen: fast cuts, impact effects, energy auras, speed lines',
        '- Emotional/shoujo: slow motion, particle effects (petals, sparkles), soft lighting transitions',
        '- Slice-of-life: gentle pacing, warm color grading, everyday environments',
        '- Opening/intro: dynamic montage feel, title-card energy, music-video pacing',
      ].join('\n'),
    },
    {
      id: 'svc_ugcfactory_day',
      agent_id: 'agent_atelier_ugcfactory',
      category: 'ugc',
      title: 'Unlimited Brand UGC — 1 Day',
      description: 'Unlimited user-generated-content-style visuals for your brand for 24 hours. Product-in-hand shots, lifestyle scenes, unboxing moments, and testimonial-ready frames — all matching your brand guidelines.',
      price_usd: '25.00',
      provider_key: 'grok',
      provider_model: 'grok-2-image',
      turnaround_hours: 24,
      system_prompt: 'You are UGC Factory, a specialist in authentic-looking user-generated content for brands. Every image must look like it was shot by a real creator on their phone: natural lighting, casual compositions, real-world environments (kitchen tables, bathroom shelves, car dashboards, park benches). Products should be the hero but feel organic, not staged. Include human hands or partial figures when relevant. Warm, slightly saturated tones. Shoot styles: flat-lay, product-in-hand, lifestyle scene, before/after, unboxing reveal. Never produce overly polished studio-quality looks — the goal is authentic, scroll-stopping content that feels native to Instagram and TikTok.',
    },
    {
      id: 'svc_lenscraft_day',
      agent_id: 'agent_atelier_lenscraft',
      category: 'brand_content',
      title: 'Unlimited Product Photography — 1 Day',
      description: 'Unlimited studio-quality product renders for 24 hours. Clean white backgrounds, lifestyle compositions, hero shots, and detail close-ups — all in a consistent, premium visual style.',
      price_usd: '25.00',
      provider_key: 'grok',
      provider_model: 'grok-2-image',
      turnaround_hours: 24,
      system_prompt: 'You are LensCraft, a specialist in commercial product photography. Every image must look like a professional studio shoot: precise lighting with soft shadows, clean backgrounds (pure white, gradient, or contextual), sharp focus on the product, and premium feel. Styles include: hero shot (dramatic angle, single product), flat-lay (top-down arrangement with props), lifestyle (product in elegant real-world setting), detail macro (textures, materials, craftsmanship), and catalog (clean, informative, e-commerce ready). Maintain consistent lighting temperature and color grading across all outputs. Products should look aspirational and high-end. Never produce amateur or over-processed looks.',
    },
  ];

  for (const s of services) {
    await atelierClient.execute({
      sql: `INSERT OR IGNORE INTO services (id, agent_id, category, title, description, price_usd, price_type, turnaround_hours, deliverables, portfolio_post_ids, provider_key, provider_model, system_prompt, quota_limit)
            VALUES (?, ?, ?, ?, ?, ?, 'fixed', ?, '[]', '[]', ?, ?, ?, ?)`,
      args: [s.id, s.agent_id, s.category, s.title, s.description, s.price_usd, s.turnaround_hours || 1, s.provider_key, s.provider_model, s.system_prompt || null, s.quota_limit || 0],
    });
  }
}

// ─── Types ───

export type ServiceCategory = 'image_gen' | 'video_gen' | 'ugc' | 'influencer' | 'brand_content' | 'custom';
export type ServicePriceType = 'fixed' | 'quote';
export type OrderStatus = 'pending_quote' | 'quoted' | 'accepted' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'cancelled';

export interface AtelierAgent {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  bio: string | null;
  source: 'agentgram' | 'external' | 'official';
  endpoint_url: string | null;
  capabilities: string;
  api_key: string | null;
  verified: number;
  blue_check: number;
  is_atelier_official: number;
  active: number;
  total_orders: number;
  completed_orders: number;
  avg_rating: number | null;
  twitter_username: string | null;
  bankr_wallet: string | null;
  owner_wallet: string | null;
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_mode: 'pumpfun' | 'byot' | null;
  token_creator_wallet: string | null;
  token_tx_hash: string | null;
  token_created_at: string | null;
  created_at: string;
}

export interface AtelierAgentListItem {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  source: 'agentgram' | 'external' | 'official';
  verified: number;
  blue_check: number;
  is_atelier_official: number;
  services_count: number;
  avg_rating: number | null;
  completed_orders: number;
  categories: string[];
  token_mint: string | null;
  token_symbol: string | null;
  token_name: string | null;
  token_image_url: string | null;
}

export interface Service {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar_url: string | null;
  category: ServiceCategory;
  title: string;
  description: string;
  price_usd: string;
  price_type: ServicePriceType;
  turnaround_hours: number;
  deliverables: string;
  portfolio_post_ids: string;
  demo_url: string | null;
  active: number;
  total_orders: number;
  completed_orders: number;
  avg_rating: number | null;
  verified: number;
  blue_check: number;
  has_bankr_wallet: number;
  provider_key: string | null;
  provider_model: string | null;
  system_prompt: string | null;
  quota_limit: number;
  is_atelier_official: number;
  created_at: string;
}

export interface ServiceOrder {
  id: string;
  service_id: string;
  service_title: string;
  client_agent_id: string | null;
  client_wallet: string | null;
  client_name: string | null;
  provider_agent_id: string;
  provider_name: string;
  brief: string;
  reference_urls: string | null;
  quoted_price_usd: string | null;
  platform_fee_usd: string | null;
  payment_method: string | null;
  status: OrderStatus;
  escrow_tx_hash: string | null;
  payout_tx_hash: string | null;
  deliverable_post_id: number | null;
  deliverable_url: string | null;
  deliverable_media_type: 'image' | 'video' | null;
  quota_total: number;
  quota_used: number;
  workspace_expires_at: string | null;
  delivered_at: string | null;
  review_deadline: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface OrderDeliverable {
  id: string;
  order_id: string;
  prompt: string;
  deliverable_url: string | null;
  deliverable_media_type: 'image' | 'video' | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error: string | null;
  created_at: string;
}

export interface ServiceReview {
  id: string;
  order_id: string;
  service_id: string;
  reviewer_agent_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface AtelierProfile {
  wallet: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface RecentAgentOrder {
  id: string;
  service_title: string;
  client_wallet: string | null;
  client_display_name: string | null;
  quoted_price_usd: string | null;
  status: OrderStatus;
  created_at: string;
}

// ─── Cross-DB Sync ───

export async function ensureAtelierAgent(coreAgent: {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified: number;
  blue_check: number;
  is_atelier_official: number;
  twitter_username: string | null;
  bankr_wallet: string | null;
  owner_wallet: string | null;
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_mode: 'pumpfun' | 'byot' | null;
  token_creator_wallet: string | null;
  token_tx_hash: string | null;
  token_created_at: string | null;
}): Promise<AtelierAgent> {
  await initAtelierDb();
  const source = coreAgent.is_atelier_official ? 'official' : 'agentgram';

  await atelierClient.execute({
    sql: `INSERT INTO atelier_agents (id, name, description, avatar_url, bio, source, verified, blue_check, is_atelier_official, twitter_username, bankr_wallet, owner_wallet, token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash, token_created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = ?, description = ?, avatar_url = ?, bio = ?, source = ?,
            verified = ?, blue_check = ?, is_atelier_official = ?,
            twitter_username = ?, bankr_wallet = ?, owner_wallet = ?,
            token_mint = COALESCE(atelier_agents.token_mint, ?),
            token_name = COALESCE(atelier_agents.token_name, ?),
            token_symbol = COALESCE(atelier_agents.token_symbol, ?),
            token_image_url = COALESCE(atelier_agents.token_image_url, ?),
            token_mode = COALESCE(atelier_agents.token_mode, ?),
            token_creator_wallet = COALESCE(atelier_agents.token_creator_wallet, ?),
            token_tx_hash = COALESCE(atelier_agents.token_tx_hash, ?),
            token_created_at = COALESCE(atelier_agents.token_created_at, ?)`,
    args: [
      coreAgent.id, coreAgent.name, coreAgent.description, coreAgent.avatar_url,
      coreAgent.bio, source, coreAgent.verified, coreAgent.blue_check,
      coreAgent.is_atelier_official, coreAgent.twitter_username, coreAgent.bankr_wallet,
      coreAgent.owner_wallet, coreAgent.token_mint, coreAgent.token_name,
      coreAgent.token_symbol, coreAgent.token_image_url, coreAgent.token_mode,
      coreAgent.token_creator_wallet, coreAgent.token_tx_hash, coreAgent.token_created_at,
      // ON CONFLICT update values
      coreAgent.name, coreAgent.description, coreAgent.avatar_url, coreAgent.bio, source,
      coreAgent.verified, coreAgent.blue_check, coreAgent.is_atelier_official,
      coreAgent.twitter_username, coreAgent.bankr_wallet, coreAgent.owner_wallet,
      coreAgent.token_mint, coreAgent.token_name, coreAgent.token_symbol,
      coreAgent.token_image_url, coreAgent.token_mode, coreAgent.token_creator_wallet,
      coreAgent.token_tx_hash, coreAgent.token_created_at,
    ],
  });

  return (await getAtelierAgent(coreAgent.id))!;
}

// ─── Agent Queries ───

export async function getAtelierAgent(id: string): Promise<AtelierAgent | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM atelier_agents WHERE id = ? AND active = 1',
    args: [id],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierAgent) : null;
}

export async function getAtelierAgentByApiKey(apiKey: string): Promise<AtelierAgent | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM atelier_agents WHERE api_key = ? AND active = 1',
    args: [apiKey],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierAgent) : null;
}

export async function getAtelierAgentsByWallet(ownerWallet: string): Promise<AtelierAgent[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM atelier_agents WHERE owner_wallet = ? AND active = 1',
    args: [ownerWallet],
  });
  return result.rows as unknown as AtelierAgent[];
}

export async function registerAtelierAgent(data: {
  name: string;
  description: string;
  avatar_url?: string;
  endpoint_url: string;
  capabilities?: string[];
  owner_wallet?: string;
}): Promise<{ agent_id: string; api_key: string }> {
  await initAtelierDb();
  const id = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const apiKey = `atelier_${randomBytes(24).toString('hex')}`;
  const capabilities = JSON.stringify(data.capabilities || []);

  await atelierClient.execute({
    sql: `INSERT INTO atelier_agents (id, name, description, avatar_url, source, endpoint_url, capabilities, api_key, owner_wallet)
          VALUES (?, ?, ?, ?, 'external', ?, ?, ?, ?)`,
    args: [id, data.name, data.description, data.avatar_url || null, data.endpoint_url, capabilities, apiKey, data.owner_wallet || null],
  });

  return { agent_id: id, api_key: apiKey };
}

export async function updateAtelierAgent(
  id: string,
  updates: Partial<Pick<AtelierAgent, 'name' | 'description' | 'avatar_url' | 'endpoint_url' | 'capabilities'>>
): Promise<AtelierAgent | null> {
  await initAtelierDb();
  const setClauses: string[] = [];
  const args: (string | null)[] = [];

  const fields: (keyof typeof updates)[] = ['name', 'description', 'avatar_url', 'endpoint_url', 'capabilities'];
  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(updates[field] as string | null);
    }
  }

  if (setClauses.length === 0) return getAtelierAgent(id);

  args.push(id);
  await atelierClient.execute({
    sql: `UPDATE atelier_agents SET ${setClauses.join(', ')} WHERE id = ? AND active = 1`,
    args,
  });

  return getAtelierAgent(id);
}

export async function getAtelierAgents(filters?: {
  category?: ServiceCategory;
  search?: string;
  source?: 'agentgram' | 'external' | 'official' | 'all';
  sortBy?: 'popular' | 'newest' | 'rating';
  limit?: number;
  offset?: number;
}): Promise<AtelierAgentListItem[]> {
  await initAtelierDb();

  const limit = Math.min(filters?.limit || 24, 100);
  const offset = filters?.offset || 0;
  const search = filters?.search?.trim();
  const source = filters?.source || 'all';

  const conditions: string[] = ['a.active = 1'];
  const args: (string | number)[] = [];

  if (source === 'official') {
    conditions.push("a.source = 'official'");
  } else if (source === 'agentgram') {
    conditions.push("a.source IN ('agentgram', 'official')");
    conditions.push('a.is_atelier_official = 0');
  } else if (source === 'external') {
    conditions.push("a.source = 'external'");
  }

  if (filters?.category) {
    conditions.push('s.category = ?');
    args.push(filters.category);
  }
  if (search) {
    conditions.push('(a.name LIKE ? OR a.description LIKE ? OR s.title LIKE ?)');
    const pat = `%${search}%`;
    args.push(pat, pat, pat);
  }

  let orderClause: string;
  switch (filters?.sortBy) {
    case 'newest': orderClause = 'a.created_at DESC'; break;
    case 'rating': orderClause = 'avg_rating DESC NULLS LAST'; break;
    default: orderClause = 'completed_orders DESC, services_count DESC'; break;
  }

  args.push(limit, offset);

  const result = await atelierClient.execute({
    sql: `SELECT
            a.id, a.name, a.description, a.avatar_url, a.source,
            a.verified, a.blue_check, a.is_atelier_official,
            COUNT(DISTINCT s.id) as services_count,
            MAX(s.avg_rating) as avg_rating,
            COALESCE(SUM(s.completed_orders), 0) as completed_orders,
            GROUP_CONCAT(DISTINCT s.category) as categories_str,
            a.token_mint, a.token_symbol, a.token_name, a.token_image_url,
            a.created_at
          FROM atelier_agents a
          INNER JOIN services s ON s.agent_id = a.id AND s.active = 1
          WHERE ${conditions.join(' AND ')}
          GROUP BY a.id
          ORDER BY ${orderClause}
          LIMIT ? OFFSET ?`,
    args,
  });

  return result.rows.map((row) => {
    const r = row as unknown as {
      id: string; name: string; description: string | null; avatar_url: string | null;
      source: 'agentgram' | 'external' | 'official';
      verified: number; blue_check: number; is_atelier_official: number;
      services_count: number; avg_rating: number | null; completed_orders: number;
      categories_str: string | null;
      token_mint: string | null; token_symbol: string | null; token_name: string | null; token_image_url: string | null;
    };

    let categories: string[] = [];
    if (r.categories_str) {
      if (r.source === 'external') {
        try { categories = JSON.parse(r.categories_str); } catch { categories = r.categories_str.split(',').filter(Boolean); }
      } else {
        categories = r.categories_str.split(',').filter(Boolean);
      }
    }

    return {
      id: r.id, name: r.name, description: r.description, avatar_url: r.avatar_url,
      source: r.source, verified: r.verified, blue_check: r.blue_check,
      is_atelier_official: r.is_atelier_official, services_count: r.services_count,
      avg_rating: r.avg_rating, completed_orders: r.completed_orders, categories,
      token_mint: r.token_mint, token_symbol: r.token_symbol,
      token_name: r.token_name, token_image_url: r.token_image_url,
    };
  });
}

// ─── Service Queries ───

export async function createService(data: {
  agent_id: string;
  category: ServiceCategory;
  title: string;
  description: string;
  price_usd: string;
  price_type: ServicePriceType;
  turnaround_hours?: number;
  deliverables?: string[];
  portfolio_post_ids?: number[];
  demo_url?: string;
}): Promise<Service> {
  await initAtelierDb();
  const id = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await atelierClient.execute({
    sql: `INSERT INTO services (id, agent_id, category, title, description, price_usd, price_type, turnaround_hours, deliverables, portfolio_post_ids, demo_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.agent_id, data.category, data.title, data.description, data.price_usd, data.price_type, data.turnaround_hours || 48, JSON.stringify(data.deliverables || []), JSON.stringify(data.portfolio_post_ids || []), data.demo_url || null],
  });
  return getServiceById(id) as Promise<Service>;
}

export async function getServices(filters?: {
  category?: ServiceCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  providerKey?: string;
  sortBy?: 'popular' | 'newest' | 'cheapest' | 'rating' | 'fastest';
  limit?: number;
  offset?: number;
}): Promise<Service[]> {
  await initAtelierDb();
  const conditions: string[] = ['s.active = 1'];
  const args: (string | number)[] = [];

  if (filters?.category) { conditions.push('s.category = ?'); args.push(filters.category); }
  if (filters?.search) { conditions.push('(s.title LIKE ? OR s.description LIKE ?)'); args.push(`%${filters.search}%`, `%${filters.search}%`); }
  if (filters?.minPrice !== undefined) { conditions.push('CAST(s.price_usd AS REAL) >= ?'); args.push(filters.minPrice); }
  if (filters?.maxPrice !== undefined) { conditions.push('CAST(s.price_usd AS REAL) <= ?'); args.push(filters.maxPrice); }
  if (filters?.minRating !== undefined) { conditions.push('s.avg_rating >= ?'); args.push(filters.minRating); }
  if (filters?.providerKey) { conditions.push('s.provider_key = ?'); args.push(filters.providerKey); }

  const orderBy = {
    popular: 's.completed_orders DESC, s.avg_rating DESC',
    newest: 's.created_at DESC',
    cheapest: 'CAST(s.price_usd AS REAL) ASC',
    rating: 's.avg_rating DESC NULLS LAST',
    fastest: 's.turnaround_hours ASC',
  }[filters?.sortBy || 'popular'] || 's.completed_orders DESC';

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  args.push(limit, offset);

  const result = await atelierClient.execute({
    sql: `SELECT s.*,
            a.name as agent_name,
            a.avatar_url as agent_avatar_url,
            a.verified,
            a.blue_check,
            (a.bankr_wallet IS NOT NULL) as has_bankr_wallet,
            a.is_atelier_official
          FROM services s
          LEFT JOIN atelier_agents a ON s.agent_id = a.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
    args,
  });
  return result.rows as unknown as Service[];
}

export async function getFeaturedServices(limit = 6): Promise<Service[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT s.*,
            a.name as agent_name,
            a.avatar_url as agent_avatar_url,
            a.verified,
            a.blue_check,
            (a.bankr_wallet IS NOT NULL) as has_bankr_wallet,
            a.is_atelier_official
          FROM services s
          LEFT JOIN atelier_agents a ON s.agent_id = a.id
          WHERE s.active = 1
          ORDER BY s.completed_orders DESC, s.avg_rating DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as Service[];
}

export async function getServiceById(id: string): Promise<Service | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT s.*,
            a.name as agent_name,
            a.avatar_url as agent_avatar_url,
            a.verified,
            a.blue_check,
            (a.bankr_wallet IS NOT NULL) as has_bankr_wallet,
            a.is_atelier_official
          FROM services s
          LEFT JOIN atelier_agents a ON s.agent_id = a.id
          WHERE s.id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as Service) || null;
}

export async function getServicesByAgent(agentId: string): Promise<Service[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT s.*,
            a.name as agent_name,
            a.avatar_url as agent_avatar_url,
            a.verified,
            a.blue_check,
            (a.bankr_wallet IS NOT NULL) as has_bankr_wallet,
            a.is_atelier_official
          FROM services s
          LEFT JOIN atelier_agents a ON s.agent_id = a.id
          WHERE s.agent_id = ? AND s.active = 1
          ORDER BY s.created_at DESC`,
    args: [agentId],
  });
  return result.rows as unknown as Service[];
}

export async function updateService(
  id: string,
  agentId: string,
  updates: Partial<Pick<Service, 'title' | 'description' | 'price_usd' | 'price_type' | 'category' | 'turnaround_hours' | 'deliverables' | 'portfolio_post_ids' | 'demo_url' | 'active'>>
): Promise<Service | null> {
  await initAtelierDb();
  const setClauses: string[] = [];
  const args: (string | number | null)[] = [];

  const fields: (keyof typeof updates)[] = ['title', 'description', 'price_usd', 'price_type', 'category', 'turnaround_hours', 'deliverables', 'portfolio_post_ids', 'demo_url', 'active'];
  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(updates[field] as string | number | null);
    }
  }

  if (setClauses.length === 0) return getServiceById(id);
  args.push(id, agentId);

  await atelierClient.execute({
    sql: `UPDATE services SET ${setClauses.join(', ')} WHERE id = ? AND agent_id = ?`,
    args,
  });
  return getServiceById(id);
}

export async function deactivateService(id: string, agentId: string): Promise<boolean> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'UPDATE services SET active = 0 WHERE id = ? AND agent_id = ?',
    args: [id, agentId],
  });
  return result.rowsAffected > 0;
}

export async function getAgentIdsWithActiveServices(): Promise<Set<string>> {
  await initAtelierDb();
  const result = await atelierClient.execute('SELECT DISTINCT agent_id FROM services WHERE active = 1');
  return new Set((result.rows as unknown as { agent_id: string }[]).map(r => r.agent_id));
}

// ─── Order Queries ───

export async function createServiceOrder(data: {
  service_id: string;
  client_agent_id?: string;
  client_wallet?: string;
  provider_agent_id: string;
  brief: string;
  reference_urls?: string[];
  quoted_price_usd?: string;
  quota_total?: number;
}): Promise<ServiceOrder> {
  await initAtelierDb();
  const id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const status = data.quoted_price_usd ? 'quoted' : 'pending_quote';
  const platformFee = data.quoted_price_usd ? (parseFloat(data.quoted_price_usd) * 0.10).toFixed(2) : null;

  await atelierClient.execute({
    sql: `INSERT INTO service_orders (id, service_id, client_agent_id, client_wallet, provider_agent_id, brief, reference_urls, quoted_price_usd, platform_fee_usd, status, quota_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.service_id, data.client_agent_id || null, data.client_wallet || null, data.provider_agent_id, data.brief, data.reference_urls ? JSON.stringify(data.reference_urls) : null, data.quoted_price_usd || null, platformFee, status, data.quota_total || 0],
  });

  await atelierClient.execute({
    sql: 'UPDATE services SET total_orders = total_orders + 1 WHERE id = ?',
    args: [data.service_id],
  });

  return getServiceOrderById(id) as Promise<ServiceOrder>;
}

export async function getServiceOrderById(id: string): Promise<ServiceOrder | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name,
            pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN atelier_agents ca ON o.client_agent_id = ca.id
          LEFT JOIN atelier_agents pa ON o.provider_agent_id = pa.id
          WHERE o.id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as ServiceOrder) || null;
}

export async function getOrdersByAgent(agentId: string, role: 'client' | 'provider' | 'both' = 'both'): Promise<ServiceOrder[]> {
  await initAtelierDb();
  let condition: string;
  if (role === 'client') condition = 'o.client_agent_id = ?';
  else if (role === 'provider') condition = 'o.provider_agent_id = ?';
  else condition = '(o.client_agent_id = ? OR o.provider_agent_id = ?)';

  const args = role === 'both' ? [agentId, agentId] : [agentId];

  const result = await atelierClient.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name,
            pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN atelier_agents ca ON o.client_agent_id = ca.id
          LEFT JOIN atelier_agents pa ON o.provider_agent_id = pa.id
          WHERE ${condition}
          ORDER BY o.created_at DESC`,
    args,
  });
  return result.rows as unknown as ServiceOrder[];
}

export async function getRecentOrdersForAgent(agentId: string, limit = 10): Promise<RecentAgentOrder[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT o.id, s.title as service_title, o.client_wallet,
            p.display_name as client_display_name,
            o.quoted_price_usd, o.status, o.created_at
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN atelier_profiles p ON o.client_wallet = p.wallet
          WHERE o.provider_agent_id = ?
          ORDER BY o.created_at DESC
          LIMIT ?`,
    args: [agentId, limit],
  });
  return result.rows as unknown as RecentAgentOrder[];
}

export async function updateOrderStatus(
  id: string,
  updates: {
    status: OrderStatus;
    quoted_price_usd?: string;
    platform_fee_usd?: string;
    payment_method?: string;
    escrow_tx_hash?: string;
    payout_tx_hash?: string;
    deliverable_post_id?: number;
    deliverable_url?: string;
    deliverable_media_type?: string;
    workspace_expires_at?: string;
  }
): Promise<ServiceOrder | null> {
  await initAtelierDb();
  const setClauses: string[] = ['status = ?'];
  const args: (string | number | null)[] = [updates.status];

  if (updates.quoted_price_usd !== undefined) { setClauses.push('quoted_price_usd = ?'); args.push(updates.quoted_price_usd); }
  if (updates.platform_fee_usd !== undefined) { setClauses.push('platform_fee_usd = ?'); args.push(updates.platform_fee_usd); }
  if (updates.payment_method !== undefined) { setClauses.push('payment_method = ?'); args.push(updates.payment_method); }
  if (updates.escrow_tx_hash !== undefined) { setClauses.push('escrow_tx_hash = ?'); args.push(updates.escrow_tx_hash); }
  if (updates.payout_tx_hash !== undefined) { setClauses.push('payout_tx_hash = ?'); args.push(updates.payout_tx_hash); }
  if (updates.deliverable_post_id !== undefined) { setClauses.push('deliverable_post_id = ?'); args.push(updates.deliverable_post_id); }
  if (updates.deliverable_url !== undefined) { setClauses.push('deliverable_url = ?'); args.push(updates.deliverable_url); }
  if (updates.deliverable_media_type !== undefined) { setClauses.push('deliverable_media_type = ?'); args.push(updates.deliverable_media_type); }
  if (updates.workspace_expires_at !== undefined) { setClauses.push('workspace_expires_at = ?'); args.push(updates.workspace_expires_at); }

  if (updates.status === 'delivered') {
    setClauses.push("delivered_at = CURRENT_TIMESTAMP");
    setClauses.push("review_deadline = datetime('now', '+48 hours')");
  }
  if (updates.status === 'completed') {
    setClauses.push("completed_at = CURRENT_TIMESTAMP");
  }
  if (updates.quoted_price_usd && !updates.platform_fee_usd) {
    setClauses.push('platform_fee_usd = ?');
    args.push((parseFloat(updates.quoted_price_usd) * 0.10).toFixed(2));
  }

  args.push(id);
  await atelierClient.execute({
    sql: `UPDATE service_orders SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });

  if (updates.status === 'completed') {
    const order = await getServiceOrderById(id);
    if (order) {
      await atelierClient.execute({
        sql: 'UPDATE services SET completed_orders = completed_orders + 1 WHERE id = ?',
        args: [order.service_id],
      });
    }
  }

  return getServiceOrderById(id);
}

export async function getOrdersByWallet(wallet: string): Promise<ServiceOrder[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name,
            pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN atelier_agents ca ON o.client_agent_id = ca.id
          LEFT JOIN atelier_agents pa ON o.provider_agent_id = pa.id
          WHERE o.client_wallet = ?
          ORDER BY o.created_at DESC`,
    args: [wallet],
  });
  return result.rows as unknown as ServiceOrder[];
}

// ─── Deliverables ───

export async function createOrderDeliverable(orderId: string, prompt: string): Promise<OrderDeliverable> {
  await initAtelierDb();
  const id = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await atelierClient.execute({
    sql: `INSERT INTO order_deliverables (id, order_id, prompt, status) VALUES (?, ?, ?, 'pending')`,
    args: [id, orderId, prompt],
  });
  const result = await atelierClient.execute({ sql: 'SELECT * FROM order_deliverables WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as OrderDeliverable;
}

export async function getOrderDeliverables(orderId: string): Promise<OrderDeliverable[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM order_deliverables WHERE order_id = ? ORDER BY created_at DESC',
    args: [orderId],
  });
  return result.rows as unknown as OrderDeliverable[];
}

export async function updateOrderDeliverable(
  id: string,
  updates: { status?: string; deliverable_url?: string; deliverable_media_type?: string; error?: string }
): Promise<void> {
  await initAtelierDb();
  const setClauses: string[] = [];
  const args: (string | null)[] = [];
  if (updates.status !== undefined) { setClauses.push('status = ?'); args.push(updates.status); }
  if (updates.deliverable_url !== undefined) { setClauses.push('deliverable_url = ?'); args.push(updates.deliverable_url); }
  if (updates.deliverable_media_type !== undefined) { setClauses.push('deliverable_media_type = ?'); args.push(updates.deliverable_media_type); }
  if (updates.error !== undefined) { setClauses.push('error = ?'); args.push(updates.error); }
  if (setClauses.length === 0) return;
  args.push(id);
  await atelierClient.execute({ sql: `UPDATE order_deliverables SET ${setClauses.join(', ')} WHERE id = ?`, args });
}

export async function incrementOrderQuotaUsed(orderId: string): Promise<number> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `UPDATE service_orders SET quota_used = quota_used + 1 WHERE id = ? AND quota_used < quota_total`,
    args: [orderId],
  });
  return result.rowsAffected;
}

// ─── Reviews ───

export async function createServiceReview(data: {
  order_id: string;
  service_id: string;
  reviewer_agent_id: string;
  reviewer_name: string;
  rating: number;
  comment?: string;
}): Promise<ServiceReview> {
  await initAtelierDb();
  const id = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await atelierClient.execute({
    sql: `INSERT INTO service_reviews (id, order_id, service_id, reviewer_agent_id, reviewer_name, rating, comment)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.order_id, data.service_id, data.reviewer_agent_id, data.reviewer_name, data.rating, data.comment || null],
  });
  await recalculateServiceRating(data.service_id);
  const result = await atelierClient.execute({ sql: 'SELECT * FROM service_reviews WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as ServiceReview;
}

export async function getReviewByOrderId(orderId: string): Promise<ServiceReview | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM service_reviews WHERE order_id = ?',
    args: [orderId],
  });
  return (result.rows[0] as unknown as ServiceReview) || null;
}

export async function getServiceReviews(serviceId: string): Promise<ServiceReview[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM service_reviews WHERE service_id = ? ORDER BY created_at DESC',
    args: [serviceId],
  });
  return result.rows as unknown as ServiceReview[];
}

async function recalculateServiceRating(serviceId: string): Promise<void> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT AVG(rating) as avg_rating FROM service_reviews WHERE service_id = ?',
    args: [serviceId],
  });
  const avgRating = result.rows[0] ? Number((result.rows[0] as unknown as { avg_rating: number }).avg_rating) : null;
  await atelierClient.execute({
    sql: 'UPDATE services SET avg_rating = ? WHERE id = ?',
    args: [avgRating, serviceId],
  });
}

// ─── Atelier Profiles ───

export async function getAtelierProfile(wallet: string): Promise<AtelierProfile | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM atelier_profiles WHERE wallet = ?',
    args: [wallet],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierProfile) : null;
}

export async function upsertAtelierProfile(
  wallet: string,
  data: { display_name?: string; bio?: string; avatar_url?: string; twitter_handle?: string }
): Promise<AtelierProfile> {
  await initAtelierDb();
  await atelierClient.execute({
    sql: `INSERT INTO atelier_profiles (wallet, display_name, bio, avatar_url, twitter_handle)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(wallet) DO UPDATE SET
            display_name = COALESCE(?, display_name),
            bio = COALESCE(?, bio),
            avatar_url = COALESCE(?, avatar_url),
            twitter_handle = COALESCE(?, twitter_handle),
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      wallet,
      data.display_name || null, data.bio || null, data.avatar_url || null, data.twitter_handle || null,
      data.display_name ?? null, data.bio ?? null, data.avatar_url ?? null, data.twitter_handle ?? null,
    ],
  });
  const profile = await getAtelierProfile(wallet);
  return profile!;
}

// ─── Creator Fee Tracking ───

export async function recordFeeSweep(amountLamports: number, txHash: string): Promise<string> {
  await initAtelierDb();
  const id = `sweep_${randomBytes(12).toString('hex')}`;
  await atelierClient.execute({
    sql: 'INSERT INTO creator_fee_sweeps (id, amount_lamports, tx_hash) VALUES (?, ?, ?)',
    args: [id, amountLamports, txHash],
  });
  return id;
}

export async function getFeeSweeps(limit = 50): Promise<{ id: string; amount_lamports: number; tx_hash: string; swept_at: string }[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM creator_fee_sweeps ORDER BY swept_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as { id: string; amount_lamports: number; tx_hash: string; swept_at: string }[];
}

export async function createFeePayout(
  recipientWallet: string,
  agentId: string,
  tokenMint: string,
  amountLamports: number,
): Promise<string> {
  await initAtelierDb();
  const id = `payout_${randomBytes(12).toString('hex')}`;
  await atelierClient.execute({
    sql: 'INSERT INTO creator_fee_payouts (id, recipient_wallet, agent_id, token_mint, amount_lamports) VALUES (?, ?, ?, ?, ?)',
    args: [id, recipientWallet, agentId, tokenMint, amountLamports],
  });
  return id;
}

export async function completeFeePayout(id: string, txHash: string): Promise<void> {
  await initAtelierDb();
  await atelierClient.execute({
    sql: "UPDATE creator_fee_payouts SET status = 'paid', tx_hash = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [txHash, id],
  });
}

export async function getPayoutsForWallet(wallet: string): Promise<{
  id: string; recipient_wallet: string; agent_id: string; token_mint: string;
  amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
}[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM creator_fee_payouts WHERE recipient_wallet = ? ORDER BY created_at DESC',
    args: [wallet],
  });
  return result.rows as unknown as {
    id: string; recipient_wallet: string; agent_id: string; token_mint: string;
    amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
  }[];
}

export async function getTotalSwept(): Promise<number> {
  await initAtelierDb();
  const result = await atelierClient.execute('SELECT COALESCE(SUM(amount_lamports), 0) as total FROM creator_fee_sweeps');
  return Number(result.rows[0]?.total ?? 0);
}

export async function getTotalPaidOut(): Promise<number> {
  await initAtelierDb();
  const result = await atelierClient.execute(
    "SELECT COALESCE(SUM(amount_lamports), 0) as total FROM creator_fee_payouts WHERE status = 'paid'",
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getAllPayouts(limit = 100): Promise<{
  id: string; recipient_wallet: string; agent_id: string; token_mint: string;
  amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
}[]> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: 'SELECT * FROM creator_fee_payouts ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as {
    id: string; recipient_wallet: string; agent_id: string; token_mint: string;
    amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
  }[];
}

// ─── Token Queries ───

export async function updateAgentToken(
  agentId: string,
  tokenData: {
    token_mint: string;
    token_name: string;
    token_symbol: string;
    token_image_url?: string;
    token_mode: 'pumpfun' | 'byot';
    token_creator_wallet: string;
    token_tx_hash?: string;
  }
): Promise<boolean> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `UPDATE atelier_agents SET
      token_mint = ?, token_name = ?, token_symbol = ?, token_image_url = ?,
      token_mode = ?, token_creator_wallet = ?, token_tx_hash = ?, token_created_at = CURRENT_TIMESTAMP
      WHERE id = ? AND token_mint IS NULL`,
    args: [
      tokenData.token_mint, tokenData.token_name, tokenData.token_symbol,
      tokenData.token_image_url || null, tokenData.token_mode,
      tokenData.token_creator_wallet, tokenData.token_tx_hash || null, agentId,
    ],
  });
  return result.rowsAffected > 0;
}

export async function getAgentTokenInfo(agentId: string): Promise<AgentTokenInfo | null> {
  await initAtelierDb();
  const result = await atelierClient.execute({
    sql: `SELECT token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash, token_created_at
          FROM atelier_agents WHERE id = ?`,
    args: [agentId],
  });
  if (!result.rows[0]) return null;
  return result.rows[0] as unknown as AgentTokenInfo;
}
