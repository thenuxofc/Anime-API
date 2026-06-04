const CREATOR = "THENUX";

const PROVIDERS = {
  kissanime: {
    name: "KissAnime",
    base: "https://kissanime.com.cv",
    searchUrl: (q) => `https://kissanime.com.cv/?s=${encodeURIComponent(q)}`,
    resultFilter: (href) => href.includes("kissanime.com.cv"),
    cleanTitle: (title) => title.replace(" - Kissanime", "").trim(),
    referer: "https://kissanime.com.cv/",
    fileName: "kissanime_video.mp4",
  },
  "9anime": {
    name: "9Anime",
    base: "https://9anime.me.uk",
    searchUrl: (q) => `https://9anime.me.uk/?s=${encodeURIComponent(q)}`,
    resultFilter: (href) => href.includes("9anime.me.uk"),
    cleanTitle: (title) => title.trim(),
    referer: "https://9anime.me.uk/",
    fileName: "9anime_video.mp4",
  },
  animeland: {
    name: "AnimeLand",
    base: "https://animeland.today",
    searchUrl: (q) => `https://animeland.today/search?keyword=${encodeURIComponent(q)}`,
    resultFilter: () => true,
    cleanTitle: (title) => title.trim(),
    referer: "https://animeland.today/",
    fileName: "animeland_video.mp4",
  },
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: jsonHeaders, body: "" };
  }

  const query = event.queryStringParameters || {};
  const providerKey = String(query.provider || query.site || "").toLowerCase();
  const action = String(query.action || "info").toLowerCase();
  const provider = PROVIDERS[providerKey];

  if (!provider) {
    return send(400, {
      creator: CREATOR,
      success: false,
      error: "Missing or invalid provider. Use provider=kissanime, provider=9anime, or provider=animeland.",
      examples: examples(event),
    });
  }

  try {
    if (action === "search") return await handleSearch(provider, query.q, event);
    if (action === "dl" || action === "details" || action === "extract") return await handleDetails(provider, query.url, event);
    if (action === "download") return await handleDownload(provider, query.url);

    return send(200, {
      creator: CREATOR,
      success: true,
      name: "THENUX Anime Scraper API",
      provider: providerKey,
      provider_name: provider.name,
      endpoints: examples(event, providerKey),
      note: "Use only for content you own, have permission to access, or content that is legally available in your region.",
    });
  } catch (err) {
    return send(500, {
      creator: CREATOR,
      success: false,
      error: err.message || "Internal server error",
    });
  }
};

function siteOrigin(event) {
  const proto = event.headers["x-forwarded-proto"] || "https";
  const host = event.headers.host || "localhost:8888";
  return `${proto}://${host}`;
}

function examples(event, provider = "kissanime") {
  const base = `${siteOrigin(event)}/api`;
  return {
    info: `${base}?provider=${provider}`,
    search: `${base}?provider=${provider}&action=search&q=naruto`,
    details: `${base}?provider=${provider}&action=dl&url=ANIME_PAGE_URL`,
    download_proxy: `${base}?provider=${provider}&action=download&url=DIRECT_MEDIA_URL`,
  };
}

function send(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...jsonHeaders, ...extraHeaders },
    body: JSON.stringify(data, null, 2),
  };
}

function userAgent() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
}

async function fetchHtml(url, referer) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": referer,
    },
  });
  if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
  return response.text();
}

async function handleSearch(provider, q, event) {
  if (!q) {
    return send(400, { creator: CREATOR, success: false, error: "Missing q query parameter." });
  }

  const html = await fetchHtml(provider.searchUrl(q), provider.referer);
  const results = provider.name === "AnimeLand" ? parseAnimeLandSearch(html, provider) : parseBasicSearch(html, provider);

  return send(200, {
    creator: CREATOR,
    success: true,
    type: "anime-search",
    provider: provider.name,
    query: q,
    total: results.length,
    results,
  }, { "Cache-Control": "public, max-age=1800" });
}

function parseBasicSearch(html, provider) {
  const results = [];
  const seen = new Set();
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>/gi)];

  for (const match of matches) {
    let url = absoluteUrl(match[1], provider.base);
    const title = decodeHtml(provider.cleanTitle(match[2] || ""));
    if (!title || seen.has(url) || !provider.resultFilter(url)) continue;
    seen.add(url);
    results.push({ title, url });
  }
  return results;
}

function parseAnimeLandSearch(html, provider) {
  const results = [];
  const seen = new Set();
  const richMatches = [...html.matchAll(/<a[^>]+href=["'](\/anime\/[^"']+)["'][^>]*>[\s\S]*?<img[^>]+alt=["']([^"']+)["']/gi)];

  for (const match of richMatches) {
    const url = absoluteUrl(match[1], provider.base);
    const title = decodeHtml(match[2].trim());
    if (!title || seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url });
  }

  if (results.length === 0) {
    const basicMatches = [...html.matchAll(/<a[^>]+href=["'](\/anime\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi)];
    for (const match of basicMatches) {
      const url = absoluteUrl(match[1], provider.base);
      const title = decodeHtml(match[2].trim());
      if (!title || seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url });
    }
  }
  return results;
}

async function handleDetails(provider, animeUrl, event) {
  if (!animeUrl) {
    return send(400, { creator: CREATOR, success: false, error: "Missing url query parameter." });
  }

  const html = await fetchHtml(animeUrl, provider.referer);
  const title = cleanPageTitle(extractMeta(html, "title") || extractTitle(html) || `${provider.name} Video`, provider.name);
  const thumbnail = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || "";
  const desc = decodeHtml(extractMeta(html, "og:description") || extractMeta(html, "description") || title);
  const links = extractEmbedLinks(html);

  if (Object.keys(links).length === 0) links.Fallback = animeUrl;

  return send(200, {
    creator: CREATOR,
    success: true,
    type: "anime-details",
    provider: provider.name,
    title,
    videoname: title,
    desc,
    thumbnail,
    source_url: animeUrl,
    links,
    note: "Links are extracted from public page embeds. Some servers may block external access or require browser playback.",
  }, { "Cache-Control": "public, max-age=1800" });
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? decodeHtml(match[1].trim()) : "";
}

function cleanPageTitle(title, providerName) {
  return decodeHtml(title.replace(` - ${providerName}`, "").replace(" - Kissanime", "").trim());
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtml(match[1].trim());
  }
  return "";
}

function extractEmbedLinks(html) {
  const links = {};
  let count = 1;
  const add = (raw) => {
    if (!raw) return;
    let src = decodeHtml(raw.trim());
    if (src.startsWith("//")) src = "https:" + src;
    if (!/^https?:\/\//i.test(src)) return;
    if (/facebook\.com|twitter\.com|doubleclick|googletagmanager/i.test(src)) return;
    if (Object.values(links).includes(src)) return;
    links[`Embed Server ${count++}`] = src;
  };

  for (const match of html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) add(match[1]);
  for (const match of html.matchAll(/data-video=["']([^"']+)["']/gi)) {
    try {
      const decoded = Buffer.from(match[1], "base64").toString("utf8");
      const iframe = decoded.match(/src=["']([^"']+)["']/i);
      add(iframe ? iframe[1] : decoded);
    } catch (_) {}
  }
  for (const match of html.matchAll(/(?:file|source|url)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi)) add(match[1]);
  return links;
}

async function handleDownload(provider, downloadUrl) {
  if (!downloadUrl) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ creator: CREATOR, success: false, error: "Missing url query parameter." }, null, 2) };
  }

  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": userAgent(),
      "Referer": provider.referer,
    },
  });

  if (!response.ok) {
    return { statusCode: response.status, headers: jsonHeaders, body: JSON.stringify({ creator: CREATOR, success: false, error: `Failed to fetch media. Status: ${response.status}` }, null, 2) };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": response.headers.get("content-type") || "application/octet-stream",
    "Content-Disposition": response.headers.get("content-disposition") || `attachment; filename="${provider.fileName}"`,
  };
  const length = response.headers.get("content-length");
  if (length) headers["Content-Length"] = length;

  const arrayBuffer = await response.arrayBuffer();
  return {
    statusCode: 200,
    headers,
    body: Buffer.from(arrayBuffer).toString("base64"),
    isBase64Encoded: true,
  };
}

function absoluteUrl(url, base) {
  try { return new URL(url, base).href; } catch (_) { return url; }
}

function decodeHtml(str = "") {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
