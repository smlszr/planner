/* ============================================================
   PLANNER APP — app.js
   Vanilla JS, no frameworks, localStorage persistence
   ============================================================ */

/* ============================================================
   1. DATA STORE
   ============================================================ */

// Load from localStorage or use defaults
let state = {
  tasks: [],
  goals: { year: [], month: [], week: [] },
  images: { img1: null },
  calendarView: 'month',      // year | month | week | day
  calendarDate: new Date(),   // current navigation date
  weekPlannerOffset: 0        // weeks offset from current week
};

// Generate a simple unique ID
function uid() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

// Persist state to localStorage
function saveState() {
  try {
    localStorage.setItem('planner_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

// Load state from localStorage
function loadState() {
  try {
    const raw = localStorage.getItem('planner_v2');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Restore calendarDate as Date object
    state.tasks  = parsed.tasks  || [];
    state.goals  = parsed.goals  || { year: [], month: [], week: [] };
    state.images = parsed.images || { img1: null };
    state.calendarView    = parsed.calendarView || 'month';
    state.calendarDate    = parsed.calendarDate ? new Date(parsed.calendarDate) : new Date();
    state.weekPlannerOffset = parsed.weekPlannerOffset || 0;
  } catch (e) {
    console.warn('Could not load state:', e);
  }
}

/* ============================================================
   2. DATE HELPERS
   ============================================================ */

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function today() {
  const d = new Date();
  return toDateStr(d);
}

function toDateStr(d) {
  // Returns YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function fromDateStr(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekStart(d) {
  // Returns Monday of the week containing d
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  return start;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatDisplayDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatShortDate(d) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/* ============================================================
   3. NAVIGATION / ROUTING
   ============================================================ */

function showView(viewId) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target view
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');

  // Render the view
  renderView(viewId);
}

function renderView(viewId) {
  switch (viewId) {
    case 'dashboard':   renderDashboard();   break;
    case 'year-goals':  renderGoals('year');  break;
    case 'month-goals': renderGoals('month'); break;
    case 'week-goals':  renderGoals('week');  break;
    case 'week-planner':renderWeekPlanner();  break;
    case 'calendar':    renderCalendar();     break;
  }
}

/* ============================================================
   4. DASHBOARD
   ============================================================ */

function renderDashboard() {
  // Set greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  document.getElementById('greeting-time').textContent = greet;

  // Set date display
  document.getElementById('full-date-display').textContent = formatDisplayDate(new Date());

  // Today's tasks
  const todayStr = today();
  const todayTasks = state.tasks.filter(t => t.date === todayStr);
  const container = document.getElementById('dashboard-today-tasks');
  document.getElementById('today-task-count').textContent = todayTasks.length;

  if (todayTasks.length === 0) {
    container.innerHTML = '<p class="empty-state">No tasks for today. Add one!</p>';
  } else {
    container.innerHTML = '';
    todayTasks.forEach(task => {
      container.appendChild(createTaskCard(task, { compact: true }));
    });
  }

  // Weekly progress
  const weekStart = getWeekStart(new Date());
  const weekEnd   = addDays(weekStart, 6);
  const weekDates = [];
  for (let i = 0; i < 7; i++) weekDates.push(toDateStr(addDays(weekStart, i)));

  const weekTasks     = state.tasks.filter(t => weekDates.includes(t.date));
  const weekCompleted = weekTasks.filter(t => t.completed).length;
  const pct = weekTasks.length === 0 ? 0 : Math.round((weekCompleted / weekTasks.length) * 100);

  const circumference = 2 * Math.PI * 30; // r=30
  const ring = document.getElementById('weekly-ring');
  ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  document.getElementById('weekly-pct').textContent = pct + '%';
  document.getElementById('weekly-caption').textContent =
    `${weekCompleted} of ${weekTasks.length} tasks completed this week`;

  // Weekly goals summary
  const wgContainer = document.getElementById('dashboard-week-goals');
  const weekGoals = state.goals.week.slice(0, 4);
  if (weekGoals.length === 0) {
    wgContainer.innerHTML = '<p class="empty-state">No weekly goals set.</p>';
  } else {
    wgContainer.innerHTML = weekGoals.map(g => `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
        <input type="checkbox" ${g.completed ? 'checked' : ''} style="margin-top:3px;accent-color:var(--accent);cursor:pointer;"
          onchange="toggleGoal('week','${g.id}',this.checked)" />
        <span style="font-size:14px;${g.completed ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${g.title}</span>
      </div>
    `).join('');
  }

  // Restore widget images
  restoreWidgetImages();
}

function restoreWidgetImages() {
  if (state.images.img1) {
    const img = document.getElementById('widget-img-1');
    const zone = document.getElementById('img-zone-1');
    img.src = state.images.img1;
    img.classList.remove('hidden');
    zone.querySelector('p') && (zone.querySelector('p').style.display = 'none');
  }
}

/* ============================================================
   5. TASK CARDS (reusable builder)
   ============================================================ */

function createTaskCard(task, opts = {}) {
  const card = document.createElement('div');
  card.className = `task-card${task.completed ? ' completed' : ''}`;
  card.style.borderLeftColor = task.color || 'var(--p1)';
  card.dataset.taskId = task.id;
  card.draggable = true;

  const timeStr = task.time ? `🕐 ${task.time}` : '';
  const imgHtml = task.image ? `<img src="${task.image}" class="task-card-img" alt="Task image" />` : '';

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:6px;">
      <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}
        title="Mark complete" />
      <div style="flex:1;min-width:0;">
        <div class="task-card-title">${escHtml(task.title)}</div>
        ${timeStr ? `<div class="task-card-meta">${timeStr}</div>` : ''}
        ${imgHtml}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="task-card-btn" title="Edit">✏️</button>
      <button class="task-card-btn delete" title="Delete">🗑</button>
    </div>
  `;

  // Checkbox toggle
  card.querySelector('.task-check').addEventListener('change', (e) => {
    e.stopPropagation();
    toggleTask(task.id, e.target.checked);
  });

  // Edit button
  card.querySelector('.task-card-btn:not(.delete)').addEventListener('click', (e) => {
    e.stopPropagation();
    openTaskModal(task.id);
  });

  // Delete button
  card.querySelector('.task-card-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  // Click → detail modal
  card.addEventListener('click', () => openDetailModal(task.id));

  // Drag events
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('taskId', task.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

/* ============================================================
   6. TASK CRUD
   ============================================================ */

function toggleTask(id, completed) {
  const task = state.tasks.find(t => t.id === id);
  if (task) { task.completed = completed; saveState(); refreshCurrentView(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  refreshCurrentView();
}

function refreshCurrentView() {
  const active = document.querySelector('.nav-item.active');
  if (active) renderView(active.dataset.view);
}

/* ============================================================
   7. TASK MODAL
   ============================================================ */

let taskModalImage = null; // base64 string while modal open

function openTaskModal(editId = null, presetDate = null, presetTime = null) {
  taskModalImage = null;

  const modal    = document.getElementById('task-modal-overlay');
  const titleEl  = document.getElementById('task-modal-title');
  const titleIn  = document.getElementById('task-title-input');
  const descIn   = document.getElementById('task-desc-input');
  const dateIn   = document.getElementById('task-date-input');
  const timeIn   = document.getElementById('task-time-input');
  const editIdIn = document.getElementById('task-edit-id');
  const imgPrev  = document.getElementById('task-img-preview');
  const imgLabel = document.getElementById('task-img-label');

  // Reset form
  titleIn.value = '';
  descIn.value  = '';
  dateIn.value  = presetDate || today();
  timeIn.value  = presetTime || '';
  editIdIn.value = '';
  imgPrev.src = '';
  imgPrev.classList.add('hidden');
  imgLabel.textContent = '📎 Click to upload image';

  // Reset color picker
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  document.querySelector('.color-dot[data-color="#b5d5c5"]').classList.add('selected');

  if (editId) {
    const task = state.tasks.find(t => t.id === editId);
    if (!task) return;
    titleEl.textContent = 'Edit Task';
    titleIn.value  = task.title;
    descIn.value   = task.description || '';
    dateIn.value   = task.date;
    timeIn.value   = task.time || '';
    editIdIn.value = task.id;
    if (task.color) {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      const dot = document.querySelector(`.color-dot[data-color="${task.color}"]`);
      if (dot) dot.classList.add('selected');
    }
    if (task.image) {
      taskModalImage = task.image;
      imgPrev.src = task.image;
      imgPrev.classList.remove('hidden');
      imgLabel.textContent = '📎 Image attached (click to change)';
    }
  } else {
    titleEl.textContent = 'New Task';
  }

  modal.classList.remove('hidden');
  titleIn.focus();
}

function closeTaskModal() {
  document.getElementById('task-modal-overlay').classList.add('hidden');
  taskModalImage = null;
}

function saveTask() {
  const titleIn  = document.getElementById('task-title-input');
  const descIn   = document.getElementById('task-desc-input');
  const dateIn   = document.getElementById('task-date-input');
  const timeIn   = document.getElementById('task-time-input');
  const editIdIn = document.getElementById('task-edit-id');

  const title = titleIn.value.trim();
  if (!title) { titleIn.focus(); titleIn.style.borderColor = 'var(--danger)'; return; }
  titleIn.style.borderColor = '';

  const date = dateIn.value;
  if (!date) { dateIn.focus(); return; }

  const selectedColor = document.querySelector('.color-dot.selected')?.dataset.color || '#b5d5c5';

  if (editIdIn.value) {
    // Update existing task
    const task = state.tasks.find(t => t.id === editIdIn.value);
    if (task) {
      task.title       = title;
      task.description = descIn.value.trim();
      task.date        = date;
      task.time        = timeIn.value;
      task.color       = selectedColor;
      if (taskModalImage) task.image = taskModalImage;
    }
  } else {
    // Create new task
    state.tasks.push({
      id:          uid(),
      title,
      description: descIn.value.trim(),
      date,
      time:        timeIn.value,
      color:       selectedColor,
      completed:   false,
      image:       taskModalImage || null,
      createdAt:   Date.now()
    });
  }

  saveState();
  closeTaskModal();
  refreshCurrentView();
}

/* ============================================================
   8. GOAL CRUD & MODAL
   ============================================================ */

function openGoalModal(type, editId = null) {
  const overlay = document.getElementById('goal-modal-overlay');
  const titleEl = document.getElementById('goal-modal-title');
  const titleIn = document.getElementById('goal-title-input');
  const descIn  = document.getElementById('goal-desc-input');
  const typeIn  = document.getElementById('goal-type-input');
  const editIn  = document.getElementById('goal-edit-id');

  titleIn.value = '';
  descIn.value  = '';
  typeIn.value  = type;
  editIn.value  = '';

  const labels = { year: 'Year Goal', month: 'Month Goal', week: 'Week Goal' };
  titleEl.textContent = editId ? `Edit ${labels[type]}` : `New ${labels[type]}`;

  if (editId) {
    const goal = state.goals[type].find(g => g.id === editId);
    if (goal) {
      titleIn.value = goal.title;
      descIn.value  = goal.description || '';
      editIn.value  = editId;
    }
  }

  overlay.classList.remove('hidden');
  titleIn.focus();
}

function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.add('hidden');
}

function saveGoal() {
  const titleIn = document.getElementById('goal-title-input');
  const descIn  = document.getElementById('goal-desc-input');
  const typeIn  = document.getElementById('goal-type-input');
  const editIn  = document.getElementById('goal-edit-id');

  const title = titleIn.value.trim();
  if (!title) { titleIn.focus(); return; }

  const type = typeIn.value;

  if (editIn.value) {
    const goal = state.goals[type].find(g => g.id === editIn.value);
    if (goal) {
      goal.title       = title;
      goal.description = descIn.value.trim();
    }
  } else {
    state.goals[type].push({
      id:          uid(),
      title,
      description: descIn.value.trim(),
      completed:   false,
      createdAt:   Date.now()
    });
  }

  saveState();
  closeGoalModal();
  renderGoals(type);
}

function toggleGoal(type, id, completed) {
  const goal = state.goals[type].find(g => g.id === id);
  if (goal) { goal.completed = completed; saveState(); }
  // Re-render only if currently on that view
  const activeView = document.querySelector('.nav-item.active')?.dataset.view;
  if (activeView === `${type}-goals`) renderGoals(type);
  if (activeView === 'dashboard') renderDashboard();
}

function deleteGoal(type, id) {
  state.goals[type] = state.goals[type].filter(g => g.id !== id);
  saveState();
  renderGoals(type);
}

/* ============================================================
   9. GOALS RENDER
   ============================================================ */

function renderGoals(type) {
  const listId = `${type}-goals-list`;
  const container = document.getElementById(listId);
  if (!container) return;

  const goals = state.goals[type];

  // Update labels
  const now = new Date();
  if (type === 'year')  document.getElementById('current-year-label').textContent  = now.getFullYear();
  if (type === 'month') document.getElementById('current-month-label').textContent = MONTHS[now.getMonth()];

  if (goals.length === 0) {
    container.innerHTML = '<p class="empty-state full-width">No goals yet. Start adding some!</p>';
    return;
  }

  container.innerHTML = '';
  goals.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-card-top">
        <input type="checkbox" class="goal-check" ${goal.completed ? 'checked' : ''}
          onchange="toggleGoal('${type}','${goal.id}',this.checked)" />
        <div style="flex:1">
          <div class="goal-title${goal.completed ? ' done' : ''}">${escHtml(goal.title)}</div>
          ${goal.description ? `<div class="goal-desc">${escHtml(goal.description)}</div>` : ''}
        </div>
      </div>
      <div class="goal-card-footer">
        <button class="btn-ghost" style="padding:6px 14px;font-size:12px;"
          onclick="openGoalModal('${type}','${goal.id}')">Edit</button>
        <button class="btn-ghost" style="padding:6px 14px;font-size:12px;color:var(--danger);"
          onclick="deleteGoal('${type}','${goal.id}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ============================================================
   10. WEEK PLANNER
   ============================================================ */

function renderWeekPlanner() {
  const now = new Date();
  const baseWeekStart = getWeekStart(now);
  const weekStart = addDays(baseWeekStart, state.weekPlannerOffset * 7);
  const weekEnd   = addDays(weekStart, 6);

  document.getElementById('week-planner-range').textContent =
    `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}, ${weekEnd.getFullYear()}`;

  const board = document.getElementById('week-board');
  board.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dateStr = toDateStr(day);
    const isToday = isSameDay(day, now);

    const col = document.createElement('div');
    col.className = `week-col${isToday ? ' today' : ''}`;
    col.dataset.date = dateStr;

    const dateNum = document.createElement('div');
    dateNum.className = 'week-col-date';
    dateNum.textContent = day.getDate();

    col.innerHTML = `
      <div class="week-col-header">
        <div class="week-col-day">${DAYS_S[day.getDay()]}</div>
      </div>
    `;
    col.querySelector('.week-col-header').appendChild(dateNum);

    const tasksDiv = document.createElement('div');
    tasksDiv.className = 'week-tasks';
    col.appendChild(tasksDiv);

    // Fill tasks
    const dayTasks = state.tasks.filter(t => t.date === dateStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    dayTasks.forEach(task => tasksDiv.appendChild(createTaskCard(task, { compact: true })));

    // Add task inline button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-inline';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => openTaskModal(null, dateStr));
    col.appendChild(addBtn);

    // Drag-over events for week columns
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('taskId');
      moveTaskToDate(taskId, dateStr);
    });

    board.appendChild(col);
  }
}

function moveTaskToDate(taskId, newDate, newTime) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.date = newDate;
    if (newTime !== undefined) task.time = newTime;
    saveState();
    refreshCurrentView();
  }
}

/* ============================================================
   11. CALENDAR
   ============================================================ */

function renderCalendar() {
  const label = document.getElementById('cal-current-label');
  const container = document.getElementById('calendar-container');
  const d = state.calendarDate;

  switch (state.calendarView) {
    case 'month': renderMonthView(d, container, label); break;
    case 'week':  renderWeekView(d, container, label);  break;
    case 'day':   renderDayView(d, container, label);   break;
    case 'year':  renderYearView(d, container, label);  break;
  }
}

/* ---- Month View ---- */
function renderMonthView(d, container, label) {
  label.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'cal-month-grid';

  // Header row
  DAYS_S.forEach(name => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = name;
    grid.appendChild(el);
  });

  // Calculate days to show
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const endPad   = 6 - lastDay.getDay();
  const todayStr = today();

  // Prev month days
  for (let i = startPad - 1; i >= 0; i--) {
    const day = addDays(firstDay, -i - 1);
    grid.appendChild(makeCalDay(day, true));
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), i);
    grid.appendChild(makeCalDay(day, false));
  }

  // Next month days
  for (let i = 1; i <= endPad; i++) {
    const day = addDays(lastDay, i);
    grid.appendChild(makeCalDay(day, true));
  }

  container.appendChild(grid);
}

function makeCalDay(day, otherMonth) {
  const dateStr = toDateStr(day);
  const todayStr = today();
  const dayTasks = state.tasks.filter(t => t.date === dateStr);

  const cell = document.createElement('div');
  cell.className = `cal-day${otherMonth ? ' other-month' : ''}${dateStr === todayStr ? ' today' : ''}`;
  cell.dataset.date = dateStr;

  const num = document.createElement('div');
  num.className = 'cal-day-num';
  num.textContent = day.getDate();
  cell.appendChild(num);

  // Show up to 3 task dots
  const shown = dayTasks.slice(0, 3);
  shown.forEach(task => {
    const dot = document.createElement('div');
    dot.className = 'cal-task-dot';
    dot.textContent = task.title;
    dot.style.background = task.color || 'var(--p1)';
    dot.title = task.title;
    dot.addEventListener('click', (e) => { e.stopPropagation(); openDetailModal(task.id); });
    cell.appendChild(dot);
  });
  if (dayTasks.length > 3) {
    const more = document.createElement('div');
    more.className = 'cal-more';
    more.textContent = `+${dayTasks.length - 3} more`;
    cell.appendChild(more);
  }

  // Click to add task on that day
  cell.addEventListener('click', () => openTaskModal(null, dateStr));

  // Drag-drop
  cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
  cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
  cell.addEventListener('drop', (e) => {
    e.preventDefault();
    cell.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('taskId');
    moveTaskToDate(taskId, dateStr);
  });

  return cell;
}

/* ---- Week View ---- */
function renderWeekView(d, container, label) {
  const weekStart = getWeekStart(d);
  const weekEnd   = addDays(weekStart, 6);
  label.textContent = `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`;

  container.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'cal-week-view';

  // Corner cell
  const corner = document.createElement('div');
  corner.className = 'cal-week-header';
  corner.style.background = 'var(--bg-alt)';
  view.appendChild(corner);

  // Day headers
  const todayStr = today();
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const h = document.createElement('div');
    h.className = `cal-week-header${toDateStr(day) === todayStr ? ' today-col' : ''}`;
    h.innerHTML = `
      <div class="week-header-day">${DAYS_S[day.getDay()]}</div>
      <div class="week-header-date">${day.getDate()}</div>
    `;
    view.appendChild(h);
  }

  // Time label column + hour slots for each day
  for (let h = 0; h < 24; h++) {
    const timeLabel = document.createElement('div');
    timeLabel.className = 'cal-hour-label cal-week-time-col';
    timeLabel.style.padding = '4px 8px';
    timeLabel.style.textAlign = 'right';
    timeLabel.style.fontSize = '10px';
    timeLabel.style.color = 'var(--text-muted)';
    timeLabel.style.borderBottom = '1px solid var(--border)';
    timeLabel.style.minHeight = '56px';
    timeLabel.style.display = 'flex';
    timeLabel.style.alignItems = 'flex-start';
    timeLabel.style.paddingTop = '4px';
    timeLabel.textContent = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`;
    view.appendChild(timeLabel);

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateStr = toDateStr(day);
      const timeStr = String(h).padStart(2,'0') + ':00';

      const slot = document.createElement('div');
      slot.className = 'cal-week-hour-slot';
      slot.dataset.date = dateStr;
      slot.dataset.time = timeStr;

      // Tasks in this hour slot
      const slotTasks = state.tasks.filter(t =>
        t.date === dateStr && t.time && t.time.startsWith(String(h).padStart(2,'0'))
      );
      slotTasks.forEach(task => {
        const dot = document.createElement('div');
        dot.className = 'cal-task-dot';
        dot.textContent = task.title;
        dot.style.background = task.color || 'var(--p1)';
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', (e) => { e.stopPropagation(); openDetailModal(task.id); });
        slot.appendChild(dot);
      });

      slot.addEventListener('click', () => openTaskModal(null, dateStr, timeStr));
      slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        moveTaskToDate(e.dataTransfer.getData('taskId'), dateStr, timeStr);
      });

      view.appendChild(slot);
    }
  }

  container.appendChild(view);
}

/* ---- Day View ---- */
function renderDayView(d, container, label) {
  label.textContent = formatDisplayDate(d);
  container.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'cal-day-view';
  view.style.overflowY = 'auto';
  view.style.maxHeight = '70vh';

  const dateStr = toDateStr(d);

  for (let h = 0; h < 24; h++) {
    const timeStr = String(h).padStart(2,'0') + ':00';
    const timeLabel = document.createElement('div');
    timeLabel.className = 'cal-hour-label';
    timeLabel.style.display = 'flex';
    timeLabel.style.alignItems = 'flex-start';
    timeLabel.style.paddingTop = '4px';
    timeLabel.style.minHeight = '60px';
    timeLabel.style.borderBottom = '1px solid var(--border)';
    timeLabel.textContent = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`;
    view.appendChild(timeLabel);

    const slot = document.createElement('div');
    slot.className = 'cal-hour-slot';
    slot.dataset.date = dateStr;
    slot.dataset.time = timeStr;

    const slotTasks = state.tasks.filter(t =>
      t.date === dateStr && t.time && t.time.startsWith(String(h).padStart(2,'0'))
    );
    slotTasks.forEach(task => slot.appendChild(createTaskCard(task)));

    slot.addEventListener('click', (e) => {
      if (e.target.closest('.task-card')) return;
      openTaskModal(null, dateStr, timeStr);
    });
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      moveTaskToDate(e.dataTransfer.getData('taskId'), dateStr, timeStr);
    });

    view.appendChild(slot);
  }

  container.appendChild(view);
}

/* ---- Year View ---- */
function renderYearView(d, container, label) {
  label.textContent = d.getFullYear();
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'cal-year-grid';
  const todayStr = today();

  for (let m = 0; m < 12; m++) {
    const monthEl = document.createElement('div');
    monthEl.className = 'cal-mini-month';

    const header = document.createElement('div');
    header.className = 'cal-mini-header';
    header.textContent = MONTHS[m];

    const miniGrid = document.createElement('div');
    miniGrid.className = 'cal-mini-grid';

    // Day name headers (1 letter)
    ['S','M','T','W','T','F','S'].forEach(n => {
      const c = document.createElement('div');
      c.className = 'cal-mini-cell header';
      c.textContent = n;
      miniGrid.appendChild(c);
    });

    const firstDay = new Date(d.getFullYear(), m, 1);
    const lastDay  = new Date(d.getFullYear(), m + 1, 0);
    const startPad = firstDay.getDay();

    for (let i = 0; i < startPad; i++) {
      miniGrid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dayStr = `${d.getFullYear()}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasTasks = state.tasks.some(t => t.date === dayStr);
      const c = document.createElement('div');
      c.className = `cal-mini-cell${hasTasks ? ' has-task' : ''}${dayStr === todayStr ? ' today' : ''}`;
      c.textContent = day;
      miniGrid.appendChild(c);
    }

    // Click on mini month → go to month view
    monthEl.addEventListener('click', () => {
      state.calendarDate = new Date(d.getFullYear(), m, 1);
      state.calendarView = 'month';
      document.querySelectorAll('.vsw-btn').forEach(b => b.classList.toggle('active', b.dataset.calview === 'month'));
      renderCalendar();
    });

    monthEl.appendChild(header);
    monthEl.appendChild(miniGrid);
    grid.appendChild(monthEl);
  }

  container.appendChild(grid);
}

/* ============================================================
   12. CALENDAR NAVIGATION
   ============================================================ */

function calNavigate(dir) {
  const d = state.calendarDate;
  switch (state.calendarView) {
    case 'year':
      state.calendarDate = new Date(d.getFullYear() + dir, d.getMonth(), 1);
      break;
    case 'month':
      state.calendarDate = new Date(d.getFullYear(), d.getMonth() + dir, 1);
      break;
    case 'week':
      state.calendarDate = addDays(d, dir * 7);
      break;
    case 'day':
      state.calendarDate = addDays(d, dir);
      break;
  }
  saveState();
  renderCalendar();
}

/* ============================================================
   13. DETAIL MODAL
   ============================================================ */

let detailTaskId = null;

function openDetailModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  detailTaskId = taskId;

  document.getElementById('detail-task-title').textContent = task.title;

  const body = document.getElementById('detail-modal-body');
  body.innerHTML = `
    ${task.description ? `
      <div class="detail-row">
        <span class="detail-label">Notes</span>
        <span class="detail-value">${escHtml(task.description)}</span>
      </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Date</span>
      <span class="detail-value">${task.date ? formatDisplayDate(fromDateStr(task.date)) : '—'}</span>
    </div>
    ${task.time ? `
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${task.time}</span>
      </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span class="detail-value" style="color:${task.completed ? 'var(--success)' : 'var(--text-muted)'}">
        ${task.completed ? '✅ Completed' : '⏳ Pending'}
      </span>
    </div>
    ${task.image ? `<img src="${task.image}" class="detail-img" alt="Task image" />` : ''}
  `;

  document.getElementById('detail-modal-overlay').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.add('hidden');
  detailTaskId = null;
}

/* ============================================================
   14. IMAGE UPLOAD HELPERS
   ============================================================ */

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Widget image upload
async function handleWidgetImageUpload(file, widgetKey, imgId, zoneId) {
  const b64 = await fileToBase64(file);
  state.images[widgetKey] = b64;
  saveState();

  const img  = document.getElementById(imgId);
  const zone = document.getElementById(zoneId);
  img.src = b64;
  img.classList.remove('hidden');
  const p = zone.querySelector('p');
  if (p) p.style.display = 'none';
}

/* ============================================================
   15. ESCAPE HTML (XSS protection)
   ============================================================ */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ============================================================
   16. EVENT LISTENERS SETUP
   ============================================================ */

function initEventListeners() {

  // --- Sidebar navigation ---
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showView(item.dataset.view);
    });
  });

  // --- Dashboard Quick Add ---
  document.getElementById('quick-add-btn').addEventListener('click', () => openTaskModal());

  // --- Task Modal ---
  document.getElementById('task-modal-close').addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-cancel').addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-save').addEventListener('click', saveTask);
  document.getElementById('task-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTaskModal();
  });

  // Color picker
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });

  // Task image upload
  document.getElementById('task-img-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    taskModalImage = b64;
    const preview = document.getElementById('task-img-preview');
    preview.src = b64;
    preview.classList.remove('hidden');
    document.getElementById('task-img-label').textContent = '📎 Image attached';
  });

  // --- Goal Modal ---
  document.getElementById('goal-modal-close').addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-cancel').addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-save').addEventListener('click', saveGoal);
  document.getElementById('goal-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeGoalModal();
  });

  // --- Detail Modal ---
  document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetailModal();
  });
  document.getElementById('detail-delete-btn').addEventListener('click', () => {
    if (detailTaskId) {
      deleteTask(detailTaskId);
      closeDetailModal();
    }
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    const id = detailTaskId;
    closeDetailModal();
    openTaskModal(id);
  });

  // --- Week Planner Navigation ---
  document.getElementById('week-prev').addEventListener('click', () => {
    state.weekPlannerOffset--;
    saveState();
    renderWeekPlanner();
  });
  document.getElementById('week-next').addEventListener('click', () => {
    state.weekPlannerOffset++;
    saveState();
    renderWeekPlanner();
  });
  document.getElementById('week-add-task-btn').addEventListener('click', () => openTaskModal());

  // --- Calendar Navigation ---
  document.getElementById('cal-prev').addEventListener('click', () => calNavigate(-1));
  document.getElementById('cal-next').addEventListener('click', () => calNavigate(1));
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    state.calendarDate = new Date();
    saveState();
    renderCalendar();
  });
  document.getElementById('cal-add-task-btn').addEventListener('click', () => {
    openTaskModal(null, toDateStr(state.calendarDate));
  });

  // Calendar view switcher
  document.querySelectorAll('.vsw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vsw-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.calendarView = btn.dataset.calview;
      saveState();
      renderCalendar();
    });
  });

  // --- Widget image uploads ---
  document.querySelector('.hidden-file[data-widget="img1"]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await handleWidgetImageUpload(file, 'img1', 'widget-img-1', 'img-zone-1');
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeGoalModal();
      closeDetailModal();
    }
    // Ctrl/Cmd + N → new task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openTaskModal();
    }
  });

  // --- Enter key in modal inputs ---
  document.getElementById('task-title-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveTask();
  });
  document.getElementById('goal-title-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveGoal();
  });
}

/* ============================================================
   17. SIDEBAR DATE DISPLAY
   ============================================================ */

function updateSidebarDate() {
  const d = new Date();
  document.getElementById('sidebar-date').textContent =
    `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* ============================================================
   18. INIT
   ============================================================ */

function init() {
  loadState();
  initEventListeners();
  updateSidebarDate();

  // Sync calendar view switcher buttons with state
  document.querySelectorAll('.vsw-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.calview === state.calendarView);
  });

  // Show dashboard by default
  showView('dashboard');

  // Update sidebar date every minute
  setInterval(updateSidebarDate, 60000);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
