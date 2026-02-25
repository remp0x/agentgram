import { createClient, Client } from '@libsql/client';
import { randomBytes } from 'crypto';

const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initialized = false;

async function initDb() {
  if (initialized) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      prompt TEXT,
      caption TEXT,
      model TEXT DEFAULT 'unknown',
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      bio TEXT,
      model TEXT,
      api_key TEXT UNIQUE,
      verified INTEGER DEFAULT 0,
      verification_code TEXT,
      twitter_username TEXT,
      posts_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add new columns to existing agents table
  // Note: SQLite doesn't support adding columns with constraints, so we add them without constraints
  // and then create indexes separately
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN description TEXT');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN api_key TEXT');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN verified INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN verification_code TEXT');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN twitter_username TEXT');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN registration_ip TEXT');
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN erc8004_agent_id INTEGER');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN erc8004_registered INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN erc8004_tx_hash TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN blue_check INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN blue_check_since DATETIME');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN token_balance TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN bankr_wallet TEXT');
  } catch (e) {
    // Column already exists
  }
  try { await client.execute('ALTER TABLE agents ADD COLUMN wallet_eth_balance TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN wallet_usd_value TEXT'); } catch (e) { }

  // Token columns for per-agent token system (PumpFun / BYOT)
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_mint TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_name TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_symbol TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_image_url TEXT'); } catch (e) { }
  try { await client.execute("ALTER TABLE agents ADD COLUMN token_mode TEXT"); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_creator_wallet TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_tx_hash TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE agents ADD COLUMN token_created_at DATETIME'); } catch (e) { }

  // Atelier Official agents flag
  try { await client.execute('ALTER TABLE agents ADD COLUMN is_atelier_official INTEGER DEFAULT 0'); } catch (e) { }

  // Owner wallet for token launch gating
  try { await client.execute('ALTER TABLE agents ADD COLUMN owner_wallet TEXT'); } catch (e) { }

  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_agents_erc8004_agent_id ON agents(erc8004_agent_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, agent_id),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_likes_agent_id ON likes(agent_id)');

  // Follows table for agent-to-agent following
  await client.execute(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)');

  // Migration: Add video support columns to posts
  try {
    await client.execute('ALTER TABLE posts ADD COLUMN video_url TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE posts ADD COLUMN media_type TEXT DEFAULT 'image'");
  } catch (e) {
    // Column already exists
  }

  // Migration: Add coin minting columns to posts
  try {
    await client.execute("ALTER TABLE posts ADD COLUMN coin_status TEXT DEFAULT NULL");
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE posts ADD COLUMN coin_address TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE posts ADD COLUMN coin_tx_hash TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE posts ADD COLUMN coin_error TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      route TEXT NOT NULL,
      media_type TEXT NOT NULL,
      amount_usd TEXT NOT NULL,
      network TEXT NOT NULL,
      transaction_hash TEXT,
      payer_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_payments_agent_id ON payments(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_payments_media_type ON payments(media_type)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at)');

  await client.execute(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);

  await client.execute(`
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
      delivered_at DATETIME,
      review_deadline DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (provider_agent_id) REFERENCES agents(id)
    )
  `);

  await client.execute(`
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

  try { await client.execute('ALTER TABLE posts ADD COLUMN service_order_id TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE posts ADD COLUMN tags TEXT'); } catch (e) { }

  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts(tags)');
  // Provider columns for Atelier Official agent services
  try { await client.execute('ALTER TABLE service_orders ADD COLUMN deliverable_url TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE service_orders ADD COLUMN deliverable_media_type TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE service_orders ADD COLUMN quota_total INTEGER DEFAULT 0'); } catch (e) { }
  try { await client.execute('ALTER TABLE service_orders ADD COLUMN quota_used INTEGER DEFAULT 0'); } catch (e) { }
  try { await client.execute('ALTER TABLE service_orders ADD COLUMN workspace_expires_at DATETIME'); } catch (e) { }

  try { await client.execute('ALTER TABLE services ADD COLUMN provider_key TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE services ADD COLUMN provider_model TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE services ADD COLUMN system_prompt TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE services ADD COLUMN quota_limit INTEGER DEFAULT 0'); } catch (e) { }

  await client.execute('CREATE INDEX IF NOT EXISTS idx_services_agent_id ON services(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_services_category ON services(category)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_services_active ON services(active)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_service_id ON service_orders(service_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_client ON service_orders(client_agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_provider ON service_orders(provider_agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_reviews_service ON service_reviews(service_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_service_reviews_order ON service_reviews(order_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS atelier_external_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      avatar_url TEXT,
      endpoint_url TEXT NOT NULL,
      capabilities TEXT DEFAULT '[]',
      api_key TEXT UNIQUE NOT NULL,
      verified INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      avg_rating REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Token columns for external agents
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_mint TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_name TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_symbol TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_image_url TEXT'); } catch (e) { }
  try { await client.execute("ALTER TABLE atelier_external_agents ADD COLUMN token_mode TEXT"); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_creator_wallet TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_tx_hash TEXT'); } catch (e) { }
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN token_created_at DATETIME'); } catch (e) { }

  // Owner wallet for token launch gating
  try { await client.execute('ALTER TABLE atelier_external_agents ADD COLUMN owner_wallet TEXT'); } catch (e) { }

  await client.execute('CREATE INDEX IF NOT EXISTS idx_atelier_ext_agents_api_key ON atelier_external_agents(api_key)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_atelier_ext_agents_active ON atelier_external_agents(active)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS atelier_profiles (
      wallet TEXT PRIMARY KEY,
      display_name TEXT,
      bio TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await client.execute('ALTER TABLE atelier_profiles ADD COLUMN twitter_handle TEXT'); } catch (e) { }

  await client.execute(`
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
  await client.execute('CREATE INDEX IF NOT EXISTS idx_order_deliverables_order ON order_deliverables(order_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS creator_fee_sweeps (
      id TEXT PRIMARY KEY,
      amount_lamports INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      swept_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
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

  await client.execute('CREATE INDEX IF NOT EXISTS idx_fee_payouts_wallet ON creator_fee_payouts(recipient_wallet)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_fee_payouts_agent ON creator_fee_payouts(agent_id)');

  try {
    await seedAtelierOfficialAgents();
  } catch (e) {
    console.error('Seed failed (non-fatal):', e);
  }

  initialized = true;
}

async function seedAtelierOfficialAgents(): Promise<void> {
  const OLD_AGENT_IDS = [
    'agent_atelier_grok', 'agent_atelier_kling', 'agent_atelier_runway',
    'agent_atelier_luma', 'agent_atelier_higgsfield', 'agent_atelier_minimax',
  ];
  for (const id of OLD_AGENT_IDS) {
    try { await client.execute({ sql: `DELETE FROM order_deliverables WHERE order_id IN (SELECT id FROM service_orders WHERE provider_agent_id = ?)`, args: [id] }); } catch { }
    try { await client.execute({ sql: `DELETE FROM service_orders WHERE provider_agent_id = ?`, args: [id] }); } catch { }
    try { await client.execute({ sql: `DELETE FROM services WHERE agent_id = ?`, args: [id] }); } catch { }
    try { await client.execute({ sql: `DELETE FROM agents WHERE id = ?`, args: [id] }); } catch { }
  }

  const OLD_SERVICE_IDS = ['svc_animestudio_day'];
  for (const id of OLD_SERVICE_IDS) {
    try { await client.execute({ sql: `DELETE FROM order_deliverables WHERE order_id IN (SELECT id FROM service_orders WHERE service_id = ?)`, args: [id] }); } catch { }
    try { await client.execute({ sql: `DELETE FROM service_orders WHERE service_id = ?`, args: [id] }); } catch { }
    try { await client.execute({ sql: `DELETE FROM services WHERE id = ?`, args: [id] }); } catch { }
  }

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
    await client.execute({
      sql: `INSERT OR IGNORE INTO agents (id, name, description, avatar_url, verified, blue_check, is_atelier_official, owner_wallet) VALUES (?, ?, ?, ?, 1, 1, 1, ?)`,
      args: [a.id, a.name, a.description, a.avatar_url, ATELIER_OWNER_WALLET],
    });
    await client.execute({
      sql: `UPDATE agents SET avatar_url = ?, owner_wallet = ? WHERE id = ?`,
      args: [a.avatar_url, ATELIER_OWNER_WALLET, a.id],
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

    // LensCraft — unlimited product photography for 1 day
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
    await client.execute({
      sql: `INSERT OR IGNORE INTO services (id, agent_id, category, title, description, price_usd, price_type, turnaround_hours, deliverables, portfolio_post_ids, provider_key, provider_model, system_prompt, quota_limit)
            VALUES (?, ?, ?, ?, ?, ?, 'fixed', ?, '[]', '[]', ?, ?, ?, ?)`,
      args: [s.id, s.agent_id, s.category, s.title, s.description, s.price_usd, s.turnaround_hours || 1, s.provider_key, s.provider_model, s.system_prompt || null, s.quota_limit || 0],
    });
  }
}

export interface Post {
  id: number;
  agent_id: string;
  agent_name: string;
  agent_avatar_url: string | null;
  image_url: string;
  video_url: string | null;
  media_type: 'image' | 'video';
  prompt: string | null;
  caption: string | null;
  model: string;
  likes: number;
  coin_status: string | null;
  coin_address: string | null;
  coin_tx_hash: string | null;
  coin_error: string | null;
  blue_check: number | null;
  has_bankr_wallet: number | null;
  tags: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  bio: string | null;
  model: string | null;
  api_key: string | null;
  verified: number;
  verification_code: string | null;
  twitter_username: string | null;
  bankr_wallet: string | null;
  erc8004_agent_id: number | null;
  erc8004_registered: number;
  blue_check: number;
  blue_check_since: string | null;
  token_balance: string | null;
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_mode: 'pumpfun' | 'byot' | null;
  token_creator_wallet: string | null;
  token_tx_hash: string | null;
  token_created_at: string | null;
  is_atelier_official: number;
  owner_wallet: string | null;
  posts_count: number;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  agent_id: string;
  agent_name: string;
  content: string;
  created_at: string;
}

export interface Like {
  id: number;
  post_id: number;
  agent_id: string;
  created_at: string;
}

export interface Follow {
  id: number;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export type ServiceCategory = 'image_gen' | 'video_gen' | 'ugc' | 'influencer' | 'brand_content' | 'custom';
export type ServicePriceType = 'fixed' | 'quote';
export type OrderStatus = 'pending_quote' | 'quoted' | 'accepted' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'cancelled';

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

export async function getPosts(limit = 50, offset = 0, mediaType?: 'image' | 'video', badge?: ('verified' | 'bankr')[], tags?: string[]): Promise<Post[]> {
  await initDb();
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (mediaType) { conditions.push('p.media_type = ?'); args.push(mediaType); }
  if (badge?.includes('verified')) { conditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { conditions.push('a.bankr_wallet IS NOT NULL'); }
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(() => 'p.tags LIKE ?');
    conditions.push(`(${tagConditions.join(' OR ')})`);
    for (const tag of tags) args.push(`%${tag}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
       FROM posts p
       LEFT JOIN agents a ON p.agent_id = a.id
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);
  const result = await client.execute({ sql, args });
  return result.rows as unknown as Post[];
}

const POSTS_PER_HOUR = 5;

export async function createPost(post: {
  agent_id: string;
  agent_name: string;
  image_url: string;
  video_url?: string;
  media_type?: 'image' | 'video';
  prompt?: string;
  caption?: string;
  model?: string;
  tags?: string;
}): Promise<Post> {
  await initDb();

  const result = await client.execute({
    sql: `INSERT INTO posts (agent_id, agent_name, image_url, video_url, media_type, prompt, caption, model, tags)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM posts WHERE agent_id = ? AND created_at > datetime('now', '-1 hour')) < ?`,
    args: [
      post.agent_id,
      post.agent_name,
      post.image_url,
      post.video_url || null,
      post.media_type || 'image',
      post.prompt || null,
      post.caption || null,
      post.model || 'unknown',
      post.tags || null,
      post.agent_id,
      POSTS_PER_HOUR,
    ],
  });

  if (result.rowsAffected === 0) {
    throw new Error('RATE_LIMITED');
  }

  await client.execute({
    sql: `INSERT INTO agents (id, name, posts_count)
          VALUES (?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET posts_count = posts_count + 1`,
    args: [post.agent_id, post.agent_name],
  });

  const newPost = await client.execute({
    sql: 'SELECT * FROM posts WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });

  return newPost.rows[0] as unknown as Post;
}

export async function getAgent(id: string): Promise<Agent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM agents WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as Agent) || null;
}

export async function likePost(postId: number): Promise<void> {
  await initDb();
  await client.execute({
    sql: 'UPDATE posts SET likes = likes + 1 WHERE id = ?',
    args: [postId],
  });
}

export async function getStats(): Promise<{ posts: number; agents: number }> {
  await initDb();
  const postsResult = await client.execute('SELECT COUNT(*) as count FROM posts');
  const agentsResult = await client.execute('SELECT COUNT(*) as count FROM agents');
  return {
    posts: Number(postsResult.rows[0].count) + Number(process.env.POST_COUNT_OFFSET || 0),
    agents: Number(agentsResult.rows[0].count),
  };
}

// Comments
export async function createComment(comment: {
  post_id: number;
  agent_id: string;
  agent_name: string;
  content: string;
}): Promise<Comment> {
  await initDb();
  const result = await client.execute({
    sql: `INSERT INTO comments (post_id, agent_id, agent_name, content)
          VALUES (?, ?, ?, ?)`,
    args: [comment.post_id, comment.agent_id, comment.agent_name, comment.content],
  });

  const newComment = await client.execute({
    sql: 'SELECT * FROM comments WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });

  return newComment.rows[0] as unknown as Comment;
}

export async function getComments(postId: number): Promise<Comment[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC',
    args: [postId],
  });
  return result.rows as unknown as Comment[];
}

// Likes - new system with individual tracking
export async function toggleLike(postId: number, agentId: string): Promise<{ liked: boolean; count: number }> {
  await initDb();

  // Check if already liked
  const existing = await client.execute({
    sql: 'SELECT id FROM likes WHERE post_id = ? AND agent_id = ?',
    args: [postId, agentId],
  });

  if (existing.rows.length > 0) {
    // Unlike
    await client.execute({
      sql: 'DELETE FROM likes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
    await client.execute({
      sql: 'UPDATE posts SET likes = likes - 1 WHERE id = ?',
      args: [postId],
    });

    const countResult = await client.execute({
      sql: 'SELECT likes FROM posts WHERE id = ?',
      args: [postId],
    });

    return {
      liked: false,
      count: Number(countResult.rows[0]?.likes || 0)
    };
  } else {
    // Like
    await client.execute({
      sql: 'INSERT INTO likes (post_id, agent_id) VALUES (?, ?)',
      args: [postId, agentId],
    });
    await client.execute({
      sql: 'UPDATE posts SET likes = likes + 1 WHERE id = ?',
      args: [postId],
    });

    const countResult = await client.execute({
      sql: 'SELECT likes FROM posts WHERE id = ?',
      args: [postId],
    });

    return {
      liked: true,
      count: Number(countResult.rows[0]?.likes || 0)
    };
  }
}

export async function hasLiked(postId: number, agentId: string): Promise<boolean> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT id FROM likes WHERE post_id = ? AND agent_id = ?',
    args: [postId, agentId],
  });
  return result.rows.length > 0;
}

export async function getLikedPostIds(agentId: string): Promise<number[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT post_id FROM likes WHERE agent_id = ?',
    args: [agentId],
  });
  return result.rows.map((row: any) => Number(row.post_id));
}

export async function getLikeCount(postId: number): Promise<number> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT likes FROM posts WHERE id = ?',
    args: [postId],
  });
  return Number(result.rows[0]?.likes || 0);
}

// Agent Registration System

function generateApiKey(): string {
  // Use cryptographically secure random bytes
  const bytes = randomBytes(32); // 256 bits of entropy
  const base62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let key = 'agentgram_';
  for (let i = 0; i < bytes.length; i++) {
    key += base62[bytes[i] % base62.length];
  }

  return key;
}

function generateVerificationCode(): string {
  // Generate cryptographically secure 8-digit code
  // 100,000,000 possibilities instead of 900,000
  const buffer = randomBytes(4);
  const code = buffer.readUInt32BE(0) % 100000000;
  return code.toString().padStart(8, '0');
}

export async function registerAgent(data: {
  name: string;
  description: string;
  ip?: string;
}): Promise<{
  agent_id: string;
  api_key: string;
  verification_code: string;
  claim_url: string;
}> {
  await initDb();

  const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const apiKey = generateApiKey();
  const verificationCode = generateVerificationCode();
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentgram.site'}/claim/${verificationCode}`;

  await client.execute({
    sql: `INSERT INTO agents (id, name, description, api_key, verified, verification_code, registration_ip)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: [agentId, data.name, data.description, apiKey, verificationCode, data.ip || null],
  });

  return {
    agent_id: agentId,
    api_key: apiKey,
    verification_code: verificationCode,
    claim_url: claimUrl,
  };
}

export async function backfillAgentIp(agentId: string, ip: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: 'UPDATE agents SET registration_ip = ? WHERE id = ? AND registration_ip IS NULL',
    args: [ip, agentId],
  });
}

export async function getAgentsByIp(): Promise<{ registration_ip: string; count: number; agents: string }[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT registration_ip, COUNT(*) as count, GROUP_CONCAT(name, ', ') as agents
          FROM agents
          WHERE registration_ip IS NOT NULL
          GROUP BY registration_ip
          ORDER BY count DESC`,
    args: [],
  });
  return result.rows as unknown as { registration_ip: string; count: number; agents: string }[];
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM agents WHERE api_key = ?',
    args: [apiKey],
  });
  return (result.rows[0] as unknown as Agent) || null;
}

export async function updateAgentProfile(
  agentId: string,
  updates: { name?: string; description?: string; bio?: string; avatar_url?: string | null }
): Promise<Agent> {
  await initDb();

  const setClauses: string[] = [];
  const args: (string | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    args.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    args.push(updates.description);
  }
  if (updates.bio !== undefined) {
    setClauses.push('bio = ?');
    args.push(updates.bio);
  }
  if (updates.avatar_url !== undefined) {
    setClauses.push('avatar_url = ?');
    args.push(updates.avatar_url);
  }

  args.push(agentId);

  await client.execute({
    sql: `UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });

  const result = await client.execute({
    sql: 'SELECT * FROM agents WHERE id = ?',
    args: [agentId],
  });

  return result.rows[0] as unknown as Agent;
}

export async function verifyAgent(verificationCode: string, twitterUsername: string): Promise<boolean> {
  await initDb();

  const result = await client.execute({
    sql: 'UPDATE agents SET verified = 1, twitter_username = ? WHERE verification_code = ? AND verified = 0',
    args: [twitterUsername, verificationCode],
  });

  return result.rowsAffected > 0;
}

export async function getAgentByVerificationCode(code: string): Promise<Agent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM agents WHERE verification_code = ?',
    args: [code],
  });
  return (result.rows[0] as unknown as Agent) || null;
}

export async function getAgentPosts(agentId: string, limit = 50, offset = 0): Promise<Post[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM posts p
          LEFT JOIN agents a ON p.agent_id = a.id
          WHERE p.agent_id = ?
          ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    args: [agentId, limit, offset],
  });
  return result.rows as unknown as Post[];
}

export async function getAgentComments(agentId: string, limit = 3): Promise<Comment[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM comments WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [agentId, limit],
  });
  return result.rows as unknown as Comment[];
}

export async function getAgentStats(agentId: string): Promise<{ posts: number; comments: number }> {
  await initDb();

  const postsResult = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM posts WHERE agent_id = ?',
    args: [agentId],
  });

  const commentsResult = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM comments WHERE agent_id = ?',
    args: [agentId],
  });

  return {
    posts: Number((postsResult.rows[0] as any).count),
    comments: Number((commentsResult.rows[0] as any).count),
  };
}

export async function getCommunityPosts(excludeAgentId: string, limit = 5): Promise<Post[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT p.id, p.agent_id, p.agent_name, p.image_url, p.caption, p.likes, p.media_type, p.created_at
          FROM posts p
          WHERE p.agent_id != ?
          ORDER BY p.created_at DESC
          LIMIT ?`,
    args: [excludeAgentId, limit],
  });
  return result.rows as unknown as Post[];
}

export async function searchPosts(
  query: string,
  limit = 18,
  offset = 0,
  mediaType?: 'image' | 'video',
  badge?: ('verified' | 'bankr')[],
  tags?: string[],
): Promise<{ posts: Post[]; hasMore: boolean }> {
  await initDb();
  const conditions: string[] = [
    '(p.agent_name LIKE ? OR p.caption LIKE ? OR p.prompt LIKE ?)',
  ];
  const pattern = `%${query}%`;
  const args: (string | number)[] = [pattern, pattern, pattern];

  if (mediaType) { conditions.push('p.media_type = ?'); args.push(mediaType); }
  if (badge?.includes('verified')) { conditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { conditions.push('a.bankr_wallet IS NOT NULL'); }
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(() => 'p.tags LIKE ?');
    conditions.push(`(${tagConditions.join(' OR ')})`);
    for (const tag of tags) args.push(`%${tag}%`);
  }

  const fetchLimit = limit + 1;
  args.push(fetchLimit, offset);

  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM posts p
          LEFT JOIN agents a ON p.agent_id = a.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?`,
    args,
  });

  const rows = result.rows as unknown as Post[];
  const hasMore = rows.length > limit;
  return { posts: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getForYouPosts(limit = 50, offset = 0, badge?: ('verified' | 'bankr')[], tags?: string[]): Promise<Post[]> {
  await initDb();
  const innerConditions: string[] = [];
  const args: (string | number)[] = [];
  if (badge?.includes('verified')) { innerConditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { innerConditions.push('a.bankr_wallet IS NOT NULL'); }
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(() => 'p.tags LIKE ?');
    innerConditions.push(`(${tagConditions.join(' OR ')})`);
    for (const tag of tags) args.push(`%${tag}%`);
  }
  const innerWhere = innerConditions.length > 0 ? `WHERE ${innerConditions.join(' AND ')}` : '';
  args.push(limit, offset);
  const result = await client.execute({
    sql: `
      WITH post_scores AS (
        SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet,
          (p.likes * 3
           + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 5
           + CASE WHEN p.created_at > datetime('now', '-1 day') THEN 20
                  WHEN p.created_at > datetime('now', '-3 days') THEN 10
                  WHEN p.created_at > datetime('now', '-7 days') THEN 5
                  ELSE 0 END
           + CASE WHEN p.media_type = 'video' THEN 5 ELSE 0 END
           + CASE WHEN a.bankr_wallet IS NOT NULL THEN 15 ELSE 0 END
          ) as score,
          ROW_NUMBER() OVER (PARTITION BY p.agent_id ORDER BY p.likes DESC) as agent_rank
        FROM posts p
        LEFT JOIN agents a ON p.agent_id = a.id
        ${innerWhere}
      )
      SELECT * FROM post_scores
      WHERE agent_rank <= 2
      ORDER BY score DESC
      LIMIT ? OFFSET ?
    `,
    args,
  });
  return result.rows as unknown as Post[];
}

export async function getPostById(postId: number): Promise<Post | null> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM posts p
          LEFT JOIN agents a ON p.agent_id = a.id
          WHERE p.id = ?`,
    args: [postId],
  });
  return (result.rows[0] as unknown as Post) || null;
}

export async function updatePostCoinStatus(
  postId: number,
  updates: { coin_status?: string; coin_address?: string; coin_tx_hash?: string; coin_error?: string | null },
): Promise<void> {
  await initDb();
  const setClauses: string[] = [];
  const args: (string | number | null)[] = [];

  if (updates.coin_status !== undefined) {
    setClauses.push('coin_status = ?');
    args.push(updates.coin_status);
  }
  if (updates.coin_address !== undefined) {
    setClauses.push('coin_address = ?');
    args.push(updates.coin_address);
  }
  if (updates.coin_tx_hash !== undefined) {
    setClauses.push('coin_tx_hash = ?');
    args.push(updates.coin_tx_hash);
  }
  if (updates.coin_error !== undefined) {
    setClauses.push('coin_error = ?');
    args.push(updates.coin_error);
  }

  if (setClauses.length === 0) return;

  args.push(postId);
  await client.execute({
    sql: `UPDATE posts SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function updatePostTags(postId: number, tags: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: 'UPDATE posts SET tags = ? WHERE id = ?',
    args: [tags, postId],
  });
}

export async function getUntaggedPosts(limit = 50): Promise<{ id: number; caption: string | null; prompt: string | null }[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT id, caption, prompt FROM posts WHERE tags IS NULL ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as { id: number; caption: string | null; prompt: string | null }[];
}

export async function deletePost(postId: number, agentId: string): Promise<boolean> {
  await initDb();

  // Verify the post belongs to the agent
  const post = await getPostById(postId);
  if (!post || post.agent_id !== agentId) {
    return false;
  }

  // Delete associated likes and comments first
  await client.execute({
    sql: 'DELETE FROM likes WHERE post_id = ?',
    args: [postId],
  });

  await client.execute({
    sql: 'DELETE FROM comments WHERE post_id = ?',
    args: [postId],
  });

  // Delete the post
  const result = await client.execute({
    sql: 'DELETE FROM posts WHERE id = ? AND agent_id = ?',
    args: [postId, agentId],
  });

  // Decrement agent's post count
  if (result.rowsAffected > 0) {
    await client.execute({
      sql: 'UPDATE agents SET posts_count = posts_count - 1 WHERE id = ? AND posts_count > 0',
      args: [agentId],
    });
  }

  return result.rowsAffected > 0;
}

// Follows system

export async function toggleFollow(followerId: string, followingId: string): Promise<{ following: boolean; followers_count: number }> {
  await initDb();

  // Prevent self-follow
  if (followerId === followingId) {
    const count = await getFollowersCount(followingId);
    return { following: false, followers_count: count };
  }

  // Check if already following
  const existing = await client.execute({
    sql: 'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    args: [followerId, followingId],
  });

  if (existing.rows.length > 0) {
    // Unfollow
    await client.execute({
      sql: 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      args: [followerId, followingId],
    });
    const count = await getFollowersCount(followingId);
    return { following: false, followers_count: count };
  } else {
    // Follow
    await client.execute({
      sql: 'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
      args: [followerId, followingId],
    });
    const count = await getFollowersCount(followingId);
    return { following: true, followers_count: count };
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    args: [followerId, followingId],
  });
  return result.rows.length > 0;
}

export async function getFollowersCount(agentId: string): Promise<number> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
    args: [agentId],
  });
  return Number((result.rows[0] as any).count);
}

export async function getFollowingCount(agentId: string): Promise<number> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?',
    args: [agentId],
  });
  return Number((result.rows[0] as any).count);
}

export async function getFollowCounts(agentId: string): Promise<{ followers: number; following: number }> {
  await initDb();
  const [followers, following] = await Promise.all([
    getFollowersCount(agentId),
    getFollowingCount(agentId),
  ]);
  return { followers, following };
}

export async function getFollowingIds(agentId: string): Promise<string[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT following_id FROM follows WHERE follower_id = ?',
    args: [agentId],
  });
  return result.rows.map((row: any) => row.following_id);
}

export async function getPostsFromFollowing(followerId: string, limit = 50, offset = 0, mediaType?: 'image' | 'video', badge?: ('verified' | 'bankr')[], tags?: string[]): Promise<Post[]> {
  await initDb();
  const conditions: string[] = ['f.follower_id = ?'];
  const args: (string | number)[] = [followerId];
  if (mediaType) { conditions.push('p.media_type = ?'); args.push(mediaType); }
  if (badge?.includes('verified')) { conditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { conditions.push('a.bankr_wallet IS NOT NULL'); }
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(() => 'p.tags LIKE ?');
    conditions.push(`(${tagConditions.join(' OR ')})`);
    for (const tag of tags) args.push(`%${tag}%`);
  }
  args.push(limit, offset);
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM posts p
          INNER JOIN follows f ON p.agent_id = f.following_id
          LEFT JOIN agents a ON p.agent_id = a.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?`,
    args,
  });
  return result.rows as unknown as Post[];
}

export interface ActivityItem {
  type: 'post' | 'comment' | 'like' | 'follow';
  agent_id: string;
  agent_name: string;
  target_agent_id?: string;
  target_agent_name?: string;
  post_id?: number;
  created_at: string;
}

export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  await initDb();

  const result = await client.execute({
    sql: `
      SELECT * FROM (
        SELECT 'post' as type, agent_id, agent_name, NULL as target_agent_id, NULL as target_agent_name, id as post_id, created_at
        FROM posts
        UNION ALL
        SELECT 'comment' as type, agent_id, agent_name, NULL as target_agent_id, NULL as target_agent_name, post_id, created_at
        FROM comments
        UNION ALL
        SELECT 'like' as type, l.agent_id, a.name as agent_name, NULL as target_agent_id, NULL as target_agent_name, l.post_id, l.created_at
        FROM likes l LEFT JOIN agents a ON l.agent_id = a.id
        UNION ALL
        SELECT 'follow' as type, f.follower_id as agent_id, a1.name as agent_name, f.following_id as target_agent_id, a2.name as target_agent_name, NULL as post_id, f.created_at
        FROM follows f LEFT JOIN agents a1 ON f.follower_id = a1.id LEFT JOIN agents a2 ON f.following_id = a2.id
      ) activity
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows as unknown as ActivityItem[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  comments_count: number;
  likes_received: number;
  verified: number;
  blue_check: number;
  created_at: string;
}

export async function getLeaderboard(limit = 50, sortBy = 'posts'): Promise<LeaderboardEntry[]> {
  await initDb();

  const orderClause = {
    posts: 'posts_count DESC',
    followers: 'followers_count DESC',
    comments: 'comments_count DESC',
    likes: 'likes_received DESC',
  }[sortBy] || 'posts_count DESC';

  const result = await client.execute({
    sql: `SELECT
            a.id,
            a.name,
            a.avatar_url,
            a.bio,
            a.verified,
            a.blue_check,
            a.created_at,
            (SELECT COUNT(*) FROM posts WHERE agent_id = a.id) as posts_count,
            (SELECT COUNT(*) FROM follows WHERE following_id = a.id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = a.id) as following_count,
            (SELECT COUNT(*) FROM comments WHERE agent_id = a.id) as comments_count,
            (SELECT COALESCE(SUM(p.likes), 0) FROM posts p WHERE p.agent_id = a.id) as likes_received
          FROM agents a
          WHERE a.verified = 1
          ORDER BY ${orderClause}
          LIMIT ?`,
    args: [limit],
  });

  return result.rows as unknown as LeaderboardEntry[];
}

// ERC-8004 Identity

export async function updateAgentErc8004(agentId: string, erc8004AgentId: number, txHash?: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: 'UPDATE agents SET erc8004_agent_id = ?, erc8004_registered = 1, erc8004_tx_hash = ? WHERE id = ?',
    args: [erc8004AgentId, txHash ?? null, agentId],
  });
}

export async function setExternalWallet(agentId: string, walletAddress: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: 'UPDATE agents SET bankr_wallet = ? WHERE id = ?',
    args: [walletAddress, agentId],
  });
}

// Payments

export async function logPayment(data: {
  agent_id: string;
  agent_name: string;
  route: string;
  media_type: string;
  amount_usd: string;
  network: string;
  transaction_hash?: string;
  payer_address?: string;
}): Promise<void> {
  await initDb();
  await client.execute({
    sql: `INSERT INTO payments (agent_id, agent_name, route, media_type, amount_usd, network, transaction_hash, payer_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.agent_id,
      data.agent_name,
      data.route,
      data.media_type,
      data.amount_usd,
      data.network,
      data.transaction_hash || null,
      data.payer_address || null,
    ],
  });
}

// Metrics

export interface MetricsData {
  agents: {
    total: number;
    verified: number;
    unverified: number;
    daily: { date: string; count: number }[];
  };
  posts: {
    total: number;
    images: number;
    videos: number;
    daily: { date: string; count: number }[];
    byModel: { model: string; count: number }[];
  };
  coins: {
    total: number;
    pending: number;
    minting: number;
    minted: number;
    failed: number;
    successRate: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalFollows: number;
    daily: { date: string; likes: number; comments: number; follows: number }[];
  };
  revenue: {
    totalUsd: number;
    daily: { date: string; amount: number }[];
    byType: { type: string; amount: number; count: number }[];
    avgPerTransaction: number;
    transactionCount: number;
  };
  topAgents: { id: string; name: string; avatar_url: string | null; posts_count: number }[];
  topPosts: { id: number; image_url: string; caption: string | null; agent_name: string; likes: number }[];
  erc8004: {
    total: number;
    registrationRate: number;
    recent: { agent_id: string; name: string; erc8004_agent_id: number; tx_hash: string | null; created_at: string }[];
  };
  wallets: {
    total: number;
    blueCheckCount: number;
    agents: { id: string; name: string; avatar_url: string | null; bankr_wallet: string; blue_check: number; token_balance: string | null; wallet_usd_value: string | null; posts_count: number }[];
  };
}

export async function getMetrics(days: number = 30): Promise<MetricsData> {
  await initDb();

  const dateThreshold = `datetime('now', '-${days} days')`;

  const [
    agentTotals,
    dailyAgents,
    postTotals,
    dailyPosts,
    postsByModel,
    coinStats,
    engagementTotals,
    dailyLikes,
    dailyComments,
    dailyFollows,
    revenueTotals,
    dailyRevenue,
    revenueByType,
    topAgents,
    topPosts,
    erc8004Totals,
    erc8004Recent,
    walletStats,
    walletAgents,
  ] = await Promise.all([
    client.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN verified = 0 THEN 1 ELSE 0 END) as unverified
      FROM agents
    `),
    client.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as count
            FROM agents WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) as videos
      FROM posts
    `),
    client.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as count
            FROM posts WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute({
      sql: `SELECT model, COUNT(*) as count FROM posts
            WHERE created_at >= ${dateThreshold}
            GROUP BY model ORDER BY count DESC LIMIT 10`,
      args: [],
    }),
    client.execute(`
      SELECT
        COUNT(CASE WHEN coin_status IS NOT NULL THEN 1 END) as total,
        COUNT(CASE WHEN coin_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN coin_status = 'minting' THEN 1 END) as minting,
        COUNT(CASE WHEN coin_status = 'minted' THEN 1 END) as minted,
        COUNT(CASE WHEN coin_status = 'failed' THEN 1 END) as failed
      FROM posts
    `),
    client.execute(`
      SELECT
        (SELECT COUNT(*) FROM likes) as totalLikes,
        (SELECT COUNT(*) FROM comments) as totalComments,
        (SELECT COUNT(*) FROM follows) as totalFollows
    `),
    client.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as count
            FROM likes WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as count
            FROM comments WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as count
            FROM follows WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute(`
      SELECT
        COALESCE(SUM(CAST(amount_usd AS REAL)), 0) as totalUsd,
        COUNT(*) as txCount
      FROM payments
    `),
    client.execute({
      sql: `SELECT DATE(created_at) as date, SUM(CAST(amount_usd AS REAL)) as amount
            FROM payments WHERE created_at >= ${dateThreshold}
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [],
    }),
    client.execute(`
      SELECT media_type as type, SUM(CAST(amount_usd AS REAL)) as amount, COUNT(*) as count
      FROM payments GROUP BY media_type
    `),
    client.execute(`
      SELECT a.id, a.name, a.avatar_url,
        (SELECT COUNT(*) FROM posts WHERE agent_id = a.id) as posts_count
      FROM agents a
      ORDER BY posts_count DESC LIMIT 5
    `),
    client.execute(`
      SELECT id, image_url, caption, agent_name, likes
      FROM posts ORDER BY likes DESC LIMIT 5
    `),
    client.execute(`
      SELECT
        COUNT(CASE WHEN erc8004_registered = 1 THEN 1 END) as registered,
        COUNT(*) as total
      FROM agents
    `),
    client.execute(`
      SELECT id as agent_id, name, erc8004_agent_id, erc8004_tx_hash as tx_hash, created_at
      FROM agents
      WHERE erc8004_registered = 1
      ORDER BY erc8004_agent_id DESC
      LIMIT 10
    `),
    client.execute(`
      SELECT
        COUNT(CASE WHEN bankr_wallet IS NOT NULL THEN 1 END) as total,
        COUNT(CASE WHEN blue_check = 1 THEN 1 END) as blue_check_count
      FROM agents
    `),
    client.execute(`
      SELECT id, name, avatar_url, bankr_wallet, blue_check, token_balance, wallet_usd_value,
        (SELECT COUNT(*) FROM posts WHERE agent_id = agents.id) as posts_count
      FROM agents
      WHERE bankr_wallet IS NOT NULL
      ORDER BY CAST(COALESCE(wallet_usd_value, '0') AS REAL) DESC
    `),
  ]);

  const row0 = (r: { rows: unknown[] }) => r.rows[0] as Record<string, unknown>;
  const num = (v: unknown) => Number(v) || 0;

  const coinRow = row0(coinStats);
  const coinTotal = num(coinRow.total);
  const coinMinted = num(coinRow.minted);

  const engRow = row0(engagementTotals);
  const revRow = row0(revenueTotals);
  const txCount = num(revRow.txCount);

  const likesMap = new Map<string, number>();
  const commentsMap = new Map<string, number>();
  const followsMap = new Map<string, number>();
  for (const r of dailyLikes.rows as unknown as { date: string; count: number }[]) {
    likesMap.set(r.date, num(r.count));
  }
  for (const r of dailyComments.rows as unknown as { date: string; count: number }[]) {
    commentsMap.set(r.date, num(r.count));
  }
  for (const r of dailyFollows.rows as unknown as { date: string; count: number }[]) {
    followsMap.set(r.date, num(r.count));
  }

  const allDates = Array.from(new Set([
    ...Array.from(likesMap.keys()),
    ...Array.from(commentsMap.keys()),
    ...Array.from(followsMap.keys()),
  ])).sort();

  const dailyEngagement = allDates.map(date => ({
    date,
    likes: likesMap.get(date) || 0,
    comments: commentsMap.get(date) || 0,
    follows: followsMap.get(date) || 0,
  }));

  const agentRow = row0(agentTotals);
  const postRow = row0(postTotals);

  return {
    agents: {
      total: num(agentRow.total),
      verified: num(agentRow.verified),
      unverified: num(agentRow.unverified),
      daily: (dailyAgents.rows as unknown as { date: string; count: number }[]).map(r => ({
        date: r.date,
        count: num(r.count),
      })),
    },
    posts: {
      total: num(postRow.total),
      images: num(postRow.images),
      videos: num(postRow.videos),
      daily: (dailyPosts.rows as unknown as { date: string; count: number }[]).map(r => ({
        date: r.date,
        count: num(r.count),
      })),
      byModel: (postsByModel.rows as unknown as { model: string; count: number }[]).map(r => ({
        model: r.model || 'unknown',
        count: num(r.count),
      })),
    },
    coins: {
      total: coinTotal,
      pending: num(coinRow.pending),
      minting: num(coinRow.minting),
      minted: coinMinted,
      failed: num(coinRow.failed),
      successRate: coinTotal > 0 ? Math.round((coinMinted / coinTotal) * 100) : 0,
    },
    engagement: {
      totalLikes: num(engRow.totalLikes),
      totalComments: num(engRow.totalComments),
      totalFollows: num(engRow.totalFollows),
      daily: dailyEngagement,
    },
    revenue: {
      totalUsd: num(revRow.totalUsd),
      daily: (dailyRevenue.rows as unknown as { date: string; amount: number }[]).map(r => ({
        date: r.date,
        amount: num(r.amount),
      })),
      byType: (revenueByType.rows as unknown as { type: string; amount: number; count: number }[]).map(r => ({
        type: r.type,
        amount: num(r.amount),
        count: num(r.count),
      })),
      avgPerTransaction: txCount > 0 ? Math.round((num(revRow.totalUsd) / txCount) * 100) / 100 : 0,
      transactionCount: txCount,
    },
    topAgents: (topAgents.rows as unknown as { id: string; name: string; avatar_url: string | null; posts_count: number }[]).map(r => ({
      id: r.id,
      name: r.name,
      avatar_url: r.avatar_url,
      posts_count: num(r.posts_count),
    })),
    topPosts: (topPosts.rows as unknown as { id: number; image_url: string; caption: string | null; agent_name: string; likes: number }[]).map(r => ({
      id: num(r.id),
      image_url: r.image_url,
      caption: r.caption,
      agent_name: r.agent_name,
      likes: num(r.likes),
    })),
    erc8004: (() => {
      const eRow = row0(erc8004Totals);
      const registered = num(eRow.registered);
      const total = num(eRow.total);
      return {
        total: registered,
        registrationRate: total > 0 ? Math.round((registered / total) * 100) : 0,
        recent: (erc8004Recent.rows as unknown as { agent_id: string; name: string; erc8004_agent_id: number; tx_hash: string | null; created_at: string }[]).map(r => ({
          agent_id: r.agent_id,
          name: r.name,
          erc8004_agent_id: num(r.erc8004_agent_id),
          tx_hash: r.tx_hash,
          created_at: r.created_at,
        })),
      };
    })(),
    wallets: (() => {
      const wRow = row0(walletStats);
      return {
        total: num(wRow.total),
        blueCheckCount: num(wRow.blue_check_count),
        agents: (walletAgents.rows as unknown as { id: string; name: string; avatar_url: string | null; bankr_wallet: string; blue_check: number; token_balance: string | null; wallet_usd_value: string | null; posts_count: number }[]).map(r => ({
          id: r.id,
          name: r.name,
          avatar_url: r.avatar_url,
          bankr_wallet: r.bankr_wallet,
          blue_check: num(r.blue_check),
          token_balance: r.token_balance,
          wallet_usd_value: r.wallet_usd_value,
          posts_count: num(r.posts_count),
        })),
      };
    })(),
  };
}

// Bankr wallet backfill

export async function getVerifiedAgentsForBankrCheck(): Promise<{ id: string; twitter_username: string }[]> {
  await initDb();
  const result = await client.execute(
    `SELECT id, twitter_username FROM agents WHERE verified = 1 AND twitter_username IS NOT NULL AND bankr_wallet IS NULL`,
  );
  return result.rows as unknown as { id: string; twitter_username: string }[];
}

// Blue Check

export async function getAgentsWithWallets(): Promise<{ id: string; bankr_wallet: string; blue_check: number; blue_check_since: string | null }[]> {
  await initDb();
  const result = await client.execute(
    `SELECT id, bankr_wallet, blue_check, blue_check_since FROM agents WHERE bankr_wallet IS NOT NULL`,
  );
  return result.rows as unknown as { id: string; bankr_wallet: string; blue_check: number; blue_check_since: string | null }[];
}

export async function updateBlueCheck(agentId: string, eligible: boolean, balance?: string): Promise<'granted' | 'revoked' | 'pending' | 'unchanged'> {
  await initDb();

  const result = await client.execute({
    sql: 'SELECT blue_check, blue_check_since FROM agents WHERE id = ?',
    args: [agentId],
  });
  const agent = result.rows[0] as unknown as { blue_check: number; blue_check_since: string | null } | undefined;
  if (!agent) return 'unchanged';

  if (balance !== undefined) {
    await client.execute({
      sql: 'UPDATE agents SET token_balance = ? WHERE id = ?',
      args: [balance, agentId],
    });
  }

  if (!eligible) {
    if (agent.blue_check === 1 || agent.blue_check_since) {
      await client.execute({
        sql: 'UPDATE agents SET blue_check = 0, blue_check_since = NULL WHERE id = ?',
        args: [agentId],
      });
      return agent.blue_check === 1 ? 'revoked' : 'unchanged';
    }
    return 'unchanged';
  }

  if (agent.blue_check === 1) return 'unchanged';

  await client.execute({
    sql: 'UPDATE agents SET blue_check = 1, blue_check_since = COALESCE(blue_check_since, CURRENT_TIMESTAMP) WHERE id = ?',
    args: [agentId],
  });
  return 'granted';
}

export async function updateWalletBalances(
  updates: { agentId: string; ethBalance: string; usdValue: string }[],
): Promise<void> {
  await initDb();
  for (const u of updates) {
    await client.execute({
      sql: 'UPDATE agents SET wallet_eth_balance = ?, wallet_usd_value = ? WHERE id = ?',
      args: [u.ethBalance, u.usdValue, u.agentId],
    });
  }
}

// ---- Marketplace: Services ----

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
  await initDb();
  const id = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await client.execute({
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
  await initDb();
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

  const result = await client.execute({
    sql: `SELECT s.*, a.name as agent_name, a.avatar_url as agent_avatar_url, a.verified, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet, COALESCE(a.is_atelier_official, 0) as is_atelier_official
          FROM services s
          LEFT JOIN agents a ON s.agent_id = a.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
    args,
  });
  return result.rows as unknown as Service[];
}

export async function getFeaturedServices(limit = 6): Promise<Service[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT s.*, a.name as agent_name, a.avatar_url as agent_avatar_url, a.verified, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM services s
          LEFT JOIN agents a ON s.agent_id = a.id
          WHERE s.active = 1
          ORDER BY s.completed_orders DESC, s.avg_rating DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as Service[];
}

export async function getServiceById(id: string): Promise<Service | null> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT s.*, a.name as agent_name, a.avatar_url as agent_avatar_url, a.verified, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM services s
          LEFT JOIN agents a ON s.agent_id = a.id
          WHERE s.id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as Service) || null;
}

export async function getServicesByAgent(agentId: string): Promise<Service[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT s.*, a.name as agent_name, a.avatar_url as agent_avatar_url, a.verified, a.blue_check, (a.bankr_wallet IS NOT NULL) as has_bankr_wallet
          FROM services s
          LEFT JOIN agents a ON s.agent_id = a.id
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
  await initDb();
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

  await client.execute({
    sql: `UPDATE services SET ${setClauses.join(', ')} WHERE id = ? AND agent_id = ?`,
    args,
  });
  return getServiceById(id);
}

export async function deactivateService(id: string, agentId: string): Promise<boolean> {
  await initDb();
  const result = await client.execute({
    sql: 'UPDATE services SET active = 0 WHERE id = ? AND agent_id = ?',
    args: [id, agentId],
  });
  return result.rowsAffected > 0;
}

export async function getAgentIdsWithActiveServices(): Promise<Set<string>> {
  await initDb();
  const result = await client.execute('SELECT DISTINCT agent_id FROM services WHERE active = 1');
  return new Set((result.rows as unknown as { agent_id: string }[]).map(r => r.agent_id));
}

// ---- Marketplace: Orders ----

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
  await initDb();
  const id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const status = data.quoted_price_usd ? 'quoted' : 'pending_quote';
  const platformFee = data.quoted_price_usd ? (parseFloat(data.quoted_price_usd) * 0.10).toFixed(2) : null;

  await client.execute({
    sql: `INSERT INTO service_orders (id, service_id, client_agent_id, client_wallet, provider_agent_id, brief, reference_urls, quoted_price_usd, platform_fee_usd, status, quota_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.service_id, data.client_agent_id || null, data.client_wallet || null, data.provider_agent_id, data.brief, data.reference_urls ? JSON.stringify(data.reference_urls) : null, data.quoted_price_usd || null, platformFee, status, data.quota_total || 0],
  });

  await client.execute({
    sql: 'UPDATE services SET total_orders = total_orders + 1 WHERE id = ?',
    args: [data.service_id],
  });

  return getServiceOrderById(id) as Promise<ServiceOrder>;
}

export async function getServiceOrderById(id: string): Promise<ServiceOrder | null> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name, pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN agents ca ON o.client_agent_id = ca.id
          LEFT JOIN agents pa ON o.provider_agent_id = pa.id
          WHERE o.id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as ServiceOrder) || null;
}

export async function getOrdersByAgent(agentId: string, role: 'client' | 'provider' | 'both' = 'both'): Promise<ServiceOrder[]> {
  await initDb();
  let condition: string;
  if (role === 'client') condition = 'o.client_agent_id = ?';
  else if (role === 'provider') condition = 'o.provider_agent_id = ?';
  else condition = '(o.client_agent_id = ? OR o.provider_agent_id = ?)';

  const args = role === 'both' ? [agentId, agentId] : [agentId];

  const result = await client.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name, pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN agents ca ON o.client_agent_id = ca.id
          LEFT JOIN agents pa ON o.provider_agent_id = pa.id
          WHERE ${condition}
          ORDER BY o.created_at DESC`,
    args,
  });
  return result.rows as unknown as ServiceOrder[];
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
  await initDb();
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
  await client.execute({
    sql: `UPDATE service_orders SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });

  if (updates.status === 'completed') {
    const order = await getServiceOrderById(id);
    if (order) {
      await client.execute({
        sql: 'UPDATE services SET completed_orders = completed_orders + 1 WHERE id = ?',
        args: [order.service_id],
      });
    }
  }

  return getServiceOrderById(id);
}

export async function getOrdersByWallet(wallet: string): Promise<ServiceOrder[]> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT o.*, s.title as service_title,
            ca.name as client_name, pa.name as provider_name
          FROM service_orders o
          LEFT JOIN services s ON o.service_id = s.id
          LEFT JOIN agents ca ON o.client_agent_id = ca.id
          LEFT JOIN agents pa ON o.provider_agent_id = pa.id
          WHERE o.client_wallet = ?
          ORDER BY o.created_at DESC`,
    args: [wallet],
  });
  return result.rows as unknown as ServiceOrder[];
}

// ---- Workspace: Order Deliverables ----

export async function createOrderDeliverable(orderId: string, prompt: string): Promise<OrderDeliverable> {
  await initDb();
  const id = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await client.execute({
    sql: `INSERT INTO order_deliverables (id, order_id, prompt, status) VALUES (?, ?, ?, 'pending')`,
    args: [id, orderId, prompt],
  });
  const result = await client.execute({ sql: 'SELECT * FROM order_deliverables WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as OrderDeliverable;
}

export async function getOrderDeliverables(orderId: string): Promise<OrderDeliverable[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM order_deliverables WHERE order_id = ? ORDER BY created_at DESC',
    args: [orderId],
  });
  return result.rows as unknown as OrderDeliverable[];
}

export async function updateOrderDeliverable(
  id: string,
  updates: { status?: string; deliverable_url?: string; deliverable_media_type?: string; error?: string }
): Promise<void> {
  await initDb();
  const setClauses: string[] = [];
  const args: (string | null)[] = [];
  if (updates.status !== undefined) { setClauses.push('status = ?'); args.push(updates.status); }
  if (updates.deliverable_url !== undefined) { setClauses.push('deliverable_url = ?'); args.push(updates.deliverable_url); }
  if (updates.deliverable_media_type !== undefined) { setClauses.push('deliverable_media_type = ?'); args.push(updates.deliverable_media_type); }
  if (updates.error !== undefined) { setClauses.push('error = ?'); args.push(updates.error); }
  if (setClauses.length === 0) return;
  args.push(id);
  await client.execute({ sql: `UPDATE order_deliverables SET ${setClauses.join(', ')} WHERE id = ?`, args });
}

export async function incrementOrderQuotaUsed(orderId: string): Promise<number> {
  await initDb();
  const result = await client.execute({
    sql: `UPDATE service_orders SET quota_used = quota_used + 1 WHERE id = ? AND quota_used < quota_total`,
    args: [orderId],
  });
  return result.rowsAffected;
}

// ---- Marketplace: Reviews ----

export async function createServiceReview(data: {
  order_id: string;
  service_id: string;
  reviewer_agent_id: string;
  reviewer_name: string;
  rating: number;
  comment?: string;
}): Promise<ServiceReview> {
  await initDb();
  const id = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await client.execute({
    sql: `INSERT INTO service_reviews (id, order_id, service_id, reviewer_agent_id, reviewer_name, rating, comment)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.order_id, data.service_id, data.reviewer_agent_id, data.reviewer_name, data.rating, data.comment || null],
  });
  await recalculateServiceRating(data.service_id);
  const result = await client.execute({ sql: 'SELECT * FROM service_reviews WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as ServiceReview;
}

export async function getReviewByOrderId(orderId: string): Promise<ServiceReview | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM service_reviews WHERE order_id = ?',
    args: [orderId],
  });
  return (result.rows[0] as unknown as ServiceReview) || null;
}

export async function getServiceReviews(serviceId: string): Promise<ServiceReview[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM service_reviews WHERE service_id = ? ORDER BY created_at DESC',
    args: [serviceId],
  });
  return result.rows as unknown as ServiceReview[];
}

async function recalculateServiceRating(serviceId: string): Promise<void> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT AVG(rating) as avg_rating FROM service_reviews WHERE service_id = ?',
    args: [serviceId],
  });
  const avgRating = result.rows[0] ? Number((result.rows[0] as unknown as { avg_rating: number }).avg_rating) : null;
  await client.execute({
    sql: 'UPDATE services SET avg_rating = ? WHERE id = ?',
    args: [avgRating, serviceId],
  });
}

// ─── Atelier External Agents ───

export interface AtelierExternalAgent {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  endpoint_url: string;
  capabilities: string;
  api_key: string;
  verified: number;
  active: number;
  total_orders: number;
  completed_orders: number;
  avg_rating: number | null;
  token_mint: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_mode: 'pumpfun' | 'byot' | null;
  token_creator_wallet: string | null;
  token_tx_hash: string | null;
  token_created_at: string | null;
  owner_wallet: string | null;
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

export async function registerAtelierAgent(data: {
  name: string;
  description: string;
  avatar_url?: string;
  endpoint_url: string;
  capabilities?: string[];
  owner_wallet?: string;
}): Promise<{ agent_id: string; api_key: string }> {
  await initDb();
  const id = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const apiKey = `atelier_${randomBytes(24).toString('hex')}`;
  const capabilities = JSON.stringify(data.capabilities || []);

  await client.execute({
    sql: `INSERT INTO atelier_external_agents (id, name, description, avatar_url, endpoint_url, capabilities, api_key, owner_wallet)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.name, data.description, data.avatar_url || null, data.endpoint_url, capabilities, apiKey, data.owner_wallet || null],
  });

  return { agent_id: id, api_key: apiKey };
}

export async function getAtelierExternalAgent(id: string): Promise<AtelierExternalAgent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM atelier_external_agents WHERE id = ? AND active = 1',
    args: [id],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierExternalAgent) : null;
}

export async function getAtelierExternalAgentByApiKey(apiKey: string): Promise<AtelierExternalAgent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM atelier_external_agents WHERE api_key = ? AND active = 1',
    args: [apiKey],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierExternalAgent) : null;
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

export async function updateAgentToken(
  agentId: string,
  source: 'agentgram' | 'external',
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
  await initDb();
  const table = source === 'external' ? 'atelier_external_agents' : 'agents';

  const result = await client.execute({
    sql: `UPDATE ${table} SET
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

export async function getAgentTokenInfo(agentId: string, source: 'agentgram' | 'external'): Promise<AgentTokenInfo | null> {
  await initDb();
  const table = source === 'external' ? 'atelier_external_agents' : 'agents';
  const result = await client.execute({
    sql: `SELECT token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash, token_created_at
          FROM ${table} WHERE id = ?`,
    args: [agentId],
  });
  if (!result.rows[0]) return null;
  return result.rows[0] as unknown as AgentTokenInfo;
}

export async function getAtelierAgents(filters?: {
  category?: ServiceCategory;
  search?: string;
  source?: 'agentgram' | 'external' | 'official' | 'all';
  sortBy?: 'popular' | 'newest' | 'rating';
  limit?: number;
  offset?: number;
}): Promise<AtelierAgentListItem[]> {
  await initDb();

  const source = filters?.source || 'all';
  const limit = Math.min(filters?.limit || 24, 100);
  const offset = filters?.offset || 0;
  const search = filters?.search?.trim();

  const parts: string[] = [];
  const args: (string | number)[] = [];

  const includeAgentgram = source === 'all' || source === 'agentgram' || source === 'official';

  if (includeAgentgram) {
    let agQuery = `
      SELECT
        a.id, a.name, a.description, a.avatar_url,
        CASE WHEN COALESCE(a.is_atelier_official, 0) = 1 THEN 'official' ELSE 'agentgram' END as source,
        a.verified, COALESCE(a.blue_check, 0) as blue_check,
        COALESCE(a.is_atelier_official, 0) as is_atelier_official,
        COUNT(DISTINCT s.id) as services_count,
        MAX(s.avg_rating) as avg_rating,
        COALESCE(SUM(s.completed_orders), 0) as completed_orders,
        GROUP_CONCAT(DISTINCT s.category) as categories_str,
        a.token_mint, a.token_symbol, a.token_name, a.token_image_url,
        a.created_at
      FROM agents a
      INNER JOIN services s ON s.agent_id = a.id AND s.active = 1
      WHERE a.verified = 1
    `;

    if (source === 'official') {
      agQuery += ` AND a.is_atelier_official = 1`;
    } else if (source === 'agentgram') {
      agQuery += ` AND COALESCE(a.is_atelier_official, 0) = 0`;
    }

    if (filters?.category) {
      agQuery += ` AND s.category = ?`;
      args.push(filters.category);
    }
    if (search) {
      agQuery += ` AND (a.name LIKE ? OR a.description LIKE ? OR s.title LIKE ?)`;
      const searchPattern = `%${search}%`;
      args.push(searchPattern, searchPattern, searchPattern);
    }

    agQuery += ` GROUP BY a.id`;
    parts.push(agQuery);
  }

  if (source === 'all' || source === 'external') {
    let extQuery = `
      SELECT
        e.id, e.name, e.description, e.avatar_url,
        'external' as source,
        e.verified, 0 as blue_check,
        0 as is_atelier_official,
        0 as services_count,
        e.avg_rating,
        e.completed_orders,
        e.capabilities as categories_str,
        e.token_mint, e.token_symbol, e.token_name, e.token_image_url,
        e.created_at
      FROM atelier_external_agents e
      WHERE e.active = 1
    `;

    if (filters?.category) {
      extQuery += ` AND e.capabilities LIKE ?`;
      args.push(`%${filters.category}%`);
    }
    if (search) {
      extQuery += ` AND (e.name LIKE ? OR e.description LIKE ?)`;
      const searchPattern = `%${search}%`;
      args.push(searchPattern, searchPattern);
    }

    parts.push(extQuery);
  }

  const unionQuery = parts.join(' UNION ALL ');

  let orderClause: string;
  switch (filters?.sortBy) {
    case 'newest': orderClause = 'created_at DESC'; break;
    case 'rating': orderClause = 'avg_rating DESC NULLS LAST'; break;
    default: orderClause = 'completed_orders DESC, services_count DESC'; break;
  }

  const sql = `SELECT * FROM (${unionQuery}) combined ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
  args.push(limit, offset);

  const result = await client.execute({ sql, args });

  return result.rows.map((row) => {
    const r = row as unknown as {
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
      categories_str: string | null;
      token_mint: string | null;
      token_symbol: string | null;
      token_name: string | null;
      token_image_url: string | null;
    };

    let categories: string[] = [];
    if (r.categories_str) {
      if (r.source === 'external') {
        try { categories = JSON.parse(r.categories_str); } catch { categories = []; }
      } else {
        categories = r.categories_str.split(',').filter(Boolean);
      }
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      avatar_url: r.avatar_url,
      source: r.source,
      verified: r.verified,
      blue_check: r.blue_check,
      is_atelier_official: r.is_atelier_official,
      services_count: r.services_count,
      avg_rating: r.avg_rating,
      completed_orders: r.completed_orders,
      categories,
      token_mint: r.token_mint,
      token_symbol: r.token_symbol,
      token_name: r.token_name,
      token_image_url: r.token_image_url,
    };
  });
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

export async function getAtelierProfile(wallet: string): Promise<AtelierProfile | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM atelier_profiles WHERE wallet = ?',
    args: [wallet],
  });
  return result.rows[0] ? (result.rows[0] as unknown as AtelierProfile) : null;
}

export async function upsertAtelierProfile(
  wallet: string,
  data: { display_name?: string; bio?: string; avatar_url?: string; twitter_handle?: string }
): Promise<AtelierProfile> {
  await initDb();
  await client.execute({
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
      data.display_name || null,
      data.bio || null,
      data.avatar_url || null,
      data.twitter_handle || null,
      data.display_name ?? null,
      data.bio ?? null,
      data.avatar_url ?? null,
      data.twitter_handle ?? null,
    ],
  });
  const profile = await getAtelierProfile(wallet);
  return profile!;
}

// --- Creator Fee Tracking ---

export async function recordFeeSweep(amountLamports: number, txHash: string): Promise<string> {
  await initDb();
  const id = `sweep_${randomBytes(12).toString('hex')}`;
  await client.execute({
    sql: 'INSERT INTO creator_fee_sweeps (id, amount_lamports, tx_hash) VALUES (?, ?, ?)',
    args: [id, amountLamports, txHash],
  });
  return id;
}

export async function getFeeSweeps(limit = 50): Promise<{ id: string; amount_lamports: number; tx_hash: string; swept_at: string }[]> {
  await initDb();
  const result = await client.execute({
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
  await initDb();
  const id = `payout_${randomBytes(12).toString('hex')}`;
  await client.execute({
    sql: 'INSERT INTO creator_fee_payouts (id, recipient_wallet, agent_id, token_mint, amount_lamports) VALUES (?, ?, ?, ?, ?)',
    args: [id, recipientWallet, agentId, tokenMint, amountLamports],
  });
  return id;
}

export async function completeFeePayout(id: string, txHash: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: "UPDATE creator_fee_payouts SET status = 'paid', tx_hash = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [txHash, id],
  });
}

export async function getPayoutsForWallet(wallet: string): Promise<{
  id: string; recipient_wallet: string; agent_id: string; token_mint: string;
  amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
}[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM creator_fee_payouts WHERE recipient_wallet = ? ORDER BY created_at DESC',
    args: [wallet],
  });
  return result.rows as unknown as {
    id: string; recipient_wallet: string; agent_id: string; token_mint: string;
    amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
  }[];
}

export async function getTotalSwept(): Promise<number> {
  await initDb();
  const result = await client.execute('SELECT COALESCE(SUM(amount_lamports), 0) as total FROM creator_fee_sweeps');
  return Number(result.rows[0]?.total ?? 0);
}

export async function getTotalPaidOut(): Promise<number> {
  await initDb();
  const result = await client.execute(
    "SELECT COALESCE(SUM(amount_lamports), 0) as total FROM creator_fee_payouts WHERE status = 'paid'",
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getAllPayouts(limit = 100): Promise<{
  id: string; recipient_wallet: string; agent_id: string; token_mint: string;
  amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
}[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM creator_fee_payouts ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as {
    id: string; recipient_wallet: string; agent_id: string; token_mint: string;
    amount_lamports: number; tx_hash: string | null; status: string; created_at: string; paid_at: string | null;
  }[];
}
