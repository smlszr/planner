/* ============================================================
   PLANNER APP — app.js
   Vanilla JS · localStorage persistence · Collapsible sidebar
   ============================================================ */

/* ============================================================
   1. DATA STORE
   ============================================================ */

let state = {
  tasks:             [],
  goals:             { year: [], month: [], week: [] },
  images:            { img1: null },
  calendarView:      'month',
  calendarDate:      new Date(),
  weekPlannerOffset: 0,
  sidebarCollapsed:  false   // persisted sidebar state
};

function uid() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

function saveState() {
  try { localStorage.setItem('planner_v3', JSON.stringify(state)); }
  catch (e) { console.warn('Save failed:', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem('planner_v3');
    if (!raw) return;
    const p = JSON.parse(raw);
    state.tasks             = p.tasks  || [];
    state.goals             = p.goals  || { year: [], month: [], week: [] };
    state.images            = p.images || { img1: null };
    state.calendarView      = p.calendarView || 'month';
    state.calendarDate      = p.calendarDate ? new Date(p.calendarDate) : new Date();
    state.weekPlannerOffset = p.weekPlannerOffset || 0;
    state.sidebarCollapsed  = p.sidebarCollapsed || false;
  } catch (e) { console.warn('Load failed:', e); }
}

/* ============================================================
   2. DATE HELPERS
   ============================================================ */
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const today     = ()    => toDateStr(new Date());
const toDateStr = d     => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromDateStr = s   => { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays   = (d,n) => { const c = new Date(d); c.setDate(c.getDate()+n); return c; };
const isSameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

function getWeekStart(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}
function formatDisplayDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function formatShortDate(d) { return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }

/* ============================================================
   3. SIDEBAR CONTROLLER
   ============================================================ */
const MOBILE_BP = 900; // px

const SB = {
  el:       null,
  main:     null,
  overlay:  null,
  toggle:   null,
  mobileBtn:null,
  isMobile: () => window.innerWidth <= MOBILE_BP,

  init() {
    this.el        = document.getElementById('sidebar');
    this.main      = document.getElementById('main-content');
    this.overlay   = document.getElementById('sidebar-overlay');
    this.toggle    = document.getElementById('sidebar-toggle');
    this.mobileBtn = document.getElementById('mobile-menu-btn');

    // Restore persisted collapsed state (desktop only)
    if (!this.isMobile()) {
      if (state.sidebarCollapsed) {
        this.el.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
      } else {
        this.el.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
      }
    }

    // Toggle button — works on both desktop (collapse) and mobile (drawer)
    this.toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isMobile()) {
        this.openMobile();
      } else {
        this.toggleCollapse();
      }
    });

    // Mobile hamburger in topbar
    this.mobileBtn.addEventListener('click', () => this.openMobile());

    // Close on overlay click
    this.overlay.addEventListener('click', () => this.closeMobile());

    // Handle resize
    window.addEventListener('resize', () => {
      if (!this.isMobile()) {
        // Switched to desktop: close mobile drawer if open
        this.closeMobile();
        // Restore desktop collapsed state
        if (state.sidebarCollapsed) {
          this.el.classList.add('collapsed');
          document.body.classList.add('sidebar-collapsed');
        } else {
          this.el.classList.remove('collapsed');
          document.body.classList.remove('sidebar-collapsed');
        }
      } else {
        // Switched to mobile: remove collapsed class (drawer handles width)
        this.el.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
      }
    });
  },

  /* Toggle collapse state on desktop */
  toggleCollapse() {
    const isCollapsed = this.el.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    state.sidebarCollapsed = isCollapsed;
    saveState();
  },

  /* Open mobile drawer */
  openMobile() {
    this.el.classList.add('mobile-open');
    this.overlay.classList.add('visible');
    document.body.classList.add('mobile-open');
    document.body.style.overflow = 'hidden';
  },

  /* Close mobile drawer */
  closeMobile() {
    this.el.classList.remove('mobile-open');
    this.overlay.classList.remove('visible');
    document.body.classList.remove('mobile-open');
    document.body.style.overflow = '';
  }
};

/* ============================================================
   4. NAVIGATION / ROUTING
   ============================================================ */

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target  = document.getElementById(`view-${viewId}`);
  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (target)  target.classList.add('active');
  if (navItem) navItem.classList.add('active');

  // Close mobile drawer when navigating
  if (SB.isMobile()) SB.closeMobile();

  renderView(viewId);
}

function renderView(viewId) {
  switch (viewId) {
    case 'dashboard':   renderDashboard();    break;
    case 'year-goals':  renderGoals('year');   break;
    case 'month-goals': renderGoals('month');  break;
    case 'week-goals':  renderGoals('week');   break;
    case 'week-planner':renderWeekPlanner();   break;
    case 'calendar':    renderCalendar();      break;
  }
}

/* ============================================================
   5. DASHBOARD
   ============================================================ */

function renderDashboard() {
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  document.getElementById('greeting-time').textContent = greet;
  document.getElementById('full-date-display').textContent = formatDisplayDate(new Date());

  // Today's tasks
  const todayStr   = today();
  const todayTasks = state.tasks.filter(t => t.date === todayStr);
  const container  = document.getElementById('dashboard-today-tasks');
  document.getElementById('today-task-count').textContent = todayTasks.length;

  if (!todayTasks.length) {
    container.innerHTML = '<p class="empty-state">No tasks for today. Add one!</p>';
  } else {
    container.innerHTML = '';
    todayTasks.forEach(t => container.appendChild(createTaskCard(t)));
  }

  // Weekly progress ring
  const ws = getWeekStart(new Date());
  const weekDates = Array.from({length:7}, (_,i) => toDateStr(addDays(ws,i)));
  const wt  = state.tasks.filter(t => weekDates.includes(t.date));
  const wc  = wt.filter(t => t.completed).length;
  const pct = wt.length ? Math.round((wc / wt.length) * 100) : 0;

  const circumference = 2 * Math.PI * 30;
  document.getElementById('weekly-ring').style.strokeDashoffset =
    circumference - (pct / 100) * circumference;
  document.getElementById('weekly-pct').textContent     = pct + '%';
  document.getElementById('weekly-caption').textContent =
    `${wc} of ${wt.length} tasks completed this week`;

  // Weekly goals summary
  const wgEl = document.getElementById('dashboard-week-goals');
  const wg   = state.goals.week.slice(0, 4);
  if (!wg.length) {
    wgEl.innerHTML = '<p class="empty-state">No weekly goals set.</p>';
  } else {
    wgEl.innerHTML = wg.map(g => `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
        <input type="checkbox" ${g.completed?'checked':''} style="margin-top:3px;accent-color:var(--accent);cursor:pointer;"
          onchange="toggleGoal('week','${g.id}',this.checked)" />
        <span style="font-size:14px;${g.completed?'text-decoration:line-through;color:var(--text-muted)':''}">${escHtml(g.title)}</span>
      </div>`).join('');
  }

  restoreWidgetImages();
}

function restoreWidgetImages() {
  if (state.images.img1) {
    const img  = document.getElementById('widget-img-1');
    const zone = document.getElementById('img-zone-1');
    img.src = state.images.img1;
    img.classList.remove('hidden');
    const p = zone.querySelector('p');
    if (p) p.style.display = 'none';
  }
}

/* ============================================================
   6. TASK CARDS
   ============================================================ */

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card${task.completed ? ' completed' : ''}`;
  card.style.borderLeftColor = task.color || '#b5d5c5';
  card.dataset.taskId = task.id;
  card.draggable = true;

  const timeStr = task.time ? `🕐 ${task.time}` : '';
  const imgHtml = task.image ? `<img src="${task.image}" class="task-card-img" alt="" />` : '';

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px;">
      <input type="checkbox" class="task-check" ${task.completed?'checked':''} />
      <div style="flex:1;min-width:0;">
        <div class="task-card-title">${escHtml(task.title)}</div>
        ${timeStr ? `<div class="task-card-meta">${timeStr}</div>` : ''}
        ${imgHtml}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="task-card-btn" title="Edit">✏️</button>
      <button class="task-card-btn delete" title="Delete">🗑</button>
    </div>`;

  card.querySelector('.task-check').addEventListener('change', e => {
    e.stopPropagation(); toggleTask(task.id, e.target.checked);
  });
  card.querySelector('.task-card-btn:not(.delete)').addEventListener('click', e => {
    e.stopPropagation(); openTaskModal(task.id);
  });
  card.querySelector('.task-card-btn.delete').addEventListener('click', e => {
    e.stopPropagation(); deleteTask(task.id);
  });
  card.addEventListener('click', () => openDetailModal(task.id));
  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('taskId', task.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

/* ============================================================
   7. TASK CRUD
   ============================================================ */

function toggleTask(id, completed) {
  const t = state.tasks.find(t => t.id === id);
  if (t) { t.completed = completed; saveState(); refreshCurrentView(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState(); refreshCurrentView();
}

function refreshCurrentView() {
  const active = document.querySelector('.nav-item.active');
  if (active) renderView(active.dataset.view);
}

/* ============================================================
   8. TASK MODAL
   ============================================================ */

let taskModalImage = null;

function openTaskModal(editId = null, presetDate = null, presetTime = null) {
  taskModalImage = null;

  const get = id => document.getElementById(id);
  get('task-title-input').value  = '';
  get('task-desc-input').value   = '';
  get('task-date-input').value   = presetDate || today();
  get('task-time-input').value   = presetTime || '';
  get('task-edit-id').value      = '';
  get('task-img-preview').src    = '';
  get('task-img-preview').classList.add('hidden');
  get('task-img-label').textContent = '📎 Click to upload image';

  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  document.querySelector('.color-dot[data-color="#b5d5c5"]').classList.add('selected');

  if (editId) {
    const task = state.tasks.find(t => t.id === editId);
    if (!task) return;
    get('task-modal-title').textContent = 'Edit Task';
    get('task-title-input').value = task.title;
    get('task-desc-input').value  = task.description || '';
    get('task-date-input').value  = task.date;
    get('task-time-input').value  = task.time || '';
    get('task-edit-id').value     = task.id;
    if (task.color) {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      document.querySelector(`.color-dot[data-color="${task.color}"]`)?.classList.add('selected');
    }
    if (task.image) {
      taskModalImage = task.image;
      get('task-img-preview').src = task.image;
      get('task-img-preview').classList.remove('hidden');
      get('task-img-label').textContent = '📎 Image attached';
    }
  } else {
    get('task-modal-title').textContent = 'New Task';
  }

  document.getElementById('task-modal-overlay').classList.remove('hidden');
  get('task-title-input').focus();
}

function closeTaskModal() {
  document.getElementById('task-modal-overlay').classList.add('hidden');
  taskModalImage = null;
}

function saveTask() {
  const title = document.getElementById('task-title-input').value.trim();
  const date  = document.getElementById('task-date-input').value;
  if (!title) { document.getElementById('task-title-input').focus(); return; }
  if (!date)  { document.getElementById('task-date-input').focus();  return; }

  const color  = document.querySelector('.color-dot.selected')?.dataset.color || '#b5d5c5';
  const editId = document.getElementById('task-edit-id').value;

  if (editId) {
    const task = state.tasks.find(t => t.id === editId);
    if (task) {
      Object.assign(task, {
        title,
        description: document.getElementById('task-desc-input').value.trim(),
        date,
        time:  document.getElementById('task-time-input').value,
        color,
        image: taskModalImage || task.image
      });
    }
  } else {
    state.tasks.push({
      id:          uid(),
      title,
      description: document.getElementById('task-desc-input').value.trim(),
      date,
      time:        document.getElementById('task-time-input').value,
      color,
      completed:   false,
      image:       taskModalImage || null,
      createdAt:   Date.now()
    });
  }

  saveState(); closeTaskModal(); refreshCurrentView();
}

/* ============================================================
   9. GOAL MODAL & CRUD
   ============================================================ */

function openGoalModal(type, editId = null) {
  const labels = { year:'Year Goal', month:'Month Goal', week:'Week Goal' };
  document.getElementById('goal-title-input').value = '';
  document.getElementById('goal-desc-input').value  = '';
  document.getElementById('goal-type-input').value  = type;
  document.getElementById('goal-edit-id').value     = '';
  document.getElementById('goal-modal-title').textContent =
    editId ? `Edit ${labels[type]}` : `New ${labels[type]}`;

  if (editId) {
    const g = state.goals[type].find(g => g.id === editId);
    if (g) {
      document.getElementById('goal-title-input').value = g.title;
      document.getElementById('goal-desc-input').value  = g.description || '';
      document.getElementById('goal-edit-id').value     = editId;
    }
  }

  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  document.getElementById('goal-title-input').focus();
}

function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.add('hidden');
}

function saveGoal() {
  const title  = document.getElementById('goal-title-input').value.trim();
  const type   = document.getElementById('goal-type-input').value;
  const editId = document.getElementById('goal-edit-id').value;
  if (!title) { document.getElementById('goal-title-input').focus(); return; }

  if (editId) {
    const g = state.goals[type].find(g => g.id === editId);
    if (g) { g.title = title; g.description = document.getElementById('goal-desc-input').value.trim(); }
  } else {
    state.goals[type].push({
      id:          uid(),
      title,
      description: document.getElementById('goal-desc-input').value.trim(),
      completed:   false,
      createdAt:   Date.now()
    });
  }

  saveState(); closeGoalModal(); renderGoals(type);
}

function toggleGoal(type, id, completed) {
  const g = state.goals[type].find(g => g.id === id);
  if (g) { g.completed = completed; saveState(); }
  const active = document.querySelector('.nav-item.active')?.dataset.view;
  if (active === `${type}-goals`) renderGoals(type);
  if (active === 'dashboard')     renderDashboard();
}

function deleteGoal(type, id) {
  state.goals[type] = state.goals[type].filter(g => g.id !== id);
  saveState(); renderGoals(type);
}

/* ============================================================
   10. GOALS RENDER
   ============================================================ */

function renderGoals(type) {
  const container = document.getElementById(`${type}-goals-list`);
  if (!container) return;
  const now = new Date();
  if (type === 'year')  document.getElementById('current-year-label').textContent  = now.getFullYear();
  if (type === 'month') document.getElementById('current-month-label').textContent = MONTHS[now.getMonth()];

  const goals = state.goals[type];
  if (!goals.length) {
    container.innerHTML = '<p class="empty-state full-width">No goals yet. Start adding some!</p>';
    return;
  }

  container.innerHTML = '';
  goals.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-card-top">
        <input type="checkbox" class="goal-check" ${goal.completed?'checked':''}
          onchange="toggleGoal('${type}','${goal.id}',this.checked)" />
        <div style="flex:1">
          <div class="goal-title${goal.completed?' done':''}">${escHtml(goal.title)}</div>
          ${goal.description ? `<div class="goal-desc">${escHtml(goal.description)}</div>` : ''}
        </div>
      </div>
      <div class="goal-card-footer">
        <button class="btn-ghost" style="padding:6px 14px;font-size:12px;"
          onclick="openGoalModal('${type}','${goal.id}')">Edit</button>
        <button class="btn-ghost" style="padding:6px 14px;font-size:12px;color:var(--danger);"
          onclick="deleteGoal('${type}','${goal.id}')">Delete</button>
      </div>`;
    container.appendChild(card);
  });
}

/* ============================================================
   11. WEEK PLANNER
   ============================================================ */

function renderWeekPlanner() {
  const ws = addDays(getWeekStart(new Date()), state.weekPlannerOffset * 7);
  const we = addDays(ws, 6);
  document.getElementById('week-planner-range').textContent =
    `${formatShortDate(ws)} – ${formatShortDate(we)}, ${we.getFullYear()}`;

  const board = document.getElementById('week-board');
  board.innerHTML = '';
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const day     = addDays(ws, i);
    const dateStr = toDateStr(day);
    const isToday = isSameDay(day, now);

    const col = document.createElement('div');
    col.className = `week-col${isToday ? ' today' : ''}`;
    col.dataset.date = dateStr;

    col.innerHTML = `
      <div class="week-col-header">
        <div class="week-col-day">${DAYS_S[day.getDay()]}</div>
        <div class="week-col-date">${day.getDate()}</div>
      </div>
      <div class="week-tasks"></div>`;

    const tasksDiv = col.querySelector('.week-tasks');
    state.tasks
      .filter(t => t.date === dateStr)
      .sort((a,b) => (a.time||'').localeCompare(b.time||''))
      .forEach(t => tasksDiv.appendChild(createTaskCard(t)));

    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-inline';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => openTaskModal(null, dateStr));
    col.appendChild(addBtn);

    col.addEventListener('dragover',  e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('drag-over');
      moveTaskToDate(e.dataTransfer.getData('taskId'), dateStr);
    });

    board.appendChild(col);
  }
}

function moveTaskToDate(taskId, newDate, newTime) {
  const t = state.tasks.find(t => t.id === taskId);
  if (t) {
    t.date = newDate;
    if (newTime !== undefined) t.time = newTime;
    saveState(); refreshCurrentView();
  }
}

/* ============================================================
   12. CALENDAR
   ============================================================ */

function renderCalendar() {
  const label     = document.getElementById('cal-current-label');
  const container = document.getElementById('calendar-container');
  const d         = state.calendarDate;

  switch (state.calendarView) {
    case 'month': renderMonthView(d, container, label); break;
    case 'week':  renderWeekView(d,  container, label); break;
    case 'day':   renderDayView(d,   container, label); break;
    case 'year':  renderYearView(d,  container, label); break;
  }
}

function renderMonthView(d, container, label) {
  label.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'cal-month-grid';

  DAYS_S.forEach(n => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = n;
    grid.appendChild(el);
  });

  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay  = new Date(d.getFullYear(), d.getMonth()+1, 0);
  const pad      = firstDay.getDay();
  const endPad   = 6 - lastDay.getDay();
  const todayStr = today();

  for (let i = pad-1; i >= 0; i--)   grid.appendChild(makeCalDay(addDays(firstDay,-i-1), true));
  for (let i = 1; i <= lastDay.getDate(); i++)
    grid.appendChild(makeCalDay(new Date(d.getFullYear(), d.getMonth(), i), false));
  for (let i = 1; i <= endPad; i++)  grid.appendChild(makeCalDay(addDays(lastDay,i), true));

  container.appendChild(grid);
}

function makeCalDay(day, otherMonth) {
  const dateStr   = toDateStr(day);
  const todayStr  = today();
  const dayTasks  = state.tasks.filter(t => t.date === dateStr);
  const cell = document.createElement('div');
  cell.className = `cal-day${otherMonth?' other-month':''}${dateStr===todayStr?' today':''}`;
  cell.dataset.date = dateStr;

  const num = document.createElement('div');
  num.className = 'cal-day-num';
  num.textContent = day.getDate();
  cell.appendChild(num);

  dayTasks.slice(0,3).forEach(task => {
    const dot = document.createElement('div');
    dot.className = 'cal-task-dot';
    dot.textContent = task.title;
    dot.style.background = task.color || '#b5d5c5';
    dot.addEventListener('click', e => { e.stopPropagation(); openDetailModal(task.id); });
    cell.appendChild(dot);
  });
  if (dayTasks.length > 3) {
    const more = document.createElement('div');
    more.className = 'cal-more';
    more.textContent = `+${dayTasks.length-3} more`;
    cell.appendChild(more);
  }

  cell.addEventListener('click', () => openTaskModal(null, dateStr));
  cell.addEventListener('dragover',  e => { e.preventDefault(); cell.classList.add('drag-over'); });
  cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
  cell.addEventListener('drop', e => {
    e.preventDefault(); cell.classList.remove('drag-over');
    moveTaskToDate(e.dataTransfer.getData('taskId'), dateStr);
  });
  return cell;
}

function renderWeekView(d, container, label) {
  const ws = getWeekStart(d);
  const we = addDays(ws, 6);
  label.textContent = `${formatShortDate(ws)} – ${formatShortDate(we)}`;
  container.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'cal-week-view';
  const todayStr = today();

  // Corner
  const corner = document.createElement('div');
  corner.className = 'cal-week-header';
  view.appendChild(corner);

  // Day headers
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const h = document.createElement('div');
    h.className = `cal-week-header${toDateStr(day)===todayStr?' today-col':''}`;
    h.innerHTML = `<div class="week-header-day">${DAYS_S[day.getDay()]}</div>
                   <div class="week-header-date">${day.getDate()}</div>`;
    view.appendChild(h);
  }

  // Hour rows
  for (let h = 0; h < 24; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'cal-week-time-col';
    lbl.textContent = h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`;
    view.appendChild(lbl);

    for (let i = 0; i < 7; i++) {
      const day  = addDays(ws, i);
      const dStr = toDateStr(day);
      const tStr = String(h).padStart(2,'0')+':00';
      const slot = document.createElement('div');
      slot.className = 'cal-week-hour-slot';
      slot.dataset.date = dStr; slot.dataset.time = tStr;

      state.tasks
        .filter(t => t.date===dStr && t.time?.startsWith(String(h).padStart(2,'0')))
        .forEach(task => {
          const dot = document.createElement('div');
          dot.className = 'cal-task-dot';
          dot.textContent = task.title;
          dot.style.background = task.color || '#b5d5c5';
          dot.addEventListener('click', e => { e.stopPropagation(); openDetailModal(task.id); });
          slot.appendChild(dot);
        });

      slot.addEventListener('click', () => openTaskModal(null, dStr, tStr));
      slot.addEventListener('dragover',  e => { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault(); slot.classList.remove('drag-over');
        moveTaskToDate(e.dataTransfer.getData('taskId'), dStr, tStr);
      });
      view.appendChild(slot);
    }
  }
  container.appendChild(view);
}

function renderDayView(d, container, label) {
  label.textContent = formatDisplayDate(d);
  container.innerHTML = '';
  const view    = document.createElement('div');
  view.className = 'cal-day-view';
  const dateStr = toDateStr(d);

  for (let h = 0; h < 24; h++) {
    const tStr = String(h).padStart(2,'0')+':00';
    const lbl  = document.createElement('div');
    lbl.className = 'cal-hour-label';
    lbl.textContent = h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`;
    view.appendChild(lbl);

    const slot = document.createElement('div');
    slot.className = 'cal-hour-slot';
    slot.dataset.date = dateStr; slot.dataset.time = tStr;

    state.tasks
      .filter(t => t.date===dateStr && t.time?.startsWith(String(h).padStart(2,'0')))
      .forEach(t => slot.appendChild(createTaskCard(t)));

    slot.addEventListener('click', e => { if (e.target.closest('.task-card')) return; openTaskModal(null, dateStr, tStr); });
    slot.addEventListener('dragover',  e => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.classList.remove('drag-over');
      moveTaskToDate(e.dataTransfer.getData('taskId'), dateStr, tStr);
    });
    view.appendChild(slot);
  }
  container.appendChild(view);
}

function renderYearView(d, container, label) {
  label.textContent = d.getFullYear();
  container.innerHTML = '';
  const grid     = document.createElement('div');
  grid.className = 'cal-year-grid';
  const todayStr = today();

  for (let m = 0; m < 12; m++) {
    const month = document.createElement('div');
    month.className = 'cal-mini-month';

    const hdr = document.createElement('div');
    hdr.className = 'cal-mini-header';
    hdr.textContent = MONTHS[m];

    const miniGrid = document.createElement('div');
    miniGrid.className = 'cal-mini-grid';
    ['S','M','T','W','T','F','S'].forEach(n => {
      const c = document.createElement('div');
      c.className = 'cal-mini-cell header'; c.textContent = n;
      miniGrid.appendChild(c);
    });

    const firstDay = new Date(d.getFullYear(), m, 1);
    const lastDay  = new Date(d.getFullYear(), m+1, 0);
    for (let i = 0; i < firstDay.getDay(); i++) miniGrid.appendChild(document.createElement('div'));
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dStr = `${d.getFullYear()}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasT = state.tasks.some(t => t.date === dStr);
      const c = document.createElement('div');
      c.className = `cal-mini-cell${hasT?' has-task':''}${dStr===todayStr?' today':''}`;
      c.textContent = day;
      miniGrid.appendChild(c);
    }

    month.addEventListener('click', () => {
      state.calendarDate = new Date(d.getFullYear(), m, 1);
      state.calendarView = 'month';
      document.querySelectorAll('.vsw-btn').forEach(b => b.classList.toggle('active', b.dataset.calview==='month'));
      renderCalendar();
    });

    month.appendChild(hdr);
    month.appendChild(miniGrid);
    grid.appendChild(month);
  }
  container.appendChild(grid);
}

/* ============================================================
   13. CALENDAR NAVIGATION
   ============================================================ */

function calNavigate(dir) {
  const d = state.calendarDate;
  switch (state.calendarView) {
    case 'year':  state.calendarDate = new Date(d.getFullYear()+dir, d.getMonth(), 1); break;
    case 'month': state.calendarDate = new Date(d.getFullYear(), d.getMonth()+dir, 1); break;
    case 'week':  state.calendarDate = addDays(d, dir*7); break;
    case 'day':   state.calendarDate = addDays(d, dir);   break;
  }
  saveState(); renderCalendar();
}

/* ============================================================
   14. DETAIL MODAL
   ============================================================ */

let detailTaskId = null;

function openDetailModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  detailTaskId = taskId;
  document.getElementById('detail-task-title').textContent = task.title;
  document.getElementById('detail-modal-body').innerHTML = `
    ${task.description ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${escHtml(task.description)}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${task.date ? formatDisplayDate(fromDateStr(task.date)) : '—'}</span></div>
    ${task.time ? `<div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${task.time}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:${task.completed?'var(--success)':'var(--text-muted)'}">${task.completed?'✅ Completed':'⏳ Pending'}</span></div>
    ${task.image ? `<img src="${task.image}" class="detail-img" alt="" />` : ''}`;
  document.getElementById('detail-modal-overlay').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.add('hidden');
  detailTaskId = null;
}

/* ============================================================
   15. IMAGE UPLOAD
   ============================================================ */

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function handleWidgetImageUpload(file, key, imgId, zoneId) {
  const b64 = await fileToBase64(file);
  state.images[key] = b64;
  saveState();
  const img  = document.getElementById(imgId);
  const zone = document.getElementById(zoneId);
  img.src = b64;
  img.classList.remove('hidden');
  const p = zone.querySelector('p');
  if (p) p.style.display = 'none';
}

/* ============================================================
   16. UTILITIES
   ============================================================ */

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function updateSidebarDate() {
  const d = new Date();
  document.getElementById('sidebar-date').textContent =
    `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* ============================================================
   17. EVENT LISTENERS
   ============================================================ */

function initEventListeners() {

  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); showView(item.dataset.view); });
  });

  // Dashboard
  document.getElementById('quick-add-btn').addEventListener('click', () => openTaskModal());

  // Task Modal
  document.getElementById('task-modal-close').addEventListener('click',  closeTaskModal);
  document.getElementById('task-modal-cancel').addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-save').addEventListener('click',   saveTask);
  document.getElementById('task-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });

  // Color dots
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });

  // Task image upload
  document.getElementById('task-img-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    taskModalImage = await fileToBase64(file);
    document.getElementById('task-img-preview').src = taskModalImage;
    document.getElementById('task-img-preview').classList.remove('hidden');
    document.getElementById('task-img-label').textContent = '📎 Image attached';
  });

  // Goal Modal
  document.getElementById('goal-modal-close').addEventListener('click',  closeGoalModal);
  document.getElementById('goal-modal-cancel').addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-save').addEventListener('click',   saveGoal);
  document.getElementById('goal-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGoalModal();
  });

  // Detail Modal
  document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDetailModal();
  });
  document.getElementById('detail-delete-btn').addEventListener('click', () => {
    if (detailTaskId) { deleteTask(detailTaskId); closeDetailModal(); }
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    const id = detailTaskId; closeDetailModal(); openTaskModal(id);
  });

  // Week Planner
  document.getElementById('week-prev').addEventListener('click', () => {
    state.weekPlannerOffset--; saveState(); renderWeekPlanner();
  });
  document.getElementById('week-next').addEventListener('click', () => {
    state.weekPlannerOffset++; saveState(); renderWeekPlanner();
  });
  document.getElementById('week-add-task-btn').addEventListener('click', () => openTaskModal());

  // Calendar
  document.getElementById('cal-prev').addEventListener('click',      () => calNavigate(-1));
  document.getElementById('cal-next').addEventListener('click',      () => calNavigate(1));
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    state.calendarDate = new Date(); saveState(); renderCalendar();
  });
  document.getElementById('cal-add-task-btn').addEventListener('click', () => {
    openTaskModal(null, toDateStr(state.calendarDate));
  });
  document.querySelectorAll('.vsw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vsw-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.calendarView = btn.dataset.calview;
      saveState(); renderCalendar();
    });
  });

  // Widget image upload
  document.querySelector('.hidden-file[data-widget="img1"]').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) await handleWidgetImageUpload(file, 'img1', 'widget-img-1', 'img-zone-1');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeTaskModal(); closeGoalModal(); closeDetailModal(); }
    if ((e.ctrlKey||e.metaKey) && e.key === 'n') { e.preventDefault(); openTaskModal(); }
    // [ and ] to collapse / expand sidebar
    if (e.key === '[' && !e.ctrlKey && !e.metaKey && !SB.isMobile()) SB.toggleCollapse();
  });

  // Enter in modal inputs
  document.getElementById('task-title-input').addEventListener('keydown', e => { if (e.key==='Enter') saveTask(); });
  document.getElementById('goal-title-input').addEventListener('keydown', e => { if (e.key==='Enter') saveGoal(); });
}

/* ============================================================
   18. INIT
   ============================================================ */

function init() {
  loadState();
  SB.init();
  initEventListeners();
  updateSidebarDate();

  // Sync calendar view switcher
  document.querySelectorAll('.vsw-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.calview === state.calendarView);
  });

  // Boot to dashboard
  showView('dashboard');

  // Update clock every minute
  setInterval(updateSidebarDate, 60000);
}

document.addEventListener('DOMContentLoaded', init);
