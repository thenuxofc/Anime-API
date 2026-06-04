# THENUX Anime Scraper API 🚀

A Netlify Functions API converted from the uploaded scraper files for:

- KissAnime
- 9Anime
- AnimeLand

All JSON responses include:

```json
{
  "creator": "THENUX",
  "success": true
}
```

> Use this project only for content you own, have permission to access, or content that is legally available in your region. This API does not bypass DRM or paid access.

## Deploy to Netlify

### Option 1: Drag and drop

1. Extract this ZIP.
2. Push the folder to GitHub.
3. Open Netlify.
4. Click **Add new site → Import an existing project**.
5. Select your GitHub repo.
6. Keep build settings default.
7. Deploy.

### Option 2: Netlify CLI

```bash
npm install
npx netlify dev
```

For production deploy:

```bash
npx netlify deploy --prod
```

## API Base URL

Local:

```txt
http://localhost:8888/api
```

After hosting:

```txt
https://YOUR-SITE.netlify.app/api
```

## Providers

| Provider | Value |
|---|---|
| KissAnime | `kissanime` |
| 9Anime | `9anime` |
| AnimeLand | `animeland` |

## Endpoints

### API Info

```txt
/api?provider=kissanime
```

### Search Anime

```txt
/api?provider=kissanime&action=search&q=naruto
/api?provider=9anime&action=search&q=one%20piece
/api?provider=animeland&action=search&q=demon%20slayer
```

Example response:

```json
{
  "creator": "THENUX",
  "success": true,
  "type": "anime-search",
  "provider": "KissAnime",
  "query": "naruto",
  "total": 1,
  "results": [
    {
      "title": "Naruto",
      "url": "https://example.com/anime/naruto"
    }
  ]
}
```

### Extract Details / Embed Links

```txt
/api?provider=kissanime&action=dl&url=ANIME_PAGE_URL
/api?provider=9anime&action=dl&url=ANIME_PAGE_URL
/api?provider=animeland&action=dl&url=ANIME_PAGE_URL
```

Example response:

```json
{
  "creator": "THENUX",
  "success": true,
  "type": "anime-details",
  "provider": "KissAnime",
  "title": "Anime Title",
  "videoname": "Anime Title",
  "desc": "Description here",
  "thumbnail": "https://example.com/image.jpg",
  "source_url": "https://example.com/anime/page",
  "links": {
    "Embed Server 1": "https://example.com/embed"
  }
}
```

### Download Proxy

```txt
/api?provider=kissanime&action=download&url=DIRECT_MEDIA_URL
```

This works only when the remote server allows external fetch access. Some servers block proxy downloads or require browser sessions.

## Project Structure

```txt
thenux-anime-netlify/
├─ netlify/
│  └─ functions/
│     └─ api.js
├─ public/
│  └─ index.html
├─ netlify.toml
├─ package.json
└─ README.md
```

## Notes

- Converted from Cloudflare Worker format to Netlify Functions.
- Added one unified endpoint instead of separate Worker routes.
- Added `creator: "THENUX"` to clean JSON responses.
- Added CORS headers.
- Added public landing page to test API.

## Made by

**THENUX** ⚡
