/* ============================================================
   PLANNER UPGRADES — upgrades.js
   Temiz yeniden yazım — tüm buton ve DOM sorunları çözüldü
   ============================================================ */

/* ============================================================
   PRIORITY
   ============================================================ */
const Priority = {
  LABELS: { 1:'🔴 Acil', 2:'🟡 Yüksek', 3:'🔵 Normal', 4:'⚪ Düşük' },

  badge(p) {
    if(!p || p===3) return '';
    const cls = ['','p1','p2','p3','p4'][p] || 'p4';
    return `<span class="priority-badge ${cls}">${this.LABELS[p]}</span>`;
  },

  getSelected() {
    return parseInt(document.querySelector('.priority-option.selected')?.dataset.p || '3');
  },

  setSelected(p) {
    document.querySelectorAll('.priority-option').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.p) === (p||3));
    });
  },

  injectIntoModal() {
    if(document.getElementById('priority-selector')) return;
    const reminderGroup = document.getElementById('task-reminder-input')?.closest('.form-group');
    if(!reminderGroup) return;
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label>Öncelik</label>
      <div class="priority-selector" id="priority-selector">
        <button type="button" class="priority-option" data-p="1">🔴<br/><span>Acil</span></button>
        <button type="button" class="priority-option" data-p="2">🟡<br/><span>Yüksek</span></button>
        <button type="button" class="priority-option selected" data-p="3">🔵<br/><span>Normal</span></button>
        <button type="button" class="priority-option" data-p="4">⚪<br/><span>Düşük</span></button>
      </div>`;
    reminderGroup.parentNode.insertBefore(div, reminderGroup);
    div.querySelectorAll('.priority-option').forEach(btn => {
      btn.addEventListener('click', () => {
        div.querySelectorAll('.priority-option').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }
};

/* ============================================================
   AI
   ============================================================ */
const AI = {
  history: [],
  KEY: 'planner_ai_history',

  init() {
    this.history = JSON.parse(localStorage.getItem(this.KEY)||'[]').slice(-20);
  },

  save() { localStorage.setItem(this.KEY, JSON.stringify(this.history.slice(-20))); },

  buildSystemPrompt() {
    const taskList = state.tasks
      .filter(t=>!t.completed).slice(0,20)
      .map(t=>`- ${t.title}${t.date?` (bitiş: ${t.date})`:''}`)
      .join('\n') || 'Henüz görev yok.';
    const goals = [
      ...state.goals.year.slice(0,3).map(g=>`[Yıl] ${g.title}`),
      ...state.goals.month.slice(0,3).map(g=>`[Ay] ${g.title}`),
      ...state.goals.week.slice(0,3).map(g=>`[Hafta] ${g.title}`)
    ].join('\n') || 'Henüz hedef yok.';
    return `Sen kullanıcının planlayıcı uygulamasına entegre edilmiş bir üretkenlik asistanısın. Türkçe yanıt ver.
Kullanıcının açık görevleri:\n${taskList}\nHedefleri:\n${goals}\nBugün: ${new Date().toDateString()}
Görev önerirken <tasks>[{"title":"...","date":"YYYY-MM-DD","priority":1-4}]</tasks> formatında JSON döndür.`;
  },

  async send(userMessage) {
    this.history.push({ role:'user', content:userMessage });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000,
        system:this.buildSystemPrompt(), messages:this.history })
    });
    if(!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const reply = data.content?.map(c=>c.text||'').join('')||'';
    this.history.push({role:'assistant',content:reply});
    this.save();
    return reply;
  },

  parseSuggestions(text) {
    const m = text.match(/<tasks>([\s\S]*?)<\/tasks>/);
    if(!m) return [];
    try { return JSON.parse(m[1]); } catch{ return []; }
  },

  stripTags(text) {
    return text.replace(/<tasks>[\s\S]*?<\/tasks>/g,'').trim();
  }
};

/* ============================================================
   POMODORO
   ============================================================ */
const Pomodoro = {
  MODES: {
    focus:  { label:'Odak',        mins:25, color:'#6b5cff' },
    short:  { label:'Kısa Mola',   mins:5,  color:'#b5d5c5' },
    long:   { label:'Uzun Mola',   mins:15, color:'#a2d2ff' }
  },
  mode: 'focus',
  running: false,
  timeLeft: 25*60,
  totalTime: 25*60,
  sessions: 0,
  todaySessions: 0,
  selectedTaskId: null,
  _interval: null,
  CIRC: 2*Math.PI*80,

  init() {
    const saved = JSON.parse(localStorage.getItem('planner_pomo')||'{}');
    this.todaySessions = saved.todaySessions||0;
    this.timeLeft = this.MODES[this.mode].mins*60;
    this.totalTime = this.timeLeft;
  },

  render() {
    const container = document.getElementById('pomodoro-main');
    if(!container) return;
    const tasks = state.tasks.filter(t=>!t.completed).slice(0,10);
    container.innerHTML = `
      <div class="pomodoro-layout">
        <div class="pomodoro-timer-card upgrade-panel">
          <div class="pomodoro-mode-tabs">
            ${Object.entries(this.MODES).map(([k,v])=>
              `<button type="button" class="pomo-tab${this.mode===k?' active':''}" data-mode="${k}">${v.label}</button>`
            ).join('')}
          </div>
          <div class="pomo-ring-wrap">
            <svg class="pomo-svg" viewBox="0 0 180 180">
              <circle class="pomo-track" cx="90" cy="90" r="80"/>
              <circle id="pomo-ring" class="pomo-progress" cx="90" cy="90" r="80"
                stroke-dasharray="${this.CIRC}"
                stroke-dashoffset="${this.CIRC*(1-(1-this.timeLeft/this.totalTime))}"
                style="stroke:${this.MODES[this.mode].color}"/>
            </svg>
            <div class="pomo-time-display">
              <span id="pomo-time-text">${this._fmt(this.timeLeft)}</span>
              <small>${this.MODES[this.mode].label}</small>
            </div>
          </div>
          <div class="pomo-controls">
            <button type="button" class="pomo-btn-reset" id="pomo-reset-btn">↺</button>
            <button type="button" class="pomo-btn-main"  id="pomo-play-btn">${this.running?'⏸':'▶'}</button>
            <button type="button" class="pomo-btn-skip"  id="pomo-skip-btn">⏭</button>
          </div>
          <div class="pomo-stats-row">
            <div class="pomo-stat"><div class="pomo-stat-num">${this.sessions}</div><div class="pomo-stat-lbl">Bu oturum</div></div>
            <div class="pomo-stat"><div class="pomo-stat-num">${this.todaySessions}</div><div class="pomo-stat-lbl">Bugün</div></div>
            <div class="pomo-stat"><div class="pomo-stat-num">${this.todaySessions*25}</div><div class="pomo-stat-lbl">Dk odaklandı</div></div>
          </div>
        </div>
        <div class="pomodoro-tasks-panel upgrade-panel">
          <div class="pomo-task-picker-label">Odaklanılacak görevi seç</div>
          <div class="pomo-task-list">
            ${tasks.map(t=>`
              <div class="pomo-task-item${this.selectedTaskId===t.id?' selected':''}" data-id="${t.id}">
                <span class="pomo-task-dot" style="background:${t.color||'#b5d5c5'}"></span>
                <span>${escHtml(t.title)}</span>
              </div>`).join('') || '<p class="empty-state">Açık görev yok.</p>'}
          </div>
        </div>
      </div>`;

    // bind events
    container.querySelectorAll('.pomo-tab').forEach(btn =>
      btn.addEventListener('click', () => { this._switchMode(btn.dataset.mode); this.render(); }));
    container.querySelector('#pomo-play-btn')?.addEventListener('click', () => this.toggle());
    container.querySelector('#pomo-reset-btn')?.addEventListener('click', () => { this._reset(); this.render(); });
    container.querySelector('#pomo-skip-btn')?.addEventListener('click', () => { this._skip(); });
    container.querySelectorAll('.pomo-task-item').forEach(item =>
      item.addEventListener('click', () => { this.selectedTaskId = item.dataset.id; this.render(); }));
  },

  toggle() { this.running ? this._pause() : this._play(); },

  _play() {
    this.running = true;
    this._interval = setInterval(() => {
      this.timeLeft--;
      this._updateDisplay();
      if(this.timeLeft<=0) this._complete();
    }, 1000);
    this._updateDisplay();
  },

  _pause() {
    this.running = false;
    clearInterval(this._interval);
    this._updateDisplay();
  },

  _reset() {
    this.running = false;
    clearInterval(this._interval);
    this.timeLeft = this.MODES[this.mode].mins*60;
    this.totalTime = this.timeLeft;
  },

  _skip() {
    this._reset();
    this.mode = this.mode==='focus' ? 'short' : 'focus';
    this.timeLeft = this.MODES[this.mode].mins*60;
    this.totalTime = this.timeLeft;
    this.render();
  },

  _switchMode(m) {
    this._reset();
    this.mode = m;
    this.timeLeft = this.MODES[m].mins*60;
    this.totalTime = this.timeLeft;
  },

  _complete() {
    this._pause();
    if(this.mode==='focus') { this.sessions++; this.todaySessions++; }
    localStorage.setItem('planner_pomo', JSON.stringify({todaySessions:this.todaySessions}));
    if('Notification' in window && Notification.permission==='granted')
      new Notification('⏰ Süre doldu!', {body:`${this.MODES[this.mode].label} bitti.`});
    this._skip();
  },

  _updateDisplay() {
    const el = document.getElementById('pomo-time-text');
    const ring = document.getElementById('pomo-ring');
    const playBtn = document.getElementById('pomo-play-btn');
    if(el) el.textContent = this._fmt(this.timeLeft);
    if(ring) {
      const pct = 1 - this.timeLeft/this.totalTime;
      ring.style.strokeDashoffset = this.CIRC*(1-pct);
    }
    if(playBtn) playBtn.textContent = this.running ? '⏸' : '▶';
    document.title = this.running ? `${this._fmt(this.timeLeft)} — Planlayıcı` : 'Planlayıcı';
  },

  _fmt(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }
};

/* ============================================================
   HABITS
   ============================================================ */
const Habits = {
  KEY: 'planner_habits',
  EMOJIS: ['✅','💧','📚','🏃','🧘','💪','🥗','😴','✍️','🎯','🌿','⭐'],

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)||'{"habits":[],"logs":{}}'); }
    catch{ return {habits:[],logs:{}}; }
  },
  save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },

  addHabit(name, emoji) {
    const data = this.load();
    data.habits.push({id: Date.now().toString(), name, emoji});
    this.save(data); this.render();
  },

  deleteHabit(id) {
    const data = this.load();
    data.habits = data.habits.filter(h=>h.id!==id);
    this.save(data); this.render();
  },

  toggle(habitId, dateStr) {
    const data = this.load();
    const key = `${habitId}:${dateStr}`;
    data.logs[key] = !data.logs[key];
    this.save(data); this.render();
  },

  getStreak(habitId) {
    const data = this.load();
    let streak = 0;
    for(let i=0; i<365; i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${habitId}:${d.toISOString().slice(0,10)}`;
      if(data.logs[key]) streak++;
      else if(i>0) break;
    }
    return streak;
  },

  render() {
    const container = document.getElementById('habits-main');
    if(!container) return;
    const data = this.load();
    const today = new Date().toISOString().slice(0,10);

    container.innerHTML = `
      <div class="upgrade-panel habit-add-form">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:180px;margin:0">
            <label>Alışkanlık adı</label>
            <input type="text" id="habit-name-input" placeholder="Örn: 8 bardak su iç" />
          </div>
          <div class="form-group" style="margin:0">
            <label>Simge</label>
            <div class="habit-emoji-pick" id="habit-emoji-pick">
              ${this.EMOJIS.map((e,i)=>`<button type="button" class="emoji-option${i===0?' selected':''}" data-emoji="${e}">${e}</button>`).join('')}
            </div>
          </div>
          <button type="button" class="btn-primary" id="add-habit-btn">+ Ekle</button>
        </div>
      </div>
      <div class="habits-grid">
        ${!data.habits.length ? '<p class="empty-state">Henüz alışkanlık yok. Yukarıdan ekle!</p>' :
          data.habits.map(h => {
            const streak = this.getStreak(h.id);
            const days = Array.from({length:7},(_,i)=>{
              const d=new Date(); d.setDate(d.getDate()-(6-i));
              const ds=d.toISOString().slice(0,10);
              return `<div class="habit-dot${data.logs[`${h.id}:${ds}`]?' done':''}${ds===today?' today':''}"
                data-habit="${h.id}" data-date="${ds}">${['Pz','Pt','Sa','Ça','Pe','Cu','Ct'][d.getDay()]}</div>`;
            }).join('');
            return `<div class="upgrade-panel habit-row" style="padding:16px 20px">
              <div class="habit-info">
                <span class="habit-icon">${h.emoji}</span>
                <div>
                  <div class="habit-name">${escHtml(h.name)}</div>
                  <div class="habit-streak${streak>=3?' hot':''}">${streak>0?`🔥 ${streak} gün seri`:'Henüz seri yok'}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:14px">
                <div class="habit-week-dots">${days}</div>
                <button type="button" class="task-card-btn delete" data-delete-habit="${h.id}">🗑</button>
              </div>
            </div>`;
          }).join('')}
      </div>`;

    container.querySelector('#add-habit-btn')?.addEventListener('click', () => {
      const name = container.querySelector('#habit-name-input').value.trim();
      const emoji = container.querySelector('.emoji-option.selected')?.dataset.emoji || '✅';
      if(name) this.addHabit(name, emoji);
    });
    container.querySelectorAll('.emoji-option').forEach(btn =>
      btn.addEventListener('click', () => {
        container.querySelectorAll('.emoji-option').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      }));
    container.querySelectorAll('.habit-dot').forEach(dot =>
      dot.addEventListener('click', () => this.toggle(dot.dataset.habit, dot.dataset.date)));
    container.querySelectorAll('[data-delete-habit]').forEach(btn =>
      btn.addEventListener('click', () => this.deleteHabit(btn.dataset.deleteHabit)));
  }
};

/* ============================================================
   ANALYTICS
   ============================================================ */
const Analytics = {
  render() {
    const container = document.getElementById('analytics-main');
    if(!container) return;
    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    const total = state.tasks.length;
    const done  = state.tasks.filter(t=>t.completed).length;
    const pct   = total ? Math.round(done/total*100) : 0;

    // Last 7 days
    const days7 = Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=d.toISOString().slice(0,10);
      const dayTasks=state.tasks.filter(t=>t.date===ds);
      const dayDone=dayTasks.filter(t=>t.completed).length;
      return {label:['Pz','Pt','Sa','Ça','Pe','Cu','Ct'][d.getDay()], total:dayTasks.length, done:dayDone, isToday:ds===todayStr};
    });
    const maxDay = Math.max(...days7.map(d=>d.total),1);

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:24px">
        ${[
          ['Toplam Görev', total, '📋'],
          ['Tamamlanma', pct+'%', '✅'],
          ['Tamamlanan', done, '🎯'],
          ['Kalan', total-done, '⏳']
        ].map(([lbl,val,icon])=>`
          <div class="upgrade-panel" style="text-align:center;padding:20px 16px">
            <div style="font-size:28px;margin-bottom:6px">${icon}</div>
            <div style="font-size:26px;font-weight:700;color:var(--accent)">${val}</div>
            <div style="font-size:12px;color:var(--text-muted)">${lbl}</div>
          </div>`).join('')}
      </div>
      <div class="upgrade-panel">
        <div class="upgrade-panel-title" style="margin-bottom:18px">📊 Son 7 Gün</div>
        <div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:0 8px">
          ${days7.map(d=>{
            const h = Math.max(d.total ? Math.round(d.total/maxDay*100) : 6, 6);
            const dh= d.total ? Math.round(d.done/maxDay*100) : 0;
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:11px;color:var(--text-muted)">${d.total||''}</div>
              <div style="width:100%;flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2px">
                <div style="height:${dh}%;background:var(--accent);border-radius:4px 4px 0 0;min-height:${d.done?4:0}px;opacity:0.85"></div>
                <div style="height:${h-dh}%;background:var(--border);border-radius:${d.done?'0':'4px 4px'} 0 0;min-height:${d.total&&!d.done?4:0}px"></div>
              </div>
              <div style="font-size:11px;color:${d.isToday?'var(--accent)':'var(--text-muted)'};font-weight:${d.isToday?700:400}">${d.label}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:var(--text-muted)">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:4px"></span>Tamamlanan</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--border);border-radius:2px;margin-right:4px"></span>Toplam</span>
        </div>
      </div>`;
  }
};

/* ============================================================
   AI VIEW
   ============================================================ */
function renderAIView() {
  const histEl = document.getElementById('ai-chat-history');
  if(!histEl) return;
  histEl.innerHTML = AI.history.map(m=>`
    <div class="ai-msg ${m.role}">${escHtml(AI.stripTags ? AI.stripTags(m.content) : m.content)}</div>`).join('');
  histEl.scrollTop = histEl.scrollHeight;
}

async function sendAIMessage(prompt) {
  if(!prompt.trim()) return;
  const ta = document.getElementById('ai-prompt');
  const histEl = document.getElementById('ai-chat-history');
  if(ta) ta.value = '';
  if(histEl) {
    histEl.innerHTML += `<div class="ai-msg user">${escHtml(prompt)}</div>`;
    histEl.innerHTML += `<div class="ai-msg assistant" id="ai-thinking">⏳ Düşünüyor…</div>`;
    histEl.scrollTop = histEl.scrollHeight;
  }
  try {
    const reply = await AI.send(prompt);
    document.getElementById('ai-thinking')?.remove();
    const text = AI.stripTags(reply);
    if(histEl) { histEl.innerHTML += `<div class="ai-msg assistant">${escHtml(text)}</div>`; histEl.scrollTop=histEl.scrollHeight; }
    const suggestions = AI.parseSuggestions(reply);
    const area = document.getElementById('ai-response-area');
    if(suggestions.length && area) {
      area.innerHTML = `<div class="upgrade-panel"><div class="upgrade-panel-title">✨ Önerilen Görevler</div>
        ${suggestions.map((s,i)=>`
          <div class="ai-suggestion" data-idx="${i}">
            <div><strong>${escHtml(s.title)}</strong>${s.date?`<br/><small>${s.date}</small>`:''}</div>
            <button type="button" class="btn-primary" style="padding:5px 12px;font-size:12px" data-idx="${i}">+ Ekle</button>
          </div>`).join('')}
      </div>`;
      area.querySelectorAll('button[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = suggestions[parseInt(btn.dataset.idx)];
          if(s) {
            state.tasks.push({id:Date.now().toString(), title:s.title, description:s.description||'',
              date:s.date||'', priority:s.priority||3, color:'#b5d5c5', completed:false, createdAt:Date.now()});
            saveState();
            btn.textContent = '✅';
            btn.disabled = true;
            showToast('✅ Görev eklendi');
          }
        });
      });
    }
  } catch(e) {
    document.getElementById('ai-thinking')?.remove();
    if(histEl) histEl.innerHTML += `<div class="ai-msg assistant">❌ Hata: ${e.message}</div>`;
  }
}

function initAIEvents() {
  document.getElementById('ai-send-btn')?.addEventListener('click', () => {
    sendAIMessage(document.getElementById('ai-prompt')?.value||'');
  });
  document.getElementById('ai-suggest-btn')?.addEventListener('click', () => {
    sendAIMessage('Hedeflerime göre bu hafta için görevler öner.');
  });
  document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
    AI.history = []; AI.save();
    const h = document.getElementById('ai-chat-history');
    if(h) h.innerHTML = '';
    const a = document.getElementById('ai-response-area');
    if(a) a.innerHTML = '';
  });
  document.addEventListener('keydown', e => {
    if(e.target.id==='ai-prompt' && e.key==='Enter' && (e.ctrlKey||e.metaKey)) {
      e.preventDefault();
      sendAIMessage(e.target.value||'');
    }
  });
}

/* ============================================================
   INJECT VIEWS & NAV
   ============================================================ */
function injectUpgrades() {
  const main = document.getElementById('main-content');
  const nav  = document.querySelector('.sidebar-nav');
  if(!main || !nav) return;

  // 4 new views — appended AFTER existing views (safe, no DOM reordering)
  const newViews = [
    { id:'ai',        icon:'✨', label:'AI Asistan',
      html:`<section class="view" id="view-ai">
        <header class="view-header"><div><h1 class="view-title">AI Asistan ✨</h1><p class="view-subtitle">Claude ile daha akıllı planla</p></div></header>
        <div class="upgrade-panel ai-input-area">
          <div class="ai-chat-history" id="ai-chat-history"></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <textarea class="ai-textarea" id="ai-prompt" placeholder="Sor… (Ctrl+Enter)" rows="2" style="flex:1"></textarea>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="ai-send-btn">✨ Gönder</button>
            <button type="button" class="btn-ghost" id="ai-suggest-btn">🎯 Görev öner</button>
            <button type="button" class="btn-ghost" id="ai-clear-btn">Temizle</button>
          </div>
        </div>
        <div id="ai-response-area"></div>
      </section>` },
    { id:'pomodoro',  icon:'🍅', label:'Odak Zamanlayıcı',
      html:`<section class="view" id="view-pomodoro">
        <header class="view-header"><div><h1 class="view-title">Odak Zamanlayıcı 🍅</h1><p class="view-subtitle">Pomodoro tekniği ile derin çalışma</p></div></header>
        <div id="pomodoro-main"></div>
      </section>` },
    { id:'habits',    icon:'🔗', label:'Alışkanlık Takibi',
      html:`<section class="view" id="view-habits">
        <header class="view-header"><div><h1 class="view-title">Alışkanlık Takibi 🔗</h1><p class="view-subtitle">Her gün bir adım daha</p></div></header>
        <div id="habits-main"></div>
      </section>` },
    { id:'analytics', icon:'📊', label:'Analitik',
      html:`<section class="view" id="view-analytics">
        <header class="view-header"><div><h1 class="view-title">Analitik 📊</h1><p class="view-subtitle">Üretkenliğine genel bakış</p></div></header>
        <div id="analytics-main"></div>
      </section>` },
  ];

  // Append views to main (safe — doesn't touch existing views)
  newViews.forEach(v => {
    if(!document.getElementById(`view-${v.id}`)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = v.html;
      main.appendChild(tmp.firstElementChild);
    }
  });

  // Add divider + nav items
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.06);margin:8px 10px';
  nav.appendChild(divider);

  newViews.forEach(v => {
    if(nav.querySelector(`[data-view="${v.id}"]`)) return; // don't double-add
    const a = document.createElement('a');
    a.href='#'; a.className='nav-item'; a.dataset.view=v.id; a.dataset.tooltip=v.label;
    a.innerHTML=`<span class="nav-indicator"></span><span class="nav-icon" style="font-size:16px">${v.icon}</span><span class="nav-label">${v.label}</span>`;
    nav.appendChild(a);
  });

  // Patch renderView to handle new views
  const _orig = renderView; // local reference, not window
  window.renderView = function(viewId) {
    _orig(viewId);
    if(viewId==='pomodoro')  Pomodoro.render();
    if(viewId==='habits')    Habits.render();
    if(viewId==='analytics') Analytics.render();
    if(viewId==='ai')        renderAIView();
  };
  // Keep window.showView pointing to the same showView (it already calls window.renderView)
  window.showView = showView;

  // Patch openTaskModal to inject priority
  const _origOpen = window.openTaskModal;
  if(_origOpen) {
    window.openTaskModal = function(editId, presetDate, presetTime) {
      _origOpen(editId, presetDate, presetTime);
      Priority.injectIntoModal();
      const task = editId ? state.tasks.find(t=>t.id===editId) : null;
      Priority.setSelected(task?.priority || 3);
    };
  }

  // Patch saveTask to save priority
  const _origSave = window.saveTask;
  if(_origSave) {
    window.saveTask = function() {
      const p = Priority.getSelected();
      const editId = document.getElementById('task-edit-id')?.value;
      _origSave();
      const tasks = editId ? state.tasks.filter(t=>t.id===editId) : state.tasks.slice(-1);
      if(tasks.length) { tasks[0].priority=p; saveState(); }
    };
  }

  // Patch createTaskCard for priority badge
  const _origCard = window.createTaskCard;
  if(_origCard) {
    window.createTaskCard = function(task) {
      const card = _origCard(task);
      if(task.priority && task.priority!==3) {
        card.dataset.priority = task.priority;
        card.querySelector('.task-card-meta')?.insertAdjacentHTML('beforeend', Priority.badge(task.priority));
      }
      return card;
    };
  }
}

/* ============================================================
   BOOT — wait for app.js to finish, then inject
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    AI.init();
    Pomodoro.init();
    injectUpgrades();
    initAIEvents();
    console.log('✅ Upgrades yüklendi');
  }, 150);
});
