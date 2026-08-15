import { API_CONFIG } from '../config/api-config.js';
import { storage } from '../js/storage.js';
import { db } from '../config/firebase-config.js';

class YouTubeApiService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.activeApiKey = null;
    this.keyPool = []; // Multi-key pool from Firebase
    this.keyListeners = [];
    this.isKeyInitialized = false;

    this._initFirebaseKeyPoolListeners();
  }

  // 1. Realtime Listener for Multi-Key Pool & Active Key
  _initFirebaseKeyPoolListeners() {
    try {
      // Listen to the entire key pool
      db.ref('app_config/api_pool').on('value', (snapshot) => {
        const poolData = snapshot.val() || {};
        this.keyPool = Object.values(poolData).map(item => item.key.trim()).filter(Boolean);
      });

      // Listen to the currently active key
      db.ref('app_config/active_api_key').on('value', (snapshot) => {
        const key = snapshot.val();
        const prevKey = this.activeApiKey;
        this.activeApiKey = (key && typeof key === 'string' && key.trim()) ? key.trim() : null;
        this.isKeyInitialized = true;

        if (this.activeApiKey !== prevKey) {
          this.keyListeners.forEach(callback => callback(this.activeApiKey));
        }
      });
    } catch (e) {
      console.warn('Firebase key pool listener error:', e);
      this.isKeyInitialized = true;
    }
  }

  onApiKeyChanged(callback) {
    this.keyListeners.push(callback);
    if (this.isKeyInitialized) {
      callback(this.activeApiKey);
    }
  }

  getCurrentApiKey() {
    return this.activeApiKey;
  }

  // 2. Automatic Failover to Next Key when Quota Exceeded (403)
  async rotateToNextKey() {
    if (!this.keyPool || this.keyPool.length <= 1) {
      console.warn('No backup keys available in pool to rotate.');
      return false;
    }

    const currentIdx = this.keyPool.indexOf(this.activeApiKey);
    const nextIdx = (currentIdx + 1) % this.keyPool.length;
    const nextKey = this.keyPool[nextIdx];

    if (nextKey && nextKey !== this.activeApiKey) {
      console.log(`⚡ Quota exhausted on current key. Auto-switching to next key in pool: ${nextKey.slice(0, 8)}...`);
      this.activeApiKey = nextKey;
      
      // Update in Firebase Realtime Database so Admin Panel & all users sync instantly
      try {
        await db.ref('app_config/active_api_key').set(nextKey);
      } catch (e) {
        console.warn('Failed to publish rotated key to Firebase:', e);
      }
      return true;
    }
    return false;
  }

  // 3. Centralized HTTP GET with Auto-Retry Failover on Quota Limit
  async _get(endpoint, params = {}, retryCount = 0) {
    const currentKey = this.getCurrentApiKey();
    if (!currentKey) {
      const noKeyError = new Error("No active YouTube API Key set. Please add API Keys from the Admin Panel.");
      noKeyError.code = "NO_API_KEY";
      throw noKeyError;
    }

    const settings = storage.getSettings();
    const url = new URL(`${this.baseUrl}${endpoint}`);

    const mergedParams = {
      key: currentKey,
      regionCode: settings.regionCode || API_CONFIG.DEFAULT_PARAMS.regionCode,
      hl: API_CONFIG.DEFAULT_PARAMS.hl,
      ...params
    };

    Object.keys(mergedParams).forEach(key => {
      if (mergedParams[key] !== undefined && mergedParams[key] !== null) {
        url.searchParams.append(key, mergedParams[key]);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        // Quota Limit Reached (403): Automatically rotate key and retry!
        if (response.status === 403) {
          if (retryCount < this.keyPool.length) {
            const hasRotated = await this.rotateToNextKey();
            if (hasRotated) {
              return this._get(endpoint, params, retryCount + 1); // Retry with new key
            }
          }
          const quotaErr = new Error("All YouTube API keys in the pool have exceeded daily quota.");
          quotaErr.code = 403;
          throw quotaErr;
        }

        const error = new Error(data.error?.message || 'Failed to fetch data');
        error.code = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      if (!navigator.onLine) {
        const netError = new Error('No internet connection.');
        netError.code = 'OFFLINE';
        throw netError;
      }
      throw err;
    }
  }

  async _batchAttachChannelAvatars(items) {
    if (!items || items.length === 0) return items;
    const channelIds = [...new Set(items.map(i => i.channelId).filter(Boolean))];
    if (channelIds.length === 0) return items;

    try {
      const channelData = await this._get(API_CONFIG.ENDPOINTS.CHANNELS, {
        part: 'snippet',
        id: channelIds.join(',')
      });

      const avatarMap = {};
      (channelData.items || []).forEach(ch => {
        avatarMap[ch.id] = ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url || '';
      });

      return items.map(item => ({
        ...item,
        channelAvatar: avatarMap[item.channelId] || ''
      }));
    } catch (e) {
      return items;
    }
  }

  getSearchSuggestions(query) {
    return new Promise((resolve) => {
      if (!query || !query.trim()) {
        resolve([]);
        return;
      }

      const callbackName = 'yt_suggest_' + Math.floor(Math.random() * 1000000);
      const script = document.createElement('script');
      script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&jsonp=${callbackName}`;

      window[callbackName] = (data) => {
        try {
          const suggestions = (data && data[1]) ? data[1].map(item => item[0]) : [];
          resolve(suggestions);
        } catch (e) {
          resolve([]);
        } finally {
          delete window[callbackName];
          if (document.body.contains(script)) document.body.removeChild(script);
        }
      };

      script.onerror = () => {
        resolve([]);
        try {
          delete window[callbackName];
          if (document.body.contains(script)) document.body.removeChild(script);
        } catch (e) {}
      };

      document.body.appendChild(script);
    });
  }

  async getVideoComments(videoId) {
    try {
      const data = await this._get('/commentThreads', {
        part: 'snippet',
        videoId: videoId,
        maxResults: 20,
        order: 'relevance'
      });

      return (data.items || []).map(item => {
        const top = item.snippet?.topLevelComment?.snippet;
        return {
          id: item.id,
          authorName: top?.authorDisplayName || 'User',
          authorAvatar: top?.authorProfileImageUrl || '',
          text: top?.textDisplay || '',
          likeCount: YouTubeApiService.formatViews(top?.likeCount || '0'),
          timeAgo: YouTubeApiService.timeAgo(top?.publishedAt)
        };
      });
    } catch (e) {
      return [];
    }
  }

  async getPopularVideos(pageToken = '', categoryId = null) {
    const cacheKey = `feed_${categoryId || '0'}_${pageToken || 'p0'}`;
    const cached = storage.getCache(cacheKey);
    if (cached) return cached;

    const params = {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      maxResults: API_CONFIG.DEFAULT_PARAMS.maxResults,
      pageToken: pageToken || undefined
    };

    if (categoryId && categoryId !== '0') {
      params.videoCategoryId = categoryId;
    }

    const data = await this._get(API_CONFIG.ENDPOINTS.VIDEOS, params);
    let items = data.items.map(this._formatVideoItem);
    items = await this._batchAttachChannelAvatars(items);

    const result = {
      items,
      nextPageToken: data.nextPageToken || null
    };

    storage.setCache(cacheKey, result, API_CONFIG.CACHE_TTL.HOME_FEED);
    return result;
  }

  async getCombinedPersonalizedFeed(pageToken = '') {
    const searchHistory = storage.getSearchHistory();
    const likedVideos = storage.getLikedVideos();
    const subs = storage.getSubscriptions();

    const interests = [];
    searchHistory.slice(0, 20).forEach(q => interests.push(q));
    likedVideos.slice(0, 15).forEach(v => interests.push(v.title.slice(0, 25)));
    subs.slice(0, 15).forEach(c => interests.push(c.title));

    if (interests.length === 0) {
      return this.getPopularVideos(pageToken);
    }

    const randomKeyword = interests[Math.floor(Math.random() * interests.length)];
    return this.search(randomKeyword, pageToken, 'video');
  }

  async getCategories() {
    const cacheKey = `categories_${storage.getSettings().regionCode}`;
    const cached = storage.getCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(API_CONFIG.ENDPOINTS.CATEGORIES, { part: 'snippet' });
    const apiCategories = data.items
      .filter(c => c.snippet.assignable)
      .map(c => ({ id: c.id, title: c.snippet.title }));

    const userSearches = storage.getSearchHistory().slice(0, 4).map((q, idx) => ({
      id: `custom_search_${idx}`,
      title: q,
      isCustomQuery: true
    }));

    const valid = [{ id: '0', title: 'All' }, ...userSearches, ...apiCategories];
    storage.setCache(cacheKey, valid, API_CONFIG.CACHE_TTL.CATEGORIES);
    return valid;
  }

  async getPersonalizedShortsFeed(pageToken = '') {
    const searchHistory = storage.getSearchHistory();
    const likedVideos = storage.getLikedVideos();

    const keywords = [];
    searchHistory.slice(0, 5).forEach(q => keywords.push(q));
    likedVideos.slice(0, 5).forEach(v => keywords.push(v.title.slice(0, 20)));

    const queryTerm = keywords.length > 0 
      ? `#shorts ${keywords[Math.floor(Math.random() * keywords.length)]}` 
      : '#shorts trending';

    return this.search(queryTerm, pageToken, 'video');
  }

  async search(query, pageToken = '', type = 'video', filters = {}) {
    const params = {
      part: 'snippet',
      q: query,
      maxResults: API_CONFIG.DEFAULT_PARAMS.maxResults,
      type: filters.type && filters.type !== 'all' ? filters.type : type,
      pageToken: pageToken || undefined
    };

    if (filters.duration && filters.duration !== 'any') {
      params.videoDuration = filters.duration;
    }
    if (filters.order && filters.order !== 'relevance') {
      params.order = filters.order;
    }
    if (filters.uploadDate && filters.uploadDate !== 'anytime') {
      const now = new Date();
      if (filters.uploadDate === 'hour') now.setHours(now.getHours() - 1);
      else if (filters.uploadDate === 'today') now.setDate(now.getDate() - 1);
      else if (filters.uploadDate === 'week') now.setDate(now.getDate() - 7);
      else if (filters.uploadDate === 'month') now.setMonth(now.getMonth() - 1);
      else if (filters.uploadDate === 'year') now.setFullYear(now.getFullYear() - 1);
      params.publishedAfter = now.toISOString();
    }

    const data = await this._get(API_CONFIG.ENDPOINTS.SEARCH, params);
    const videoIds = data.items.filter(i => i.id.kind === 'youtube#video').map(i => i.id.videoId).join(',');
    let statsMap = {};

    if (videoIds) {
      try {
        const statsData = await this._get(API_CONFIG.ENDPOINTS.VIDEOS, {
          part: 'contentDetails,statistics',
          id: videoIds
        });
        (statsData.items || []).forEach(item => {
          statsMap[item.id] = {
            duration: YouTubeApiService.parseDuration(item.contentDetails?.duration),
            viewCount: YouTubeApiService.formatViews(item.statistics?.viewCount || '0')
          };
        });
      } catch (e) {}
    }

    let items = data.items.map(item => {
      const id = item.id.videoId || item.id.channelId || item.id.playlistId;
      const stats = statsMap[id] || {};
      return {
        id,
        kind: item.id.kind,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        timeAgo: YouTubeApiService.timeAgo(item.snippet.publishedAt),
        duration: stats.duration || '',
        viewCount: stats.viewCount || ''
      };
    });

    items = await this._batchAttachChannelAvatars(items);

    return {
      items,
      nextPageToken: data.nextPageToken || null
    };
  }

  async getVideoDetails(videoId) {
    const cacheKey = `video_${videoId}`;
    const cached = storage.getCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(API_CONFIG.ENDPOINTS.VIDEOS, {
      part: 'snippet,contentDetails,statistics',
      id: videoId
    });

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found or is private.');
    }

    const formatted = this._formatVideoItem(data.items[0]);
    try {
      const channel = await this.getChannelDetails(formatted.channelId);
      formatted.channelAvatar = channel.avatar;
      formatted.channelSubscriberCount = channel.subscriberCount;
    } catch (e) {
      formatted.channelAvatar = '';
    }

    storage.setCache(cacheKey, formatted, 1000 * 60 * 30);
    return formatted;
  }

  async getRelatedVideos(videoId, categoryId = '') {
    return this.getPopularVideos('', categoryId || null);
  }

  async getChannelDetails(channelId) {
    const cacheKey = `channel_${channelId}`;
    const cached = storage.getCache(cacheKey);
    if (cached) return cached;

    const data = await this._get(API_CONFIG.ENDPOINTS.CHANNELS, {
      part: 'snippet,statistics,brandingSettings',
      id: channelId
    });

    if (!data.items || data.items.length === 0) {
      throw new Error('Channel not found.');
    }

    const item = data.items[0];
    const details = {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      avatar: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      banner: item.brandingSettings?.image?.bannerExternalUrl || null,
      subscriberCount: YouTubeApiService.formatViews(item.statistics?.subscriberCount || '0'),
      videoCount: item.statistics?.videoCount || '0',
      viewCount: item.statistics?.viewCount || '0'
    };

    storage.setCache(cacheKey, details, 1000 * 60 * 60);
    return details;
  }

  async getChannelVideos(channelId, pageToken = '') {
    const params = {
      part: 'snippet',
      channelId: channelId,
      maxResults: 10,
      order: 'date',
      type: 'video',
      pageToken: pageToken || undefined
    };

    const data = await this._get(API_CONFIG.ENDPOINTS.SEARCH, params);
    let items = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      timeAgo: YouTubeApiService.timeAgo(item.snippet.publishedAt)
    }));

    items = await this._batchAttachChannelAvatars(items);

    return {
      items,
      nextPageToken: data.nextPageToken || null
    };
  }

  async getSubscribedFeed(subscribedChannels = []) {
    if (!subscribedChannels || subscribedChannels.length === 0) {
      return { items: [] };
    }

    const channelPromises = subscribedChannels.slice(0, 5).map(c => 
      this.getChannelVideos(c.id).catch(() => ({ items: [] }))
    );

    const results = await Promise.all(channelPromises);
    let mixedVideos = [];
    results.forEach(res => {
      mixedVideos.push(...(res.items || []));
    });

    mixedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return { items: mixedVideos };
  }

  _formatVideoItem(item) {
    return {
      id: typeof item.id === 'string' ? item.id : item.id?.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      timeAgo: YouTubeApiService.timeAgo(item.snippet.publishedAt),
      duration: YouTubeApiService.parseDuration(item.contentDetails?.duration),
      viewCount: YouTubeApiService.formatViews(item.statistics?.viewCount || '0'),
      likeCount: YouTubeApiService.formatViews(item.statistics?.likeCount || '0'),
      commentCount: YouTubeApiService.formatViews(item.statistics?.commentCount || '0'),
      categoryId: item.snippet.categoryId
    };
  }

  static parseDuration(isoStr) {
    if (!isoStr) return '';
    const match = isoStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    const hours = parseInt(match[1] || 0, 10);
    const minutes = parseInt(match[2] || 0, 10);
    const seconds = parseInt(match[3] || 0, 10);

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${minutes}:${pad(seconds)}`;
  }

  static formatViews(views) {
    const num = parseInt(views, 10);
    if (isNaN(num)) return '0';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  }

  static timeAgo(isoDate) {
    if (!isoDate) return '';
    const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    return 'Just now';
  }
}

export const youtubeApi = new YouTubeApiService();