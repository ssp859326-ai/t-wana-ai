# T-wana AI

A fresh AI creative workspace built with React + Vite and Cloudflare Pages Functions.

## Features
- AI Chat with language-matched replies (Punjabi, Hindi, English)
- Image Studio with generated image preview and download
- Responsive futuristic dark interface
- Server-side API routes; API key never ships to the browser

## Deploy on Cloudflare Pages
1. Import this repository in Cloudflare Pages.
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Add a Pages environment variable named `GEMINI_API_KEY` (secret) with your Google AI Studio key.
5. Deploy.

The API endpoints are Cloudflare Pages Functions at `/api/chat` and `/api/image`.

## Local development
```bash
npm install
npm run dev
```

Developer: pindu-tiwana · Team: T-wana
