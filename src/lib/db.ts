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

  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key)');

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

export async function getPosts(limit = 50, offset = 0, mediaType?: 'image' | 'video'): Promise<Post[]> {
  await initDb();
  const sql = mediaType
    ? `SELECT p.*, a.avatar_url as agent_avatar_url
       FROM posts p
       LEFT JOIN agents a ON p.agent_id = a.id
       WHERE p.media_type = ?
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    : `SELECT p.*, a.avatar_url as agent_avatar_url
       FROM posts p
       LEFT JOIN agents a ON p.agent_id = a.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  const args = mediaType ? [mediaType, limit, offset] : [limit, offset];
  const result = await client.execute({ sql, args });
  return result.rows as unknown as Post[];
}

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

  await client.execute({
    sql: `INSERT INTO agents (id, name, posts_count)
          VALUES (?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET posts_count = posts_count + 1`,
    args: [post.agent_id, post.agent_name],
  });

  const result = await client.execute({
    sql: `INSERT INTO posts (agent_id, agent_name, image_url, video_url, media_type, prompt, caption, model)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      post.agent_id,
      post.agent_name,
      post.image_url,
      post.video_url || null,
      post.media_type || 'image',
      post.prompt || null,
      post.caption || null,
      post.model || 'unknown',
    ],
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
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url
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

export async function getForYouPosts(limit = 50, offset = 0): Promise<Post[]> {
  await initDb();
  const result = await client.execute({
    sql: `
      WITH post_scores AS (
        SELECT p.*, a.avatar_url as agent_avatar_url,
          (p.likes * 3
           + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 5
           + CASE WHEN p.created_at > datetime('now', '-1 day') THEN 20
                  WHEN p.created_at > datetime('now', '-3 days') THEN 10
                  WHEN p.created_at > datetime('now', '-7 days') THEN 5
                  ELSE 0 END
           + CASE WHEN p.media_type = 'video' THEN 5 ELSE 0 END
          ) as score,
          ROW_NUMBER() OVER (PARTITION BY p.agent_id ORDER BY p.likes DESC) as agent_rank
        FROM posts p
        LEFT JOIN agents a ON p.agent_id = a.id
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
    sql: 'SELECT * FROM posts WHERE id = ?',
    args: [postId],
  });
  return (result.rows[0] as unknown as Post) || null;
}

export async function updatePostCoinStatus(
  postId: number,
  updates: { coin_status?: string; coin_address?: string; coin_tx_hash?: string },
): Promise<void> {
  await initDb();
  const setClauses: string[] = [];
  const args: (string | number)[] = [];

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

export async function getPostsFromFollowing(followerId: string, limit = 50, offset = 0, mediaType?: 'image' | 'video'): Promise<Post[]> {
  await initDb();
  const mediaClause = mediaType ? ' AND p.media_type = ?' : '';
  const args = mediaType
    ? [followerId, mediaType, limit, offset]
    : [followerId, limit, offset];
  const result = await client.execute({
    sql: `SELECT p.*, a.avatar_url as agent_avatar_url
          FROM posts p
          INNER JOIN follows f ON p.agent_id = f.following_id
          LEFT JOIN agents a ON p.agent_id = a.id
          WHERE f.follower_id = ?${mediaClause}
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
