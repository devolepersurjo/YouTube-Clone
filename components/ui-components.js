import { Icons } from './icons.js';

export const UI = {
  renderVideoCard(video) {
    const initial = (video.channelTitle || 'C').charAt(0).toUpperCase();

    return `
      <div class="video-card ripple" data-video-id="${video.id}" data-channel-id="${video.channelId}">
        <div class="thumbnail-wrapper">
          <img class="thumbnail" src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}" loading="lazy" />
          ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
        </div>
        <div class="video-info">
          <div class="channel-avatar-wrapper" data-channel-id="${video.channelId}">
            ${video.channelAvatar ? `
              <img class="channel-avatar-img" src="${video.channelAvatar}" alt="${this.escapeHtml(video.channelTitle)}" 
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="avatar-placeholder" style="display:none;">${initial}</div>
            ` : `
              <div class="avatar-placeholder">${initial}</div>
            `}
          </div>
          <div class="meta-content">
            <h3 class="video-title">${this.escapeHtml(video.title)}</h3>
            <div class="video-subtext">
              <span class="channel-name" data-channel-id="${video.channelId}">${this.escapeHtml(video.channelTitle)}</span>
              <span class="bullet-dot">•</span>
              <span>${video.viewCount} views</span>
              <span class="bullet-dot">•</span>
              <span>${video.timeAgo || ''}</span>
            </div>
          </div>
          <button class="icon-btn action-menu-btn" data-video-action="${video.id}" aria-label="More options">
            ${Icons.MoreVert()}
          </button>
        </div>
      </div>
    `;
  },

  renderHistoryCard(video) {
    return `
      <div class="history-item-card ripple" data-video-id="${video.id}">
        <div class="history-thumb-wrap">
          <img src="${video.thumbnail}" class="history-thumb-img" loading="lazy" />
          ${video.duration ? `<span class="history-duration">${video.duration}</span>` : ''}
        </div>
        <div class="history-meta-wrap">
          <h4 class="history-card-title">${this.escapeHtml(video.title)}</h4>
          <p class="history-channel-name">${this.escapeHtml(video.channelTitle)}</p>
        </div>
      </div>
    `;
  },

  renderHistoryFullItem(video) {
    return `
      <div class="full-history-row ripple" data-video-id="${video.id}">
        <div class="full-history-thumb-wrap">
          <img src="${video.thumbnail}" class="full-history-thumb" loading="lazy" />
          ${video.duration ? `<span class="full-history-duration">${video.duration}</span>` : ''}
        </div>
        <div class="full-history-info">
          <h4 class="full-history-title">${this.escapeHtml(video.title)}</h4>
          <p class="full-history-subtext">${this.escapeHtml(video.channelTitle)} • ${video.viewCount ? `${video.viewCount} views` : ''}</p>
        </div>
        <button class="icon-btn full-history-menu-btn" data-video-action="${video.id}" aria-label="Options">
          ${Icons.MoreVert()}
        </button>
      </div>
    `;
  },

  renderChannelCard(channel, isSubscribed = false) {
    return `
      <div class="channel-card ripple" data-channel-id="${channel.id}">
        <img class="channel-card-avatar" src="${channel.avatar || channel.thumbnail}" alt="${this.escapeHtml(channel.title)}" />
        <div class="channel-card-info">
          <h3 class="channel-card-title">${this.escapeHtml(channel.title)}</h3>
          <p class="channel-card-subs">${channel.subscriberCount ? `${channel.subscriberCount} subscribers` : ''}</p>
        </div>
        <button class="btn subscribe-btn ${isSubscribed ? 'subscribed' : ''}" data-sub-channel-id="${channel.id}">
          ${isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>
    `;
  },

  // Home Feed Skeleton
  renderSkeletons(count = 3, showChips = false) {
    let chipsHtml = '';
    if (showChips) {
      chipsHtml = `
        <div class="skeleton-chips-bar">
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
          <div class="skeleton-chip-item skeleton-shimmer"></div>
        </div>
      `;
    }

    let cardsHtml = '';
    for (let i = 0; i < count; i++) {
      cardsHtml += `
        <div class="skeleton-card">
          <div class="skeleton-thumbnail skeleton-shimmer"></div>
          <div class="skeleton-details">
            <div class="skeleton-avatar skeleton-shimmer"></div>
            <div class="skeleton-lines">
              <div class="skeleton-line-title skeleton-shimmer"></div>
              <div class="skeleton-line-subtitle skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      `;
    }
    return chipsHtml + cardsHtml;
  },

  // 9:16 Vertical Shorts Skeleton (Screenshot 3 Fix)
  renderShortsSkeleton() {
    return `
      <div class="short-skeleton-card">
        <div class="short-skeleton-bg skeleton-shimmer"></div>
        <div class="short-skeleton-sidebar">
          <div class="short-skel-btn skeleton-shimmer"></div>
          <div class="short-skel-btn skeleton-shimmer"></div>
          <div class="short-skel-btn skeleton-shimmer"></div>
        </div>
        <div class="short-skeleton-bottom">
          <div class="short-skel-avatar skeleton-shimmer"></div>
          <div class="short-skel-line skeleton-shimmer" style="width: 60%; height: 14px; margin-bottom: 8px;"></div>
          <div class="short-skel-line skeleton-shimmer" style="width: 80%; height: 12px;"></div>
        </div>
      </div>
    `;
  },

  renderError(message, retryCallbackName) {
    return `
      <div class="error-container">
        <div class="error-icon-circle">!</div>
        <h3 class="error-title">Something went wrong</h3>
        <p class="error-message">${this.escapeHtml(message)}</p>
        <button class="btn btn-primary ripple" onclick="${retryCallbackName}()">Retry</button>
      </div>
    `;
  },

  renderEmpty(message = 'No content found') {
    return `
      <div class="empty-container">
        <p class="empty-message">${this.escapeHtml(message)}</p>
      </div>
    `;
  },

  escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
};
