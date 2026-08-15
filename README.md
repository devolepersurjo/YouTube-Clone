# StreamPulse - Production Quality YouTube Client (Android/PWA)

A YouTube-style, fully modular, mobile-first Android video application powered by the official **YouTube Data API v3** and the **YouTube IFrame Embed Player API**.

---

## 1. Features
- **Real YouTube Data API v3 Integration**: Dynamic category fetching, high-res video thumbnails, channel statistics, live search suggestions, and pagination tokens (`nextPageToken`).
- **Android UX Patterns**: Skeleton shimmer loader states, Material 3 navigation bars, bottom-sheets, smooth touch ripple effects, and hardware back-button handling (`popstate`).
- **Dark Mode Support**: Automatically synchronizes with Android device preferences or user-selected settings.
- **Local Persistence Layer**: Saves search queries, watch history, liked videos, and channel subscriptions using localStorage.
- **No Scraping Policy**: Uses compliant Google IFrame embedding to stream video without breaking YouTube ToS.

---

## 2. API Key Configuration & Quota Management

### Centralized Config File
The API key is strictly maintained inside:
`config/api-config.js`

```javascript
export const API_CONFIG = {
  API_KEY: "AIzaSyBK5K0h4BQutcRHbVXmFJQmEkf46PtVqYk",
  ...
};