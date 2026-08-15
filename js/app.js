import { youtubeApi } from '../services/youtube-api.js';
import { authService } from '../services/auth-service.js';
import { storage } from './storage.js';
import { Icons } from '../components/icons.js';
import { UI } from '../components/ui-components.js';
import { playerManager } from './player.js';
import { NavigationManager } from './navigation.js';

class YouTubeCloneApp {
  constructor() {
    this.currentTab = 'home';
    this.activeCategory = '0';
    this.nextPageToken = null;
    this.isLoadingMore = false;
    this.isPlayerOpen = false;
    this.isBottomSheetOpen = false;
    this.activeActionVideo = null;
    this.currentUser = authService.currentUser;
    this.currentSearchQuery = '';
    
    this.cachedHomeVideos = storage.get('cached_home_videos', []);
    this.cachedCategory = storage.get('cached_home_cat', '0');
    this.cachedShorts = storage.get('cached_shorts_list', []);

    this.activeSearchFilters = {
      type: 'all',
      duration: 'any',
      uploadDate: 'anytime',
      order: 'relevance'
    };

    this.nav = new NavigationManager(this);
    this.init();
  }

  async init() {
    this.renderSplashScreen();
    this.applyTheme();
    this.renderTopAppBar();
    this.renderBottomNavigation();
    this.setupEventListeners();

    this.renderHomeShell(true);

    window.addEventListener('google-signin-success', async (e) => {
      const { user, payload } = e.detail;
      this.currentUser = user;
      storage.setCurrentUser(user);
      await storage.syncUserDataFromCloud(user.uid);

      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.remove('visible');

      this.renderBottomNavigation();
      if (this.currentTab === 'library') {
        this.loadLibraryView();
      }
      this.showSnackbar(`Signed in as ${payload?.name || user?.displayName || 'Google User'}!`);
    });

    window.addEventListener('google-signin-failed', (e) => {
      const googleBtn = document.getElementById('btn-auth-google');
      const errorMsg = document.getElementById('auth-error-msg');
      if (googleBtn) {
        googleBtn.classList.remove('btn-loading');
        googleBtn.innerHTML = `${Icons.Google()} <span>Continue with Google</span>`;
      }
      if (errorMsg) {
        errorMsg.textContent = e.detail.message;
        errorMsg.style.display = 'block';
      }
    });

    authService.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      storage.setCurrentUser(user);

      if (user) {
        await storage.syncUserDataFromCloud(user.uid);
      }

      this.renderBottomNavigation();
      if (this.currentTab === 'library') {
        this.loadLibraryView();
      }
    });

    youtubeApi.onApiKeyChanged(async (apiKey) => {
      if (apiKey) {
        this.cachedHomeVideos = [];
        this.cachedShorts = [];
        await this.loadHomeCategories();
        this.loadHomeFeed(true);
      } else {
        const feed = document.getElementById('video-feed');
        if (feed) {
          feed.innerHTML = UI.renderError(
            "No active YouTube API Key set. Please configure an API Key from the Admin Panel.",
            'window.app.retryHomeFeed'
          );
        }
      }
    });
  }

  requireAuth(actionName = 'perform this action') {
    if (!this.currentUser) {
      this.showSnackbar(`Please sign in to ${actionName}`);
      this.openAuthModal('login');
      return false;
    }
    return true;
  }

  renderSplashScreen() {
    const splash = document.createElement('div');
    splash.id = 'yt-splash-screen';
    splash.className = 'yt-splash-screen';
    splash.innerHTML = `
      <div class="splash-logo-wrap">
        <svg width="68" height="48" viewBox="0 0 28 20" fill="none">
          <path d="M27.4 3.1c-.3-1.2-1.2-2.1-2.4-2.4C22.9.1 14 .1 14 .1s-8.9 0-11 .6C1.8 1 0.9 1.9.6 3.1.1 5.2 0 10 0 10s.1 4.8.6 6.9c.3 1.2 1.2 2.1 2.4 2.4 2.1.6 11 .6 11 .6s8.9 0 11-.6c1.2-.3 2.1-1.2 2.4-2.4.5-2.1.6-6.9.6-6.9s-.1-4.8-.6-6.9z" fill="#FF0000"/>
          <polygon points="11.2,14.3 18.5,10 11.2,5.7" fill="#FFFFFF"/>
        </svg>
      </div>
    `;
    document.body.appendChild(splash);

    setTimeout(() => {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 400);
    }, 700);
  }

  applyTheme() {
    const settings = storage.getSettings();
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  }

  showSnackbar(message) {
    let snackbar = document.getElementById('yt-snackbar');
    if (!snackbar) {
      snackbar = document.createElement('div');
      snackbar.id = 'yt-snackbar';
      snackbar.className = 'yt-snackbar-toast';
      document.body.appendChild(snackbar);
    }
    snackbar.textContent = message;
    snackbar.classList.add('show');

    clearTimeout(this._snackbarTimeout);
    this._snackbarTimeout = setTimeout(() => {
      snackbar.classList.remove('show');
    }, 2800);
  }

  // --- Top App Bar ---
  renderTopAppBar(isSearchMode = false, hasSearchResults = false) {
    const topBar = document.getElementById('top-bar');

    if (isSearchMode) {
      topBar.innerHTML = `
        <div class="top-search-bar-row">
          <button class="icon-btn search-back-btn" id="btn-search-back">${Icons.Back()}</button>
          
          <div class="search-pill-container">
            <input type="search" id="top-search-input" placeholder="Search YouTube" autocomplete="off" value="${this.currentSearchQuery || ''}" />
            <button class="clear-input-btn" id="btn-clear-search-text" style="${this.currentSearchQuery ? 'display:flex;' : 'display:none;'}">
              ${Icons.Close()}
            </button>
          </div>

          <button class="mic-icon-btn" id="btn-voice-search" aria-label="Voice search">
            ${Icons.Mic()}
          </button>

          ${hasSearchResults ? `
            <button class="icon-btn" id="btn-search-filters" aria-label="Search Filters">
              ${Icons.MoreVert()}
            </button>
          ` : ''}
        </div>
      `;

      const input = document.getElementById('top-search-input');
      const clearTextBtn = document.getElementById('btn-clear-search-text');
      const backBtn = document.getElementById('btn-search-back');
      const micBtn = document.getElementById('btn-voice-search');
      const filterBtn = document.getElementById('btn-search-filters');

      backBtn.addEventListener('click', () => {
        this.currentSearchQuery = '';
        this.switchTab('home');
      });

      if (filterBtn) {
        filterBtn.addEventListener('click', () => this.openSearchFiltersModal());
      }

      const handleExecute = () => {
        const q = input.value.trim();
        if (q) {
          this.currentSearchQuery = q;
          this.executeSearchQuery(q);
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
          handleExecute();
        }
      });

      clearTextBtn.addEventListener('click', () => {
        input.value = '';
        this.currentSearchQuery = '';
        clearTextBtn.style.display = 'none';
        input.focus();
        const suggBox = document.getElementById('search-suggestions-box');
        const histBox = document.getElementById('search-history-container');
        if (suggBox) suggBox.style.display = 'none';
        if (histBox) histBox.style.display = 'block';
      });

      micBtn.addEventListener('click', () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.lang = 'en-US';
          recognition.start();
          input.placeholder = 'Listening...';
          recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            clearTextBtn.style.display = 'flex';
            this.currentSearchQuery = transcript;
            this.executeSearchQuery(transcript);
          };
          recognition.onend = () => {
            input.placeholder = 'Search YouTube';
          };
        } else {
          this.showSnackbar('Voice search not supported in this browser.');
        }
      });

      if (!hasSearchResults) input.focus();

      let debounceTimer;
      input.addEventListener('input', () => {
        const q = input.value.trim();
        clearTextBtn.style.display = input.value.length > 0 ? 'flex' : 'none';

        clearTimeout(debounceTimer);
        const suggBox = document.getElementById('search-suggestions-box');
        const histBox = document.getElementById('search-history-container');

        if (!q) {
          if (suggBox) suggBox.style.display = 'none';
          if (histBox) histBox.style.display = 'block';
          return;
        }

        debounceTimer = setTimeout(async () => {
          const suggestions = await youtubeApi.getSearchSuggestions(q);
          if (suggestions.length > 0 && input.value.trim() === q) {
            if (histBox) histBox.style.display = 'none';
            if (suggBox) {
              suggBox.style.display = 'block';
              suggBox.innerHTML = suggestions.slice(0, 8).map(s => `
                <div class="search-item-row ripple suggestion-item" data-query="${UI.escapeHtml(s)}">
                  <div style="display: flex; gap: 12px; align-items: center;">
                    ${Icons.Search()}
                    <span>${UI.escapeHtml(s)}</span>
                  </div>
                </div>
              `).join('');

              suggBox.querySelectorAll('.suggestion-item').forEach(el => {
                el.addEventListener('click', () => {
                  const query = el.getAttribute('data-query');
                  input.value = query;
                  clearTextBtn.style.display = 'flex';
                  this.currentSearchQuery = query;
                  this.executeSearchQuery(query);
                });
              });
            }
          }
        }, 180);
      });

    } else {
      topBar.innerHTML = `
        <div class="brand-section" id="btn-brand-home">
          ${Icons.YouTubeLogo()}
        </div>
        <div class="top-actions">
          <button class="icon-btn" id="btn-search-trigger" aria-label="Search">${Icons.Search()}</button>
        </div>
      `;

      document.getElementById('btn-brand-home').addEventListener('click', () => this.switchTab('home'));
      document.getElementById('btn-search-trigger').addEventListener('click', () => this.switchTab('search'));
    }
  }

  // --- Bottom Navigation ---
  renderBottomNavigation() {
    const nav = document.getElementById('bottom-nav');
    const userPhoto = this.currentUser?.photoURL;
    const userInitial = this.currentUser ? (this.currentUser.displayName || this.currentUser.email).charAt(0).toUpperCase() : null;

    const tabs = [
      { id: 'home', label: 'Home', icon: Icons.Home },
      { id: 'shorts', label: 'Shorts', icon: Icons.Shorts },
      { id: 'subscriptions', label: 'Subscriptions', icon: Icons.Subscriptions },
      { 
        id: 'library', 
        label: 'You', 
        customIcon: this.currentUser ? `
          <div class="bottom-nav-avatar ${this.currentTab === 'library' ? 'active' : ''}">
            ${userPhoto ? `<img src="${userPhoto}" class="nav-avatar-img" />` : userInitial}
          </div>
        ` : Icons.YouProfile(this.currentTab === 'library')
      }
    ];

    nav.innerHTML = tabs.map(t => `
      <button class="nav-item ${this.currentTab === t.id ? 'active' : ''}" data-tab="${t.id}">
        ${t.customIcon ? t.customIcon : t.icon(this.currentTab === t.id)}
        <span>${t.label}</span>
      </button>
    `).join('');

    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName, pushToHistory = true) {
    if (this.currentTab === tabName && tabName === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.currentTab = tabName;
    if (pushToHistory) this.nav.pushState(tabName);

    const bottomNav = document.getElementById('bottom-nav');
    const main = document.getElementById('main-view');
    
    main.classList.remove('page-transition-enter');
    void main.offsetWidth;
    main.classList.add('page-transition-enter');
    main.innerHTML = '';

    if (tabName === 'search') {
      bottomNav.style.display = 'none';
      document.body.classList.add('search-mode');
      this.renderTopAppBar(true, false);
      this.renderSearchView();
    } else {
      bottomNav.style.display = 'flex';
      document.body.classList.remove('search-mode');
      this.renderTopAppBar(false);
      this.renderBottomNavigation();

      switch (tabName) {
        case 'home':
          this.renderHomeShell();
          this.loadHomeFeed(false);
          break;
        case 'shorts':
          this.loadShortsFeed(false);
          break;
        case 'subscriptions':
          this.loadSubscriptionsView();
          break;
        case 'library':
          this.loadLibraryView();
          break;
      }
    }
  }

  // --- Home Tab ---
  renderHomeShell(showInitialSkeleton = false) {
    const main = document.getElementById('main-view');
    main.innerHTML = `
      <div id="categories-container" class="category-chips-bar">
        <div class="skeleton-chips-bar">
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
        </div>
      </div>
      <div id="video-feed" class="video-feed">
        ${showInitialSkeleton ? UI.renderSkeletons(3, false) : ''}
      </div>
    `;
    this.renderCategoriesList();
  }

  async loadHomeCategories() {
    try {
      this.categories = await youtubeApi.getCategories();
      this.renderCategoriesList();
    } catch (e) {
      this.categories = [{ id: '0', title: 'All' }];
      this.renderCategoriesList();
    }
  }

  renderCategoriesList() {
    const container = document.getElementById('categories-container');
    if (!container || !this.categories) return;

    container.innerHTML = this.categories.map(c => `
      <button class="chip ${this.activeCategory === c.id ? 'active' : ''}" data-cat-id="${c.id}" data-custom-title="${c.isCustomQuery ? c.title : ''}">
        ${c.title}
      </button>
    `).join('');

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const newCat = e.currentTarget.getAttribute('data-cat-id');
        const customTitle = e.currentTarget.getAttribute('data-custom-title');

        if (this.activeCategory !== newCat) {
          this.activeCategory = newCat;
          this.renderCategoriesList();

          if (customTitle) {
            this.loadCustomChipFeed(customTitle);
          } else {
            this.loadHomeFeed(true);
          }
        }
      });
    });
  }

  async loadCustomChipFeed(searchTerm) {
    const feed = document.getElementById('video-feed');
    if (!feed) return;
    feed.innerHTML = UI.renderSkeletons(3, false);

    try {
      const data = await youtubeApi.search(searchTerm, '', 'video');
      feed.innerHTML = '';
      data.items.forEach(v => feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v)));
    } catch (err) {
      feed.innerHTML = UI.renderError(err.message, () => this.loadCustomChipFeed(searchTerm));
    }
  }

  async loadHomeFeed(forceReload = false) {
    const feed = document.getElementById('video-feed');
    if (!feed) return;

    if (!forceReload && this.cachedHomeVideos && this.cachedHomeVideos.length > 0 && this.cachedCategory === this.activeCategory) {
      feed.innerHTML = '';
      this.cachedHomeVideos.forEach(v => {
        feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v));
      });
      return;
    }

    feed.innerHTML = UI.renderSkeletons(3, false);

    try {
      let data;
      if (this.activeCategory === '0') {
        data = await youtubeApi.getCombinedPersonalizedFeed(this.nextPageToken);
      } else {
        data = await youtubeApi.getPopularVideos(this.nextPageToken, this.activeCategory);
      }

      this.nextPageToken = data.nextPageToken;
      feed.innerHTML = '';

      if (data.items.length === 0) {
        feed.innerHTML = UI.renderEmpty('No videos found.');
        return;
      }

      data.items.forEach(v => {
        feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v));
      });

      this.cachedHomeVideos = data.items;
      this.cachedCategory = this.activeCategory;
      storage.set('cached_home_videos', this.cachedHomeVideos);
      storage.set('cached_home_cat', this.cachedCategory);

    } catch (err) {
      feed.innerHTML = UI.renderError(err.message, 'window.app.retryHomeFeed');
    }
  }

  retryHomeFeed() {
    this.loadHomeFeed(true);
  }

  // --- Vertical Fullscreen 9:16 Shorts ---
  async loadShortsFeed(forceReload = false) {
    const main = document.getElementById('main-view');
    main.innerHTML = `<div class="shorts-fullscreen-container" id="shorts-container"></div>`;
    const container = document.getElementById('shorts-container');

    if (!forceReload && this.cachedShorts && this.cachedShorts.length > 0) {
      this.renderShortsCards(this.cachedShorts);
      return;
    }

    container.innerHTML = UI.renderShortsSkeleton();

    try {
      const data = await youtubeApi.getPersonalizedShortsFeed();
      this.cachedShorts = data.items;
      storage.set('cached_shorts_list', this.cachedShorts);
      this.renderShortsCards(this.cachedShorts);
    } catch (err) {
      container.innerHTML = UI.renderError(err.message, () => this.loadShortsFeed(true));
    }
  }

  renderShortsCards(shortsList) {
    const container = document.getElementById('shorts-container');
    if (!container) return;
    container.innerHTML = '';

    shortsList.forEach((short) => {
      const isLiked = storage.isShortLiked(short.id);

      container.insertAdjacentHTML('beforeend', `
        <div class="short-fullscreen-card" data-short-id="${short.id}">
          <div class="short-video-wrapper">
            <iframe 
              src="https://www.youtube-nocookie.com/embed/${short.id}?autoplay=0&controls=0&loop=1&playsinline=1&rel=0&modestbranding=1" 
              style="width:100%;height:100%;border:none;" 
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen>
            </iframe>
          </div>

          <div class="short-action-sidebar">
            <button class="short-act-btn ${isLiked ? 'active-like' : ''}" data-like-short="${short.id}">
              ${Icons.Like(isLiked)}
              <span>${short.likeCount || 'Like'}</span>
            </button>

            <button class="short-act-btn" data-comment-short="${short.id}">
              ${Icons.Comment()}
              <span>Comments</span>
            </button>

            <button class="short-act-btn" onclick="window.app.handleShare('${short.id}')">
              ${Icons.Share()}
              <span>Share</span>
            </button>
          </div>

          <div class="short-bottom-overlay">
            <div class="short-channel-row">
              <div class="short-channel-avatar">
                ${short.channelAvatar ? `<img src="${short.channelAvatar}" />` : (short.channelTitle || 'C').charAt(0).toUpperCase()}
              </div>
              <span class="short-channel-name">@${UI.escapeHtml(short.channelTitle)}</span>
              <button class="short-sub-btn" data-sub-channel-id="${short.channelId}" data-channel-title="${UI.escapeHtml(short.channelTitle)}" data-channel-avatar="${UI.escapeHtml(short.channelAvatar || '')}">Subscribe</button>
            </div>
            <h3 class="short-video-title">${UI.escapeHtml(short.title)}</h3>
          </div>
        </div>
      `);
    });

    container.querySelectorAll('[data-like-short]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!this.requireAuth('like this short')) return;

        const sId = btn.getAttribute('data-like-short');
        const shortItem = shortsList.find(i => i.id === sId) || { id: sId, title: 'YouTube Short' };
        const isNowLiked = await storage.toggleLikeShort(shortItem);
        btn.innerHTML = `
          ${Icons.Like(isNowLiked)}
          <span>${isNowLiked ? 'Liked' : 'Like'}</span>
        `;
        btn.classList.toggle('active-like', isNowLiked);
      });
    });

    container.querySelectorAll('[data-comment-short]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-comment-short');
        this.openCommentsBottomSheet(sId);
      });
    });
  }

  // --- Read-Only Comments Bottom Sheet ---
  async openCommentsBottomSheet(videoId) {
    this.openBottomSheet(`
      <div class="comments-sheet-container">
        <div class="comments-header">
          <h3>Comments</h3>
          <button class="icon-btn" onclick="window.app.closeBottomSheet()">${Icons.Close()}</button>
        </div>
        <div id="comments-list-body" class="comments-list">
          <p style="text-align:center; color:var(--text-secondary); padding:20px;">Loading comments...</p>
        </div>
      </div>
    `);

    const commentsList = document.getElementById('comments-list-body');
    const comments = await youtubeApi.getVideoComments(videoId);

    if (comments.length === 0) {
      commentsList.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding:20px;">No comments available.</p>`;
      return;
    }

    commentsList.innerHTML = comments.map(c => `
      <div class="comment-item-row">
        <div class="comment-avatar">
          ${c.authorAvatar ? `<img src="${c.authorAvatar}" />` : c.authorName.charAt(0)}
        </div>
        <div class="comment-content">
          <div class="comment-author-name">${UI.escapeHtml(c.authorName)} <span class="comment-time">${c.timeAgo}</span></div>
          <div class="comment-text-body">${c.text}</div>
          <div class="comment-like-badge">👍 ${c.likeCount}</div>
        </div>
      </div>
    `).join('');
  }

  // --- Search View ---
  async renderSearchView() {
    const main = document.getElementById('main-view');
    const history = storage.getSearchHistory();

    main.innerHTML = `
      <div style="padding: 6px 12px;">
        <div id="search-suggestions-box" class="search-suggestions-dropdown" style="display: none;"></div>

        <div id="search-history-container">
          ${history.length > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Recent searches</span>
              <button class="icon-btn" id="btn-clear-search-history" aria-label="Clear searches">${Icons.Trash()}</button>
            </div>
            <div class="search-history-list">
              ${history.map(item => `
                <div class="search-item-row ripple" data-query="${UI.escapeHtml(item)}">
                  <div style="display: flex; gap: 12px; align-items: center;">
                    ${Icons.History()}
                    <span>${UI.escapeHtml(item)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div id="search-results" class="video-feed" style="margin-top: 12px;"></div>
      </div>
    `;

    const clearBtn = document.getElementById('btn-clear-search-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        storage.clearSearchHistoryLocal();
        const listEl = document.getElementById('search-history-container');
        if (listEl) listEl.style.display = 'none';
        this.showSnackbar('Recent searches cleared locally');
      });
    }

    document.querySelectorAll('.search-item-row').forEach(el => {
      el.addEventListener('click', () => {
        const query = el.getAttribute('data-query');
        this.currentSearchQuery = query;
        this.renderTopAppBar(true, true);
        this.executeSearchQuery(query);
      });
    });
  }

  async executeSearchQuery(query) {
    if (!query || !query.trim()) return;

    storage.addSearchQuery(query);
    this.renderTopAppBar(true, true);

    const resultsContainer = document.getElementById('search-results');
    const historyContainer = document.getElementById('search-history-container');
    const suggestionsBox = document.getElementById('search-suggestions-box');
    
    if (historyContainer) historyContainer.style.display = 'none';
    if (suggestionsBox) suggestionsBox.style.display = 'none';

    resultsContainer.innerHTML = UI.renderSkeletons(3);

    try {
      const data = await youtubeApi.search(query, '', 'video', this.activeSearchFilters);
      resultsContainer.innerHTML = '';

      if (data.items.length === 0) {
        resultsContainer.innerHTML = UI.renderEmpty('No results found.');
        return;
      }

      data.items.forEach(item => {
        if (item.kind === 'youtube#channel') {
          resultsContainer.insertAdjacentHTML('beforeend', UI.renderChannelCard(item, storage.isSubscribed(item.id)));
        } else {
          resultsContainer.insertAdjacentHTML('beforeend', UI.renderVideoCard(item));
        }
      });
    } catch (e) {
      resultsContainer.innerHTML = UI.renderError(e.message, () => this.executeSearchQuery(query));
    }
  }

  openSearchFiltersModal() {
    this.openBottomSheet(`
      <div class="search-filters-modal">
        <h3 class="filters-header-title">Search filters</h3>

        <div class="filter-row">
          <span class="filter-label">Type</span>
          <select class="filter-select" id="filter-type">
            <option value="all" ${this.activeSearchFilters.type === 'all' ? 'selected' : ''}>All</option>
            <option value="video" ${this.activeSearchFilters.type === 'video' ? 'selected' : ''}>Video</option>
            <option value="channel" ${this.activeSearchFilters.type === 'channel' ? 'selected' : ''}>Channel</option>
            <option value="playlist" ${this.activeSearchFilters.type === 'playlist' ? 'selected' : ''}>Playlist</option>
          </select>
        </div>

        <div class="filter-row">
          <span class="filter-label">Duration</span>
          <select class="filter-select" id="filter-duration">
            <option value="any" ${this.activeSearchFilters.duration === 'any' ? 'selected' : ''}>Any</option>
            <option value="short" ${this.activeSearchFilters.duration === 'short' ? 'selected' : ''}>Under 4 minutes</option>
            <option value="medium" ${this.activeSearchFilters.duration === 'medium' ? 'selected' : ''}>4–20 minutes</option>
            <option value="long" ${this.activeSearchFilters.duration === 'long' ? 'selected' : ''}>Over 20 minutes</option>
          </select>
        </div>

        <div class="filter-row">
          <span class="filter-label">Upload date</span>
          <select class="filter-select" id="filter-upload-date">
            <option value="anytime" ${this.activeSearchFilters.uploadDate === 'anytime' ? 'selected' : ''}>Anytime</option>
            <option value="hour" ${this.activeSearchFilters.uploadDate === 'hour' ? 'selected' : ''}>Last hour</option>
            <option value="today" ${this.activeSearchFilters.uploadDate === 'today' ? 'selected' : ''}>Today</option>
            <option value="week" ${this.activeSearchFilters.uploadDate === 'week' ? 'selected' : ''}>This week</option>
            <option value="month" ${this.activeSearchFilters.uploadDate === 'month' ? 'selected' : ''}>This month</option>
            <option value="year" ${this.activeSearchFilters.uploadDate === 'year' ? 'selected' : ''}>This year</option>
          </select>
        </div>

        <div class="filter-row">
          <span class="filter-label">Prioritize</span>
          <select class="filter-select" id="filter-order">
            <option value="relevance" ${this.activeSearchFilters.order === 'relevance' ? 'selected' : ''}>Relevance</option>
            <option value="date" ${this.activeSearchFilters.order === 'date' ? 'selected' : ''}>Upload date</option>
            <option value="viewCount" ${this.activeSearchFilters.order === 'viewCount' ? 'selected' : ''}>View count</option>
            <option value="rating" ${this.activeSearchFilters.order === 'rating' ? 'selected' : ''}>Rating</option>
          </select>
        </div>

        <button class="btn btn-primary" id="btn-apply-filters" style="width: 100%; border-radius: 24px; padding: 12px; margin-top: 18px;">
          Apply Filters
        </button>
      </div>
    `);

    document.getElementById('btn-apply-filters').addEventListener('click', () => {
      this.activeSearchFilters = {
        type: document.getElementById('filter-type').value,
        duration: document.getElementById('filter-duration').value,
        uploadDate: document.getElementById('filter-upload-date').value,
        order: document.getElementById('filter-order').value
      };
      this.closeBottomSheet();
      if (this.currentSearchQuery) {
        this.executeSearchQuery(this.currentSearchQuery);
      }
    });
  }

  // --- Subscriptions ---
  async loadSubscriptionsView() {
    const main = document.getElementById('main-view');
    const subs = storage.getSubscriptions();

    if (subs.length === 0) {
      main.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <h3 style="font-size: 16px; margin-bottom: 6px;">Don’t miss new videos</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Sign in or subscribe to channels to see updates here.</p>
        </div>
      `;
      return;
    }

    main.innerHTML = `
      <div style="padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h2 style="font-size: 17px; font-weight: 700;">Subscribed Channels</h2>
          <button class="see-all-link-btn" id="btn-see-all-subs">See all</button>
        </div>

        <div class="subs-channels-horizontal-row">
          ${subs.map(c => `
            <div class="sub-channel-avatar-item ripple" data-channel-id="${c.id}">
              <div class="sub-channel-img-wrapper">
                ${c.avatar ? `
                  <img src="${c.avatar}" class="sub-channel-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                  <div class="avatar-placeholder" style="display:none; width:100%; height:100%; border-radius:50%; font-size:16px;">
                    ${(c.title || 'C').charAt(0).toUpperCase()}
                  </div>
                ` : `
                  <div class="avatar-placeholder" style="width:100%; height:100%; border-radius:50%; font-size:16px;">
                    ${(c.title || 'C').charAt(0).toUpperCase()}
                  </div>
                `}
              </div>
              <span class="sub-channel-title-text">${UI.escapeHtml(c.title)}</span>
            </div>
          `).join('')}
        </div>

        <div id="subs-feed" class="video-feed" style="margin-top: 18px;">
          ${UI.renderSkeletons(3)}
        </div>
      </div>
    `;

    document.getElementById('btn-see-all-subs')?.addEventListener('click', () => {
      this.openAllSubscriptionsView();
    });

    document.querySelectorAll('.sub-channel-avatar-item').forEach(item => {
      item.addEventListener('click', () => {
        const chId = item.getAttribute('data-channel-id');
        this.openChannelVideosOnly(chId);
      });
    });

    try {
      const data = await youtubeApi.getSubscribedFeed(subs);
      const feed = document.getElementById('subs-feed');
      if (feed) {
        feed.innerHTML = '';
        if (data.items.length === 0) {
          feed.innerHTML = UI.renderEmpty('No recent videos from subscribed channels.');
        } else {
          data.items.forEach(v => feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v)));
        }
      }
    } catch (e) {
      const feed = document.getElementById('subs-feed');
      if (feed) feed.innerHTML = UI.renderError('Could not load channel feed', () => this.loadSubscriptionsView());
    }
  }

  openAllSubscriptionsView() {
    const main = document.getElementById('main-view');
    main.classList.remove('page-transition-enter');
    void main.offsetWidth;
    main.classList.add('page-transition-enter');

    const subs = storage.getSubscriptions();

    main.innerHTML = `
      <div style="padding: 16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
          <button class="icon-btn" id="btn-see-all-back">${Icons.Back()}</button>
          <h2 style="font-size:18px; font-weight:700;">All Subscriptions (${subs.length})</h2>
        </div>

        <div class="all-subs-list">
          ${subs.map(c => `
            <div class="all-subs-row ripple" data-channel-id="${c.id}">
              <div style="display:flex; align-items:center; gap:14px; flex:1;">
                <div class="sub-channel-img-wrapper" style="width:48px; height:48px;">
                  <img src="${c.avatar || ''}" class="sub-channel-img" />
                </div>
                <div>
                  <h4 style="font-size:14px; font-weight:600;">${UI.escapeHtml(c.title)}</h4>
                </div>
              </div>
              <button class="btn subscribe-btn subscribed" data-sub-channel-id="${c.id}">Subscribed</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-see-all-back').addEventListener('click', () => this.loadSubscriptionsView());
  }

  async openChannelVideosOnly(channelId) {
    const feed = document.getElementById('subs-feed');
    if (!feed) return;
    feed.innerHTML = UI.renderSkeletons(2);

    try {
      const data = await youtubeApi.getChannelVideos(channelId);
      feed.innerHTML = '';
      data.items.forEach(v => feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v)));
    } catch (e) {
      feed.innerHTML = UI.renderError('Could not load channel videos', () => this.openChannelVideosOnly(channelId));
    }
  }

  // --- You (Library) View ---
  loadLibraryView() {
    const main = document.getElementById('main-view');
    const history = storage.getWatchHistory();
    const playlists = storage.getCustomPlaylists();
    const liked = storage.getLikedVideos();
    const disliked = storage.getDislikedVideos();
    const likedShorts = storage.getLikedShorts();
    const userPhoto = this.currentUser?.photoURL;
    const userInitial = this.currentUser ? (this.currentUser.displayName || this.currentUser.email).charAt(0).toUpperCase() : null;

    main.innerHTML = `
      <div style="padding: 16px;">
        <div class="user-profile-header-card">
          ${this.currentUser ? `
            <div class="profile-avatar-circle">
              ${userPhoto ? `<img src="${userPhoto}" class="profile-avatar-img" />` : userInitial}
            </div>
            <div class="profile-info-text">
              <h3 class="profile-name-title">${UI.escapeHtml(this.currentUser.displayName || 'YouTube User')}</h3>
              <p class="profile-email-sub">${UI.escapeHtml(this.currentUser.email)}</p>
            </div>
            <button class="sign-out-btn-inline" id="btn-you-logout">Sign Out</button>
          ` : `
            <div style="text-align: center; width: 100%; padding: 8px 0;">
              <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 6px;">Sign in to YouTube Clone</h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Sync history, playlists & personalized feed</p>
              <button class="btn btn-primary" id="btn-you-login" style="padding: 8px 24px; border-radius: 20px;">Sign In / Register</button>
            </div>
          `}
        </div>

        <!-- History Carousel Section -->
        <div class="history-section-wrapper">
          <div class="section-title-row">
            <h2 class="history-title-btn" id="btn-open-full-history">History ${Icons.ChevronRight()}</h2>
          </div>
          <div class="history-horizontal-carousel">
            ${history.length > 0 ? history.map(v => UI.renderHistoryCard(v)).join('') : '<p style="color:var(--text-secondary);font-size:13px;padding:8px 0;">No watch history yet.</p>'}
          </div>
        </div>

        <!-- Playlists & Custom Saved Categories -->
        <div style="margin-top: 24px;">
          <div class="section-title-row">
            <h2 style="font-size: 18px; font-weight: 700;">Playlists & Saved Videos</h2>
          </div>

          <div class="playlists-list-container">
            ${Object.keys(playlists).map(name => `
              <div class="playlist-category-item ripple" data-playlist-name="${UI.escapeHtml(name)}">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="playlist-icon-wrap">${Icons.Save(true)}</div>
                  <div>
                    <h4 style="font-size:14px; font-weight:600;">${UI.escapeHtml(name)}</h4>
                    <p style="font-size:12px; color:var(--text-secondary);">${playlists[name].length} videos</p>
                  </div>
                </div>
                ${Icons.ChevronRight()}
              </div>
            `).join('')}

            <!-- Liked Shorts Section -->
            <div class="playlist-category-item ripple" id="btn-open-liked-shorts">
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="playlist-icon-wrap" style="color: #ff0000;">${Icons.Shorts(true)}</div>
                <div>
                  <h4 style="font-size:14px; font-weight:600;">Liked Shorts</h4>
                  <p style="font-size:12px; color:var(--text-secondary);">${likedShorts.length} shorts</p>
                </div>
              </div>
              ${Icons.ChevronRight()}
            </div>

            <!-- Liked Videos Section -->
            <div class="playlist-category-item ripple" id="btn-open-liked-videos">
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="playlist-icon-wrap" style="color: #22c55e;">${Icons.Like(true)}</div>
                <div>
                  <h4 style="font-size:14px; font-weight:600;">Liked Videos</h4>
                  <p style="font-size:12px; color:var(--text-secondary);">${liked.length} videos</p>
                </div>
              </div>
              ${Icons.ChevronRight()}
            </div>

            <!-- Disliked Videos Section -->
            <div class="playlist-category-item ripple" id="btn-open-disliked-videos">
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="playlist-icon-wrap" style="color: #ef4444;">${Icons.Dislike(true)}</div>
                <div>
                  <h4 style="font-size:14px; font-weight:600;">Disliked Videos</h4>
                  <p style="font-size:12px; color:var(--text-secondary);">${disliked.length} videos</p>
                </div>
              </div>
              ${Icons.ChevronRight()}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-open-full-history')?.addEventListener('click', () => this.openFullHistoryView());
    document.getElementById('btn-you-login')?.addEventListener('click', () => this.openAuthModal());
    document.getElementById('btn-you-logout')?.addEventListener('click', () => this.openSignOutConfirmDialog());

    document.getElementById('btn-open-liked-shorts')?.addEventListener('click', () => {
      this.openSimpleVideoListView('Liked Shorts', storage.getLikedShorts());
    });

    document.getElementById('btn-open-liked-videos')?.addEventListener('click', () => {
      this.openSimpleVideoListView('Liked Videos', storage.getLikedVideos());
    });

    document.getElementById('btn-open-disliked-videos')?.addEventListener('click', () => {
      this.openSimpleVideoListView('Disliked Videos', storage.getDislikedVideos());
    });

    document.querySelectorAll('[data-playlist-name]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.getAttribute('data-playlist-name');
        this.openPlaylistDetailView(name);
      });
    });
  }

  openSimpleVideoListView(title, videosList) {
    const main = document.getElementById('main-view');
    main.classList.remove('page-transition-enter');
    void main.offsetWidth;
    main.classList.add('page-transition-enter');

    main.innerHTML = `
      <div style="padding: 16px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
          <button class="icon-btn" id="btn-list-back">${Icons.Back()}</button>
          <h2 style="font-size:18px; font-weight:700;">${UI.escapeHtml(title)} (${videosList.length})</h2>
        </div>
        <div class="video-feed">
          ${videosList.length > 0 ? videosList.map(v => UI.renderVideoCard(v)).join('') : UI.renderEmpty(`No items in ${title}.`)}
        </div>
      </div>
    `;

    document.getElementById('btn-list-back').addEventListener('click', () => this.loadLibraryView());
  }

  // --- Full History View ---
  openFullHistoryView() {
    const main = document.getElementById('main-view');
    main.classList.remove('page-transition-enter');
    void main.offsetWidth;
    main.classList.add('page-transition-enter');

    const history = storage.getWatchHistory();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    const todayItems = [];
    const yesterdayItems = [];
    const earlierItems = [];

    history.forEach(item => {
      const time = item.watchedAt || Date.now();
      if (time >= todayStart) {
        todayItems.push(item);
      } else if (time >= yesterdayStart) {
        yesterdayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    main.innerHTML = `
      <div class="full-history-page">
        <div class="full-history-topbar">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="icon-btn" id="btn-history-back">${Icons.Back()}</button>
            <h2 style="font-size:20px; font-weight:700;">History</h2>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="icon-btn" id="btn-history-search">${Icons.Search()}</button>
            <button class="icon-btn" id="btn-history-menu">${Icons.MoreVert()}</button>
          </div>
        </div>

        <div style="padding: 10px 14px;">
          ${history.length === 0 ? UI.renderEmpty('No watch history found.') : ''}

          ${todayItems.length > 0 ? `
            <h3 class="history-date-header">Today</h3>
            <div class="full-history-group">
              ${todayItems.map(v => UI.renderHistoryFullItem(v)).join('')}
            </div>
          ` : ''}

          ${yesterdayItems.length > 0 ? `
            <h3 class="history-date-header">Yesterday</h3>
            <div class="full-history-group">
              ${yesterdayItems.map(v => UI.renderHistoryFullItem(v)).join('')}
            </div>
          ` : ''}

          ${earlierItems.length > 0 ? `
            <h3 class="history-date-header">Earlier</h3>
            <div class="full-history-group">
              ${earlierItems.map(v => UI.renderHistoryFullItem(v)).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('btn-history-back').addEventListener('click', () => this.loadLibraryView());
    document.getElementById('btn-history-search').addEventListener('click', () => this.switchTab('search'));
    document.getElementById('btn-history-menu').addEventListener('click', () => {
      this.openBottomSheet(`
        <div class="bottom-sheet-item" id="sheet-clear-history" style="color:#ff4d4f;">
          ${Icons.Trash()} <span>Clear all watch history</span>
        </div>
      `);
      document.getElementById('sheet-clear-history').addEventListener('click', () => {
        storage.clearWatchHistory();
        this.closeBottomSheet();
        this.openFullHistoryView();
      });
    });
  }

  // --- Sign Out Dialog ---
  openSignOutConfirmDialog() {
    this.openBottomSheet(`
      <div class="premium-dialog-card">
        <h3 style="font-size: 17px; font-weight: 700; margin-bottom: 8px;">Sign out of YouTube Clone?</h3>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 20px;">
          Signing out will remove your personal history, likes, and playlists from this device.
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn" id="btn-cancel-signout" style="background: transparent; color: var(--text-primary); font-weight: 600;">Cancel</button>
          <button class="btn" id="btn-confirm-signout" style="background: var(--accent-color); color: #fff; font-weight: 600; border-radius: 20px;">Sign Out</button>
        </div>
      </div>
    `);

    document.getElementById('btn-cancel-signout').addEventListener('click', () => this.closeBottomSheet());
    document.getElementById('btn-confirm-signout').addEventListener('click', async () => {
      await authService.logout();
      storage.clearUserDataOnLogout();
      this.closeBottomSheet();
      this.showSnackbar('Signed out successfully');
      this.loadLibraryView();
    });
  }

  // --- Custom Save Playlist Modal ---
  openSaveToPlaylistModal(video) {
    if (!this.requireAuth('save videos to playlists')) return;

    const playlists = storage.getCustomPlaylists();
    const playlistNames = Object.keys(playlists);

    this.openBottomSheet(`
      <div class="save-playlist-modal">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 14px;">Save video to...</h3>

        <div class="playlist-checkbox-list">
          ${playlistNames.map(name => `
            <div class="playlist-check-row ripple" data-save-category="${UI.escapeHtml(name)}">
              <span>${UI.escapeHtml(name)}</span>
              <button class="btn btn-primary" style="padding: 4px 12px; font-size: 12px;">Save</button>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <h4 style="font-size: 13px; margin-bottom: 8px; color: var(--text-secondary);">Create new playlist category</h4>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="new-playlist-name" placeholder="Playlist title..." 
              style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);" />
            <button class="btn btn-primary" id="btn-create-save-cat">Create & Save</button>
          </div>
        </div>
      </div>
    `);

    document.querySelectorAll('[data-save-category]').forEach(el => {
      el.addEventListener('click', async () => {
        const cat = el.getAttribute('data-save-category');
        await storage.saveVideoToPlaylist(cat, video);
        this.closeBottomSheet();
        this.updateSaveButtonActiveState(true);
        this.showSnackbar(`Saved to ${cat}!`);
      });
    });

    document.getElementById('btn-create-save-cat').addEventListener('click', async () => {
      const input = document.getElementById('new-playlist-name');
      const val = input.value.trim();
      if (val) {
        await storage.createPlaylist(val);
        await storage.saveVideoToPlaylist(val, video);
        this.closeBottomSheet();
        this.updateSaveButtonActiveState(true);
        this.showSnackbar(`Saved to ${val}!`);
      }
    });
  }

  updateSaveButtonActiveState(isSaved) {
    const saveBtn = document.getElementById('btn-save-video');
    if (saveBtn) {
      saveBtn.innerHTML = `
        ${Icons.Save(isSaved)}
        <span>${isSaved ? 'Saved' : 'Save'}</span>
      `;
      if (isSaved) {
        saveBtn.classList.add('saved-active');
      } else {
        saveBtn.classList.remove('saved-active');
      }
    }
  }

  openPlaylistDetailView(playlistName) {
    const main = document.getElementById('main-view');
    main.classList.remove('page-transition-enter');
    void main.offsetWidth;
    main.classList.add('page-transition-enter');

    const playlists = storage.getCustomPlaylists();
    const videos = playlists[playlistName] || [];

    main.innerHTML = `
      <div style="padding: 16px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
          <button class="icon-btn" id="btn-playlist-back">${Icons.Back()}</button>
          <h2 style="font-size:18px; font-weight:700;">${UI.escapeHtml(playlistName)} (${videos.length})</h2>
        </div>
        <div class="video-feed">
          ${videos.length > 0 ? videos.map(v => UI.renderVideoCard(v)).join('') : UI.renderEmpty('No videos saved in this playlist.')}
        </div>
      </div>
    `;

    document.getElementById('btn-playlist-back').addEventListener('click', () => this.loadLibraryView());
  }

  // --- Auth Modal with Eye Show/Hide Toggle (Screenshot 2 & 6 Match) ---
  openAuthModal(defaultMode = 'login') {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('visible');
    modal.innerHTML = `
      <div class="auth-card" id="auth-main-card">
        <div class="auth-tabs">
          <button class="auth-tab ${defaultMode === 'login' ? 'active' : ''}" id="tab-auth-login">Login</button>
          <button class="auth-tab ${defaultMode === 'register' ? 'active' : ''}" id="tab-auth-register">Create Account</button>
        </div>

        <button type="button" class="btn-google-auth" id="btn-auth-google">
          ${Icons.Google()}
          <span id="btn-google-text">Continue with Google</span>
        </button>

        <div style="display:flex; align-items:center; margin: 14px 0; color: var(--text-secondary); font-size: 12px;">
          <div style="flex:1; height:1px; background:var(--border-color);"></div>
          <span style="padding: 0 10px;">OR</span>
          <div style="flex:1; height:1px; background:var(--border-color);"></div>
        </div>

        <form id="auth-form">
          <div id="auth-name-group" style="display: ${defaultMode === 'register' ? 'block' : 'none'}; margin-bottom: 12px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Your Name</label>
            <input type="text" id="auth-name" class="auth-input" placeholder="Your Name" />
          </div>

          <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Email</label>
            <input type="email" id="auth-email" class="auth-input" placeholder="user@example.com" required />
          </div>

          <!-- Password with Eye Toggle (Screenshot 2 & 6) -->
          <div style="margin-bottom: 6px;">
            <label style="font-size: 12px; color: var(--text-secondary);">Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required />
              <button type="button" class="toggle-password-btn" id="btn-toggle-password" aria-label="Toggle password visibility">
                ${Icons.EyeOff()}
              </button>
            </div>
          </div>

          <!-- Forgot Password Container -->
          <div id="forgot-pass-wrap" style="text-align: right; margin-bottom: 14px; display: ${defaultMode === 'login' ? 'block' : 'none'};">
            <button type="button" class="forgot-pass-btn" id="btn-forgot-password">Forgot password?</button>
          </div>

          <div id="auth-error-msg" class="auth-feedback-error" style="display: none;"></div>
          <div id="auth-success-msg" class="auth-feedback-success" style="display: none;"></div>

          <button type="submit" class="btn btn-primary" id="btn-auth-submit" style="width: 100%; border-radius: 8px; padding: 12px;">
            ${defaultMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          
          <button type="button" class="btn" id="btn-auth-cancel" style="width: 100%; margin-top: 8px; background: transparent; color: var(--text-secondary);">
            Cancel
          </button>
        </form>
      </div>
    `;

    let mode = defaultMode;
    const tabLogin = document.getElementById('tab-auth-login');
    const tabReg = document.getElementById('tab-auth-register');
    const nameGroup = document.getElementById('auth-name-group');
    const forgotWrap = document.getElementById('forgot-pass-wrap');
    const submitBtn = document.getElementById('btn-auth-submit');
    const form = document.getElementById('auth-form');
    const errorMsg = document.getElementById('auth-error-msg');
    const successMsg = document.getElementById('auth-success-msg');
    const googleBtn = document.getElementById('btn-auth-google');
    const forgotPassBtn = document.getElementById('btn-forgot-password');
    const authCard = document.getElementById('auth-main-card');
    const passInput = document.getElementById('auth-password');
    const togglePassBtn = document.getElementById('btn-toggle-password');

    // Eye Show/Hide Toggle Logic
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.innerHTML = isPass ? Icons.Eye() : Icons.EyeOff();
    });

    tabLogin.addEventListener('click', () => {
      mode = 'login';
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      nameGroup.style.display = 'none';
      if (forgotWrap) forgotWrap.style.display = 'block';
      submitBtn.textContent = 'Sign In';
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';
    });

    tabReg.addEventListener('click', () => {
      mode = 'register';
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
      nameGroup.style.display = 'block';
      if (forgotWrap) forgotWrap.style.display = 'none';
      submitBtn.textContent = 'Create Account';
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';
    });

    document.getElementById('btn-auth-cancel').addEventListener('click', () => {
      modal.classList.remove('visible');
    });

    forgotPassBtn.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      try {
        await authService.sendPasswordReset(email);
        successMsg.textContent = 'Password reset email sent! Check your inbox.';
        successMsg.style.display = 'block';
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
      }
    });

    const triggerAuthSuccess = (msg) => {
      errorMsg.style.display = 'none';
      successMsg.textContent = msg;
      successMsg.style.display = 'block';
      authCard.classList.add('auth-card-success');

      setTimeout(() => {
        modal.classList.remove('visible');
      }, 800);
    };

    googleBtn.addEventListener('click', () => {
      errorMsg.style.display = 'none';
      googleBtn.classList.add('btn-loading');
      googleBtn.innerHTML = `<span class="google-spinner"></span> <span>Connecting to Google...</span>`;
      authService.triggerGooglePrompt(mode);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const name = document.getElementById('auth-name').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';
      errorMsg.style.display = 'none';

      try {
        if (mode === 'register') {
          await authService.register(email, password, name);
          triggerAuthSuccess('Account created successfully!');
        } else {
          await authService.login(email, password);
          triggerAuthSuccess('Login successful! Welcome back.');
        }
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
      }
    });
  }

  // --- Video Player Overlay (In-App Loading without External Redirects) ---
  async openPlayer(videoId) {
    this.isPlayerOpen = true;
    window.history.pushState({ modal: 'player' }, '', '#watch');

    const overlay = document.getElementById('video-player-overlay');
    overlay.classList.add('active');
    overlay.innerHTML = `
      <div class="player-embed-container">
        <div class="responsive-iframe-wrapper">
          <div id="player-target"></div>
        </div>
      </div>
      <div id="player-details-container" style="padding: 14px;">
        ${UI.renderSkeletons(1)}
      </div>
    `;

    try {
      const details = await youtubeApi.getVideoDetails(videoId);
      await storage.addToHistory(details);

      playerManager.loadVideo(videoId, details);

      const isSub = storage.isSubscribed(details.channelId);
      const isLiked = storage.isLiked(details.id);
      const isDisliked = storage.isDisliked(details.id);
      const isSaved = storage.isVideoInAnyPlaylist(details.id);

      const container = document.getElementById('player-details-container');
      container.innerHTML = `
        <h2 style="font-size: 16px; font-weight: 600; line-height: 1.3;">${UI.escapeHtml(details.title)}</h2>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
          ${details.viewCount} views • ${details.timeAgo}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" data-channel-id="${details.channelId}">
            <img src="${details.channelAvatar || ''}" style="width: 38px; height: 38px; border-radius: 50%; object-fit:cover; background: var(--bg-secondary);" />
            <div>
              <div style="font-size: 13px; font-weight: 600;">${UI.escapeHtml(details.channelTitle)}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${details.channelSubscriberCount ? `${details.channelSubscriberCount} subscribers` : ''}</div>
            </div>
          </div>
          <button class="btn subscribe-btn ${isSub ? 'subscribed' : ''}" data-sub-channel-id="${details.channelId}" 
            data-channel-title="${UI.escapeHtml(details.channelTitle)}" data-channel-avatar="${UI.escapeHtml(details.channelAvatar || '')}">
            ${isSub ? 'Subscribed' : 'Subscribe'}
          </button>
        </div>

        <div style="display: flex; justify-content: space-around; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
          <button class="icon-btn" id="btn-like-video" style="display:flex; flex-direction:column; font-size:11px; gap:4px;">
            ${Icons.Like(isLiked)}
            <span>${details.likeCount || 'Like'}</span>
          </button>
          <button class="icon-btn" id="btn-dislike-video" style="display:flex; flex-direction:column; font-size:11px; gap:4px;">
            ${Icons.Dislike(isDisliked)}
            <span>Dislike</span>
          </button>
          <button class="icon-btn" id="btn-share-video" style="display:flex; flex-direction:column; font-size:11px; gap:4px;">
            ${Icons.Share()}
            <span>Share</span>
          </button>
          <button class="icon-btn ${isSaved ? 'saved-active' : ''}" id="btn-save-video" style="display:flex; flex-direction:column; font-size:11px; gap:4px;">
            ${Icons.Save(isSaved)}
            <span>${isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>

        <!-- In-App Related Videos (Plays inside app, never redirects out) -->
        <h3 style="font-size: 15px; margin: 18px 0 12px 0;">Related Videos</h3>
        <div id="related-videos-container" class="video-feed">
          ${UI.renderSkeletons(2)}
        </div>
      `;

      youtubeApi.getRelatedVideos(videoId, details.categoryId).then(res => {
        const relContainer = document.getElementById('related-videos-container');
        if (relContainer) {
          relContainer.innerHTML = '';
          res.items.forEach(v => relContainer.insertAdjacentHTML('beforeend', UI.renderVideoCard(v)));
        }
      });

      document.getElementById('btn-like-video').addEventListener('click', async () => {
        if (!this.requireAuth('like this video')) return;

        const isNowLiked = await storage.toggleLike(details);
        document.getElementById('btn-like-video').innerHTML = `
          ${Icons.Like(isNowLiked)}
          <span>${isNowLiked ? 'Liked' : 'Like'}</span>
        `;
        document.getElementById('btn-dislike-video').innerHTML = `
          ${Icons.Dislike(false)}
          <span>Dislike</span>
        `;
      });

      document.getElementById('btn-dislike-video').addEventListener('click', async () => {
        if (!this.requireAuth('dislike this video')) return;

        const isNowDisliked = await storage.toggleDislike(details);
        document.getElementById('btn-dislike-video').innerHTML = `
          ${Icons.Dislike(isNowDisliked)}
          <span>${isNowDisliked ? 'Disliked' : 'Dislike'}</span>
        `;
        document.getElementById('btn-like-video').innerHTML = `
          ${Icons.Like(false)}
          <span>${details.likeCount || 'Like'}</span>
        `;
      });

      document.getElementById('btn-save-video').addEventListener('click', () => {
        if (!this.requireAuth('save videos to playlists')) return;
        this.openSaveToPlaylistModal(details);
      });

      document.getElementById('btn-share-video').addEventListener('click', () => {
        this.handleShare(details.id);
      });

    } catch (err) {
      document.getElementById('player-details-container').innerHTML = UI.renderError(err.message, () => this.openPlayer(videoId));
    }
  }

  closePlayerView(updateHistory = true) {
    this.isPlayerOpen = false;
    const overlay = document.getElementById('video-player-overlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';

    playerManager.createMiniPlayer((vidId) => {
      this.openPlayer(vidId);
    });

    if (updateHistory && window.location.hash === '#watch') {
      window.history.back();
    }
  }

  handleShare(videoId) {
    const url = `https://youtu.be/${videoId}`;
    if (navigator.share) {
      navigator.share({ title: 'YouTube Clone Video', url: url });
    } else {
      navigator.clipboard.writeText(url);
      this.showSnackbar('Video link copied to clipboard!');
    }
  }

  openBottomSheet(contentHtml) {
    this.isBottomSheetOpen = true;
    const sheet = document.getElementById('bottom-sheet');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    sheet.innerHTML = contentHtml;
    sheet.classList.add('open');
    backdrop.classList.add('visible');
  }

  closeBottomSheet() {
    this.isBottomSheetOpen = false;
    const sheet = document.getElementById('bottom-sheet');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    sheet.classList.remove('open');
    backdrop.classList.remove('visible');
  }

  setupEventListeners() {
    document.getElementById('bottom-sheet-backdrop').addEventListener('click', () => this.closeBottomSheet());

    document.addEventListener('click', (e) => {
      const videoCard = e.target.closest('.video-card');
      const historyCard = e.target.closest('.history-item-card') || e.target.closest('.full-history-row');
      const subBtn = e.target.closest('[data-sub-channel-id]');

      if (subBtn) {
        e.stopPropagation();
        if (!this.requireAuth('subscribe to channels')) return;

        const chId = subBtn.getAttribute('data-sub-channel-id');
        const title = subBtn.getAttribute('data-channel-title') || 'Channel';
        const avatar = subBtn.getAttribute('data-channel-avatar') || '';

        storage.toggleSubscription({ id: chId, title: title, avatar: avatar }).then(isSubscribed => {
          subBtn.textContent = isSubscribed ? 'Subscribed' : 'Subscribe';
          subBtn.classList.toggle('subscribed', isSubscribed);
          this.showSnackbar(isSubscribed ? 'Subscribed to channel' : 'Subscription removed');
        });
        return;
      }

      // Play video directly in-app
      if (historyCard) {
        const vId = historyCard.getAttribute('data-video-id');
        this.openPlayer(vId);
        return;
      }

      if (videoCard) {
        const vId = videoCard.getAttribute('data-video-id');
        this.openPlayer(vId);
        return;
      }
    });

    const mainView = document.getElementById('main-view');
    mainView.addEventListener('scroll', () => {
      if (this.currentTab !== 'home' || !this.nextPageToken || this.isLoadingMore) return;

      if (mainView.scrollTop + mainView.clientHeight >= mainView.scrollHeight - 300) {
        this.isLoadingMore = true;
        youtubeApi.getPopularVideos(this.nextPageToken, this.activeCategory).then(data => {
          this.nextPageToken = data.nextPageToken;
          const feed = document.getElementById('video-feed');
          data.items.forEach(v => feed.insertAdjacentHTML('beforeend', UI.renderVideoCard(v)));
          this.cachedHomeVideos = [...this.cachedHomeVideos, ...data.items];
          storage.set('cached_home_videos', this.cachedHomeVideos);
          this.isLoadingMore = false;
        }).catch(() => { this.isLoadingMore = false; });
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new YouTubeCloneApp();
});
