import { APP_CONFIG, API_CONFIG } from '../config/api-config.js';
import { db } from '../config/firebase-config.js';

class StorageService {
  constructor() {
    this.prefix = APP_CONFIG.storagePrefix;
    this.currentUserId = null;
  }

  setCurrentUser(user) {
    this.currentUserId = user ? user.uid : null;
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this._getKey(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this._getKey(key), JSON.stringify(value));
    } catch (e) {}
  }

  remove(key) {
    try {
      localStorage.removeItem(this._getKey(key));
    } catch (e) {}
  }

  clearUserDataOnLogout() {
    this.currentUserId = null;
    this.set('watch_history', []);
    this.set('liked_videos', []);
    this.set('disliked_videos', []);
    this.set('liked_shorts', []);
    this.set('custom_playlists', { 'Watch Later': [] });
    this.set('subscriptions', []);
    this.remove('cached_home_videos');
  }

  // --- Watch History ---
  getWatchHistory() {
    const list = this.get('watch_history', []);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return list.filter(item => (item.watchedAt || 0) >= thirtyDaysAgo);
  }

  async addToHistory(video) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let list = this.getWatchHistory().filter(v => v.id !== video.id && (v.watchedAt || 0) >= thirtyDaysAgo);
    
    list.unshift({ ...video, watchedAt: Date.now() });
    if (list.length > 150) list.pop();
    this.set('watch_history', list);

    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/watchHistory`).set(list);
      } catch (e) {}
    }
  }

  async clearWatchHistory() {
    this.set('watch_history', []);
    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/watchHistory`).remove();
      } catch (e) {}
    }
  }

  // --- Liked Shorts Storage ---
  getLikedShorts() {
    return this.get('liked_shorts', []);
  }

  async toggleLikeShort(short) {
    let list = this.getLikedShorts();
    const exists = list.some(s => s.id === short.id);
    if (exists) {
      list = list.filter(s => s.id !== short.id);
    } else {
      list.unshift({ ...short, likedAt: Date.now() });
    }
    this.set('liked_shorts', list);

    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/likedShorts`).set(list);
      } catch (e) {}
    }
    return !exists;
  }

  isShortLiked(shortId) {
    return this.getLikedShorts().some(s => s.id === shortId);
  }

  // --- Custom Playlists ---
  getCustomPlaylists() {
    return this.get('custom_playlists', {
      'Watch Later': []
    });
  }

  async createPlaylist(categoryName) {
    if (!categoryName || !categoryName.trim()) return;
    const cleanName = categoryName.trim();
    const playlists = this.getCustomPlaylists();
    if (!playlists[cleanName]) {
      playlists[cleanName] = [];
      this.set('custom_playlists', playlists);
      this._syncPlaylistsToFirebase();
    }
  }

  async saveVideoToPlaylist(categoryName, video) {
    const playlists = this.getCustomPlaylists();
    if (!playlists[categoryName]) {
      playlists[categoryName] = [];
    }
    const exists = playlists[categoryName].some(v => v.id === video.id);
    if (!exists) {
      playlists[categoryName].unshift(video);
      this.set('custom_playlists', playlists);
      this._syncPlaylistsToFirebase();
      return true;
    }
    return false;
  }

  isVideoInAnyPlaylist(videoId) {
    const playlists = this.getCustomPlaylists();
    return Object.values(playlists).some(arr => arr.some(v => v.id === videoId));
  }

  async _syncPlaylistsToFirebase() {
    if (this.currentUserId) {
      try {
        const playlists = this.getCustomPlaylists();
        await db.ref(`users/${this.currentUserId}/playlists`).set(playlists);
      } catch (e) {}
    }
  }

  // --- Liked Videos ---
  getLikedVideos() {
    return this.get('liked_videos', []);
  }

  async toggleLike(video) {
    let list = this.getLikedVideos();
    const exists = list.some(v => v.id === video.id);
    if (exists) {
      list = list.filter(v => v.id !== video.id);
    } else {
      list.unshift({ ...video, likedAt: Date.now() });
      this.removeFromDislikes(video.id);
    }
    this.set('liked_videos', list);

    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/likedVideos`).set(list);
      } catch (e) {}
    }
    return !exists;
  }

  isLiked(videoId) {
    return this.getLikedVideos().some(v => v.id === videoId);
  }

  // --- Disliked Videos ---
  getDislikedVideos() {
    return this.get('disliked_videos', []);
  }

  async toggleDislike(video) {
    let list = this.getDislikedVideos();
    const exists = list.some(v => v.id === video.id);
    if (exists) {
      list = list.filter(v => v.id !== video.id);
    } else {
      list.unshift({ ...video, dislikedAt: Date.now() });
      if (this.isLiked(video.id)) {
        this.toggleLike(video);
      }
    }
    this.set('disliked_videos', list);

    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/dislikedVideos`).set(list);
      } catch (e) {}
    }
    return !exists;
  }

  removeFromDislikes(videoId) {
    let list = this.getDislikedVideos().filter(v => v.id !== videoId);
    this.set('disliked_videos', list);
    if (this.currentUserId) {
      db.ref(`users/${this.currentUserId}/dislikedVideos`).set(list).catch(() => {});
    }
  }

  isDisliked(videoId) {
    return this.getDislikedVideos().some(v => v.id === videoId);
  }

  // --- Subscriptions ---
  getSubscriptions() {
    return this.get('subscriptions', []);
  }

  async toggleSubscription(channel) {
    let list = this.getSubscriptions();
    const idx = list.findIndex(c => c.id === channel.id);
    let isSubscribed = false;

    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        id: channel.id,
        title: channel.title || 'YouTube Channel',
        avatar: channel.avatar || channel.channelAvatar || '',
        subscribedAt: Date.now()
      });
      isSubscribed = true;
    }
    this.set('subscriptions', list);

    if (this.currentUserId) {
      try {
        await db.ref(`users/${this.currentUserId}/subscriptions`).set(list);
      } catch (e) {}
    }
    return isSubscribed;
  }

  isSubscribed(channelId) {
    return this.getSubscriptions().some(c => c.id === channelId);
  }

  async syncUserDataFromCloud(userId) {
    this.currentUserId = userId;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    try {
      const snapshot = await db.ref(`users/${userId}`).once('value');
      const data = snapshot.val();
      if (!data) return;

      if (data.watchHistory) {
        let history = Array.isArray(data.watchHistory) ? data.watchHistory : Object.values(data.watchHistory);
        history = history.filter(item => (item.watchedAt || 0) >= thirtyDaysAgo);
        this.set('watch_history', history);
      }
      if (data.playlists) {
        this.set('custom_playlists', data.playlists);
      }
      if (data.likedVideos) {
        this.set('liked_videos', Array.isArray(data.likedVideos) ? data.likedVideos : Object.values(data.likedVideos));
      }
      if (data.dislikedVideos) {
        this.set('disliked_videos', Array.isArray(data.dislikedVideos) ? data.dislikedVideos : Object.values(data.dislikedVideos));
      }
      if (data.likedShorts) {
        this.set('liked_shorts', Array.isArray(data.likedShorts) ? data.likedShorts : Object.values(data.likedShorts));
      }
      if (data.subscriptions) {
        this.set('subscriptions', Array.isArray(data.subscriptions) ? data.subscriptions : Object.values(data.subscriptions));
      }
    } catch (e) {}
  }

  getSearchHistory() {
    return this.get('search_history', []);
  }

  addSearchQuery(query) {
    if (!query || !query.trim()) return;
    let list = this.getSearchHistory().filter(q => q.toLowerCase() !== query.toLowerCase());
    list.unshift(query.trim());
    if (list.length > 50) list.pop();
    this.set('search_history', list);
  }

  clearSearchHistoryLocal() {
    this.set('search_history', []);
  }

  getSettings() {
    return this.get('app_settings', {
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      regionCode: API_CONFIG.DEFAULT_PARAMS.regionCode,
      autoplay: true
    });
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    this.set('app_settings', updated);
    return updated;
  }

  getCache(key) {
    const cached = this.get(`cache_${key}`);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      localStorage.removeItem(this._getKey(`cache_${key}`));
      return null;
    }
    return cached.data;
  }

  setCache(key, data, ttlMs) {
    this.set(`cache_${key}`, {
      data,
      expiry: Date.now() + ttlMs
    });
  }
}

export const storage = new StorageService();