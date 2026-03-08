/* ============================================================
   MÜZİK ÇALARI — music.js
   Lofi / Ambient / Jazz radyo akışları
   ============================================================ */

const MusicPlayer = {
  tracks: [
    {
      name: 'Lo-fi Chill Beats',
      sub:  'Odak modu 🎧',
      url:  'https://stream.zeno.fm/f3wvbbqmdg8uv'
    },
    {
      name: 'Chillhop Radio',
      sub:  'Rahatlatıcı hip-hop 🌿',
      url:  'https://stream.zeno.fm/0r0xa792kwzuv'
    },
    {
      name: 'Ambient Sleep Radio',
      sub:  'Derin odak 🌊',
      url:  'https://stream.zeno.fm/yn65fbz綠2ruv'
    },
    {
      name: 'Jazz Vibes',
      sub:  'Caz keyfi ☕',
      url:  'https://stream.zeno.fm/wrb0bm4hm78uv'
    },
    {
      name: 'Study Beats',
      sub:  'Çalışma müziği 📚',
      url:  'https://stream.zeno.fm/6h8mzafqf48uv'
    }
  ],

  current:  0,
  playing:  false,
  audio:    null,
  volume:   0.5,

  init() {
    this.audio = new Audio();
    this.audio.volume = this.volume;
    this.audio.crossOrigin = 'anonymous';

    // Restore volume from storage
    const saved = localStorage.getItem('planner_music_vol');
    if(saved) { this.volume = parseFloat(saved); this.audio.volume = this.volume; }

    // Saved track index
    const savedTrack = localStorage.getItem('planner_music_track');
    if(savedTrack) this.current = parseInt(savedTrack) || 0;

    // Wire up toggle buttons (sidebar + mobile topbar)
    document.getElementById('music-toggle-btn')?.addEventListener('click', () => this.togglePlayer());
    document.getElementById('music-toggle-btn-mobile')?.addEventListener('click', () => this.togglePlayer());

    // Player controls
    document.getElementById('music-play-btn')?.addEventListener('click', () => this.togglePlay());
    document.getElementById('music-prev')?.addEventListener('click', () => this.prev());
    document.getElementById('music-next')?.addEventListener('click', () => this.next());
    document.getElementById('music-close-btn')?.addEventListener('click', () => this.hidePlayer());
    document.getElementById('music-vol')?.addEventListener('input', e => {
      this.volume = parseFloat(e.target.value);
      this.audio.volume = this.volume;
      localStorage.setItem('planner_music_vol', this.volume);
    });

    // Auto-next on stream end / error
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', () => {
      setTimeout(() => this.next(), 2000);
    });

    this.updateUI();
  },

  togglePlayer() {
    const player = document.getElementById('music-player');
    if(player.classList.contains('hidden')) {
      player.classList.remove('hidden');
      // Auto-play when opened
      if(!this.playing) this.togglePlay();
    } else {
      this.hidePlayer();
    }
  },

  hidePlayer() {
    document.getElementById('music-player').classList.add('hidden');
  },

  togglePlay() {
    if(this.playing) {
      this.pause();
    } else {
      this.play();
    }
  },

  play() {
    const track = this.tracks[this.current];
    if(this.audio.src !== track.url) {
      this.audio.src = track.url;
    }
    this.audio.play().catch(() => {
      // Stream might be unavailable, try next
      showToast('⚠️ Bu akış şu an kullanılamıyor, sonraki deneniyor...');
      setTimeout(() => this.next(), 1500);
    });
    this.playing = true;
    this.updateUI();
    this.startEqualizer();
  },

  pause() {
    this.audio.pause();
    this.playing = false;
    this.updateUI();
    this.stopEqualizer();
  },

  prev() {
    this.current = (this.current - 1 + this.tracks.length) % this.tracks.length;
    localStorage.setItem('planner_music_track', this.current);
    const wasPlaying = this.playing;
    this.audio.src = '';
    this.playing = false;
    this.updateUI();
    if(wasPlaying) this.play();
    else this.updateUI();
  },

  next() {
    this.current = (this.current + 1) % this.tracks.length;
    localStorage.setItem('planner_music_track', this.current);
    const wasPlaying = this.playing;
    this.audio.src = '';
    this.playing = false;
    if(wasPlaying) this.play();
    else this.updateUI();
  },

  updateUI() {
    const track = this.tracks[this.current];
    const nameEl = document.getElementById('music-track-name');
    const subEl  = document.getElementById('music-track-sub');
    const playBtn= document.getElementById('music-play-btn');
    const volEl  = document.getElementById('music-vol');

    if(nameEl) nameEl.textContent = track.name;
    if(subEl)  subEl.textContent  = track.sub;
    if(playBtn) playBtn.textContent = this.playing ? '⏸' : '▶';
    if(volEl)  volEl.value = this.volume;

    // Update sidebar music button appearance
    const btn = document.getElementById('music-toggle-btn');
    if(btn) {
      btn.style.color = this.playing ? 'var(--sb-active-color)' : '';
    }
  },

  _eqInterval: null,

  startEqualizer() {
    const bars = document.querySelectorAll('#music-eq span');
    if(!bars.length) return;
    this._eqInterval = setInterval(() => {
      bars.forEach(bar => {
        const h = Math.random() * 14 + 4;
        bar.style.height = h + 'px';
      });
    }, 200);
  },

  stopEqualizer() {
    clearInterval(this._eqInterval);
    document.querySelectorAll('#music-eq span').forEach(bar => {
      bar.style.height = '4px';
    });
  }
};

// Add music player CSS inline
const musicCSS = `
.music-player {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 400;
  width: calc(100% - 40px);
  max-width: 560px;
  animation: slideUpMusic 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes slideUpMusic {
  from { opacity:0; transform: translateX(-50%) translateY(20px); }
  to   { opacity:1; transform: translateX(-50%) translateY(0); }
}
.music-player-inner {
  background: var(--sb-bg);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.4);
  backdrop-filter: blur(20px);
  flex-wrap: wrap;
}
[data-theme="dark"] .music-player-inner {
  background: rgba(10,10,14,0.95);
}
.music-info {
  display: flex; align-items: center; gap: 10px; flex: 1; min-width: 140px;
}
.music-equalizer {
  display: flex; align-items: flex-end; gap: 2px; height: 20px; flex-shrink: 0;
}
.music-equalizer span {
  display: block; width: 3px; height: 4px;
  background: var(--sb-active-color);
  border-radius: 2px;
  transition: height 0.15s ease;
}
.music-track-name {
  font-size: 13px; font-weight: 600; color: #e4e0d8; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; max-width: 160px;
}
.music-track-sub {
  font-size: 11px; color: #6b6763; margin-top: 2px;
}
.music-controls {
  display: flex; align-items: center; gap: 6px;
}
.music-btn {
  background: rgba(255,255,255,0.08); border: none;
  border-radius: 50%; width: 34px; height: 34px;
  color: #e4e0d8; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.music-btn:hover { background: rgba(255,255,255,0.15); }
.music-btn:active { transform: scale(0.9); }
.music-btn-play {
  width: 40px; height: 40px; font-size: 15px;
  background: var(--sb-active-color);
  color: #18181b;
}
.music-btn-play:hover { background: #9dc5b3; }
.music-vol-wrap {
  display: flex; align-items: center; gap: 6px;
}
.music-vol-slider {
  -webkit-appearance: none; appearance: none;
  width: 80px; height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 99px; outline: none; cursor: pointer;
}
.music-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: var(--sb-active-color); cursor: pointer;
}
.music-close-btn {
  background: rgba(255,255,255,0.06); border: none;
  border-radius: 50%; width: 28px; height: 28px;
  color: #6b6763; font-size: 11px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}
.music-close-btn:hover { background: rgba(224,90,90,0.2); color: #e05a5a; }

@media (max-width: 900px) {
  .music-player { bottom: 88px; width: calc(100% - 24px); }
  .music-vol-wrap { display: none; }
  .music-track-name { max-width: 120px; }
}
`;

const styleEl = document.createElement('style');
styleEl.textContent = musicCSS;
document.head.appendChild(styleEl);

// Boot
document.addEventListener('DOMContentLoaded', () => {
  MusicPlayer.init();
});
