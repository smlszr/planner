/* ============================================================
   PLANNER APP — app.js
   UPGRADES: Dark Mode · Recurring Tasks · Push Notifications · Firebase Sync
   ============================================================ */

/* ============================================================
   FIREBASE CONFIG
   ⚠️  REPLACE the values below with YOUR Firebase project config.
       Go to: console.firebase.google.com → Your Project
       → Project Settings → Your apps → Web app → SDK setup
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const FIREBASE_ENABLED = false; // Giriş ekranı kapatıldı

/* ============================================================
   1. STATE
   ============================================================ */
let state = {
  tasks:             [],
  goals:             { year: [], month: [], week: [] },
  images:            { img1: null },
  calendarView:      'month',
  calendarDate:      new Date(),
  weekPlannerOffset: 0,
  sidebarCollapsed:  false,
  darkMode:          false,
  currentUser:       null,   // Firebase user object
  useFirebase:       false   // true once user logs in with Firebase
};

let db   = null;  // Firestore instance
let auth = null;  // Firebase Auth instance

/* ============================================================
   2. PERSISTENCE (localStorage fallback + Firebase)
   ============================================================ */
function saveState() {
  try {
    // Always save UI prefs locally
    localStorage.setItem('planner_prefs', JSON.stringify({
      sidebarCollapsed: state.sidebarCollapsed,
      darkMode:         state.darkMode,
      calendarView:     state.calendarView,
      calendarDate:     state.calendarDate,
      weekPlannerOffset:state.weekPlannerOffset
    }));
    // Save data locally as backup
    localStorage.setItem('planner_data', JSON.stringify({
      tasks:  state.tasks,
      goals:  state.goals,
      images: state.images
    }));
    // Sync to Firebase if logged in
    if (state.useFirebase && state.currentUser && db) {
      syncToFirebase();
    }
  } catch(e) { console.warn('Save failed:', e); }
}

function loadState() {
  try {
    const prefs = JSON.parse(localStorage.getItem('planner_prefs') || '{}');
    const data  = JSON.parse(localStorage.getItem('planner_data')  || '{}');
    state.sidebarCollapsed   = prefs.sidebarCollapsed  || false;
    state.darkMode           = prefs.darkMode           || false;
    state.calendarView       = prefs.calendarView       || 'month';
    state.calendarDate       = prefs.calendarDate ? new Date(prefs.calendarDate) : new Date();
    state.weekPlannerOffset  = prefs.weekPlannerOffset  || 0;
    state.tasks              = data.tasks  || [];
    state.goals              = data.goals  || { year: [], month: [], week: [] };
    state.images             = data.images || { img1: null };
  } catch(e) { console.warn('Load failed:', e); }
}

/* ============================================================
   3. FIREBASE SETUP
   ============================================================ */
function initFirebase() {
  if (!FIREBASE_ENABLED) return;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db   = firebase.firestore();

    // Google provider
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // Auth state listener
    auth.onAuthStateChanged(user => {
      if (user) {
        state.currentUser = user;
        state.useFirebase = true;
        hideAuthGate();
        setUserUI(user);
        loadFromFirebase();
        showToast('☁️ Bulutla senkronize edildi');
      } else {
        state.currentUser = null;
        state.useFirebase = false;
        setUserUI(null);
      }
    });

    // Sign in with email
    document.getElementById('auth-signin-btn').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass  = document.getElementById('auth-password').value;
      if (!email || !pass) return showAuthError('Please fill in both fields.');
      try {
        await auth.signInWithEmailAndPassword(email, pass);
      } catch(e) { showAuthError(friendlyAuthError(e.code)); }
    });

    // Sign up with email
    document.getElementById('auth-signup-btn').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const pass  = document.getElementById('auth-password').value;
      if (!email || !pass) return showAuthError('Please fill in both fields.');
      if (pass.length < 6) return showAuthError('Password must be at least 6 characters.');
      try {
        await auth.createUserWithEmailAndPassword(email, pass);
      } catch(e) { showAuthError(friendlyAuthError(e.code)); }
    });

    // Google sign in
    document.getElementById('auth-google-btn').addEventListener('click', async () => {
      try { await auth.signInWithPopup(googleProvider); }
      catch(e) { showAuthError(friendlyAuthError(e.code)); }
    });

    // Sign out
    document.getElementById('sign-out-btn').addEventListener('click', async () => {
      await auth.signOut();
      state.useFirebase = false;
      showToast('Çıkış yapıldı');
      showAuthGate();
    });

  } catch(e) { console.warn('Firebase init failed:', e); }
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':    'No account found with that email.',
    'auth/wrong-password':    'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email':     'Please enter a valid email address.',
    'auth/weak-password':     'Password should be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showAuthGate()  { document.getElementById('auth-gate')?.classList.remove('hidden'); }
function hideAuthGate()  { document.getElementById('auth-gate')?.classList.add('hidden'); }

function setUserUI(user) {
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'User';
    nameEl.textContent   = name;
    avatarEl.textContent = name[0].toUpperCase();
  } else {
    nameEl.textContent   = 'Guest';
    avatarEl.textContent = '?';
  }
}

/* ── Firebase sync ── */
async function syncToFirebase() {
  if (!db || !state.currentUser) return;
  try {
    const uid = state.currentUser.uid;
    await db.collection('users').doc(uid).set({
      tasks:  state.tasks,
      goals:  state.goals,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('Firebase sync failed:', e); }
}

async function loadFromFirebase() {
  if (!db || !state.currentUser) return;
  try {
    const uid  = state.currentUser.uid;
    const doc  = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.tasks) state.tasks = data.tasks;
      if (data.goals) state.goals = data.goals;
      saveState();
      refreshCurrentView();
    }
  } catch(e) { console.warn('Firebase load failed:', e); }
}

/* ============================================================
   4. DARK MODE
   ============================================================ */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  const mBtn  = document.getElementById('mobile-theme-btn');

  if (dark) {
    // Moon icon
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    if (label) label.textContent = 'Karanlık Tema';
    if (mBtn)  mBtn.textContent  = '☀️';
  } else {
    // Sun icon
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    if (label) label.textContent = 'Açık Tema';
    if (mBtn)  mBtn.textContent  = '🌙';
  }
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  applyTheme(state.darkMode);
  saveState();
  showToast(state.darkMode ? '🌙 Karanlık tema açık' : '☀️ Açık tema açık');
}

/* ============================================================
   5. PUSH NOTIFICATIONS
   ============================================================ */
let notificationPermission = 'default';
const scheduledNotifications = new Map(); // taskId → timeoutId

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  notificationPermission = result;
  localStorage.setItem('notif-perm', result);
  if (result === 'granted') {
    showToast('🔔 Hatırlatıcılar açıldı!');
    scheduleAllReminders();
  }
  document.getElementById('notif-banner')?.classList.add('hidden');
}

function scheduleAllReminders() {
  // Clear all existing timeouts
  scheduledNotifications.forEach(id => clearTimeout(id));
  scheduledNotifications.clear();

  if (notificationPermission !== 'granted') return;

  state.tasks.forEach(task => {
    if (!task.completed && task.reminder && task.reminder !== 'none' && task.date && task.time) {
      scheduleReminder(task);
    }
  });
}

function scheduleReminder(task) {
  if (notificationPermission !== 'granted') return;
  if (!task.date || !task.time || !task.reminder || task.reminder === 'none') return;

  const taskDate  = new Date(`${task.date}T${task.time}`);
  const fireAt    = new Date(taskDate.getTime() - (parseInt(task.reminder) * 60000));
  const msUntil   = fireAt.getTime() - Date.now();

  if (msUntil <= 0) return; // already passed

  // Clear existing if any
  if (scheduledNotifications.has(task.id)) {
    clearTimeout(scheduledNotifications.get(task.id));
  }

  const timeoutId = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('📋 ' + task.title, {
        body: task.description || `Reminder for your task at ${task.time}`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        tag: task.id,
        requireInteraction: false,
        silent: false
      });
    }
  }, msUntil);

  scheduledNotifications.set(task.id, timeoutId);
}

function cancelReminder(taskId) {
  if (scheduledNotifications.has(taskId)) {
    clearTimeout(scheduledNotifications.get(taskId));
    scheduledNotifications.delete(taskId);
  }
}

/* ============================================================
   6. RECURRING TASKS
   ============================================================ */

/**
 * Given a base task with recurrence info, expand it into
 * concrete occurrences within [startDate, endDate].
 * Returns array of virtual task objects (not saved to state).
 */
function expandRecurringTask(task, viewStart, viewEnd) {
  if (!task.recurrence || task.recurrence === 'none') return [task];

  const occurrences = [];
  const recEnd = task.recurrenceEnd ? new Date(task.recurrenceEnd) : addDays(new Date(), 365);
  let current   = fromDateStr(task.date);
  const vsDate  = viewStart instanceof Date ? viewStart : fromDateStr(viewStart);
  const veDate  = viewEnd   instanceof Date ? viewEnd   : fromDateStr(viewEnd);

  while (current <= recEnd && current <= veDate) {
    if (current >= vsDate) {
      occurrences.push({
        ...task,
        date:         toDateStr(current),
        _isRecurrence: true,
        _baseId:      task.id
      });
    }
    // Advance by recurrence frequency
    switch (task.recurrence) {
      case 'daily':   current = addDays(current, 1);                                      break;
      case 'weekly':  current = addDays(current, 7);                                      break;
      case 'monthly': current = new Date(current.getFullYear(), current.getMonth()+1, current.getDate()); break;
      case 'yearly':  current = new Date(current.getFullYear()+1, current.getMonth(), current.getDate()); break;
      default:        break;
    }
  }
  return occurrences;
}

/**
 * Get all tasks (including expanded recurring) for a given date string.
 */
function getTasksForDate(dateStr) {
  const date    = fromDateStr(dateStr);
  const allTasks = [];

  state.tasks.forEach(task => {
    if (!task.recurrence || task.recurrence === 'none') {
      if (task.date === dateStr) allTasks.push(task);
    } else {
      const occurrences = expandRecurringTask(task, date, date);
      allTasks.push(...occurrences);
    }
  });

  return allTasks.sort((a,b) => (a.time||'').localeCompare(b.time||''));
}

/**
 * Get all tasks for a date range (for calendar / week views).
 */
function getTasksForRange(startDate, endDate) {
  const allTasks = [];
  state.tasks.forEach(task => {
    if (!task.recurrence || task.recurrence === 'none') {
      const d = fromDateStr(task.date);
      if (d >= startDate && d <= endDate) allTasks.push(task);
    } else {
      allTasks.push(...expandRecurringTask(task, startDate, endDate));
    }
  });
  return allTasks;
}

/* ============================================================
   7. DATE HELPERS
   ============================================================ */
const DAYS   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const DAYS_S = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const uid       = () => '_' + Math.random().toString(36).slice(2,9);
const today     = () => toDateStr(new Date());
const toDateStr = d  => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromDateStr = s => { if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays   = (d,n) => { const c=new Date(d); c.setDate(c.getDate()+n); return c; };
const isSameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

function getWeekStart(d) {
  const day=d.getDay(); return addDays(d, day===0?-6:1-day);
}
function formatDisplayDate(d) { return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function formatShortDate(d)   { return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }

/* ============================================================
   8. SIDEBAR
   ============================================================ */
const MOBILE_BP = 900;
const SB = {
  el: null, main: null, overlay: null, toggle: null, mobileBtn: null,
  isMobile: () => window.innerWidth <= MOBILE_BP,

  init() {
    this.el        = document.getElementById('sidebar');
    this.main      = document.getElementById('main-content');
    this.overlay   = document.getElementById('sidebar-overlay');
    this.toggle    = document.getElementById('sidebar-toggle');
    this.mobileBtn = document.getElementById('mobile-menu-btn');

    if (!this.isMobile()) {
      if (state.sidebarCollapsed) {
        this.el.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
      } else {
        this.el.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
      }
    }

    this.toggle.addEventListener('click', e => {
      e.stopPropagation();
      this.isMobile() ? this.openMobile() : this.toggleCollapse();
    });
    this.mobileBtn.addEventListener('click', () => this.openMobile());
    this.overlay.addEventListener('click', () => this.closeMobile());

    window.addEventListener('resize', () => {
      if (!this.isMobile()) {
        this.closeMobile();
        this.el.classList.toggle('collapsed', state.sidebarCollapsed);
        document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
      } else {
        this.el.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
      }
    });
  },

  toggleCollapse() {
    const collapsed = this.el.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    state.sidebarCollapsed = collapsed;
    saveState();
  },

  openMobile() {
    this.el.classList.add('mobile-open');
    this.overlay.classList.add('visible');
    document.body.classList.add('mobile-open');
    document.body.style.overflow = 'hidden';
  },

  closeMobile() {
    this.el.classList.remove('mobile-open');
    this.overlay.classList.remove('visible');
    document.body.classList.remove('mobile-open');
    document.body.style.overflow = '';
  }
};

/* ============================================================
   9. NAVIGATION
   ============================================================ */
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`view-${viewId}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');

  // Sync bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewId ||
      (['month-goals','week-goals'].includes(viewId) && item.dataset.view==='year-goals'));
  });

  if (SB.isMobile()) SB.closeMobile();

  // Use window.renderView so upgrades.js patch is respected
  (window.renderView || renderView)(viewId);
}

function renderView(viewId) {
  switch(viewId) {
    case 'dashboard':   renderDashboard();   break;
    case 'year-goals':  renderGoals('year'); break;
    case 'month-goals': renderGoals('month');break;
    case 'week-goals':  renderGoals('week'); break;
    case 'week-planner':renderWeekPlanner(); break;
    case 'calendar':    renderCalendar();    break;
  }
}

function refreshCurrentView() {
  const active = document.querySelector('.nav-item.active');
  if (active) renderView(active.dataset.view);
}

/* ============================================================
   10. DASHBOARD
   ============================================================ */
function renderDashboard() {
  const hour  = new Date().getHours();
  const greetWord = hour<12?'sabahlar':hour<18?'iyi günler':'iyi akşamlar';
  document.getElementById('greeting-time').textContent = greetWord;
  document.getElementById('full-date-display').textContent = formatDisplayDate(new Date());

  // Banner greeting
  const bannerGreet = document.getElementById('banner-greeting-text');
  if (bannerGreet) bannerGreet.textContent = hour<12 ? 'Günaydın ☀️' : hour<18 ? 'İyi günler 🌤' : 'İyi akşamlar 🌙';

  // Today's tasks (including recurring)
  const todayStr   = today();
  const todayTasks = getTasksForDate(todayStr);
  const container  = document.getElementById('dashboard-today-tasks');
  document.getElementById('today-task-count').textContent = todayTasks.length;

  container.innerHTML = '';
  if (!todayTasks.length) {
    container.innerHTML = '<p class="empty-state">No tasks for today. Add one!</p>';
  } else {
    todayTasks.forEach(t => container.appendChild(createTaskCard(t)));
  }

  // Weekly progress
  const ws        = getWeekStart(new Date());
  const weekTasks = getTasksForRange(ws, addDays(ws,6));
  const wc        = weekTasks.filter(t => t.completed).length;
  const pct       = weekTasks.length ? Math.round((wc/weekTasks.length)*100) : 0;
  const circ      = 2*Math.PI*30;
  document.getElementById('weekly-ring').style.strokeDashoffset = circ - (pct/100)*circ;
  document.getElementById('weekly-pct').textContent     = pct + '%';
  document.getElementById('weekly-caption').textContent = `${wc} of ${weekTasks.length} tasks completed this week`;

  // Goals summary — show week + any active month/year goals
  const wgEl = document.getElementById('dashboard-week-goals');
  const allActiveGoals = [
    ...state.goals.year.filter(g=>!g.completed).slice(0,1).map(g=>({...g,_goalType:'year'})),
    ...state.goals.month.filter(g=>!g.completed).slice(0,1).map(g=>({...g,_goalType:'month'})),
    ...state.goals.week.filter(g=>!g.completed).slice(0,3).map(g=>({...g,_goalType:'week'})),
  ];
  if (!allActiveGoals.length) { wgEl.innerHTML='<p class="empty-state">Henüz hedef yok.</p>'; }
  else {
    wgEl.innerHTML = allActiveGoals.map(g=>`
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
        <input type="checkbox" ${g.completed?'checked':''} style="margin-top:3px;accent-color:var(--accent);cursor:pointer;"
          onchange="toggleGoal('${g._goalType}','${g.id}',this.checked)" />
        <div>
          <span class="goal-type-badge goal-badge-${g._goalType}" style="margin-bottom:2px;display:inline-block">${GOAL_TYPE_TR[g._goalType]}</span>
          <div style="font-size:14px;${g.completed?'text-decoration:line-through;color:var(--text-muted)':''}">${escHtml(g.title)}</div>
        </div>
      </div>`).join('');
  }

  restoreWidgetImages();
}

function restoreWidgetImages() {
  if (state.images.img1) {
    document.getElementById('widget-img-1').src = state.images.img1;
    document.getElementById('widget-img-1').classList.remove('hidden');
    const p = document.getElementById('img-zone-1').querySelector('p');
    if (p) p.style.display='none';
  }
}

/* ============================================================
   11. TASK CARDS
   ============================================================ */
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card${task.completed?' completed':''}`;
  card.style.borderLeftColor = task.color || '#b5d5c5';
  card.dataset.taskId = task.id;
  card.draggable = !task._isRecurrence;

  const timeStr = task.time ? `🕐 ${task.time}` : '';
  const recStr  = task.recurrence && task.recurrence !== 'none'
    ? `<span class="recurrence-badge">🔁 ${task.recurrence}</span>` : '';
  const imgHtml = task.image ? `<img src="${task.image}" class="task-card-img" alt="" />` : '';

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px;">
      <input type="checkbox" class="task-check" ${task.completed?'checked':''} />
      <div style="flex:1;min-width:0;">
        <div class="task-card-title">${escHtml(task.title)}</div>
        <div class="task-card-meta">${timeStr?`<span>${timeStr}</span>`:''}${recStr}</div>
        ${imgHtml}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="task-card-btn" title="Edit">✏️</button>
      <button class="task-card-btn delete" title="Delete">🗑</button>
    </div>`;

  card.querySelector('.task-check').addEventListener('change', e => {
    e.stopPropagation();
    // For recurring instances, toggle the base task
    toggleTask(task._baseId || task.id, e.target.checked);
  });
  card.querySelector('.task-card-btn:not(.delete)').addEventListener('click', e => {
    e.stopPropagation(); openTaskModal(task._baseId || task.id);
  });
  card.querySelector('.task-card-btn.delete').addEventListener('click', e => {
    e.stopPropagation(); deleteTask(task._baseId || task.id);
  });
  card.addEventListener('click', () => openDetailModal(task._baseId || task.id));

  if (!task._isRecurrence) {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('taskId', task.id);
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }

  return card;
}

/* ============================================================
   12. TASK CRUD
   ============================================================ */
function toggleTask(id, completed) {
  const t = state.tasks.find(t => t.id===id);
  if (t) { t.completed = completed; saveState(); refreshCurrentView(); }
}

function deleteTask(id) {
  cancelReminder(id);
  state.tasks = state.tasks.filter(t => t.id!==id);
  saveState(); refreshCurrentView();
}

/* ============================================================
   13. TASK MODAL
   ============================================================ */
let taskModalImage = null;

function openTaskModal(editId=null, presetDate=null, presetTime=null) {
  taskModalImage = null;
  const g = id => document.getElementById(id);

  g('task-title-input').value      = '';
  g('task-desc-input').value       = '';
  g('task-date-input').value       = presetDate || today();
  g('task-time-input').value       = presetTime || '';
  g('task-recurrence-input').value = 'none';
  g('task-recurrence-end').value   = '';
  g('task-reminder-input').value   = 'none';
  g('task-edit-id').value          = '';
  g('task-img-preview').src        = '';
  g('task-img-preview').classList.add('hidden');
  g('task-img-label').textContent  = '📎 Click to upload image';

  document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('selected'));
  document.querySelector('.color-dot[data-color="#b5d5c5"]').classList.add('selected');

  if (editId) {
    const task = state.tasks.find(t=>t.id===editId);
    if (!task) return;
    g('task-modal-title').textContent     = 'Edit Task';
    g('task-title-input').value           = task.title;
    g('task-desc-input').value            = task.description||'';
    g('task-date-input').value            = task.date;
    g('task-time-input').value            = task.time||'';
    g('task-recurrence-input').value      = task.recurrence||'none';
    g('task-recurrence-end').value        = task.recurrenceEnd||'';
    g('task-reminder-input').value        = task.reminder||'none';
    g('task-edit-id').value               = task.id;
    if (task.color) {
      document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('selected'));
      document.querySelector(`.color-dot[data-color="${task.color}"]`)?.classList.add('selected');
    }
    if (task.image) {
      taskModalImage = task.image;
      g('task-img-preview').src = task.image;
      g('task-img-preview').classList.remove('hidden');
      g('task-img-label').textContent = '📎 Image attached';
    }
  } else {
    g('task-modal-title').textContent = 'New Task';
  }

  document.getElementById('task-modal-overlay').classList.remove('hidden');
  g('task-title-input').focus();
}

function closeTaskModal() {
  document.getElementById('task-modal-overlay').classList.add('hidden');
  taskModalImage = null;
}

function saveTask() {
  const g     = id => document.getElementById(id);
  const title = g('task-title-input').value.trim();
  const date  = g('task-date-input').value;
  if (!title) { g('task-title-input').focus(); return; }
  if (!date)  { g('task-date-input').focus();  return; }

  const color      = document.querySelector('.color-dot.selected')?.dataset.color || '#b5d5c5';
  const recurrence = g('task-recurrence-input').value;
  const reminder   = g('task-reminder-input').value;
  const editId     = g('task-edit-id').value;

  if (editId) {
    const task = state.tasks.find(t=>t.id===editId);
    if (task) {
      Object.assign(task, {
        title, description: g('task-desc-input').value.trim(),
        date, time: g('task-time-input').value,
        color, recurrence, reminder,
        recurrenceEnd: g('task-recurrence-end').value || null,
        image: taskModalImage || task.image
      });
      cancelReminder(task.id);
      scheduleReminder(task);
    }
  } else {
    const newTask = {
      id: uid(), title,
      description: g('task-desc-input').value.trim(),
      date, time: g('task-time-input').value,
      color, recurrence, reminder,
      recurrenceEnd: g('task-recurrence-end').value || null,
      completed: false,
      image: taskModalImage || null,
      createdAt: Date.now()
    };
    state.tasks.push(newTask);
    scheduleReminder(newTask);
  }

  saveState(); closeTaskModal(); refreshCurrentView();
  showToast('✅ Görev kaydedildi');
}

/* ============================================================
   14. GOAL MODAL & CRUD
   ============================================================ */
const GOAL_TYPE_TR  = { year:'Yıllık Hedef', month:'Aylık Hedef', week:'Haftalık Hedef' };
const GOAL_PARENT   = { month:'year', week:'month' };
const GOAL_CHILD    = { year:'month', month:'week' };
const GOAL_COLOR    = { year:'#cdb4db', month:'#a2d2ff', week:'#b5d5c5' };   // purple / blue / green
const GOAL_COLOR_DK = { year:'rgba(205,180,219,0.18)', month:'rgba(162,210,255,0.18)', week:'rgba(181,213,197,0.18)' };

function _defaultDatesForType(type) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  if (type === 'year')  return { start: `${y}-01-01`, end: `${y}-12-31` };
  if (type === 'month') {
    const last = new Date(y, m+1, 0).getDate();
    return { start: toDateStr(new Date(y,m,1)), end: toDateStr(new Date(y,m,last)) };
  }
  // week
  const ws = getWeekStart(now);
  return { start: toDateStr(ws), end: toDateStr(addDays(ws, 6)) };
}

function openGoalModal(type, editId=null) {
  const defs = _defaultDatesForType(type);
  document.getElementById('goal-title-input').value  = '';
  document.getElementById('goal-desc-input').value   = '';
  document.getElementById('goal-start-input').value  = defs.start;
  document.getElementById('goal-end-input').value    = defs.end;
  document.getElementById('goal-type-input').value   = type;
  document.getElementById('goal-edit-id').value      = '';
  document.getElementById('goal-modal-title').textContent =
    editId ? `${GOAL_TYPE_TR[type]} Düzenle` : `Yeni ${GOAL_TYPE_TR[type]}`;

  _renderParentGoalSelect(type, null);

  if (editId) {
    const g = state.goals[type].find(g => g.id === editId);
    if (g) {
      document.getElementById('goal-title-input').value  = g.title;
      document.getElementById('goal-desc-input').value   = g.description || '';
      document.getElementById('goal-start-input').value  = g.startDate || defs.start;
      document.getElementById('goal-end-input').value    = g.endDate   || defs.end;
      document.getElementById('goal-edit-id').value      = editId;
      _renderParentGoalSelect(type, g.parentId || null);
    }
  }
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  document.getElementById('goal-title-input').focus();
}

function _renderParentGoalSelect(type, selectedId) {
  const wrap = document.getElementById('goal-parent-wrap');
  if (!wrap) return;
  const parentType = GOAL_PARENT[type];
  if (!parentType || !state.goals[parentType]?.length) { wrap.innerHTML=''; return; }
  const opts = state.goals[parentType]
    .map(g => `<option value="${g.id}"${g.id===selectedId?' selected':''}>${escHtml(g.title)}</option>`)
    .join('');
  wrap.innerHTML = `<div class="form-group" style="margin-bottom:0">
    <label>Bağlı ${GOAL_TYPE_TR[parentType]}</label>
    <select id="goal-parent-select" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px;font-family:var(--font-body);color:var(--text);background:var(--bg);outline:none;">
      <option value="">— Bağlantısız —</option>${opts}
    </select></div>`;
}

function closeGoalModal() { document.getElementById('goal-modal-overlay').classList.add('hidden'); }

function saveGoal() {
  const title     = document.getElementById('goal-title-input').value.trim();
  const type      = document.getElementById('goal-type-input').value;
  const editId    = document.getElementById('goal-edit-id').value;
  const startDate = document.getElementById('goal-start-input').value;
  const endDate   = document.getElementById('goal-end-input').value;
  const parentId  = document.getElementById('goal-parent-select')?.value || null;
  if (!title) { document.getElementById('goal-title-input').focus(); return; }

  if (editId) {
    const g = state.goals[type].find(g => g.id === editId);
    if (g) Object.assign(g, { title, description: document.getElementById('goal-desc-input').value.trim(), startDate, endDate, parentId: parentId||null });
  } else {
    state.goals[type].push({ id:uid(), title, description:document.getElementById('goal-desc-input').value.trim(), completed:false, createdAt:Date.now(), startDate, endDate, parentId:parentId||null, type });
  }
  saveState(); closeGoalModal(); renderGoals(type);
  showToast('🎯 Hedef kaydedildi');
}

function toggleGoal(type, id, completed) {
  const g = state.goals[type].find(g => g.id === id);
  if (g) { g.completed = completed; saveState(); }
  const active = document.querySelector('.nav-item.active')?.dataset.view;
  if (active === `${type}-goals`) renderGoals(type);
  if (active === 'dashboard')     renderDashboard();
  if (active === 'calendar')      renderCalendar();
}

function deleteGoal(type, id) {
  const childType = GOAL_CHILD[type];
  if (childType) state.goals[childType]?.forEach(g => { if (g.parentId===id) g.parentId=null; });
  state.goals[type] = state.goals[type].filter(g => g.id !== id);
  saveState(); renderGoals(type);
}

function openGoalDetail(type, id) {
  const g = state.goals[type].find(g => g.id === id);
  if (!g) return;
  const overlay = document.getElementById('goal-detail-overlay');
  if (!overlay) { openGoalModal(type, id); return; }
  document.getElementById('goal-detail-title').textContent = g.title;
  document.getElementById('goal-detail-body').innerHTML = `
    ${g.description?`<div class="detail-row"><span class="detail-label">Açıklama</span><span class="detail-value">${escHtml(g.description)}</span></div>`:''}
    <div class="detail-row"><span class="detail-label">Tür</span><span class="detail-value"><span class="goal-type-badge goal-badge-${type}">${GOAL_TYPE_TR[type]}</span></span></div>
    <div class="detail-row"><span class="detail-label">Başlangıç</span><span class="detail-value">${g.startDate ? formatDisplayDate(fromDateStr(g.startDate)) : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Bitiş</span><span class="detail-value">${g.endDate ? formatDisplayDate(fromDateStr(g.endDate)) : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Durum</span><span class="detail-value" style="color:${g.completed?'var(--success)':'var(--text-muted)'}">${g.completed?'✅ Tamamlandı':'⏳ Devam ediyor'}</span></div>`;
  overlay.dataset.goalType = type;
  overlay.dataset.goalId   = id;
  overlay.classList.remove('hidden');
}

/* ============================================================
   15. GOALS RENDER
   ============================================================ */
function renderGoals(type) {
  const container = document.getElementById(`${type}-goals-list`);
  if (!container) return;
  const now = new Date();
  if (type==='year')  document.getElementById('current-year-label').textContent  = now.getFullYear();
  if (type==='month') document.getElementById('current-month-label').textContent = MONTHS[now.getMonth()];

  const goals = state.goals[type];
  const parentType = GOAL_PARENT[type];
  const childType  = GOAL_CHILD[type];

  if (!goals.length) {
    container.innerHTML = `<p class="empty-state full-width">Henüz ${GOAL_TYPE_TR[type].toLowerCase()} yok. Hayal kurmaya başla!</p>`;
    return;
  }

  container.innerHTML = '';
  goals.forEach(goal => {
    const parent = parentType ? state.goals[parentType]?.find(p => p.id === goal.parentId) : null;
    const children = childType ? (state.goals[childType]||[]).filter(c => c.parentId === goal.id) : [];
    const doneChildren = children.filter(c => c.completed).length;

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-card-top">
        <input type="checkbox" class="goal-check" ${goal.completed?'checked':''}
          onchange="toggleGoal('${type}','${goal.id}',this.checked)" />
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <span class="goal-type-badge goal-badge-${type}">${GOAL_TYPE_TR[type]}</span>
            ${parent ? `<span class="goal-parent-link" onclick="showView('${parentType}-goals')" title="${escHtml(parent.title)}">↑ ${escHtml(parent.title.slice(0,24))}${parent.title.length>24?'…':''}</span>` : ''}
          </div>
          <div class="goal-title${goal.completed?' done':''}">${escHtml(goal.title)}</div>
          ${goal.description ? `<div class="goal-desc">${escHtml(goal.description)}</div>` : ''}
          ${goal.startDate ? `<div class="goal-dates">📅 ${goal.startDate}${goal.endDate?' → '+goal.endDate:''}</div>` : ''}
          ${children.length ? `<div class="goal-children-bar">
            <div class="goal-children-fill" style="width:${children.length?Math.round(doneChildren/children.length*100):0}%"></div>
          </div>
          <div class="goal-children-label">${doneChildren}/${children.length} alt hedef</div>` : ''}
        </div>
      </div>
      <div class="goal-card-footer">
        ${childType ? `<button class="btn-ghost" style="padding:6px 12px;font-size:12px" onclick="openGoalModal('${childType}');setTimeout(()=>{const s=document.getElementById('goal-parent-select');if(s)s.value='${goal.id}';},50)">+ Alt Hedef</button>` : ''}
        <button class="btn-ghost" style="padding:6px 12px;font-size:12px" onclick="openGoalModal('${type}','${goal.id}')">Düzenle</button>
        <button class="btn-ghost" style="padding:6px 12px;font-size:12px;color:var(--danger)" onclick="deleteGoal('${type}','${goal.id}')">Sil</button>
      </div>`;
    container.appendChild(card);
  });
}

/* ============================================================
   16. WEEK PLANNER
   ============================================================ */
function renderWeekPlanner() {
  const ws = addDays(getWeekStart(new Date()), state.weekPlannerOffset*7);
  const we = addDays(ws, 6);
  document.getElementById('week-planner-range').textContent =
    `${formatShortDate(ws)} – ${formatShortDate(we)}, ${we.getFullYear()}`;

  const board = document.getElementById('week-board');
  board.innerHTML='';
  const now=new Date();

  for (let i=0;i<7;i++) {
    const day=addDays(ws,i), dateStr=toDateStr(day), isToday=isSameDay(day,now);
    const col=document.createElement('div');
    col.className=`week-col${isToday?' today':''}`;
    col.dataset.date=dateStr;
    col.innerHTML=`
      <div class="week-col-header">
        <div class="week-col-day">${DAYS_S[day.getDay()]}</div>
        <div class="week-col-date">${day.getDate()}</div>
      </div>
      <div class="week-tasks"></div>`;

    const tasksDiv=col.querySelector('.week-tasks');
    getTasksForDate(dateStr).forEach(t=>tasksDiv.appendChild(createTaskCard(t)));

    const addBtn=document.createElement('button');
    addBtn.className='add-task-inline'; addBtn.textContent='+ Add';
    addBtn.addEventListener('click',()=>openTaskModal(null,dateStr));
    col.appendChild(addBtn);

    col.addEventListener('dragover', e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');moveTaskToDate(e.dataTransfer.getData('taskId'),dateStr);});
    board.appendChild(col);
  }
}

function moveTaskToDate(taskId, newDate, newTime) {
  const t=state.tasks.find(t=>t.id===taskId);
  if (t) {
    t.date=newDate;
    if (newTime!==undefined) t.time=newTime;
    cancelReminder(t.id);
    scheduleReminder(t);
    saveState(); refreshCurrentView();
  }
}

/* ============================================================
   17. CALENDAR
   ============================================================ */
function renderCalendar() {
  const label=document.getElementById('cal-current-label');
  const container=document.getElementById('calendar-container');
  const d=state.calendarDate;
  switch(state.calendarView) {
    case 'month': renderMonthView(d,container,label);  break;
    case 'week':  renderWeekView(d,container,label);   break;
    case 'day':   renderDayView(d,container,label);    break;
    case 'year':  renderYearView(d,container,label);   break;
  }
}

function renderMonthView(d,container,label) {
  label.textContent=`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  container.innerHTML='';
  const grid=document.createElement('div');
  grid.className='cal-month-grid';
  DAYS_S.forEach(n=>{const el=document.createElement('div');el.className='cal-day-name';el.textContent=n;grid.appendChild(el);});

  const firstDay=new Date(d.getFullYear(),d.getMonth(),1);
  const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0);
  for(let i=firstDay.getDay()-1;i>=0;i--) grid.appendChild(makeCalDay(addDays(firstDay,-i-1),true));
  for(let i=1;i<=lastDay.getDate();i++) grid.appendChild(makeCalDay(new Date(d.getFullYear(),d.getMonth(),i),false));
  for(let i=1;i<=6-lastDay.getDay();i++) grid.appendChild(makeCalDay(addDays(lastDay,i),true));
  container.appendChild(grid);
}

function makeCalDay(day,otherMonth) {
  const dateStr=toDateStr(day), todayStr=today();
  const dayTasks=getTasksForDate(dateStr);
  const dayGoals=getGoalsForDate(dateStr);
  const cell=document.createElement('div');
  cell.className=`cal-day${otherMonth?' other-month':''}${dateStr===todayStr?' today':''}`;
  cell.dataset.date=dateStr;

  const num=document.createElement('div');
  num.className='cal-day-num'; num.textContent=day.getDate();
  cell.appendChild(num);

  // Goals first (max 2)
  dayGoals.slice(0,2).forEach(g => cell.appendChild(_makeGoalDot(g)));

  // Then tasks
  const taskSlots = Math.max(0, 3 - dayGoals.slice(0,2).length);
  dayTasks.slice(0,taskSlots).forEach(task=>{
    const dot=document.createElement('div');
    dot.className='cal-task-dot'; dot.textContent=task.title;
    dot.style.background=task.color||'#b5d5c5';
    dot.addEventListener('click',e=>{e.stopPropagation();openDetailModal(task._baseId||task.id);});
    cell.appendChild(dot);
  });
  const totalExtra = (dayGoals.length > 2 ? dayGoals.length-2 : 0) + Math.max(0,dayTasks.length-taskSlots);
  if(totalExtra>0){const more=document.createElement('div');more.className='cal-more';more.textContent=`+${totalExtra} daha`;cell.appendChild(more);}

  cell.addEventListener('click',()=>openTaskModal(null,dateStr));
  cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('drag-over');});
  cell.addEventListener('dragleave',()=>cell.classList.remove('drag-over'));
  cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drag-over');moveTaskToDate(e.dataTransfer.getData('taskId'),dateStr);});
  return cell;
}

function renderWeekView(d,container,label) {
  const ws=getWeekStart(d),we=addDays(ws,6);
  label.textContent=`${formatShortDate(ws)} – ${formatShortDate(we)}`;
  container.innerHTML='';
  const view=document.createElement('div');
  view.className='cal-week-view';
  const todayStr=today();

  const corner=document.createElement('div');corner.className='cal-week-header';view.appendChild(corner);
  for(let i=0;i<7;i++){
    const day=addDays(ws,i),dStr=toDateStr(day);
    const h=document.createElement('div');
    h.className=`cal-week-header${dStr===todayStr?' today-col':''}`;
    h.innerHTML=`<div class="week-header-day">${DAYS_S[day.getDay()]}</div><div class="week-header-date">${day.getDate()}</div>`;
    // Goal pills in header
    getGoalsForDate(dStr).forEach(g=>{
      const pill=document.createElement('div');
      pill.className='cal-goal-pill';
      pill.style.background=GOAL_COLOR[g._goalType];
      pill.textContent='🎯 '+g.title.slice(0,14)+(g.title.length>14?'…':'');
      pill.title=`${GOAL_TYPE_TR[g._goalType]}: ${g.title}`;
      pill.addEventListener('click',e=>{e.stopPropagation();openGoalDetail(g._goalType,g.id);});
      h.appendChild(pill);
    });
    view.appendChild(h);
  }

  for(let h=0;h<24;h++){
    const lbl=document.createElement('div');
    lbl.className='cal-week-time-col';
    lbl.textContent=h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`;
    view.appendChild(lbl);

    for(let i=0;i<7;i++){
      const day=addDays(ws,i),dStr=toDateStr(day),tStr=String(h).padStart(2,'0')+':00';
      const slot=document.createElement('div');
      slot.className='cal-week-hour-slot'; slot.dataset.date=dStr; slot.dataset.time=tStr;
      getTasksForDate(dStr).filter(t=>t.time?.startsWith(String(h).padStart(2,'0'))).forEach(task=>{
        const dot=document.createElement('div');dot.className='cal-task-dot';dot.textContent=task.title;dot.style.background=task.color||'#b5d5c5';
        dot.addEventListener('click',e=>{e.stopPropagation();openDetailModal(task._baseId||task.id);});
        slot.appendChild(dot);
      });
      slot.addEventListener('click',()=>openTaskModal(null,dStr,tStr));
      slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drag-over');});
      slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));
      slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('drag-over');moveTaskToDate(e.dataTransfer.getData('taskId'),dStr,tStr);});
      view.appendChild(slot);
    }
  }
  container.appendChild(view);
}

function renderDayView(d,container,label) {
  label.textContent=formatDisplayDate(d);
  container.innerHTML='';
  const dateStr=toDateStr(d);

  // Goals banner for the day
  const dayGoals=getGoalsForDate(dateStr);
  if(dayGoals.length){
    const banner=document.createElement('div');
    banner.className='cal-day-goals-banner';
    dayGoals.forEach(g=>{
      const pill=document.createElement('div');
      pill.className='cal-goal-pill';
      pill.style.background=GOAL_COLOR[g._goalType];
      pill.textContent=`🎯 ${g.title}`;
      pill.title=GOAL_TYPE_TR[g._goalType];
      if(g.completed) pill.style.opacity='0.5';
      pill.addEventListener('click',e=>{e.stopPropagation();openGoalDetail(g._goalType,g.id);});
      banner.appendChild(pill);
    });
    container.appendChild(banner);
  }

  const view=document.createElement('div');view.className='cal-day-view';
  for(let h=0;h<24;h++){
    const tStr=String(h).padStart(2,'0')+':00';
    const lbl=document.createElement('div');lbl.className='cal-hour-label';
    lbl.textContent=h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`;
    view.appendChild(lbl);
    const slot=document.createElement('div');slot.className='cal-hour-slot';slot.dataset.date=dateStr;slot.dataset.time=tStr;
    getTasksForDate(dateStr).filter(t=>t.time?.startsWith(String(h).padStart(2,'0'))).forEach(t=>slot.appendChild(createTaskCard(t)));
    slot.addEventListener('click',e=>{if(e.target.closest('.task-card'))return;openTaskModal(null,dateStr,tStr);});
    slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drag-over');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));
    slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('drag-over');moveTaskToDate(e.dataTransfer.getData('taskId'),dateStr,tStr);});
    view.appendChild(slot);
  }
  container.appendChild(view);
}

function renderYearView(d,container,label) {
  label.textContent=d.getFullYear();
  container.innerHTML='';
  const grid=document.createElement('div');grid.className='cal-year-grid';
  const todayStr=today();
  const yr=d.getFullYear();

  for(let m=0;m<12;m++){
    const month=document.createElement('div');month.className='cal-mini-month';
    const hdr=document.createElement('div');hdr.className='cal-mini-header';hdr.textContent=MONTHS[m];

    // Check if any goals span this month
    const monthStart=`${yr}-${String(m+1).padStart(2,'0')}-01`;
    const monthEnd=`${yr}-${String(m+1).padStart(2,'0')}-${new Date(yr,m+1,0).getDate()}`;
    const monthGoals=[];
    ['year','month','week'].forEach(type=>{
      (state.goals[type]||[]).forEach(g=>{
        if(g.startDate && g.startDate<=monthEnd && (!g.endDate||g.endDate>=monthStart))
          monthGoals.push({...g,_goalType:type});
      });
    });
    if(monthGoals.length){
      const row=document.createElement('div');row.style.cssText='display:flex;gap:3px;margin-bottom:4px;flex-wrap:wrap;';
      [...new Set(monthGoals.map(g=>g._goalType))].forEach(type=>{
        const dot=document.createElement('div');
        dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:${GOAL_COLOR[type]};flex-shrink:0`;
        dot.title=GOAL_TYPE_TR[type];
        row.appendChild(dot);
      });
      month.appendChild(hdr);month.appendChild(row);
    } else {
      month.appendChild(hdr);
    }

    const miniGrid=document.createElement('div');miniGrid.className='cal-mini-grid';
    ['P','Pt','S','Ç','Pe','C','Ct'].forEach(n=>{const c=document.createElement('div');c.className='cal-mini-cell header';c.textContent=n;miniGrid.appendChild(c);});

    const firstDay=new Date(yr,m,1),lastDay=new Date(yr,m+1,0);
    for(let i=0;i<firstDay.getDay();i++) miniGrid.appendChild(document.createElement('div'));
    for(let day=1;day<=lastDay.getDate();day++){
      const dStr=`${yr}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasT=getTasksForDate(dStr).length>0;
      const hasG=getGoalsForDate(dStr).length>0;
      const c=document.createElement('div');
      c.className=`cal-mini-cell${hasT||hasG?' has-task':''}${dStr===todayStr?' today':''}`;
      if(hasG&&!hasT) c.style.background='rgba(107,92,255,0.15)';
      c.textContent=day; miniGrid.appendChild(c);
    }
    month.addEventListener('click',()=>{
      state.calendarDate=new Date(yr,m,1);state.calendarView='month';
      document.querySelectorAll('.vsw-btn').forEach(b=>b.classList.toggle('active',b.dataset.calview==='month'));
      renderCalendar();
    });
    month.appendChild(miniGrid);grid.appendChild(month);
  }
  container.appendChild(grid);
}

function calNavigate(dir) {
  const d=state.calendarDate;
  switch(state.calendarView){
    case 'year':  state.calendarDate=new Date(d.getFullYear()+dir,d.getMonth(),1); break;
    case 'month': state.calendarDate=new Date(d.getFullYear(),d.getMonth()+dir,1); break;
    case 'week':  state.calendarDate=addDays(d,dir*7); break;
    case 'day':   state.calendarDate=addDays(d,dir);   break;
  }
  saveState(); renderCalendar();
}

/* Returns all goals visible on a given dateStr */
function getGoalsForDate(dateStr) {
  const results = [];
  ['year','month','week'].forEach(type => {
    (state.goals[type]||[]).forEach(g => {
      if (!g.startDate) return;
      const inRange = dateStr >= g.startDate && (!g.endDate || dateStr <= g.endDate);
      if (inRange) results.push({ ...g, _goalType: type });
    });
  });
  return results;
}

function _makeGoalDot(goal, mini=false) {
  const el = document.createElement('div');
  el.className = mini ? 'cal-goal-dot-mini' : 'cal-goal-dot';
  el.dataset.goalType = goal._goalType;
  el.textContent = mini ? '' : `🎯 ${goal.title}`;
  el.style.background = GOAL_COLOR[goal._goalType];
  el.title = `${GOAL_TYPE_TR[goal._goalType]}: ${goal.title}`;
  if (goal.completed) el.style.opacity = '0.5';
  el.addEventListener('click', e => { e.stopPropagation(); openGoalDetail(goal._goalType, goal.id); });
  return el;
}

/* ============================================================
   18. DETAIL MODAL
   ============================================================ */
let detailTaskId=null;

function openDetailModal(taskId) {
  const task=state.tasks.find(t=>t.id===taskId); if(!task) return;
  detailTaskId=taskId;
  document.getElementById('detail-task-title').textContent=task.title;
  const recStr = task.recurrence&&task.recurrence!=='none' ? `<div class="detail-row"><span class="detail-label">Repeat</span><span class="detail-value">🔁 ${task.recurrence}</span></div>` : '';
  const remStr = task.reminder&&task.reminder!=='none' ? `<div class="detail-row"><span class="detail-label">Reminder</span><span class="detail-value">🔔 ${task.reminder==='0'?'At task time':task.reminder+' min before'}</span></div>` : '';
  document.getElementById('detail-modal-body').innerHTML=`
    ${task.description?`<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${escHtml(task.description)}</span></div>`:''}
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${task.date?formatDisplayDate(fromDateStr(task.date)):'—'}</span></div>
    ${task.time?`<div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${task.time}</span></div>`:''}
    ${recStr}${remStr}
    <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:${task.completed?'var(--success)':'var(--text-muted)'}">${task.completed?'✅ Completed':'⏳ Pending'}</span></div>
    ${task.image?`<img src="${task.image}" class="detail-img" alt="" />`:''}`;
  document.getElementById('detail-modal-overlay').classList.remove('hidden');
}

function closeDetailModal(){document.getElementById('detail-modal-overlay').classList.add('hidden');detailTaskId=null;}

/* ============================================================
   19. IMAGE UPLOAD
   ============================================================ */
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});}

async function handleWidgetImageUpload(file,key,imgId,zoneId){
  const b64=await fileToBase64(file);
  state.images[key]=b64; saveState();
  document.getElementById(imgId).src=b64;
  document.getElementById(imgId).classList.remove('hidden');
  const p=document.getElementById(zoneId).querySelector('p');
  if(p) p.style.display='none';
}

/* ============================================================
   20. TOAST
   ============================================================ */
let toastTimeout=null;
function showToast(msg) {
  const toast=document.getElementById('toast');
  toast.textContent=msg; toast.classList.remove('hidden'); toast.classList.add('show');
  if(toastTimeout) clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.classList.add('hidden'),300);},2500);
}

/* ============================================================
   21. DASHBOARD BANNER
   ============================================================ */
const Banner = {
  STORAGE_KEY: 'planner_banner_img',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) this._applyImage(saved);

    // Upload
    document.getElementById('banner-upload-input')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const b64 = await this._toBase64(file);
      localStorage.setItem(this.STORAGE_KEY, b64);
      this._applyImage(b64);
      showToast('🖼 Banner güncellendi');
      // reset input so same file can be picked again
      e.target.value = '';
    });

    // Remove
    document.getElementById('banner-remove-btn')?.addEventListener('click', () => {
      localStorage.removeItem(this.STORAGE_KEY);
      this._clearImage();
      showToast('Banner kaldırıldı');
    });
  },

  _applyImage(src) {
    const banner   = document.getElementById('dashboard-banner');
    const img      = document.getElementById('banner-img');
    const removeBtn = document.getElementById('banner-remove-btn');
    if (!banner || !img) return;
    img.src = src;
    img.classList.remove('hidden');
    banner.classList.add('has-image');
    removeBtn?.classList.remove('hidden');
  },

  _clearImage() {
    const banner    = document.getElementById('dashboard-banner');
    const img       = document.getElementById('banner-img');
    const removeBtn = document.getElementById('banner-remove-btn');
    if (!banner || !img) return;
    img.src = '';
    img.classList.add('hidden');
    banner.classList.remove('has-image');
    removeBtn?.classList.add('hidden');
  },

  _toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej(new Error('Dosya okunamadı'));
      r.readAsDataURL(file);
    });
  }
};

/* ============================================================
   21b. UTILITY
   ============================================================ */
function escHtml(s){if(!s)return '';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function updateSidebarDate(){const d=new Date();document.getElementById('sidebar-date').textContent=`${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;}

/* ============================================================
   22. EVENT LISTENERS
   ============================================================ */
function initEventListeners() {
  // Sidebar + bottom nav — event delegation (sonradan eklenen butonlar da çalışır)
  document.addEventListener('click', e => {
    const navItem = e.target.closest('.nav-item');
    if(navItem?.dataset.view) {
      e.preventDefault();
      (window.showView || showView)(navItem.dataset.view);
    }
    const bottomItem = e.target.closest('.bottom-nav-item');
    if(bottomItem?.dataset.view) {
      e.preventDefault();
      (window.showView || showView)(bottomItem.dataset.view);
    }
  });

  // Dashboard
  document.getElementById('quick-add-btn')?.addEventListener('click',()=>openTaskModal());

  // Task Modal
  document.getElementById('task-modal-close')?.addEventListener('click',closeTaskModal);
  document.getElementById('task-modal-cancel')?.addEventListener('click',closeTaskModal);
  document.getElementById('task-modal-save')?.addEventListener('click',saveTask);
  document.getElementById('task-modal-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeTaskModal();});

  // Color dots
  document.querySelectorAll('.color-dot').forEach(dot=>{
    dot.addEventListener('click',()=>{document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('selected'));dot.classList.add('selected');});
  });

  // Task image
  document.getElementById('task-img-input')?.addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file) return;
    taskModalImage=await fileToBase64(file);
    document.getElementById('task-img-preview').src=taskModalImage;
    document.getElementById('task-img-preview').classList.remove('hidden');
    document.getElementById('task-img-label').textContent='📎 Image attached';
  });

  // Recurrence end date visibility
  document.getElementById('task-recurrence-input')?.addEventListener('change', e=>{
    document.getElementById('recurrence-end-group').style.opacity = e.target.value==='none' ? '0.4' : '1';
  });

  // Goal Modal
  document.getElementById('goal-modal-close')?.addEventListener('click',closeGoalModal);
  document.getElementById('goal-modal-cancel')?.addEventListener('click',closeGoalModal);
  document.getElementById('goal-modal-save')?.addEventListener('click',saveGoal);

  // Goal detail modal
  document.getElementById('goal-detail-close')?.addEventListener('click',()=>document.getElementById('goal-detail-overlay').classList.add('hidden'));
  document.getElementById('goal-detail-edit-btn')?.addEventListener('click',()=>{
    const ol=document.getElementById('goal-detail-overlay');
    const type=ol.dataset.goalType, id=ol.dataset.goalId;
    ol.classList.add('hidden');
    openGoalModal(type,id);
  });
  document.getElementById('goal-detail-complete-btn')?.addEventListener('click',()=>{
    const ol=document.getElementById('goal-detail-overlay');
    const type=ol.dataset.goalType, id=ol.dataset.goalId;
    const g=state.goals[type]?.find(g=>g.id===id);
    if(g){ g.completed=!g.completed; saveState(); ol.classList.add('hidden'); refreshCurrentView(); showToast(g.completed?'✅ Tamamlandı!':'↩️ Yeniden açıldı'); }
  });
  document.getElementById('goal-modal-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeGoalModal();});

  // Detail Modal
  document.getElementById('detail-modal-close')?.addEventListener('click',closeDetailModal);
  document.getElementById('detail-modal-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeDetailModal();});
  document.getElementById('detail-delete-btn')?.addEventListener('click',()=>{if(detailTaskId){deleteTask(detailTaskId);closeDetailModal();}});
  document.getElementById('detail-edit-btn')?.addEventListener('click',()=>{const id=detailTaskId;closeDetailModal();openTaskModal(id);});

  // Week Planner
  document.getElementById('week-prev')?.addEventListener('click',()=>{state.weekPlannerOffset--;saveState();renderWeekPlanner();});
  document.getElementById('week-next')?.addEventListener('click',()=>{state.weekPlannerOffset++;saveState();renderWeekPlanner();});
  document.getElementById('week-add-task-btn')?.addEventListener('click',()=>openTaskModal());

  // Calendar
  document.getElementById('cal-prev')?.addEventListener('click',()=>calNavigate(-1));
  document.getElementById('cal-next')?.addEventListener('click',()=>calNavigate(1));
  document.getElementById('cal-today-btn')?.addEventListener('click',()=>{state.calendarDate=new Date();saveState();renderCalendar();});
  document.getElementById('cal-add-task-btn')?.addEventListener('click',()=>openTaskModal(null,toDateStr(state.calendarDate)));
  document.querySelectorAll('.vsw-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.vsw-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.calendarView=btn.dataset.calview; saveState(); renderCalendar();
    });
  });

  // Widget image
  document.querySelector('.hidden-file[data-widget="img1"]')?.addEventListener('change',async e=>{
    const file=e.target.files[0]; if(file) await handleWidgetImageUpload(file,'img1','widget-img-1','img-zone-1');
  });

  // Dark mode toggles
  document.getElementById('dark-mode-toggle')?.addEventListener('click',toggleDarkMode);
  document.getElementById('mobile-theme-btn')?.addEventListener('click',toggleDarkMode);

  // Notification banner
  document.getElementById('notif-allow-btn')?.addEventListener('click',requestNotificationPermission);
  document.getElementById('notif-deny-btn')?.addEventListener('click',()=>{
    document.getElementById('notif-banner')?.classList.add('hidden');
    localStorage.setItem('notif-dismissed','1');
  });

  // Sign out (optional, only if element exists)
  document.getElementById('sign-out-btn')?.addEventListener('click',async()=>{
    if(auth) await auth.signOut();
    showToast('Çıkış yapıldı');
  });

  // Mobile FAB
  document.getElementById('mobile-fab')?.addEventListener('click',()=>openTaskModal());

  // Keyboard shortcuts
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeTaskModal();closeGoalModal();closeDetailModal();}
    if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();openTaskModal();}
    if(e.key==='['&&!e.ctrlKey&&!e.metaKey&&!SB.isMobile()) SB.toggleCollapse();
  });

  document.getElementById('task-title-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveTask();});
  document.getElementById('goal-title-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveGoal();});
}

/* ============================================================
   23. SERVICE WORKER
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(()=>console.log('[SW] Registered'))
      .catch(e=>console.warn('[SW] Failed:',e));
  });
}

/* ============================================================
   24. INIT
   ============================================================ */
function init() {
  try {
  loadState();

  // Dark mode
  applyTheme(state.darkMode);

  // Sidebar
  SB.init();

  // Firebase (only if configured)
  initFirebase();

  // Firebase devre dışı - direkt giriş
  hideAuthGate();

  // Calendar view buttons
  document.querySelectorAll('.vsw-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.calview===state.calendarView);
  });

  // Init event listeners
  initEventListeners();

  // Dashboard banner
  Banner.init();

  // Render dashboard
  showView('dashboard');

  // Update sidebar date
  updateSidebarDate();
  setInterval(updateSidebarDate, 60000);

  // Schedule existing reminders
  const savedPerm = localStorage.getItem('notif-perm');
  if (savedPerm==='granted') {
    notificationPermission='granted';
    scheduleAllReminders();
  } else if (!savedPerm && !localStorage.getItem('notif-dismissed') && 'Notification' in window) {
    setTimeout(()=>{ document.getElementById('notif-banner')?.classList.remove('hidden'); }, 3000);
  }

  // Expose globals AFTER init so upgrades.js can safely patch them
  window.showView          = showView;
  window.renderView        = renderView;
  window.openTaskModal     = openTaskModal;
  window.saveTask          = saveTask;
  window.createTaskCard    = createTaskCard;
  window.openGoalModal     = openGoalModal;
  window.deleteTask        = deleteTask;
  window.saveState         = saveState;
  window.openDetailModal   = openDetailModal;
  window.refreshCurrentView= refreshCurrentView;
  window.escHtml           = escHtml;
  window.showToast         = showToast;
  window.today             = today;
  window.toDateStr         = toDateStr;
  window.addDays           = addDays;
  window.state             = state;

  } catch(e) {
    console.error('init() HATASI:', e);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:50px;left:0;right:0;background:#e05a5a;color:#fff;padding:16px;z-index:99999;font-size:13px;font-family:monospace;white-space:pre-wrap';
    d.textContent = '❌ init() HATASI:\n' + e.message + '\n' + (e.stack||'').split('\n').slice(0,5).join('\n');
    document.body.appendChild(d);
  }
}

document.addEventListener('DOMContentLoaded', init);
