/**
 * Official YouTube Style Vector SVG Icons
 */
export const Icons = {
  YouTubeLogo: () => `
    <div style="display:flex; align-items:center; gap:5px; font-family:'Roboto', 'Arial', sans-serif; cursor:pointer;">
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <path d="M27.4 3.1c-.3-1.2-1.2-2.1-2.4-2.4C22.9.1 14 .1 14 .1s-8.9 0-11 .6C1.8 1 0.9 1.9.6 3.1.1 5.2 0 10 0 10s.1 4.8.6 6.9c.3 1.2 1.2 2.1 2.4 2.4 2.1.6 11 .6 11 .6s8.9 0 11-.6c1.2-.3 2.1-1.2 2.4-2.4.5-2.1.6-6.9.6-6.9s-.1-4.8-.6-6.9z" fill="#FF0000"/>
        <polygon points="11.2,14.3 18.5,10 11.2,5.7" fill="#FFFFFF"/>
      </svg>
      <span style="font-weight:700; font-size:18px; letter-spacing:-0.8px; color:var(--text-primary);">YouTube Clone</span>
    </div>
  `,

  Home: (active = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${active ? '0' : '2'}">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1v-9.5z"/>
    </svg>`,
    
  // Official YouTube Shorts S-Play Logo (Exact Match to Picture 3)
  Shorts: (active = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path d="M10.74 3.32a4.42 4.42 0 0 1 5.76 1.77l1.18 2.05a4.42 4.42 0 0 1-1.77 5.76l-1.52.88 1.94.84a4.42 4.42 0 0 1 2.34 5.56 4.42 4.42 0 0 1-5.56 2.34l-6.14-2.66a4.42 4.42 0 0 1-2.34-5.56l1.18-2.05a4.42 4.42 0 0 1 1.77-5.76l1.52-.88-1.94-.84a4.42 4.42 0 0 1-2.34-5.56A4.42 4.42 0 0 1 10.74 3.32z" 
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="${active ? 'currentColor' : 'none'}"/>
      <polygon points="10 9 15 12 10 15" fill="${active ? '#ffffff' : 'currentColor'}"/>
    </svg>`,
    
  Subscriptions: (active = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
      <path d="M4 6h16M2 10h20M6 14h12M8 18h8"/>
    </svg>`,
    
  YouProfile: (active = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
    </svg>`,
    
  Search: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,

  Back: () => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>`,

  Mic: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>`,

  Close: () => `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,

  Comment: () => `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`,

  MoreVert: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <circle cx="12" cy="5" r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="12" cy="19" r="2"/>
    </svg>`,

  ChevronRight: () => `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`,

  Like: (filled = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>`,

  Dislike: (filled = false) => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
    </svg>`,

  Share: () => `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>`,

  Save: (filled = false) => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>`,

  History: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,

  Trash: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`,

  Google: () => `
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>`,

  // Password Eye Icons (Screenshot 6 Match)
  Eye: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,

  EyeOff: () => `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`
};
