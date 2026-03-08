/* ============================================================
   PLANNER UPGRADES — upgrades.js
   Features: AI Suggestions · Pomodoro · Habit Tracker ·
             Priority Levels · Search/Filter · Analytics
   Load AFTER app.js in index.html
   ============================================================ */

/* ============================================================
   UPGRADE 1 — SEARCH & FILTER
   ============================================================ */
const Search = {
  query: '',
  filter: 'all',   // all | today | upcoming | completed | p1 | p2 | p3
  sort:   'date',  // date | priority | created | alpha

  init() {
    // Inject search bar into every view header lazily on first render
    // We add a global floating search in the topbar area instead
    this._injectGlobalBar();
  },

  _injectGlobalBar() {
    // Add to mobile topbar & desktop sidebar top
    const wrap = document.createElement('div');
    wrap.className = 'search-bar-wrap';
    wrap.id = 'global-search-bar';
    wrap.innerHTML = `
      <div class="search-input-wrap" style="position:relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="global-search" type="text" placeholder="Search tasks… (Ctrl+K)" autocomplete="off" />
        <div class="search-results-panel" id="search-results-panel"></div>
      </div>
      <div class="filter-chips" id="filter-chips">
        <button class="filter-chip active" data-filter="all">All</button>
        <button class="filter-chip" data-filter="today">Today</button>
        <button class="filter-chip" data-filter="upcoming">Upcoming</button>
        <button class="filter-chip" data-filter="completed">Done</button>
        <button class="filter-chip" data-filter="p1">🔴 Urgent</button>
      </div>
      <select class="sort-select" id="task-sort-select">
        <option value="date">Sort: Date</option>
        <option value="priority">Sort: Priority</option>
        <option value="alpha">Sort: A–Z</option>
        <option value="created">Sort: Created</option>
      </select>`;

    // Insert before main content views
    const main = document.getElementById('main-content');
    const firstView = main.querySelector('.view');
    main.insertBefore(wrap, firstView);

    // Events
    const input = document.getElementById('global-search');
    input.addEventListener('input', () => { this.query = input.value; this._showResults(); });
    input.addEventListener('focus', () => { if(this.query) this._showResults(); });
    document.addEventListener('click', e => { if(!wrap.contains(e.target)) this._hideResults(); });

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
        this.filter = chip.dataset.filter;
        refreshCurrentView();
      });
    });

    document.getElementById('task-sort-select').addEventListener('change', e => {
      this.sort = e.target.value; refreshCurrentView();
    });

    // Ctrl+K shortcut
    document.addEventListener('keydown', e => {
      if((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); input.focus(); input.select(); }
    });
  },

  _showResults() {
    const panel = document.getElementById('search-results-panel');
    const q = this.query.trim().toLowerCase();
    if(!q) { panel.classList.remove('open'); return; }

    const matches = state.tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description||'').toLowerCase().includes(q)
    ).slice(0, 8);

    if(!matches.length) {
      panel.innerHTML = '<div class="search-result-empty">No tasks found</div>';
    } else {
      panel.innerHTML = matches.map(t => `
        <div class="search-result-item" data-id="${t.id}">
          <div class="search-result-dot" style="background:${t.color||'#b5d5c5'}"></div>
          <div style="flex:1">
            <div class="search-result-title">${escHtml(t.title)}</div>
            <div class="search-result-meta">${t.date||''} ${t.time||''} ${Priority.label(t.priority)}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">${t.completed?'✅':''}</div>
        </div>`).join('');
      panel.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          openDetailModal(item.dataset.id);
          this._hideResults();
          document.getElementById('global-search').value = '';
          this.query = '';
        });
      });
    }
    panel.classList.add('open');
  },

  _hideResults() {
    document.getElementById('search-results-panel')?.classList.remove('open');
  },

  /** Apply filter + sort to a tasks array */
  applyToTasks(tasks) {
    const todayStr = today();
    let filtered = [...tasks];

    switch(this.filter) {
      case 'today':     filtered = filtered.filter(t => t.date === todayStr); break;
      case 'upcoming':  filtered = filtered.filter(t => t.date > todayStr && !t.completed); break;
      case 'completed': filtered = filtered.filter(t => t.completed); break;
      case 'p1':        filtered = filtered.filter(t => t.priority === 1); break;
    }

    switch(this.sort) {
      case 'priority': filtered.sort((a,b) => (a.priority||4)-(b.priority||4)); break;
      case 'alpha':    filtered.sort((a,b) => a.title.localeCompare(b.title)); break;
      case 'created':  filtered.sort((a,b) => (b.createdAt||0)-(a.createdAt||0)); break;
      default:         filtered.sort((a,b) => (a.date||'').localeCompare(b.date||'')); break;
    }

    return filtered;
  }
};

/* ============================================================
   UPGRADE 2 — PRIORITY LEVELS
   ============================================================ */
const Priority = {
  LABELS: { 1:'🔴 Urgent', 2:'🟡 High', 3:'🔵 Normal', 4:'⚪ Low' },
  CLASSES:{ 1:'p1', 2:'p2', 3:'p3', 4:'p4' },

  label(p)  { return p ? this.LABELS[p]||'' : ''; },
  cls(p)    { return p ? this.CLASSES[p]||'p4' : 'p4'; },

  badge(p) {
    if(!p) return '';
    return `<span class="priority-badge ${this.cls(p)}">${this.LABELS[p]}</span>`;
  },

  /** Inject priority selector into task modal */
  injectIntoModal() {
    const reminderGroup = document.getElementById('task-reminder-input')?.closest('.form-group');
    if(!reminderGroup || document.getElementById('priority-selector')) return;
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label>Priority</label>
      <div class="priority-selector" id="priority-selector">
        <button class="priority-option" data-p="1">🔴<br/><span style="font-size:10px">Urgent</span></button>
        <button class="priority-option selected" data-p="3">🔵<br/><span style="font-size:10px">Normal</span></button>
        <button class="priority-option" data-p="2">🟡<br/><span style="font-size:10px">High</span></button>
        <button class="priority-option" data-p="4">⚪<br/><span style="font-size:10px">Low</span></button>
      </div>`;
    reminderGroup.parentNode.insertBefore(div, reminderGroup);

    document.querySelectorAll('.priority-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.priority-option').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  getSelected() {
    return parseInt(document.querySelector('.priority-option.selected')?.dataset.p || '3');
  },

  setSelected(p) {
    document.querySelectorAll('.priority-option').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.p)===(p||3));
    });
  }
};

/* ============================================================
   UPGRADE 3 — AI TASK SUGGESTIONS
   ============================================================ */
const AI = {
  history: [],   // {role, content}[]
  KEY: 'planner_ai_history',

  init() {
    this.history = JSON.parse(localStorage.getItem(this.KEY)||'[]').slice(-20);
  },

  save() { localStorage.setItem(this.KEY, JSON.stringify(this.history.slice(-20))); },

  buildSystemPrompt() {
    const taskList = state.tasks
      .filter(t=>!t.completed).slice(0,20)
      .map(t=>`- ${t.title}${t.date?` (due ${t.date})`:''}${t.priority?` [P${t.priority}]`:''}`)
      .join('\n') || 'No tasks yet.';

    const goals = [
      ...state.goals.year.slice(0,3).map(g=>`[Year] ${g.title}`),
      ...state.goals.month.slice(0,3).map(g=>`[Month] ${g.title}`),
      ...state.goals.week.slice(0,3).map(g=>`[Week] ${g.title}`)
    ].join('\n') || 'No goals set.';

    return `You are a helpful personal productivity assistant built into the user's Planner app.
The user's current open tasks:
${taskList}

The user's goals:
${goals}

You can help with:
1. Suggesting new tasks based on goals (reply with a JSON array: [{"title":"...","description":"...","date":"YYYY-MM-DD","priority":1-4}])
2. Answering productivity questions conversationally
3. Breaking down goals into actionable tasks

When suggesting tasks, ALWAYS return a JSON array wrapped in <tasks>...</tasks> tags in addition to your conversational reply.
If the user asks a general question, just reply conversationally without the JSON.
Keep replies concise and friendly. Today is ${new Date().toDateString()}.`;
  },

  async send(userMessage) {
    this.history.push({ role: 'user', content: userMessage });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: this.buildSystemPrompt(),
        messages: this.history
      })
    });

    if(!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const reply = data.content?.map(c=>c.text||'').join('') || '';
    this.history.push({ role: 'assistant', content: reply });
    this.save();
    return reply;
  },

  parseSuggestions(reply) {
    const match = reply.match(/<tasks>([\s\S]*?)<\/tasks>/);
    if(!match) return null;
    try { return JSON.parse(match[1].trim()); } catch{ return null; }
  },

  stripTags(reply) {
    return reply.replace(/<tasks>[\s\S]*?<\/tasks>/g,'').trim();
  }
};

/* ============================================================
   UPGRADE 4 — POMODORO TIMER
   ============================================================ */
const Pomodoro = {
  MODES: {
    focus:       { label: 'Focus',       default: 25, color: 'var(--accent)' },
    'short-break':{ label: 'Short Break', default: 5,  color: '#ffd6a5' },
    'long-break': { label: 'Long Break',  default: 15, color: '#b5d5c5' }
  },
  mode:       'focus',
  running:    false,
  timeLeft:   25 * 60,
  totalTime:  25 * 60,
  interval:   null,
  sessions:   0,
  todaySessions: 0,
  selectedTaskId: null,
  settings: { focus: 25, shortBreak: 5, longBreak: 15, autoBreak: false },
  KEY: 'planner_pomo',

  init() {
    const saved = JSON.parse(localStorage.getItem(this.KEY)||'{}');
    if(saved.settings) this.settings = { ...this.settings, ...saved.settings };
    if(saved.todaySessions && saved.date === today()) this.todaySessions = saved.todaySessions;
    this.timeLeft = this.settings.focus * 60;
    this.totalTime = this.settings.focus * 60;
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify({
      settings: this.settings,
      todaySessions: this.todaySessions,
      date: today()
    }));
  },

  start() {
    if(this.running) return;
    this.running = true;
    this.interval = setInterval(() => this.tick(), 1000);
    this.renderControls();
  },

  pause() {
    this.running = false;
    clearInterval(this.interval);
    this.renderControls();
  },

  reset() {
    this.pause();
    this.timeLeft = this.settings[this.mode==='focus'?'focus':this.mode==='short-break'?'shortBreak':'longBreak'] * 60;
    this.totalTime = this.timeLeft;
    this.renderDisplay();
    this.renderControls();
  },

  skip() {
    this.pause();
    if(this.mode === 'focus') this._completeSession();
    else this._startFocus();
  },

  tick() {
    this.timeLeft--;
    this.renderDisplay();
    if(this.timeLeft <= 0) {
      this.pause();
      if(this.mode === 'focus') this._completeSession();
      else this._startFocus();
      this._playSound();
    }
  },

  _completeSession() {
    this.sessions++;
    this.todaySessions++;
    this.save();
    showToast('🍅 Pomodoro complete! Take a break.');
    if(notificationPermission === 'granted') {
      new Notification('🍅 Focus session done!', { body: 'Time for a break.' });
    }
    // Mark sessions on the selected task
    if(this.selectedTaskId) {
      const t = state.tasks.find(t=>t.id===this.selectedTaskId);
      if(t) { t.pomodoroSessions = (t.pomodoroSessions||0)+1; saveState(); }
    }
    // Auto-start break
    const breakMode = this.sessions % 4 === 0 ? 'long-break' : 'short-break';
    this._switchMode(breakMode);
    if(this.settings.autoBreak) setTimeout(()=>this.start(), 2000);
    this.render();
  },

  _startFocus() {
    showToast('💪 Break over! Back to focus.');
    this._switchMode('focus');
    this.render();
  },

  _switchMode(mode) {
    this.mode = mode;
    const mins = mode==='focus' ? this.settings.focus
               : mode==='short-break' ? this.settings.shortBreak
               : this.settings.longBreak;
    this.timeLeft = mins * 60;
    this.totalTime = this.timeLeft;
  },

  _playSound() {
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; gain.gain.setValueAtTime(0.15, ctx.currentTime + i*0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.15 + 0.3);
        osc.start(ctx.currentTime + i*0.15); osc.stop(ctx.currentTime + i*0.15 + 0.3);
      });
    } catch(e){}
  },

  setMode(mode) {
    this.pause(); this._switchMode(mode); this.render();
  },

  formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  },

  CIRC: 2*Math.PI*80,

  renderDisplay() {
    const el = document.getElementById('pomo-time-text');
    const ring = document.getElementById('pomo-ring');
    if(!el || !ring) return;
    el.textContent = this.formatTime(this.timeLeft);
    const pct = 1 - (this.timeLeft / this.totalTime);
    ring.style.strokeDasharray  = this.CIRC;
    ring.style.strokeDashoffset = this.CIRC * (1 - pct);
    ring.className = `pomo-progress ${this.mode}`;
    document.title = this.running ? `${this.formatTime(this.timeLeft)} — Planner` : 'Planner';
  },

  renderControls() {
    const btn = document.getElementById('pomo-play-btn');
    if(!btn) return;
    btn.innerHTML = this.running ? '⏸' : '▶';
  },

  render() {
    const container = document.getElementById('pomodoro-main');
    if(!container) return;

    const todayTasks = state.tasks.filter(t=>!t.completed).slice(0,10);
    const selTask = state.tasks.find(t=>t.id===this.selectedTaskId);

    container.innerHTML = `
      <div class="pomodoro-layout">
        <div class="pomodoro-timer-card">
          <div class="pomodoro-mode-tabs">
            ${Object.entries(this.MODES).map(([k,v])=>`
              <button class="pomo-tab${this.mode===k?' active':''}" data-mode="${k}">${v.label}</button>`).join('')}
          </div>

          <div class="pomo-ring-wrap">
            <svg class="pomo-svg" viewBox="0 0 180 180">
              <circle class="pomo-track" cx="90" cy="90" r="80"/>
              <circle id="pomo-ring" class="pomo-progress ${this.mode}" cx="90" cy="90" r="80"
                stroke-dasharray="${this.CIRC}" stroke-dashoffset="${this.CIRC}"
                style="stroke:${this.MODES[this.mode].color}"/>
            </svg>
            <div class="pomo-time-display">
              <span id="pomo-time-text">${this.formatTime(this.timeLeft)}</span>
              <small>${this.MODES[this.mode].label}</small>
            </div>
          </div>

          <div class="pomo-controls">
            <button class="pomo-btn-reset" id="pomo-reset-btn" title="Reset">↺</button>
            <button class="pomo-btn-main"  id="pomo-play-btn">${this.running?'⏸':'▶'}</button>
            <button class="pomo-btn-skip"  id="pomo-skip-btn" title="Skip">⏭</button>
          </div>

          <div class="pomo-task-label">
            🎯 <span>${selTask ? `<strong>${escHtml(selTask.title)}</strong>` : 'No task selected'}</span>
          </div>

          <div class="pomo-stats-row">
            <div class="pomo-stat"><div class="pomo-stat-num">${this.sessions}</div><div class="pomo-stat-lbl">This session</div></div>
            <div class="pomo-stat"><div class="pomo-stat-num">${this.todaySessions}</div><div class="pomo-stat-lbl">Today</div></div>
            <div class="pomo-stat"><div class="pomo-stat-num">${Math.round(this.todaySessions * (this.settings.focus||25))}</div><div class="pomo-stat-lbl">Min focused</div></div>
          </div>
        </div>

        <div class="pomodoro-tasks-panel">
          <div class="pomo-task-picker-label">Select a task to focus on</div>
          <div class="pomo-task-list" id="pomo-task-list">
            ${todayTasks.length ? todayTasks.map(t=>`
              <div class="pomo-task-row${this.selectedTaskId===t.id?' selected':''}" data-id="${t.id}">
                <div class="pomo-task-dot" style="background:${t.color||'#b5d5c5'}"></div>
                <span class="pomo-task-name">${escHtml(t.title)}</span>
                <span class="pomo-sessions-done">${t.pomodoroSessions?`🍅×${t.pomodoroSessions}`:''}</span>
              </div>`).join('') : '<p class="empty-state">No open tasks. Add some first!</p>'}
          </div>

          <div class="pomo-settings-panel" style="margin-top:16px">
            <h4>⚙️ Timer Settings</h4>
            <div class="pomo-setting-row">
              <label>Focus (min)</label>
              <input type="number" id="pomo-focus-min" min="1" max="90" value="${this.settings.focus}" />
            </div>
            <div class="pomo-setting-row">
              <label>Short break (min)</label>
              <input type="number" id="pomo-short-min" min="1" max="30" value="${this.settings.shortBreak}" />
            </div>
            <div class="pomo-setting-row">
              <label>Long break (min)</label>
              <input type="number" id="pomo-long-min" min="1" max="60" value="${this.settings.longBreak}" />
            </div>
            <div class="pomo-setting-row">
              <label>Auto-start breaks</label>
              <input type="checkbox" id="pomo-auto" ${this.settings.autoBreak?'checked':''} style="width:auto;accent-color:var(--accent)" />
            </div>
          </div>
        </div>
      </div>`;

    // Events
    container.querySelectorAll('.pomo-tab').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });
    document.getElementById('pomo-play-btn').addEventListener('click', () =>
      this.running ? this.pause() : this.start());
    document.getElementById('pomo-reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('pomo-skip-btn').addEventListener('click',  () => this.skip());

    container.querySelectorAll('.pomo-task-row').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedTaskId = row.dataset.id;
        container.querySelectorAll('.pomo-task-row').forEach(r=>r.classList.toggle('selected', r===row));
      });
    });

    ['focus','short','long'].forEach(k => {
      const map = {focus:'focus', short:'shortBreak', long:'longBreak'};
      const el = document.getElementById(`pomo-${k}-min`);
      if(el) el.addEventListener('change', () => {
        this.settings[map[k]] = parseInt(el.value)||25;
        this.save();
        if(!this.running) this.reset();
      });
    });
    const autoEl = document.getElementById('pomo-auto');
    if(autoEl) autoEl.addEventListener('change', () => { this.settings.autoBreak = autoEl.checked; this.save(); });

    this.renderDisplay();
  }
};

/* ============================================================
   UPGRADE 5 — HABIT TRACKER
   ============================================================ */
const Habits = {
  KEY: 'planner_habits',
  EMOJIS: ['💧','🏃','📚','🧘','🥗','😴','✍️','💊','🚫','🎸','🧹','🌿'],

  load() {
    return JSON.parse(localStorage.getItem(this.KEY) || '{"habits":[],"logs":{}}');
  },
  save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },

  toggle(habitId, dateStr) {
    const data = this.load();
    const key = `${habitId}:${dateStr}`;
    if(data.logs[key]) delete data.logs[key]; else data.logs[key] = true;
    this.save(data); this.render();
  },

  addHabit(name, emoji) {
    const data = this.load();
    data.habits.push({ id: '_'+Math.random().toString(36).slice(2,8), name, emoji, createdAt: Date.now() });
    this.save(data); this.render();
  },

  deleteHabit(id) {
    const data = this.load();
    data.habits = data.habits.filter(h=>h.id!==id);
    this.save(data); this.render();
  },

  getStreak(habitId) {
    const data = this.load();
    let streak = 0, d = new Date();
    while(true) {
      const key = `${habitId}:${toDateStr(d)}`;
      if(data.logs[key]) { streak++; d = addDays(d,-1); } else break;
    }
    return streak;
  },

  getLast7(habitId) {
    const data = this.load();
    return Array.from({length:7},(_,i)=>{
      const day = addDays(new Date(), i-6);
      return { date: toDateStr(day), day: DAYS_S[day.getDay()], done: !!data.logs[`${habitId}:${toDateStr(day)}`] };
    });
  },

  render() {
    const container = document.getElementById('habits-main');
    if(!container) return;
    const data = this.load();

    container.innerHTML = `
      <div class="habit-add-form upgrade-panel" id="habit-add-form">
        <div class="form-group" style="flex:1;min-width:180px;margin:0">
          <label>Habit Name</label>
          <input type="text" id="habit-name-input" placeholder="e.g. Drink 8 glasses of water" style="border-radius:var(--radius-sm)" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Icon</label>
          <div class="habit-emoji-pick" id="habit-emoji-pick">
            ${this.EMOJIS.map((e,i)=>`<button class="emoji-option${i===0?' selected':''}" data-emoji="${e}">${e}</button>`).join('')}
          </div>
        </div>
        <button class="btn-primary" id="add-habit-btn" style="align-self:flex-end">+ Add Habit</button>
      </div>

      <div class="habits-grid" id="habits-list">
        ${!data.habits.length ? '<p class="empty-state">No habits yet. Add your first one above!</p>' :
          data.habits.map(h => {
            const week = this.getLast7(h.id);
            const streak = this.getStreak(h.id);
            return `
              <div class="habit-row">
                <div class="habit-info">
                  <span class="habit-icon">${h.emoji}</span>
                  <div>
                    <div class="habit-name">${escHtml(h.name)}</div>
                    <div class="habit-streak${streak>=3?' hot':''}">
                      ${streak>0?`🔥 ${streak} day streak`:'No streak yet'}
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:14px">
                  <div class="habit-week-dots">
                    ${week.map(w=>`
                      <div class="habit-dot${w.done?' done':''}${w.date===today()?' today':''}"
                        data-habit="${h.id}" data-date="${w.date}"
                        title="${w.date}">
                        <span>${w.day[0]}</span>
                      </div>`).join('')}
                  </div>
                  <button class="task-card-btn delete" onclick="Habits.deleteHabit('${h.id}')" title="Delete">🗑</button>
                </div>
              </div>`;
          }).join('')}
      </div>`;

    // Add habit
    document.getElementById('add-habit-btn').addEventListener('click', () => {
      const name = document.getElementById('habit-name-input').value.trim();
      const emoji = document.querySelector('.emoji-option.selected')?.dataset.emoji || '✅';
      if(!name) return;
      this.addHabit(name, emoji);
    });
    document.querySelectorAll('.emoji-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-option').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    container.querySelectorAll('.habit-dot').forEach(dot => {
      dot.addEventListener('click', () => this.toggle(dot.dataset.habit, dot.dataset.date));
    });
  }
};

/* ============================================================
   UPGRADE 6 — ANALYTICS DASHBOARD
   ============================================================ */
const Analytics = {
  render() {
    const container = document.getElementById('analytics-main');
    if(!container) return;

    const now       = new Date();
    const todayStr  = today();
    const weekStart = getWeekStart(now);

    // Compute stats
    const total      = state.tasks.length;
    const done       = state.tasks.filter(t=>t.completed).length;
    const todayDone  = state.tasks.filter(t=>t.completed && t.date===todayStr).length;
    const todayTotal = getTasksForDate(todayStr).length;
    const weekTasks  = getTasksForRange(weekStart, addDays(weekStart,6));
    const weekDone   = weekTasks.filter(t=>t.completed).length;
    const streak     = this._calcStreak();
    const pct        = total ? Math.round((done/total)*100) : 0;

    // Last 7 days bar data
    const last7 = Array.from({length:7},(_,i) => {
      const d = addDays(now, i-6);
      const dStr = toDateStr(d);
      const dayTasks = getTasksForDate(dStr);
      return { label: DAYS_S[d.getDay()], done: dayTasks.filter(t=>t.completed).length, total: dayTasks.length, isToday: dStr===todayStr };
    });
    const maxBar = Math.max(...last7.map(d=>d.total), 1);

    // Priority breakdown
    const byPriority = [1,2,3,4].map(p => ({
      p, label: Priority.LABELS[p]||'Normal',
      count: state.tasks.filter(t=>(t.priority||3)===p).length,
      color: ['#e05a5a','#e6920a','var(--accent)','var(--text-muted)'][p-1]
    })).filter(x=>x.count>0);
    const totalP = byPriority.reduce((s,x)=>s+x.count,0)||1;

    // Donut arc helper
    const donutArcs = this._donutArcs(byPriority.map(x=>x.count), byPriority.map(x=>x.color));

    // Insights
    const insights = this._generateInsights(streak, weekDone, weekTasks.length, todayDone, todayTotal);

    container.innerHTML = `
      <!-- KPI Cards -->
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-card-label">Total Tasks</div>
          <div class="stat-card-value">${total}</div>
          <div class="stat-card-delta">${done} completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Completion Rate</div>
          <div class="stat-card-value">${pct}%</div>
          <div class="stat-card-delta">${pct>=70?'🏆 Great work!':pct>=40?'👍 Keep going':'💪 You can do it'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">This Week</div>
          <div class="stat-card-value">${weekDone}/${weekTasks.length}</div>
          <div class="stat-card-delta">${weekTasks.length?Math.round((weekDone/weekTasks.length)*100):0}% done</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Streak</div>
          <div class="stat-card-value">${streak} 🔥</div>
          <div class="stat-card-delta">${streak>0?'days in a row':'Start today!'}</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">Tasks completed — last 7 days</div>
          <div class="bar-chart">
            ${last7.map(d=>`
              <div class="bar-group">
                <div class="bar-wrap">
                  <div class="bar-fill${d.isToday?' today-bar':''}"
                    data-val="${d.done}"
                    style="height:${Math.round((d.done/maxBar)*130)+4}px"></div>
                </div>
                <div class="bar-label">${d.label}</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-card-title">Tasks by priority</div>
          ${byPriority.length ? `
            <div class="donut-wrap">
              <svg class="donut-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bg-alt)" stroke-width="20"/>
                ${donutArcs}
              </svg>
              <div class="donut-legend">
                ${byPriority.map(x=>`
                  <div class="donut-legend-item">
                    <div class="donut-legend-dot" style="background:${x.color}"></div>
                    <span>${x.label} (${x.count})</span>
                  </div>`).join('')}
              </div>
            </div>` : '<p class="empty-state">No priority data yet.</p>'}
        </div>
      </div>

      <!-- Insights -->
      <div class="chart-card">
        <div class="chart-card-title">💡 Insights</div>
        <div class="insights-list">
          ${insights.map(i=>`
            <div class="insight-item">
              <span class="insight-icon">${i.icon}</span>
              <span>${i.text}</span>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _calcStreak() {
    let streak = 0, d = new Date();
    for(let i=0;i<365;i++) {
      const tasks = getTasksForDate(toDateStr(d));
      if(tasks.length>0 && tasks.every(t=>t.completed)) { streak++; d=addDays(d,-1); }
      else if(i===0) { d=addDays(d,-1); } // skip today if not done yet
      else break;
    }
    return streak;
  },

  _donutArcs(values, colors) {
    const total = values.reduce((s,v)=>s+v,0)||1;
    const r=48, cx=60, cy=60, circ=2*Math.PI*r;
    let offset = 0;
    return values.map((v,i) => {
      const pct = v/total;
      const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i]}"
        stroke-width="20" stroke-dasharray="${circ}" stroke-dashoffset="${circ*(1-pct)}"
        transform="rotate(${offset*360-90} ${cx} ${cy})"/>`;
      offset += pct;
      return arc;
    }).join('');
  },

  _generateInsights(streak, weekDone, weekTotal, todayDone, todayTotal) {
    const insights = [];
    const hour = new Date().getHours();

    if(streak >= 7) insights.push({icon:'🏆', text:`Amazing! You've been productive ${streak} days in a row. Keep it up!`});
    else if(streak >= 3) insights.push({icon:'🔥', text:`You're on a ${streak}-day streak! Don't break the chain.`});
    else insights.push({icon:'💡', text:'Complete all tasks today to start building a streak!'});

    if(weekTotal > 0) {
      const pct = Math.round((weekDone/weekTotal)*100);
      if(pct >= 80) insights.push({icon:'⭐', text:`You've completed ${pct}% of this week's tasks. Excellent week!`});
      else if(pct >= 50) insights.push({icon:'📈', text:`${weekDone} of ${weekTotal} tasks done this week. You're past halfway!`});
      else insights.push({icon:'📋', text:`${weekTotal - weekDone} tasks still to go this week. You've got this!`});
    }

    if(hour < 10) insights.push({icon:'☀️', text:'Morning is the best time to tackle your hardest tasks. Start strong!'});
    else if(hour >= 14 && hour < 16) insights.push({icon:'☕', text:"Post-lunch slump? A short 5-minute walk can boost focus significantly."});
    else if(hour >= 20) insights.push({icon:'🌙', text:'Consider planning tomorrow\'s top 3 tasks before you sleep.'});

    const overdue = state.tasks.filter(t=>!t.completed && t.date && t.date < today()).length;
    if(overdue > 0) insights.push({icon:'⚠️', text:`You have ${overdue} overdue task${overdue>1?'s':''}. Consider rescheduling or completing them first.`});

    const urgent = state.tasks.filter(t=>!t.completed && t.priority===1).length;
    if(urgent > 0) insights.push({icon:'🔴', text:`${urgent} urgent task${urgent>1?'s need':'needs'} your attention today.`});

    return insights.slice(0,4);
  }
};

/* ============================================================
   WIRING — inject new views & nav items into existing app
   ============================================================ */
function injectUpgrades() {
  const main = document.getElementById('main-content');
  const nav  = document.querySelector('.sidebar-nav');
  const bottomNav = document.querySelector('.bottom-nav-inner');

  // ── New Views ──────────────────────────────────────────────
  const views = [
    { id: 'ai',        icon: '✨', label: 'AI Assistant',    html: `<div id="view-ai" class="view">
        <header class="view-header">
          <div><h1 class="view-title">AI Assistant ✨</h1><p class="view-subtitle">Let Claude help you plan smarter</p></div>
        </header>
        <div class="upgrade-panel ai-input-area">
          <div class="ai-chat-history" id="ai-chat-history"></div>
          <div class="ai-action-row">
            <textarea class="ai-textarea" id="ai-prompt" placeholder="Ask me anything — 'Suggest tasks for my goals', 'How should I prioritize my week?', 'Break down my project'…" rows="2"></textarea>
          </div>
          <div class="ai-action-row">
            <button class="btn-primary" id="ai-send-btn">✨ Ask Claude</button>
            <button class="btn-ghost" id="ai-suggest-btn">🎯 Suggest tasks from my goals</button>
            <button class="btn-ghost" id="ai-clear-btn">Clear chat</button>
          </div>
        </div>
        <div class="ai-response-area" id="ai-response-area"></div>
      </div>` },
    { id: 'pomodoro',  icon: '🍅', label: 'Focus Timer',     html: `<div id="view-pomodoro" class="view">
        <header class="view-header">
          <div><h1 class="view-title">Focus Timer 🍅</h1><p class="view-subtitle">Pomodoro technique for deep work</p></div>
        </header>
        <div id="pomodoro-main"></div>
      </div>` },
    { id: 'habits',    icon: '🔗', label: 'Habit Tracker',   html: `<div id="view-habits" class="view">
        <header class="view-header">
          <div><h1 class="view-title">Habit Tracker 🔗</h1><p class="view-subtitle">Build lasting habits one day at a time</p></div>
        </header>
        <div id="habits-main"></div>
      </div>` },
    { id: 'analytics', icon: '📊', label: 'Analytics',       html: `<div id="view-analytics" class="view">
        <header class="view-header">
          <div><h1 class="view-title">Analytics 📊</h1><p class="view-subtitle">Your productivity at a glance</p></div>
        </header>
        <div id="analytics-main"></div>
      </div>` },
  ];

  views.forEach(v => {
    const div = document.createElement('div');
    div.innerHTML = v.html;
    main.insertBefore(div.firstElementChild, document.getElementById('mobile-bottom-nav')?.parentElement || null);
    main.appendChild(div.firstElementChild || main.lastElementChild);
  });

  // Re-append all new views after last existing view
  views.forEach(v => {
    const el = document.getElementById(`view-${v.id}`);
    if(el) main.appendChild(el);
  });

  // ── New Sidebar Nav Items ──────────────────────────────────
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.06);margin:8px 10px;';
  nav.appendChild(divider);

  views.forEach(v => {
    const a = document.createElement('a');
    a.href='#'; a.className='nav-item'; a.dataset.view=v.id; a.dataset.tooltip=v.label;
    a.innerHTML=`<span class="nav-indicator"></span><span class="nav-icon" style="font-size:16px">${v.icon}</span><span class="nav-label">${v.label}</span>`;
    nav.appendChild(a);
  });

  // ── Yeni view'ları renderView'e ekle ──────────────────────
  const _origRenderView = renderView;
  window.renderView = function(viewId) {
    _origRenderView(viewId);
    if(viewId==='pomodoro')  Pomodoro.render();
    if(viewId==='habits')    Habits.render();
    if(viewId==='analytics') Analytics.render();
    if(viewId==='ai')        renderAIView();
  };
}

/* ============================================================
   AI VIEW LOGIC
   ============================================================ */
function renderAIView() {
  // Restore chat history
  const histEl = document.getElementById('ai-chat-history');
  if(!histEl) return;
  histEl.innerHTML = AI.history.map(m=>`
    <div class="ai-msg ${m.role}">${escHtml(AI.stripTags ? AI.stripTags(m.content) : m.content)}</div>`).join('');
  histEl.scrollTop = histEl.scrollHeight;
}

async function sendAIMessage(prompt) {
  if(!prompt.trim()) return;
  const ta = document.getElementById('ai-prompt');
  const responseArea = document.getElementById('ai-response-area');
  const histEl = document.getElementById('ai-chat-history');
  if(ta) ta.value = '';

  // Show user bubble
  if(histEl) {
    histEl.innerHTML += `<div class="ai-msg user">${escHtml(prompt)}</div>`;
    histEl.innerHTML += `<div class="ai-msg assistant" id="ai-thinking-bubble">
      <div class="ai-thinking"><div class="ai-thinking-dots"><span></span><span></span><span></span></div> Thinking…</div></div>`;
    histEl.scrollTop = histEl.scrollHeight;
  }

  try {
    const reply = await AI.send(prompt);
    const thinking = document.getElementById('ai-thinking-bubble');
    if(thinking) thinking.remove();

    const text = AI.stripTags(reply);
    if(histEl) {
      histEl.innerHTML += `<div class="ai-msg assistant">${escHtml(text)}</div>`;
      histEl.scrollTop = histEl.scrollHeight;
    }

    // Show task suggestions if any
    const suggestions = AI.parseSuggestions(reply);
    if(suggestions?.length && responseArea) {
      responseArea.innerHTML = `
        <div class="upgrade-panel">
          <div class="upgrade-panel-header">
            <div class="upgrade-panel-title">✨ Suggested Tasks <span style="font-weight:400;text-transform:none;font-size:13px;color:var(--text-muted)">(click + to add)</span></div>
          </div>
          <div class="ai-response-area" id="ai-suggestions-list">
            ${suggestions.map((s,i)=>`
              <div class="ai-suggestion-card" id="ai-sug-${i}">
                <div class="ai-suggestion-content">
                  <div class="ai-suggestion-title">${escHtml(s.title)}</div>
                  ${s.description?`<div class="ai-suggestion-desc">${escHtml(s.description)}</div>`:''}
                  ${s.date?`<div class="ai-suggestion-desc">📅 ${s.date}</div>`:''}
                </div>
                <button class="ai-add-btn" data-idx="${i}">+ Add</button>
              </div>`).join('')}
          </div>
        </div>`;

      responseArea.querySelectorAll('.ai-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = suggestions[parseInt(btn.dataset.idx)];
          state.tasks.push({
            id: '_'+Math.random().toString(36).slice(2,9),
            title: s.title, description: s.description||'',
            date: s.date||today(), time: '', color: '#a2d2ff',
            priority: s.priority||3, recurrence:'none',
            reminder:'none', completed:false, createdAt:Date.now()
          });
          saveState();
          btn.textContent='✅ Added'; btn.classList.add('added');
          showToast('✅ Task added from AI suggestion');
        });
      });
    } else if(responseArea) {
      responseArea.innerHTML = '';
    }
  } catch(err) {
    const thinking = document.getElementById('ai-thinking-bubble');
    if(thinking) thinking.innerHTML = `<span style="color:var(--danger)">⚠️ Couldn't reach Claude API. Make sure you're using this on claude.ai or have set up the API proxy.</span>`;
    console.error('AI error:', err);
  }
}

function initAIEvents() {
  document.addEventListener('click', e => {
    if(e.target.id==='ai-send-btn') {
      const prompt = document.getElementById('ai-prompt')?.value?.trim();
      if(prompt) sendAIMessage(prompt);
    }
    if(e.target.id==='ai-suggest-btn') {
      sendAIMessage("Based on my current goals and tasks, suggest 5 concrete, actionable tasks I should work on this week. Include realistic due dates.");
    }
    if(e.target.id==='ai-clear-btn') {
      AI.history = []; AI.save();
      const histEl = document.getElementById('ai-chat-history');
      const ra = document.getElementById('ai-response-area');
      if(histEl) histEl.innerHTML='';
      if(ra)     ra.innerHTML='';
    }
  });
  document.addEventListener('keydown', e => {
    if(e.target.id==='ai-prompt' && e.key==='Enter' && (e.ctrlKey||e.metaKey)) {
      e.preventDefault();
      const prompt = e.target.value?.trim();
      if(prompt) sendAIMessage(prompt);
    }
  });
}

/* ============================================================
   PATCH EXISTING TASK MODAL TO INCLUDE PRIORITY
   ============================================================ */
function patchTaskModal() {
  // Patch openTaskModal
  const origOpen = window.openTaskModal;
  if(origOpen) {
    window.openTaskModal = function(editId=null, presetDate=null, presetTime=null) {
      origOpen(editId, presetDate, presetTime);
      Priority.injectIntoModal();
      if(editId) {
        const task = state.tasks.find(t=>t.id===editId);
        if(task) Priority.setSelected(task.priority||3);
      } else {
        Priority.setSelected(3);
      }
    };
  }

  // Patch saveTask
  const origSave = window.saveTask;
  if(origSave) {
    window.saveTask = function() {
      const p = Priority.getSelected();
      const editId = document.getElementById('task-edit-id')?.value;
      origSave();
      const tasks = editId ? state.tasks.filter(t=>t.id===editId) : state.tasks.slice(-1);
      if(tasks.length) { tasks[0].priority = p; saveState(); }
    };
  }

  // Patch createTaskCard
  const origCard = window.createTaskCard;
  if(origCard) {
    window.createTaskCard = function(task) {
      const card = origCard(task);
      if(task.priority && task.priority !== 3) {
        card.dataset.priority = task.priority;
        const meta = card.querySelector('.task-card-meta');
        if(meta) meta.insertAdjacentHTML('beforeend', Priority.badge(task.priority));
      }
      return card;
    };
  }
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Inject views & nav
    injectUpgrades();

    // Init modules
    Search.init();
    Pomodoro.init();
    AI.init();

    // Patch existing functions (window.* exposed by app.js)
    patchTaskModal();

    // Init AI event listeners
    initAIEvents();

    console.log('✅ Upgrades yüklendi');
  }, 100); // app.js init için biraz daha bekle
});
