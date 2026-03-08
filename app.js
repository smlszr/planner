<!DOCTYPE html>
<html lang="tr" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Planlayıcı — Günün, Senin Tarzında</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="upgrades.css" />
  <link rel="manifest" href="manifest.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Fraunces:ital,wght@0,300;0,500;1,300&display=swap" rel="stylesheet" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Planlayıcı" />
  <meta name="theme-color" content="#18181b" />
  <meta name="description" content="Görevler, hedefler ve takvim yönetimi için güzel bir kişisel planlayıcı." />
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
</head>
<body>

  <!-- ===== GİRİŞ EKRANI ===== -->
  <div id="auth-gate" class="auth-gate">
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-icon">✦</span><span>Planlayıcı</span></div>
      <h2 class="auth-title">Tekrar hoş geldin</h2>
      <p class="auth-sub">Tüm cihazlarda senkronize etmek için giriş yap</p>
      <div id="auth-error" class="auth-error hidden"></div>
      <div class="form-group"><label>E-posta</label><input type="email" id="auth-email" placeholder="sen@ornek.com" /></div>
      <div class="form-group"><label>Şifre</label><input type="password" id="auth-password" placeholder="••••••••" /></div>
      <button class="btn-primary btn-full" id="auth-signin-btn">Giriş Yap</button>
      <button class="btn-ghost btn-full" id="auth-signup-btn">Hesap Oluştur</button>
      <div class="auth-divider"><span>veya</span></div>
      <button class="btn-ghost btn-full" id="auth-google-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right:8px;vertical-align:middle"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google ile Devam Et
      </button>
      <button class="btn-ghost btn-full" id="auth-skip-btn" style="margin-top:8px;font-size:13px;color:var(--text-muted)">Hesapsız kullan (yalnızca bu cihaz)</button>
    </div>
  </div>

  <!-- ===== BİLDİRİM BANNER ===== -->
  <div id="notif-banner" class="notif-banner hidden">
    <span>🔔 Görevler için hatırlatıcı açılsın mı?</span>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" id="notif-allow-btn" style="padding:6px 14px;font-size:13px">İzin Ver</button>
      <button class="btn-ghost" id="notif-deny-btn" style="padding:6px 14px;font-size:13px">Şimdi değil</button>
    </div>
  </div>

  <!-- ===== TOAST ===== -->
  <div id="toast" class="toast hidden"></div>

  <!-- ===== MÜZİK ÇALARI ===== -->
  <div id="music-player" class="music-player hidden">
    <div class="music-player-inner">
      <div class="music-info">
        <div class="music-equalizer" id="music-eq">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="music-text">
          <div class="music-track-name" id="music-track-name">Lo-fi Chill Beats</div>
          <div class="music-track-sub" id="music-track-sub">Odak modu 🎧</div>
        </div>
      </div>
      <div class="music-controls">
        <button class="music-btn" id="music-prev" title="Önceki">⏮</button>
        <button class="music-btn music-btn-play" id="music-play-btn" title="Oynat">▶</button>
        <button class="music-btn" id="music-next" title="Sonraki">⏭</button>
      </div>
      <div class="music-vol-wrap">
        <span style="font-size:13px">🔊</span>
        <input type="range" id="music-vol" min="0" max="1" step="0.05" value="0.5" class="music-vol-slider" />
      </div>
      <button class="music-close-btn" id="music-close-btn" title="Kapat">✕</button>
    </div>
  </div>

  <div class="sidebar-overlay" id="sidebar-overlay"></div>

  <!-- ========== KENAR ÇUBUĞU ========== -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-top">
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menüyü aç/kapat">
        <span class="h-line"></span><span class="h-line"></span><span class="h-line"></span>
      </button>
      <div class="sidebar-brand">
        <span class="brand-icon">✦</span>
        <span class="brand-name">Planlayıcı</span>
      </div>
    </div>

    <nav class="sidebar-nav" role="navigation">
      <a href="#" class="nav-item active" data-view="dashboard" data-tooltip="Ana Sayfa">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span>
        <span class="nav-label">Ana Sayfa</span>
      </a>
      <a href="#" class="nav-item" data-view="year-goals" data-tooltip="Yıllık Hedefler">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
        <span class="nav-label">Yıllık Hedefler</span>
      </a>
      <a href="#" class="nav-item" data-view="month-goals" data-tooltip="Aylık Hedefler">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg></span>
        <span class="nav-label">Aylık Hedefler</span>
      </a>
      <a href="#" class="nav-item" data-view="week-goals" data-tooltip="Haftalık Hedefler">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg></span>
        <span class="nav-label">Haftalık Hedefler</span>
      </a>
      <a href="#" class="nav-item" data-view="week-planner" data-tooltip="Hafta Planlayıcı">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg></span>
        <span class="nav-label">Hafta Planlayıcı</span>
      </a>
      <a href="#" class="nav-item" data-view="calendar" data-tooltip="Takvim">
        <span class="nav-indicator"></span>
        <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/></svg></span>
        <span class="nav-label">Takvim</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <button class="dark-mode-toggle" id="music-toggle-btn" data-tooltip="Odak Müziği">
        <span class="nav-icon" style="font-size:17px">🎵</span>
        <span class="nav-label">Odak Müziği</span>
      </button>
      <button class="dark-mode-toggle" id="dark-mode-toggle" data-tooltip="Tema Değiştir">
        <span class="nav-icon" id="theme-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </span>
        <span class="nav-label" id="theme-label">Açık Tema</span>
      </button>
      <div class="sidebar-user" id="sidebar-user">
        <div class="user-avatar" id="user-avatar">?</div>
        <div class="user-info">
          <span class="user-name" id="user-name">Misafir</span>
          <button class="sign-out-btn" id="sign-out-btn">Çıkış yap</button>
        </div>
      </div>
      <div class="sidebar-date-block" data-tooltip="Bugün">
        <span class="sidebar-date-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
        <span class="sidebar-date-text" id="sidebar-date">Bugün</span>
      </div>
    </div>
  </aside>

  <!-- ========== ANA İÇERİK ========== -->
  <main class="main-content" id="main-content">

    <div class="mobile-topbar">
      <button class="mobile-menu-btn" id="mobile-menu-btn"><span class="h-line"></span><span class="h-line"></span><span class="h-line"></span></button>
      <span class="mobile-brand">✦ Planlayıcı</span>
      <div style="display:flex;gap:6px">
        <button class="mobile-theme-btn" id="music-toggle-btn-mobile">🎵</button>
        <button class="mobile-theme-btn" id="mobile-theme-btn">🌙</button>
      </div>
    </div>

    <!-- ANA SAYFA -->
    <section class="view active" id="view-dashboard">
      <header class="view-header">
        <div>
          <h1 class="view-title">İyi <span id="greeting-time">sabahlar</span> ☀️</h1>
          <p class="view-subtitle" id="full-date-display">Yükleniyor...</p>
        </div>
        <button class="btn-primary" id="quick-add-btn">+ Hızlı Görev Ekle</button>
      </header>
      <div class="dashboard-grid">
        <div class="widget widget-tall">
          <div class="widget-header"><h3>Bugünün Görevleri</h3><span class="badge" id="today-task-count">0</span></div>
          <div class="widget-body" id="dashboard-today-tasks"><p class="empty-state">Bugün için görev yok. Hemen ekle!</p></div>
        </div>
        <div class="widget">
          <div class="widget-header"><h3>Haftalık İlerleme</h3></div>
          <div class="widget-body">
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 80 80">
                <circle class="ring-bg" cx="40" cy="40" r="30"/>
                <circle class="ring-fill" id="weekly-ring" cx="40" cy="40" r="30"/>
              </svg>
              <div class="progress-label"><span id="weekly-pct">0%</span><small>tamamlandı</small></div>
            </div>
            <p class="progress-caption" id="weekly-caption">Bu hafta 0 görevden 0'ı tamamlandı</p>
          </div>
        </div>
        <div class="widget widget-image">
          <div class="widget-header">
            <h3>Görsel Pano</h3>
            <label class="icon-btn upload-label" title="Görsel yükle">📎<input type="file" accept="image/*" class="hidden-file" data-widget="img1" /></label>
          </div>
          <div class="image-drop-zone" id="img-zone-1">
            <p>📎 tıkla ve görsel ekle</p>
            <img id="widget-img-1" src="" alt="" class="widget-img hidden" />
          </div>
        </div>
        <div class="widget">
          <div class="widget-header"><h3>Bu Haftanın Hedefleri</h3></div>
          <div class="widget-body" id="dashboard-week-goals"><p class="empty-state">Haftalık hedef belirlenmedi.</p></div>
        </div>
      </div>
    </section>

    <!-- YILLIK HEDEFLER -->
    <section class="view" id="view-year-goals">
      <header class="view-header">
        <div><h1 class="view-title">Yıllık Hedefler</h1><p class="view-subtitle"><span id="current-year-label"></span> için büyük hayaller</p></div>
        <button class="btn-primary" onclick="openGoalModal('year')">+ Hedef Ekle</button>
      </header>
      <div class="goals-grid" id="year-goals-list"><p class="empty-state full-width">Henüz yıllık hedef yok. Hayal kurmaya başla!</p></div>
    </section>

    <!-- AYLIK HEDEFLER -->
    <section class="view" id="view-month-goals">
      <header class="view-header">
        <div><h1 class="view-title">Aylık Hedefler</h1><p class="view-subtitle"><span id="current-month-label"></span> ayı odağı</p></div>
        <button class="btn-primary" onclick="openGoalModal('month')">+ Hedef Ekle</button>
      </header>
      <div class="goals-grid" id="month-goals-list"><p class="empty-state full-width">Henüz aylık hedef yok.</p></div>
    </section>

    <!-- HAFTALIK HEDEFLER -->
    <section class="view" id="view-week-goals">
      <header class="view-header">
        <div><h1 class="view-title">Haftalık Hedefler</h1><p class="view-subtitle">Bu haftanın hedefleri</p></div>
        <button class="btn-primary" onclick="openGoalModal('week')">+ Hedef Ekle</button>
      </header>
      <div class="goals-grid" id="week-goals-list"><p class="empty-state full-width">Henüz haftalık hedef yok.</p></div>
    </section>

    <!-- HAFTA PLANLAYICI -->
    <section class="view" id="view-week-planner">
      <header class="view-header">
        <div><h1 class="view-title">Hafta Planlayıcı</h1><p class="view-subtitle" id="week-planner-range">Yükleniyor...</p></div>
        <div class="header-actions">
          <button class="btn-ghost" id="week-prev">← Önceki</button>
          <button class="btn-ghost" id="week-next">Sonraki →</button>
          <button class="btn-primary" id="week-add-task-btn">+ Görev Ekle</button>
        </div>
      </header>
      <div class="week-board" id="week-board"></div>
    </section>

    <!-- TAKVİM -->
    <section class="view" id="view-calendar">
      <header class="view-header">
        <div><h1 class="view-title">Takvim</h1><p class="view-subtitle" id="cal-current-label">Yükleniyor...</p></div>
        <div class="header-actions">
          <div class="view-switcher">
            <button class="vsw-btn active" data-calview="month">Ay</button>
            <button class="vsw-btn" data-calview="week">Hafta</button>
            <button class="vsw-btn" data-calview="day">Gün</button>
            <button class="vsw-btn" data-calview="year">Yıl</button>
          </div>
          <button class="btn-ghost" id="cal-prev">←</button>
          <button class="btn-ghost" id="cal-today-btn">Bugün</button>
          <button class="btn-ghost" id="cal-next">→</button>
          <button class="btn-primary" id="cal-add-task-btn">+ Görev Ekle</button>
        </div>
      </header>
      <div id="calendar-container"></div>
    </section>

  </main>

  <!-- GÖREV MODALI -->
  <div class="modal-overlay hidden" id="task-modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="task-modal-title">Yeni Görev</h2>
        <button class="modal-close" id="task-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Görev Başlığı *</label><input type="text" id="task-title-input" placeholder="Ne yapılması gerekiyor?" /></div>
        <div class="form-group"><label>Açıklama</label><textarea id="task-desc-input" placeholder="Daha fazla detay ekle..." rows="2"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Tarih *</label><input type="date" id="task-date-input" /></div>
          <div class="form-group"><label>Saat</label><input type="time" id="task-time-input" /></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>🔁 Tekrar</label>
            <select id="task-recurrence-input">
              <option value="none">Tekrar yok</option>
              <option value="daily">Her gün</option>
              <option value="weekly">Her hafta</option>
              <option value="monthly">Her ay</option>
              <option value="yearly">Her yıl</option>
            </select>
          </div>
          <div class="form-group" id="recurrence-end-group">
            <label>Bitiş tarihi</label>
            <input type="date" id="task-recurrence-end" />
          </div>
        </div>
        <div class="form-group">
          <label>🔔 Hatırlatıcı</label>
          <select id="task-reminder-input">
            <option value="none">Hatırlatıcı yok</option>
            <option value="0">Görev saatinde</option>
            <option value="5">5 dakika önce</option>
            <option value="15">15 dakika önce</option>
            <option value="30">30 dakika önce</option>
            <option value="60">1 saat önce</option>
            <option value="1440">1 gün önce</option>
          </select>
        </div>
        <div class="form-group">
          <label>Renk Etiketi</label>
          <div class="color-picker">
            <span class="color-dot selected" data-color="#b5d5c5" style="background:#b5d5c5"></span>
            <span class="color-dot" data-color="#ffd6a5" style="background:#ffd6a5"></span>
            <span class="color-dot" data-color="#ffafcc" style="background:#ffafcc"></span>
            <span class="color-dot" data-color="#a2d2ff" style="background:#a2d2ff"></span>
            <span class="color-dot" data-color="#cdb4db" style="background:#cdb4db"></span>
            <span class="color-dot" data-color="#caffbf" style="background:#caffbf"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Görsel Ekle</label>
          <label class="file-upload-area">
            <span id="task-img-label">📎 Görsel yüklemek için tıkla</span>
            <input type="file" accept="image/*" id="task-img-input" class="hidden-file" />
          </label>
          <img id="task-img-preview" src="" alt="" class="img-preview hidden" />
        </div>
        <input type="hidden" id="task-edit-id" value="" />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="task-modal-cancel">İptal</button>
        <button class="btn-primary" id="task-modal-save">Görevi Kaydet</button>
      </div>
    </div>
  </div>

  <!-- HEDEF MODALI -->
  <div class="modal-overlay hidden" id="goal-modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="goal-modal-title">Yeni Hedef</h2>
        <button class="modal-close" id="goal-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Hedef Başlığı *</label><input type="text" id="goal-title-input" placeholder="Ne başarmak istiyorsun?" /></div>
        <div class="form-group"><label>Açıklama</label><textarea id="goal-desc-input" placeholder="Hedefini açıkla..." rows="3"></textarea></div>
        <input type="hidden" id="goal-type-input" /><input type="hidden" id="goal-edit-id" />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="goal-modal-cancel">İptal</button>
        <button class="btn-primary" id="goal-modal-save">Hedefi Kaydet</button>
      </div>
    </div>
  </div>

  <!-- DETAY MODALI -->
  <div class="modal-overlay hidden" id="detail-modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="detail-task-title">Görev Detayı</h2>
        <button class="modal-close" id="detail-modal-close">✕</button>
      </div>
      <div class="modal-body" id="detail-modal-body"></div>
      <div class="modal-footer">
        <button class="btn-danger" id="detail-delete-btn">Sil</button>
        <button class="btn-primary" id="detail-edit-btn">Görevi Düzenle</button>
      </div>
    </div>
  </div>

  <!-- MOBİL ALT NAV -->
  <nav class="mobile-bottom-nav">
    <div class="bottom-nav-inner">
      <a href="#" class="bottom-nav-item active" data-view="dashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        Ana Sayfa
      </a>
      <a href="#" class="bottom-nav-item" data-view="week-planner">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
        Planlayıcı
      </a>
      <a href="#" class="bottom-nav-item" data-view="calendar">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Takvim
      </a>
      <a href="#" class="bottom-nav-item" data-view="year-goals">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Hedefler
      </a>
    </div>
  </nav>

  <button class="mobile-fab" id="mobile-fab" aria-label="Yeni görev ekle">+</button>

  <script src="app.js"></script>
  <script src="upgrades.js"></script>
  <script src="music.js"></script>
</body>
</html>
