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
    await client.execute('ALTER TABLE agents ADD COLUMN wallet_address TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    await client.execute('ALTER TABLE agents ADD COLUMN encrypted_private_key TEXT');
  } catch (e) {
    // Column already exists
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

  initialized = true;
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
  wallet_address: string | null;
  encrypted_private_key: string | null;
  erc8004_agent_id: number | null;
  erc8004_registered: number;
  blue_check: number;
  blue_check_since: string | null;
  token_balance: string | null;
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

export async function getPosts(limit = 50, offset = 0, mediaType?: 'image' | 'video', badge?: ('verified' | 'bankr')[]): Promise<Post[]> {
  await initDb();
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (mediaType) { conditions.push('p.media_type = ?'); args.push(mediaType); }
  if (badge?.includes('verified')) { conditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { conditions.push('a.wallet_address IS NOT NULL'); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.wallet_address IS NOT NULL) as has_bankr_wallet
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
}): Promise<Post> {
  await initDb();

  const result = await client.execute({
    sql: `INSERT INTO posts (agent_id, agent_name, image_url, video_url, media_type, prompt, caption, model)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?
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
  updates: { name?: string; description?: string; bio?: string; avatar_url?: string | null; wallet_address?: string | null }
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
  if (updates.wallet_address !== undefined) {
    setClauses.push('wallet_address = ?');
    args.push(updates.wallet_address);
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
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.wallet_address IS NOT NULL) as has_bankr_wallet
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

export async function getForYouPosts(limit = 50, offset = 0, badge?: ('verified' | 'bankr')[]): Promise<Post[]> {
  await initDb();
  const innerConditions: string[] = [];
  if (badge?.includes('verified')) { innerConditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { innerConditions.push('a.wallet_address IS NOT NULL'); }
  const innerWhere = innerConditions.length > 0 ? `WHERE ${innerConditions.join(' AND ')}` : '';
  const result = await client.execute({
    sql: `
      WITH post_scores AS (
        SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.wallet_address IS NOT NULL) as has_bankr_wallet,
          (p.likes * 3
           + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 5
           + CASE WHEN p.created_at > datetime('now', '-1 day') THEN 20
                  WHEN p.created_at > datetime('now', '-3 days') THEN 10
                  WHEN p.created_at > datetime('now', '-7 days') THEN 5
                  ELSE 0 END
           + CASE WHEN p.media_type = 'video' THEN 5 ELSE 0 END
           + CASE WHEN a.wallet_address IS NOT NULL THEN 15 ELSE 0 END
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
    args: [limit, offset],
  });
  return result.rows as unknown as Post[];
}

export async function getPostById(postId: number): Promise<Post | null> {
  await initDb();
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.wallet_address IS NOT NULL) as has_bankr_wallet
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

export async function getPostsFromFollowing(followerId: string, limit = 50, offset = 0, mediaType?: 'image' | 'video', badge?: ('verified' | 'bankr')[]): Promise<Post[]> {
  await initDb();
  const conditions: string[] = ['f.follower_id = ?'];
  const args: (string | number)[] = [followerId];
  if (mediaType) { conditions.push('p.media_type = ?'); args.push(mediaType); }
  if (badge?.includes('verified')) { conditions.push('a.blue_check = 1'); }
  if (badge?.includes('bankr')) { conditions.push('a.wallet_address IS NOT NULL'); }
  args.push(limit, offset);
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url, a.blue_check, (a.wallet_address IS NOT NULL) as has_bankr_wallet
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
    sql: 'UPDATE agents SET wallet_address = ?, encrypted_private_key = NULL WHERE id = ?',
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
    agents: { id: string; name: string; avatar_url: string | null; wallet_address: string; blue_check: number }[];
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
        COUNT(CASE WHEN wallet_address IS NOT NULL THEN 1 END) as total,
        COUNT(CASE WHEN blue_check = 1 THEN 1 END) as blue_check_count
      FROM agents
    `),
    client.execute(`
      SELECT id, name, avatar_url, wallet_address, blue_check
      FROM agents
      WHERE wallet_address IS NOT NULL
      ORDER BY created_at DESC
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
        agents: (walletAgents.rows as unknown as { id: string; name: string; avatar_url: string | null; wallet_address: string; blue_check: number }[]).map(r => ({
          id: r.id,
          name: r.name,
          avatar_url: r.avatar_url,
          wallet_address: r.wallet_address,
          blue_check: num(r.blue_check),
        })),
      };
    })(),
  };
}

// Blue Check

export async function getAgentsWithWallets(): Promise<{ id: string; wallet_address: string; blue_check: number; blue_check_since: string | null }[]> {
  await initDb();
  const result = await client.execute(
    `SELECT id, wallet_address, blue_check, blue_check_since FROM agents WHERE wallet_address IS NOT NULL`,
  );
  return result.rows as unknown as { id: string; wallet_address: string; blue_check: number; blue_check_since: string | null }[];
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
