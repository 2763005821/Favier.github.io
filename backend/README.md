# Favier Archive API

GitHub Pages 前端 + Cloudflare Workers API + Cloudflare D1 数据库。实际作品文件继续放在百度网盘，本项目只保存作品元数据、封面 URL 和分享链接。

## 目录

- \`src/index.js\`：只读公开 API。
- \`migrations/0001_initial.sql\`：D1 数据表。
- \`scripts/import-works.mjs\`：从网站导出的 JSON 备份批量导入作品。
- \`wrangler.toml\`：Workers 与 D1 配置。

## 1. 准备

安装 Node.js 20 或更高版本，然后在此目录执行：

\`\`\`bash
npm install
npx wrangler login
\`\`\`

Wrangler 4.x 用于本项目。

## 2. 创建 D1

\`\`\`bash
npm run db:create
\`\`\`

命令输出会包含 database_id。把它复制到 \`wrangler.toml\` 的 \`database_id\`，替换 \`REPLACE_WITH_D1_DATABASE_ID\`。

## 3. 创建数据库表

先在本地验证：

\`\`\`bash
npm run db:migrate:local
\`\`\`

然后创建远程表：

\`\`\`bash
npm run db:migrate:remote
\`\`\`

## 4. 本地运行和测试

\`\`\`bash
npm run dev
\`\`\`

检查：

- \`http://localhost:8787/api/health\`
- \`http://localhost:8787/api/works\`
- \`http://localhost:8787/api/works?q=夏恋\`

## 5. 部署

\`\`\`bash
npm run deploy
\`\`\`

部署成功后 Wrangler 会显示类似 \`https://favier-archive-api.<你的账户>.workers.dev\` 的地址。

检查：

\`\`\`text
https://你的-worker地址/api/health
https://你的-worker地址/api/works
\`\`\`

## 6. 让 GitHub Pages 使用 API

打开仓库根目录的 \`index.html\`，找到：

\`\`\`js
const API_BASE_URL = "";
\`\`\`

把空字符串替换成实际 Worker 根地址，例如：

\`\`\`js
const API_BASE_URL = "https://favier-archive-api.your-subdomain.workers.dev";
\`\`\`

提交后 GitHub Pages 会自动发布更新。API 是公开只读接口；不要把 Cloudflare API Token、数据库凭据或管理员密钥写入前端。

## 7. 导入作品

先在网站原来的本地模式点击“导出数据”，得到 \`personal-archive-backup.json\`。将文件放在本机任意位置，在 backend 目录执行：

\`\`\`bash
npm run db:import:remote -- "C:/path/to/personal-archive-backup.json"
\`\`\`

也可以用 \`--local\` 导入 Wrangler 本地数据库。导入脚本会将原有的 \`link\` 字段映射为 \`share_url\`，并将普通作品默认设为 published。需要暂不公开的记录，可在 JSON 对应对象中设置 \`"status": "draft"\`。

字段说明：
- \`share_url\`：百度网盘分享链接。
- \`extract_code\`：提取码。
- \`show_extract_code\`：只有设为 \`true\` 时，公开 API 才返回提取码。
- \`cover_url\`：建议使用 HTTPS 图片地址；不再把大尺寸 base64 图片存进 D1。
- \`status\`：\`published\` 或 \`draft\`。

## API

### GET /api/health

返回服务状态。

### GET /api/works

参数：
- \`q\`：标题、简介和标签关键词，最多 80 个字符。
- \`category\`：文字、视觉、设计、实验。
- \`page\`：页码。
- \`page_size\`：每页条数，最大 30。

只返回 \`published\` 作品。搜索使用 SQLite LIKE，适合当前小型中文作品目录；数据量显著增长后再评估专门的中文全文检索方案。

### GET /api/works/:slug

获取一件公开作品。

## 当前阶段的安全边界

- API 只开放 GET 和 OPTIONS，不提供匿名写入、编辑或删除接口。
- 网站远程模式下会隐藏本地添加/删除入口，避免误以为本地改动已经同步到云端。
- 数据写入先通过 Wrangler/D1 导入脚本完成。下一阶段再增加管理员身份验证和在线作品管理。
- CORS 不是身份验证；公开作品的分享链接本身仍可被访问者复制。
- 百度网盘分享链接是否有效、是否允许下载，仍由百度网盘控制。
