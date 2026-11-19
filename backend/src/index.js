const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=30, s-maxage=60"
};

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => "\\" + char);
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function toPublicWork(row) {
  return {
    id: row.slug,
    title: row.title,
    category: row.category,
    date: row.work_date || "",
    tags: parseTags(row.tags_json),
    description: row.description || "",
    image: row.cover_url || "",
    link: row.share_url || "",
    extract_code: row.show_extract_code ? (row.extract_code || "") : "",
    show_extract_code: Boolean(row.show_extract_code),
    updated_at: row.updated_at
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "GET") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "favier-archive-api", database: Boolean(env.DB) });
    }

    if (!env.DB) {
      return json({ ok: false, error: "Database binding DB is not configured" }, 503);
    }

    if (url.pathname === "/api/works") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
      const category = (url.searchParams.get("category") || "").trim().slice(0, 20);
      const page = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
      const pageSize = Math.max(1, Math.min(30, Number.parseInt(url.searchParams.get("page_size") || "24", 10) || 24));

      const conditions = ["status = 'published'"];
      const bindings = [];

      if (category && ["文字", "视觉", "设计", "实验"].includes(category)) {
        conditions.push("category = ?");
        bindings.push(category);
      }

      if (q) {
        const pattern = "%" + escapeLike(q) + "%";
        conditions.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR tags_json LIKE ? ESCAPE '\\')");
        bindings.push(pattern, pattern, pattern);
      }

      const where = conditions.join(" AND ");
      try {
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM works WHERE " + where
        ).bind(...bindings).first();

        const rows = await env.DB.prepare(
          "SELECT slug, title, category, work_date, tags_json, description, cover_url, share_url, extract_code, show_extract_code, updated_at " +
          "FROM works WHERE " + where +
          " ORDER BY COALESCE(work_date, '') DESC, updated_at DESC LIMIT ? OFFSET ?"
        ).bind(...bindings, pageSize, (page - 1) * pageSize).all();

        return json({
          ok: true,
          data: (rows.results || []).map(toPublicWork),
          pagination: {
            page,
            page_size: pageSize,
            total: countRow ? countRow.total : 0,
            total_pages: Math.ceil((countRow ? countRow.total : 0) / pageSize)
          }
        });
      } catch (error) {
        return json({ ok: false, error: "Database query failed", detail: error.message }, 500);
      }
    }

    const match = url.pathname.match(/^\/api\/works\/([a-zA-Z0-9_-]{1,100})$/);
    if (match) {
      try {
        const row = await env.DB.prepare(
          "SELECT slug, title, category, work_date, tags_json, description, cover_url, share_url, extract_code, show_extract_code, updated_at " +
          "FROM works WHERE slug = ? AND status = 'published' LIMIT 1"
        ).bind(match[1]).first();

        if (!row) return json({ ok: false, error: "Work not found" }, 404);
        return json({ ok: true, data: toPublicWork(row) });
      } catch (error) {
        return json({ ok: false, error: "Database query failed", detail: error.message }, 500);
      }
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
};
