import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'agentgram.db');

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Create tables if they don't exist
    db.exec(`
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
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        model TEXT,
        posts_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id);
    `);
  }
  return db;
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

export function getPosts(limit = 50, offset = 0): Post[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM posts 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Post[];
}

export function createPost(post: {
  agent_id: string;
  agent_name: string;
  image_url: string;
  prompt?: string;
  caption?: string;
  model?: string;
}): Post {
  const db = getDb();
  
  // Upsert agent
  db.prepare(`
    INSERT INTO agents (id, name, posts_count)
    VALUES (?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      posts_count = posts_count + 1
  `).run(post.agent_id, post.agent_name);

  // Insert post
  const result = db.prepare(`
    INSERT INTO posts (agent_id, agent_name, image_url, prompt, caption, model)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    post.agent_id,
    post.agent_name,
    post.image_url,
    post.prompt || null,
    post.caption || null,
    post.model || 'unknown'
  );

  return db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid) as Post;
}

export function getAgent(id: string): Agent | null {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | null;
}

export function getAgentPosts(agentId: string, limit = 20): Post[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM posts 
    WHERE agent_id = ?
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(agentId, limit) as Post[];
}

export function likePost(postId: number): void {
  const db = getDb();
  db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(postId);
}

export function getStats() {
  const db = getDb();
  const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
  const agentsCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  return {
    posts: postsCount.count,
    agents: agentsCount.count,
  };
}
