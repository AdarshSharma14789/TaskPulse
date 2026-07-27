// TaskPulse App State & Logic Engine

const STORAGE_KEYS = {
    TASKS: 'taskpulse_tasks_v1',
    LOGS: 'taskpulse_completion_logs_v1'
};

// Application State
let state = {
    selectedDate: getTodayDateString(),
    tasks: [],
    completionLogs: {}, // { "2026-07-27": ["task-1", "task-2"] }
    activeFrequencyFilter: 'all',
    activePriorityFilter: 'all',
    searchQuery: ''
};

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

    // Modal & Form
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
    cancelModalBtn: document.getElementById('cancel-modal-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateDateDisplay();
    loadData();
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

// Load Data from Express REST API (with localStorage fallback)
async function loadData() {
    try {
        const [tasksRes, logsRes] = await Promise.all([
            fetch('/api/tasks'),
            fetch('/api/logs')
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

// Local Storage Persistence (Backup)
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
    // Date Navigation
    DOM.prevDayBtn.addEventListener('click', () => changeSelectedDate(-1));
    DOM.nextDayBtn.addEventListener('click', () => changeSelectedDate(1));
    DOM.todayBtn.addEventListener('click', () => {
        const todayStr = getTodayDateString();
        const wasAlreadyToday = (state.selectedDate === todayStr);
        state.selectedDate = todayStr;
        updateDateDisplay();
        renderApp();

        // Trigger visual pulse animation on Overview Card
        const card = document.querySelector('.overview-card');
        if (card) {
            card.classList.remove('pulse-card');
            void card.offsetWidth; // trigger reflow
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

    // Modal Control
    DOM.addTaskBtn.addEventListener('click', () => openTaskModal());
    DOM.closeModalBtn.addEventListener('click', () => DOM.taskModal.close());
    DOM.cancelModalBtn.addEventListener('click', () => DOM.taskModal.close());

    // Frequency Selector change in Modal (Toggle weekly days container)
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

// Change selected date by N days
function changeSelectedDate(days) {
    const dateObj = parseDateString(state.selectedDate);
    dateObj.setDate(dateObj.getDate() + days);
    state.selectedDate = formatDateToString(dateObj);
    updateDateDisplay();
    renderApp();
}

// Update Date UI Text and Badges
function updateDateDisplay() {
    const dateObj = parseDateString(state.selectedDate);
    const todayStr = getTodayDateString();
    
    // Format: "Monday, July 27, 2026"
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    DOM.currentDateText.textContent = dateObj.toLocaleDateString('en-US', options);
    DOM.datePickerInput.value = state.selectedDate;

    // Badge indicator
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

// Recurrence Engine: Check if a task is scheduled for a target date (YYYY-MM-DD)
function isTaskDueOnDate(task, targetDateStr) {
    // Cannot occur before task start date
    if (targetDateStr < task.startDate) return false;

    const targetObj = parseDateString(targetDateStr);
    const startObj = parseDateString(task.startDate);

    switch (task.frequency) {
        case 'once':
            return targetDateStr === task.startDate;

        case 'daily':
            return true; // Scheduled every day on or after start date

        case 'weekly':
            // If specific weekday checkboxes chosen:
            if (task.weeklyDays && task.weeklyDays.length > 0) {
                const dayOfWeek = targetObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
                return task.weeklyDays.includes(dayOfWeek);
            }
            // Fallback: Same day of week as start date
            return targetObj.getDay() === startObj.getDay();

        case 'monthly':
            // Scheduled on the same date number of each month (e.g., 15th)
            return targetObj.getDate() === startObj.getDate();

        default:
            return false;
    }
}

// Main Render Function
function renderApp() {
    const dateStr = state.selectedDate;
    const completedTaskIds = state.completionLogs[dateStr] || [];

    // 1. Filter tasks scheduled for this date
    const tasksForDate = state.tasks.filter(task => isTaskDueOnDate(task, dateStr));

    // 2. Apply search & filter controls
    const filteredTasks = tasksForDate.filter(task => {
        // Frequency Filter
        if (state.activeFrequencyFilter !== 'all' && task.frequency !== state.activeFrequencyFilter) {
            return false;
        }

        // Priority Filter
        if (state.activePriorityFilter !== 'all' && task.priority !== state.activePriorityFilter) {
            return false;
        }

        // Search Query
        if (state.searchQuery) {
            const titleMatch = task.title.toLowerCase().includes(state.searchQuery);
            const descMatch = task.description && task.description.toLowerCase().includes(state.searchQuery);
            const catMatch = task.category && task.category.toLowerCase().includes(state.searchQuery);
            if (!titleMatch && !descMatch && !catMatch) return false;
        }

        return true;
    });

    // 3. Separate into Pending and Completed tasks
    const pendingTasks = [];
    const completedTasks = [];

    filteredTasks.forEach(task => {
        if (completedTaskIds.includes(task.id)) {
            completedTasks.push(task);
        } else {
            pendingTasks.push(task);
        }
    });

    // 4. Update Stats Overview
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

    // 5. Render Pending List
    renderTaskList(DOM.pendingTasksList, pendingTasks, false);

    // 6. Render Completed List
    renderTaskList(DOM.completedTasksList, completedTasks, true);
}

// Render individual task items into container
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

    // Attach Checkbox & Action Listeners
    tasks.forEach(task => {
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

// Generate Task Card HTML
function createTaskHTML(task, isCompleted) {
    const frequencyBadgeClass = `tag-freq-${task.frequency}`;
    const frequencyText = task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1);

    const priorityBadgeClass = `tag-priority-${task.priority}`;
    const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" id="task-card-${task.id}">
            <div class="task-left">
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

// Toggle Task Completion for current selected date
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
            headers: { 'Content-Type': 'application/json' },
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

// Open Modal for New or Edit Task
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

// Handle Form Submit (Create or Edit Task via API)
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
            // PUT /api/tasks/:id
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const updated = await res.json();
                const idx = state.tasks.findIndex(t => t.id === taskId);
                if (idx > -1) state.tasks[idx] = updated;
            }
        } else {
            // POST /api/tasks
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

// Edit Task
function editTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        openTaskModal(task);
    }
}

// Delete Task (Delete via API)
async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        Object.keys(state.completionLogs).forEach(dateStr => {
            state.completionLogs[dateStr] = state.completionLogs[dateStr].filter(id => id !== taskId);
        });

        renderApp();
        saveToLocalStorage();

        try {
            await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        } catch (e) {
            console.warn('API Error deleting task', e);
        }
    }
}

// Helper: XSS escape
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Toast Notification Helper
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

