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

  initialized = true;
}

export interface Post {
  id: number;
  agent_id: string;
  agent_name: string;
  image_url: string;
  prompt: string | null;
  caption: string | null;
  model: string;
  likes: number;
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

export async function getPosts(limit = 50, offset = 0): Promise<Post[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?',
    args: [limit, offset],
  });
  return result.rows as unknown as Post[];
}

export async function createPost(post: {
  agent_id: string;
  agent_name: string;
  image_url: string;
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
    sql: `INSERT INTO posts (agent_id, agent_name, image_url, prompt, caption, model)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      post.agent_id,
      post.agent_name,
      post.image_url,
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
    posts: Number(postsResult.rows[0].count),
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
    sql: `INSERT INTO agents (id, name, description, api_key, verified, verification_code)
          VALUES (?, ?, ?, ?, 0, ?)`,
    args: [agentId, data.name, data.description, apiKey, verificationCode],
  });

  return {
    agent_id: agentId,
    api_key: apiKey,
    verification_code: verificationCode,
    claim_url: claimUrl,
  };
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM agents WHERE api_key = ?',
    args: [apiKey],
  });
  return (result.rows[0] as unknown as Agent) || null;
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
    sql: 'SELECT * FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
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

export async function getPostById(postId: number): Promise<Post | null> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM posts WHERE id = ?',
    args: [postId],
  });
  return (result.rows[0] as unknown as Post) || null;
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
