import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "..");
const args = process.argv.slice(2);
const mode = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
const inputPath = args.find((arg) => !arg.startsWith("--"));

if (!mode || !inputPath) {
  console.error("用法：node scripts/import-works.mjs <作品备份.json> --local|--remote");
  process.exit(1);
}

const source = path.resolve(process.cwd(), inputPath);
const parsed = JSON.parse(await fs.readFile(source, "utf8"));
const works = Array.isArray(parsed) ? parsed : parsed.works;

if (!Array.isArray(works)) throw new Error("JSON 文件中没有 works 数组。");
if (works.length > 500) throw new Error("单次最多导入 500 件作品。");

const allowedCategories = new Set(["文字", "视觉", "设计", "实验"]);
const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);
const sqlString = (value) => "'" + String(value ?? "").replace(/'/g, "''") + "'";
const safeUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};
const slugify = (value, fallback) => {
  const slug = cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
};

const statements = works.filter((item) => item && typeof item === "object" && typeof item.title === "string").map((item, index) => {
  const slug = slugify(item.slug || item.id, "work-" + (index + 1));
  const title = cleanText(item.title, 120) || "未命名作品";
  const category = allowedCategories.has(item.category) ? item.category : "实验";
  const date = cleanText(item.date || item.work_date, 10);
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 30) : [];
  const description = cleanText(item.description, 5000);
  const coverUrl = safeUrl(item.cover_url || item.image);
  const shareUrl = safeUrl(item.share_url || item.link);
  const extractCode = cleanText(item.extract_code, 32);
  const showCode = item.show_extract_code === true ? 1 : 0;
  const status = item.status === "draft" ? "draft" : "published";

  return "INSERT INTO works (slug,title,category,work_date,tags_json,description,cover_url,share_url,extract_code,show_extract_code,status,updated_at) VALUES (" +
    [slug, title, category, date, JSON.stringify(tags), description, coverUrl, shareUrl, extractCode, showCode, status].map(sqlString).join(",") +
    ",CURRENT_TIMESTAMP) ON CONFLICT(slug) DO UPDATE SET " +
    "title=excluded.title,category=excluded.category,work_date=excluded.work_date,tags_json=excluded.tags_json," +
    "description=excluded.description,cover_url=excluded.cover_url,share_url=excluded.share_url,extract_code=excluded.extract_code," +
    "show_extract_code=excluded.show_extract_code,status=excluded.status,updated_at=CURRENT_TIMESTAMP;";
});

if (!statements.length) throw new Error("没有找到可导入的作品记录。");

const tempFile = path.join(os.tmpdir(), "favier-import-" + process.pid + ".sql");
await fs.writeFile(tempFile, statements.join("\n") + "\n", "utf8");

try {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(command, ["wrangler", "d1", "execute", "favier-archive", mode, "--file", tempFile], {
    cwd: backendDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  const code = await new Promise((resolve) => child.on("exit", resolve));
  if (code !== 0) process.exit(code ?? 1);
  console.log("导入完成：" + statements.length + " 条作品记录。");
} finally {
  await fs.rm(tempFile, { force: true });
}
