import { createClient, Client } from '@libsql/client';

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
      avatar_url TEXT,
      bio TEXT,
      model TEXT,
      posts_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id)');

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
  avatar_url: string | null;
  bio: string | null;
  model: string | null;
  posts_count: number;
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

export async function getAgentPosts(agentId: string, limit = 20): Promise<Post[]> {
  await initDb();
  const result = await client.execute({
    sql: 'SELECT * FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [agentId, limit],
  });
  return result.rows as unknown as Post[];
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
