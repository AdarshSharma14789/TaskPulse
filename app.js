// TaskPulse App State & Logic Engine

const STORAGE_KEYS = {
    TASKS: 'taskpulse_tasks_v1',
    LOGS: 'taskpulse_completion_logs_v1',
    TOKEN: 'taskpulse_auth_token_v1',
    THEME: 'taskpulse_theme_v1'
};

// Application State
let state = {
    user: null, // { id, name, email }
    token: localStorage.getItem(STORAGE_KEYS.TOKEN) || null,
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark-glass',
    selectedDate: getTodayDateString(),
    tasks: [],
    completionLogs: {}, // { "2026-07-27": ["task-1", "task-2"] }
    activeFrequencyFilter: 'all',
    activePriorityFilter: 'all',
    searchQuery: ''
};

// Drag and drop state tracking
let draggedTaskId = null;

// DOM Elements
const DOM = {
    // Header & Date Nav
    currentDateText: document.getElementById('current-date-text'),
    dateBadge: document.getElementById('date-badge'),
    datePickerInput: document.getElementById('date-picker-input'),
    prevDayBtn: document.getElementById('prev-day-btn'),
    nextDayBtn: document.getElementById('next-day-btn'),
    todayBtn: document.getElementById('today-btn'),
    addTaskBtn: document.getElementById('add-task-btn'),
    themeSelect: document.getElementById('theme-select'),

    // Auth Header Elements
    guestAuthContainer: document.getElementById('guest-auth-container'),
    openAuthModalBtn: document.getElementById('open-auth-modal-btn'),
    userProfileBadge: document.getElementById('user-profile-badge'),
    userNameDisplay: document.getElementById('user-name-display'),
    logoutBtn: document.getElementById('logout-btn'),

    // Stats & Progress
    progressPercent: document.getElementById('progress-percent'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    statPending: document.getElementById('stat-pending'),
    statCompleted: document.getElementById('stat-completed'),
    statTotal: document.getElementById('stat-total'),
    pendingCountBadge: document.getElementById('pending-count-badge'),
    completedCountBadge: document.getElementById('completed-count-badge'),

    // Search & Filters
    searchInput: document.getElementById('search-input'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    priorityFilter: document.getElementById('priority-filter'),

    // Task Lists
    pendingTasksList: document.getElementById('pending-tasks-list'),
    completedTasksList: document.getElementById('completed-tasks-list'),

    // Task Modal & Form
    taskModal: document.getElementById('task-modal'),
    modalTitle: document.getElementById('modal-title'),
    taskForm: document.getElementById('task-form'),
    taskIdInput: document.getElementById('task-id'),
    taskTitleInput: document.getElementById('task-title-input'),
    taskDescInput: document.getElementById('task-desc-input'),
    taskFrequencySelect: document.getElementById('task-frequency-select'),
    taskStartDate: document.getElementById('task-start-date'),
    weeklyDaysContainer: document.getElementById('weekly-days-container'),
    taskCategoryInput: document.getElementById('task-category-input'),
    taskPrioritySelect: document.getElementById('task-priority-select'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),

    // Auth Modal Elements
    authModal: document.getElementById('auth-modal'),
    closeAuthModalBtn: document.getElementById('close-auth-modal-btn'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    authErrorAlert: document.getElementById('auth-error-alert'),
    loginEmailInput: document.getElementById('login-email'),
    loginPasswordInput: document.getElementById('login-password'),
    signupNameInput: document.getElementById('signup-name'),
    signupEmailInput: document.getElementById('signup-email'),
    signupPasswordInput: document.getElementById('signup-password'),
    signupConfirmPasswordInput: document.getElementById('signup-confirm-password')
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    updateDateDisplay();
    await initAuth();
});

// Helper: Format Date Object to YYYY-MM-DD
function formatDateToString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Get Today's Date String
function getTodayDateString() {
    return formatDateToString(new Date());
}

// Helper: Parse YYYY-MM-DD into Date object safely
function parseDateString(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// Helper: Get Authorization Headers for Fetch API
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    return headers;
}

// --- THEME MANAGEMENT ---

function initTheme() {
    applyTheme(state.theme);
    if (DOM.themeSelect) {
        DOM.themeSelect.value = state.theme;
    }
}

function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(STORAGE_KEYS.THEME, themeName);
}

// --- AUTHENTICATION LOGIC ---

async function initAuth() {
    if (state.token) {
        try {
            const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
                updateAuthUI();
                await loadData();
                return;
            }
        } catch (e) {
            console.warn('Auth check failed, defaulting to guest/offline mode', e);
        }
    }

    state.user = null;
    updateAuthUI();
    await loadData();
}

function updateAuthUI() {
    if (state.user) {
        DOM.guestAuthContainer.classList.add('hidden');
        DOM.userProfileBadge.classList.remove('hidden');
        DOM.userNameDisplay.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${escapeHTML(state.user.name)}`;
    } else {
        DOM.guestAuthContainer.classList.remove('hidden');
        DOM.userProfileBadge.classList.add('hidden');
    }
}

function showAuthError(msg) {
    if (msg) {
        DOM.authErrorAlert.textContent = msg;
        DOM.authErrorAlert.classList.remove('hidden');
    } else {
        DOM.authErrorAlert.textContent = '';
        DOM.authErrorAlert.classList.add('hidden');
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    showAuthError('');

    const email = DOM.loginEmailInput.value.trim();
    const password = DOM.loginPasswordInput.value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            showAuthError(data.error || 'Login failed. Please check your credentials.');
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem(STORAGE_KEYS.TOKEN, state.token);

        updateAuthUI();
        DOM.authModal.close();
        showToast(`Welcome back, ${state.user.name}! 👋`);
        await loadData();
    } catch (err) {
        console.error('Login error', err);
        showAuthError('Unable to connect to server. Please try again.');
    }
}

async function handleSignupSubmit(e) {
    e.preventDefault();
    showAuthError('');

    const name = DOM.signupNameInput.value.trim();
    const email = DOM.signupEmailInput.value.trim();
    const password = DOM.signupPasswordInput.value;
    const confirmPassword = DOM.signupConfirmPasswordInput.value;

    if (password !== confirmPassword) {
        showAuthError('Passwords do not match. Please re-enter.');
        return;
    }

    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            showAuthError(data.error || 'Account creation failed.');
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem(STORAGE_KEYS.TOKEN, state.token);

        updateAuthUI();
        DOM.authModal.close();
        showToast(`Account created! Welcome, ${state.user.name}! 🎉`);
        await loadData();
    } catch (err) {
        console.error('Signup error', err);
        showAuthError('Unable to connect to server. Please try again.');
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(STORAGE_KEYS.TOKEN);

    updateAuthUI();
    showToast('Logged out successfully.');
    loadData();
}

// --- DATA ENGINE & API SYNC ---

async function loadData() {
    try {
        const [tasksRes, logsRes] = await Promise.all([
            fetch('/api/tasks', { headers: getAuthHeaders() }),
            fetch('/api/logs', { headers: getAuthHeaders() })
        ]);
        if (tasksRes.ok && logsRes.ok) {
            state.tasks = await tasksRes.json();
            state.completionLogs = await logsRes.json();
            saveToLocalStorage();
            renderApp();
            return;
        }
    } catch (e) {
        console.warn('Backend API unavailable, using localStorage fallback', e);
    }
    loadFromLocalStorage();
    renderApp();
}

function loadFromLocalStorage() {
    try {
        const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
        const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
        
        if (savedTasks) {
            const loaded = JSON.parse(savedTasks);
            state.tasks = loaded.filter(t => !t.id.startsWith('task-demo-'));
        } else {
            state.tasks = [];
        }

        if (savedLogs) state.completionLogs = JSON.parse(savedLogs);
    } catch (e) {
        console.error('Failed to load tasks from local storage', e);
    }
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.completionLogs));
    } catch (e) {
        console.error('Failed to save to local storage', e);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme Selector
    if (DOM.themeSelect) {
        DOM.themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            showToast(`Theme changed! 🎨`);
        });
    }

    // Date Navigation
    DOM.prevDayBtn.addEventListener('click', () => changeSelectedDate(-1));
    DOM.nextDayBtn.addEventListener('click', () => changeSelectedDate(1));
    DOM.todayBtn.addEventListener('click', () => {
        const todayStr = getTodayDateString();
        const wasAlreadyToday = (state.selectedDate === todayStr);
        state.selectedDate = todayStr;
        updateDateDisplay();
        renderApp();

        const card = document.querySelector('.overview-card');
        if (card) {
            card.classList.remove('pulse-card');
            void card.offsetWidth;
            card.classList.add('pulse-card');
        }

        showToast(wasAlreadyToday ? "You are currently viewing Today's tasks!" : "Switched to Today's view!");
    });

    DOM.datePickerInput.addEventListener('change', (e) => {
        if (e.target.value) {
            state.selectedDate = e.target.value;
            updateDateDisplay();
            renderApp();
        }
    });

    // Auth Listeners
    DOM.openAuthModalBtn.addEventListener('click', () => {
        showAuthError('');
        DOM.authModal.showModal();
    });

    DOM.closeAuthModalBtn.addEventListener('click', () => DOM.authModal.close());
    DOM.logoutBtn.addEventListener('click', handleLogout);

    DOM.tabLogin.addEventListener('click', () => {
        DOM.tabLogin.classList.add('active');
        DOM.tabSignup.classList.remove('active');
        DOM.loginForm.classList.remove('hidden');
        DOM.signupForm.classList.add('hidden');
        showAuthError('');
    });

    DOM.tabSignup.addEventListener('click', () => {
        DOM.tabSignup.classList.add('active');
        DOM.tabLogin.classList.remove('active');
        DOM.signupForm.classList.remove('hidden');
        DOM.loginForm.classList.add('hidden');
        showAuthError('');
    });

    DOM.loginForm.addEventListener('submit', handleLoginSubmit);
    DOM.signupForm.addEventListener('submit', handleSignupSubmit);

    // Filters & Search
    DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderApp();
    });

    DOM.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeFrequencyFilter = tab.getAttribute('data-frequency');
            renderApp();
        });
    });

    DOM.priorityFilter.addEventListener('change', (e) => {
        state.activePriorityFilter = e.target.value;
        renderApp();
    });

    // Task Modal Control
    DOM.addTaskBtn.addEventListener('click', () => openTaskModal());
    DOM.closeModalBtn.addEventListener('click', () => DOM.taskModal.close());
    DOM.cancelModalBtn.addEventListener('click', () => DOM.taskModal.close());

    // Frequency Selector change in Modal
    DOM.taskFrequencySelect.addEventListener('change', (e) => {
        if (e.target.value === 'weekly') {
            DOM.weeklyDaysContainer.classList.remove('hidden');
        } else {
            DOM.weeklyDaysContainer.classList.add('hidden');
        }
    });

    // Form Submit
    DOM.taskForm.addEventListener('submit', handleTaskFormSubmit);
}

function changeSelectedDate(days) {
    const dateObj = parseDateString(state.selectedDate);
    dateObj.setDate(dateObj.getDate() + days);
    state.selectedDate = formatDateToString(dateObj);
    updateDateDisplay();
    renderApp();
}

function updateDateDisplay() {
    const dateObj = parseDateString(state.selectedDate);
    const todayStr = getTodayDateString();
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    DOM.currentDateText.textContent = dateObj.toLocaleDateString('en-US', options);
    DOM.datePickerInput.value = state.selectedDate;

    if (state.selectedDate === todayStr) {
        DOM.dateBadge.textContent = 'Today';
        DOM.dateBadge.className = 'badge badge-today';
    } else if (state.selectedDate < todayStr) {
        DOM.dateBadge.textContent = 'Past Date';
        DOM.dateBadge.className = 'badge badge-past';
    } else {
        DOM.dateBadge.textContent = 'Upcoming';
        DOM.dateBadge.className = 'badge badge-future';
    }
}

function isTaskDueOnDate(task, targetDateStr) {
    if (targetDateStr < task.startDate) return false;

    const targetObj = parseDateString(targetDateStr);
    const startObj = parseDateString(task.startDate);

    switch (task.frequency) {
        case 'once':
            return targetDateStr === task.startDate;
        case 'daily':
            return true;
        case 'weekly':
            if (task.weeklyDays && task.weeklyDays.length > 0) {
                const dayOfWeek = targetObj.getDay();
                return task.weeklyDays.includes(dayOfWeek);
            }
            return targetObj.getDay() === startObj.getDay();
        case 'monthly':
            return targetObj.getDate() === startObj.getDate();
        default:
            return false;
    }
}

function renderApp() {
    const dateStr = state.selectedDate;
    const completedTaskIds = state.completionLogs[dateStr] || [];

    const tasksForDate = state.tasks.filter(task => isTaskDueOnDate(task, dateStr));

    const filteredTasks = tasksForDate.filter(task => {
        if (state.activeFrequencyFilter !== 'all' && task.frequency !== state.activeFrequencyFilter) {
            return false;
        }
        if (state.activePriorityFilter !== 'all' && task.priority !== state.activePriorityFilter) {
            return false;
        }
        if (state.searchQuery) {
            const titleMatch = task.title.toLowerCase().includes(state.searchQuery);
            const descMatch = task.description && task.description.toLowerCase().includes(state.searchQuery);
            const catMatch = task.category && task.category.toLowerCase().includes(state.searchQuery);
            if (!titleMatch && !descMatch && !catMatch) return false;
        }
        return true;
    });

    const pendingTasks = [];
    const completedTasks = [];

    filteredTasks.forEach(task => {
        if (completedTaskIds.includes(task.id)) {
            completedTasks.push(task);
        } else {
            pendingTasks.push(task);
        }
    });

    const totalScheduled = tasksForDate.length;
    const totalDone = tasksForDate.filter(t => completedTaskIds.includes(t.id)).length;
    const percent = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

    DOM.progressPercent.textContent = `${percent}%`;
    DOM.progressBarFill.style.width = `${percent}%`;
    DOM.statPending.textContent = totalScheduled - totalDone;
    DOM.statCompleted.textContent = totalDone;
    DOM.statTotal.textContent = totalScheduled;

    DOM.pendingCountBadge.textContent = pendingTasks.length;
    DOM.completedCountBadge.textContent = completedTasks.length;

    renderTaskList(DOM.pendingTasksList, pendingTasks, false);
    renderTaskList(DOM.completedTasksList, completedTasks, true);
}

function renderTaskList(container, tasks, isCompletedSection) {
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid ${isCompletedSection ? 'fa-square-check' : 'fa-clipboard-list'}"></i>
                <p>${isCompletedSection ? 'No completed tasks for this day yet.' : 'All caught up! No pending tasks scheduled.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(task => createTaskHTML(task, isCompletedSection)).join('');

    tasks.forEach(task => {
        const card = document.getElementById(`task-card-${task.id}`);
        if (card && !isCompletedSection) {
            attachDragAndDropListeners(card, task.id);
        }

        const checkbox = document.getElementById(`checkbox-${task.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));
        }

        const editBtn = document.getElementById(`edit-${task.id}`);
        if (editBtn) {
            editBtn.addEventListener('click', () => editTask(task.id));
        }

        const deleteBtn = document.getElementById(`delete-${task.id}`);
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteTask(task.id));
        }
    });
}

// Attach Drag and Drop Listeners for Task Reordering
function attachDragAndDropListeners(card, taskId) {
    card.addEventListener('dragstart', (e) => {
        draggedTaskId = taskId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        if (!draggedTaskId || draggedTaskId === taskId) return;

        const fromIdx = state.tasks.findIndex(t => t.id === draggedTaskId);
        const toIdx = state.tasks.findIndex(t => t.id === taskId);

        if (fromIdx > -1 && toIdx > -1) {
            const [movedTask] = state.tasks.splice(fromIdx, 1);
            state.tasks.splice(toIdx, 0, movedTask);

            saveToLocalStorage();
            renderApp();
            showToast('Task reordered! 🖐️');
        }
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedTaskId = null;
    });
}

// Generate Task Card HTML (with Drag Handle & Draggable attribute)
function createTaskHTML(task, isCompleted) {
    const frequencyBadgeClass = `tag-freq-${task.frequency}`;
    const frequencyText = task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1);

    const priorityBadgeClass = `tag-priority-${task.priority}`;
    const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" id="task-card-${task.id}" ${!isCompleted ? 'draggable="true"' : ''}>
            <div class="task-left">
                ${!isCompleted ? `<i class="fa-solid fa-grip-vertical drag-handle" title="Drag to reorder"></i>` : ''}

                <label class="custom-checkbox-wrapper" title="${isCompleted ? 'Mark Pending' : 'Mark Complete'}">
                    <input type="checkbox" id="checkbox-${task.id}" ${isCompleted ? 'checked' : ''}>
                    <span class="checkbox-visual">
                        <i class="fa-solid fa-check"></i>
                    </span>
                </label>

                <div class="task-body">
                    <div class="task-title">${escapeHTML(task.title)}</div>
                    ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="meta-tag ${frequencyBadgeClass}">
                            <i class="fa-solid fa-rotate-right"></i> ${frequencyText}
                        </span>
                        <span class="meta-tag ${priorityBadgeClass}">${priorityText}</span>
                        ${task.category ? `<span class="meta-tag tag-category"><i class="fa-solid fa-folder"></i> ${escapeHTML(task.category)}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="task-actions">
                <button id="edit-${task.id}" class="action-btn" title="Edit Task">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button id="delete-${task.id}" class="action-btn delete-btn" title="Delete Task">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

async function toggleTaskCompletion(taskId) {
    const dateStr = state.selectedDate;
    if (!state.completionLogs[dateStr]) {
        state.completionLogs[dateStr] = [];
    }

    const index = state.completionLogs[dateStr].indexOf(taskId);
    if (index > -1) {
        state.completionLogs[dateStr].splice(index, 1);
    } else {
        state.completionLogs[dateStr].push(taskId);
    }

    renderApp();
    saveToLocalStorage();

    try {
        const res = await fetch('/api/logs/toggle', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, dateStr })
        });
        if (res.ok) {
            const data = await res.json();
            state.completionLogs[dateStr] = data.completedTaskIds;
            saveToLocalStorage();
        }
    } catch (e) {
        console.warn('API Error toggling log, saved locally', e);
    }
}

function openTaskModal(task = null) {
    DOM.taskForm.reset();
    
    if (task) {
        DOM.modalTitle.innerHTML = `<i class="fa-solid fa-pen"></i> Edit Task`;
        DOM.taskIdInput.value = task.id;
        DOM.taskTitleInput.value = task.title;
        DOM.taskDescInput.value = task.description || '';
        DOM.taskFrequencySelect.value = task.frequency;
        DOM.taskStartDate.value = task.startDate;
        DOM.taskCategoryInput.value = task.category || 'Personal';
        DOM.taskPrioritySelect.value = task.priority || 'medium';

        if (task.frequency === 'weekly') {
            DOM.weeklyDaysContainer.classList.remove('hidden');
            const checkboxes = document.querySelectorAll('input[name="weekly-days"]');
            checkboxes.forEach(cb => {
                cb.checked = task.weeklyDays ? task.weeklyDays.includes(Number(cb.value)) : false;
            });
        } else {
            DOM.weeklyDaysContainer.classList.add('hidden');
        }
    } else {
        DOM.modalTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Create New Task`;
        DOM.taskIdInput.value = '';
        DOM.taskStartDate.value = state.selectedDate;
        DOM.weeklyDaysContainer.classList.add('hidden');
    }

    DOM.taskModal.showModal();
}

async function handleTaskFormSubmit(e) {
    e.preventDefault();

    const taskId = DOM.taskIdInput.value;
    const title = DOM.taskTitleInput.value.trim();
    const description = DOM.taskDescInput.value.trim();
    const frequency = DOM.taskFrequencySelect.value;
    const startDate = DOM.taskStartDate.value;
    const category = DOM.taskCategoryInput.value;
    const priority = DOM.taskPrioritySelect.value;

    let weeklyDays = [];
    if (frequency === 'weekly') {
        const checkboxes = document.querySelectorAll('input[name="weekly-days"]:checked');
        weeklyDays = Array.from(checkboxes).map(cb => Number(cb.value));
        if (weeklyDays.length === 0) {
            weeklyDays = [parseDateString(startDate).getDay()];
        }
    }

    const payload = {
        title,
        description,
        frequency,
        startDate,
        weeklyDays,
        category,
        priority
    };

    try {
        if (taskId) {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const updated = await res.json();
                const idx = state.tasks.findIndex(t => t.id === taskId);
                if (idx > -1) state.tasks[idx] = updated;
            }
        } else {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const created = await res.json();
                state.tasks.push(created);
            }
        }
    } catch (err) {
        console.warn('API Error, saving locally', err);
        if (taskId) {
            const idx = state.tasks.findIndex(t => t.id === taskId);
            if (idx > -1) state.tasks[idx] = { ...state.tasks[idx], ...payload };
        } else {
            state.tasks.push({ ...payload, id: 'task-' + Date.now(), createdAt: new Date().toISOString() });
        }
    }

    saveToLocalStorage();
    DOM.taskModal.close();
    renderApp();
}

function editTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        openTaskModal(task);
    }
}

async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        Object.keys(state.completionLogs).forEach(dateStr => {
            state.completionLogs[dateStr] = state.completionLogs[dateStr].filter(id => id !== taskId);
        });

        renderApp();
        saveToLocalStorage();

        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
        } catch (e) {
            console.warn('API Error deleting task', e);
        }
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${escapeHTML(message)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
