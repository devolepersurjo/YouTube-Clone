/**
 * [USER PANEL] Global API & App Configuration
 * Note: Controlled in realtime via Firebase Database node 'app_config/active_api_key'
 */
export const API_CONFIG = {
  BASE_URL: "https://www.googleapis.com/youtube/v3",
  
  ENDPOINTS: {
    VIDEOS: "/videos",
    SEARCH: "/search",
    CHANNELS: "/channels",
    CATEGORIES: "/videoCategories"
  },

  DEFAULT_PARAMS: {
    regionCode: "BD",
    hl: "en",
    maxResults: 12,
    safeSearch: "moderate"
  },

  CACHE_TTL: {
    HOME_FEED: 1000 * 60 * 15,
    CATEGORIES: 1000 * 60 * 60 * 24,
    SEARCH: 1000 * 60 * 10
  }
};

export const APP_CONFIG = {
  appName: "YouTube Clone",
  version: "2.0.0",
  storagePrefix: "ytclone_"
};
