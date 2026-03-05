import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { fileURLToPath } from "url";
import { z } from "zod";

import { initDb, ensureAdminUser, getUserByUsername, getPage, upsertPage, listProducts, getProduct, createProduct, updateProduct, deleteProduct } from "./src/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Basic hard-fail on unsafe defaults (dev can override) ----
const IS_PROD = process.env.NODE_ENV === "production";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("change")) {
  console.warn("[warn] SESSION_SECRET が弱い/未設定です。.env で強い値にしてください。");
}
if ((process.env.ADMIN_PASS || "").includes("change")) {
  console.warn("[warn] ADMIN_PASS がデフォルトっぽいです。本番は必ず変更してください。");
}

// If behind a reverse proxy (Nginx/Cloudflare), enable this in production
if (IS_PROD && process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// ---- Security headers ----
app.use(
  helmet({
    // EJS + inline scripts can be used; keep CSP off for starter simplicity.
    contentSecurityPolicy: false,
  })
);

// ---- Parsers ----
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(express.json({ limit: "200kb" }));
app.use("/public", express.static(path.join(__dirname, "public"), { maxAge: IS_PROD ? "7d" : 0 }));

// ---- Session (persistent store) ----
const SQLiteStore = SQLiteStoreFactory(session);
app.use(
  session({
    name: "yanrephouse.sid",
    store: new SQLiteStore({
      dir: __dirname,
      db: "sessions.sqlite",
      table: "sessions",
    }),
    secret: process.env.SESSION_SECRET || "change-this-in-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD, // HTTPS in production
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ---- Simple CSRF (double-submit session token) ----
function csrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}
function withCsrf(req, res, next) {
  res.locals.csrf = csrfToken(req);
  next();
}
function verifyCsrf(req, res, next) {
  const token = req.body?._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send("CSRF blocked");
  }
  next();
}

// ---- Views ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.redirect("/admin/login");
}

// ---- Upload (multer memory + magic-bytes check) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

async function saveImageIfProvided(req) {
  if (!req.file) return null;

  const type = await fileTypeFromBuffer(req.file.buffer);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!type || !allowed.has(type.mime)) {
    throw new Error("画像ファイルのみ（jpg/png/webp/gif）対応です。");
  }

  const filename = `${crypto.randomUUID()}.${type.ext}`;
  const outPath = path.join(__dirname, "public", "uploads", filename);
  await fsWriteFile(outPath, req.file.buffer);
  return `/public/uploads/${filename}`;
}

function fsWriteFile(filepath, buf) {
  return new Promise((resolve, reject) => {
    import("fs").then(fs => {
      fs.writeFile(filepath, buf, (err) => (err ? reject(err) : resolve()));
    });
  });
}

// ---- DB init ----
await initDb();
await ensureAdminUser();

// ---- Rate limit for login ----
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

// ---- Public routes ----
app.get("/", withCsrf, async (req, res) => {
  const page = await getPage("home");
  const products = await listProducts();
  res.render("index", { page, products, user: req.session?.user || null, csrf: res.locals.csrf });
});

app.get("/product/:id", withCsrf, async (req, res) => {
  const product = await getProduct(Number(req.params.id));
  if (!product) return res.status(404).send("Not found");
  res.render("product", { product, user: req.session?.user || null, csrf: res.locals.csrf });
});

// ---- Admin auth ----
app.get("/admin/login", withCsrf, (req, res) => {
  res.render("admin/login", { error: null, csrf: res.locals.csrf });
});

app.post("/admin/login", loginLimiter, verifyCsrf, async (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  const user = await getUserByUsername(username);
  if (!user) return res.status(401).render("admin/login", { error: "ユーザー名かパスワードが違います。", csrf: csrfToken(req) });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).render("admin/login", { error: "ユーザー名かパスワードが違います。", csrf: csrfToken(req) });

  req.session.user = { id: user.id, username: user.username };
  res.redirect("/admin");
});

app.post("/admin/logout", verifyCsrf, (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ---- Admin pages ----
app.get("/admin", requireAuth, withCsrf, async (req, res) => {
  res.render("admin/dashboard", { user: req.session.user, csrf: res.locals.csrf });
});

// Edit homepage
const PageSchema = z.object({
  title: z.string().min(1).max(80),
  hero: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
});

app.get("/admin/page/home", requireAuth, withCsrf, async (req, res) => {
  const page = await getPage("home");
  res.render("admin/edit_home", { page, user: req.session.user, saved: false, error: null, csrf: res.locals.csrf });
});

app.post("/admin/page/home", requireAuth, verifyCsrf, withCsrf, async (req, res) => {
  try {
    const parsed = PageSchema.parse({
      title: req.body.title,
      hero: req.body.hero,
      body: req.body.body,
    });

    await upsertPage("home", parsed);
    const page = await getPage("home");
    res.render("admin/edit_home", { page, user: req.session.user, saved: true, error: null, csrf: res.locals.csrf });
  } catch (e) {
    const page = await getPage("home");
    res.render("admin/edit_home", { page, user: req.session.user, saved: false, error: "入力が不正です。", csrf: res.locals.csrf });
  }
});

// Products CRUD
const ProductSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.coerce.number().int().min(0).max(10_000_000),
  description: z.string().max(5000).optional().default(""),
  image_url: z.string().max(2000).optional().default(""),
});

app.get("/admin/products", requireAuth, withCsrf, async (req, res) => {
  const products = await listProducts();
  res.render("admin/products_list", { products, user: req.session.user, csrf: res.locals.csrf });
});

app.get("/admin/products/new", requireAuth, withCsrf, async (req, res) => {
  res.render("admin/product_form", { product: null, user: req.session.user, mode: "new", error: null, csrf: res.locals.csrf });
});

app.post("/admin/products/new", requireAuth, upload.single("image_file"), verifyCsrf, withCsrf, async (req, res) => {
  try {
    const parsed = ProductSchema.parse({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image_url: req.body.image_url,
    });

    let img = parsed.image_url || "";
    if (req.file) {
      img = await saveImageIfProvided(req);
    }
    await createProduct({ ...parsed, image_url: img });
    res.redirect("/admin/products");
  } catch (e) {
    res.render("admin/product_form", { product: null, user: req.session.user, mode: "new", error: "保存に失敗しました。入力/画像を確認してください。", csrf: res.locals.csrf });
  }
});

app.get("/admin/products/:id/edit", requireAuth, withCsrf, async (req, res) => {
  const product = await getProduct(Number(req.params.id));
  if (!product) return res.status(404).send("Not found");
  res.render("admin/product_form", { product, user: req.session.user, mode: "edit", error: null, csrf: res.locals.csrf });
});

app.post("/admin/products/:id/edit", requireAuth, upload.single("image_file"), verifyCsrf, withCsrf, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const old = await getProduct(id);
    if (!old) return res.status(404).send("Not found");

    const parsed = ProductSchema.parse({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image_url: req.body.image_url,
    });

    const keep = req.body.keep_image === "on";
    let img = old.image_url || "";

    if (!keep) {
      img = parsed.image_url || "";
      if (req.file) img = await saveImageIfProvided(req);
    }

    await updateProduct(id, { ...parsed, image_url: img });
    res.redirect("/admin/products");
  } catch (e) {
    const product = await getProduct(Number(req.params.id));
    res.render("admin/product_form", { product, user: req.session.user, mode: "edit", error: "更新に失敗しました。入力/画像を確認してください。", csrf: res.locals.csrf });
  }
});

app.post("/admin/products/:id/delete", requireAuth, verifyCsrf, async (req, res) => {
  await deleteProduct(Number(req.params.id));
  res.redirect("/admin/products");
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Server error");
});

app.listen(PORT, () => {
  console.log(`YANREPHOUSE running: http://localhost:${PORT}`);
});
