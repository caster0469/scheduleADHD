import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database(path.join(__dirname, "..", "data.sqlite"));

export async function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      hero TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);

  const row = db.prepare("SELECT slug FROM pages WHERE slug = ?").get("home");
  if (!row) {
    upsertPage("home", {
      title: "YANREPHOUSE",
      hero: "爬虫類専門店 YANREPHOUSEへようこそ",
      body: "管理者ページからこの文章を変更できます。",
    });
  }
}

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASS || "change-me-now";
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return;

  const hash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
  console.log(`[seed] Created admin user: ${username} (change ADMIN_PASS in .env)`);
}

export async function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

export async function getPage(slug) {
  return db.prepare("SELECT * FROM pages WHERE slug = ?").get(slug);
}

export async function upsertPage(slug, { title, hero, body }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pages (slug, title, hero, body, updated_at)
    VALUES (@slug, @title, @hero, @body, @updated_at)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title,
      hero=excluded.hero,
      body=excluded.body,
      updated_at=excluded.updated_at
  `).run({ slug, title: title ?? "", hero: hero ?? "", body: body ?? "", updated_at: now });
}

export async function listProducts() {
  return db.prepare("SELECT * FROM products ORDER BY id DESC").all();
}

export async function getProduct(id) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id);
}

export async function createProduct({ name, price, description, image_url }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO products (name, price, description, image_url, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name ?? "", price ?? 0, description ?? "", image_url ?? "", now);
}

export async function updateProduct(id, { name, price, description, image_url }) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE products SET
      name = ?,
      price = ?,
      description = ?,
      image_url = ?,
      updated_at = ?
    WHERE id = ?
  `).run(name ?? "", price ?? 0, description ?? "", image_url ?? "", now, id);
}

export async function deleteProduct(id) {
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}
