class VideoPlayerManager {
  constructor() {
    this.currentVideoId = null;
    this.currentVideoDetails = null;
    this.isPlaying = true;
    this._setupGlobalMediaBridge();
  }

  // Two-way bridge between Android Notification & Web App
  _setupGlobalMediaBridge() {
    // 1. Android Notification থেকে কমান্ড এলে এখানে এক্সিকিউট হবে
    window.onAndroidMediaPlay = () => this.resumeVideo();
    window.onAndroidMediaPause = () => this.pauseVideo();
    window.onAndroidMediaNext = () => this.playNextRelatedVideo();
    window.onAndroidMediaPrev = () => this.replayCurrentVideo();

    // 2. Browser / Android W3C MediaSession API (লক স্ক্রিন ও ব্যাকগ্রাউন্ড অডিও সাপোর্ট)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resumeVideo());
      navigator.mediaSession.setActionHandler('pause', () => this.pauseVideo());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNextRelatedVideo());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.replayCurrentVideo());
    }
  }

  loadVideo(videoId, details = null) {
    this.currentVideoId = videoId;
    this.currentVideoDetails = details;
    this.isPlaying = true;

    this.destroyMiniPlayer();

    const wrapper = document.querySelector('.responsive-iframe-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
      <iframe
        id="main-yt-player"
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&fs=1"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>
    `;

    // Send Song Info to Android Notification & Lockscreen MediaSession
    if (details) {
      this.updateAndroidMediaMetadata(details);
    }
  }

  updateAndroidMediaMetadata(details) {
    const title = details.title || 'YouTube Music';
    const artist = details.channelTitle || 'YouTube Clone Premium';
    const artwork = details.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png';

    // 1. Update Android Native Notification (Sketchware Interface)
    if (window.AndroidMedia && typeof window.AndroidMedia.updateMediaNotification === 'function') {
      try {
        window.AndroidMedia.updateMediaNotification(title, artist, artwork, true);
      } catch (e) {
        console.warn('Android bridge notification error:', e);
      }
    }

    // 2. Update Browser Native MediaSession (For lockscreen controls)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: 'YouTube Clone Premium',
        artwork: [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  resumeVideo() {
    const iframe = document.getElementById('main-yt-player') || document.getElementById('mini-yt-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      this.isPlaying = true;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      if (window.AndroidMedia) window.AndroidMedia.updatePlaybackState(true);
    }
  }

  pauseVideo() {
    const iframe = document.getElementById('main-yt-player') || document.getElementById('mini-yt-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      this.isPlaying = false;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      if (window.AndroidMedia) window.AndroidMedia.updatePlaybackState(false);
    }
  }

  playNextRelatedVideo() {
    const nextCard = document.querySelector('#related-videos-container .video-card');
    if (nextCard) {
      const nextId = nextCard.getAttribute('data-video-id');
      if (window.app && nextId) window.app.openPlayer(nextId);
    }
  }

  replayCurrentVideo() {
    const iframe = document.getElementById('main-yt-player');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
      this.resumeVideo();
    }
  }

  createMiniPlayer(onExpandCallback) {
    if (!this.currentVideoId) return;
    this.destroyMiniPlayer();

    let miniPlayer = document.createElement('div');
    miniPlayer.id = 'yt-mini-player';
    miniPlayer.className = 'yt-floating-mini-player';

    const title = this.currentVideoDetails?.title || 'YouTube Video';
    const channel = this.currentVideoDetails?.channelTitle || 'Playing';

    miniPlayer.innerHTML = `
      <div class="mini-player-video-wrap">
        <iframe
          id="mini-yt-iframe"
          src="https://www.youtube-nocookie.com/embed/${this.currentVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0"
          style="width:100%;height:100%;border:none;pointer-events:none;"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media">
        </iframe>
      </div>
      <div class="mini-player-info" id="mini-player-expand-trigger">
        <h4 class="mini-player-title">${title}</h4>
        <p class="mini-player-channel">${channel}</p>
      </div>
      <div class="mini-player-controls">
        <button class="mini-ctrl-btn" id="btn-mini-playpause" aria-label="Play/Pause">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <button class="mini-ctrl-btn" id="btn-mini-close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(miniPlayer);

    document.getElementById('mini-player-expand-trigger')?.addEventListener('click', () => {
      this.destroyMiniPlayer();
      if (onExpandCallback) onExpandCallback(this.currentVideoId);
    });

    document.getElementById('btn-mini-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });

    document.getElementById('btn-mini-playpause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isPlaying) {
        this.pauseVideo();
        document.getElementById('btn-mini-playpause').innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        `;
      } else {
        this.resumeVideo();
        document.getElementById('btn-mini-playpause').innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        `;
      }
    });
  }

  destroyMiniPlayer() {
    const existing = document.getElementById('yt-mini-player');
    if (existing) existing.remove();
  }

  destroy() {
    this.destroyMiniPlayer();
    const wrapper = document.querySelector('.responsive-iframe-wrapper');
    if (wrapper) wrapper.innerHTML = '<div id="player-target"></div>';
    this.currentVideoId = null;
    this.currentVideoDetails = null;

    if (window.AndroidMedia && typeof window.AndroidMedia.stopMediaNotification === 'function') {
      window.AndroidMedia.stopMediaNotification();
    }
  }
}

export const playerManager = new VideoPlayerManager();
