const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Helper: Ensure Data Directory & DB File exist
function ensureDBExists() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ tasks: [], logs: {} }, null, 2));
    }
}

// Helper: Read DB
function readDB() {
    ensureDBExists();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error reading DB file:', e);
        return { tasks: [], logs: {} };
    }
}

// Helper: Write DB
function writeDB(data) {
    ensureDBExists();
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing DB file:', e);
    }
}

// --- REST API ENDPOINTS ---

// 1. GET /api/tasks - Retrieve all tasks
app.get('/api/tasks', (req, res) => {
    const db = readDB();
    res.json(db.tasks || []);
});

// 2. POST /api/tasks - Create new task
app.post('/api/tasks', (req, res) => {
    const db = readDB();
    const task = req.body;

    if (!task || !task.title || !task.frequency || !task.startDate) {
        return res.status(400).json({ error: 'Task title, frequency, and start date are required.' });
    }

    if (!task.id) {
        task.id = 'task-' + Date.now();
    }
    if (!task.createdAt) {
        task.createdAt = new Date().toISOString();
    }

    db.tasks.push(task);
    writeDB(db);

    res.status(201).json(task);
});

// 3. PUT /api/tasks/:id - Update existing task
app.put('/api/tasks/:id', (req, res) => {
    const db = readDB();
    const { id } = req.params;
    const updatedData = req.body;

    const index = db.tasks.findIndex(t => t.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Task not found.' });
    }

    db.tasks[index] = { ...db.tasks[index], ...updatedData, id };
    writeDB(db);

    res.json(db.tasks[index]);
});

// 4. DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', (req, res) => {
    const db = readDB();
    const { id } = req.params;

    db.tasks = db.tasks.filter(t => t.id !== id);

    // Remove task from completion logs
    if (db.logs) {
        Object.keys(db.logs).forEach(dateStr => {
            db.logs[dateStr] = db.logs[dateStr].filter(taskId => taskId !== id);
        });
    }

    writeDB(db);
    res.json({ message: 'Task deleted successfully.', id });
});

// 5. GET /api/logs - Retrieve all completion logs
app.get('/api/logs', (req, res) => {
    const db = readDB();
    res.json(db.logs || {});
});

// 6. POST /api/logs/toggle - Toggle task completion status for a date
app.post('/api/logs/toggle', (req, res) => {
    const db = readDB();
    const { taskId, dateStr } = req.body;

    if (!taskId || !dateStr) {
        return res.status(400).json({ error: 'taskId and dateStr are required.' });
    }

    if (!db.logs[dateStr]) {
        db.logs[dateStr] = [];
    }

    const index = db.logs[dateStr].indexOf(taskId);
    if (index > -1) {
        db.logs[dateStr].splice(index, 1); // Unmark complete
    } else {
        db.logs[dateStr].push(taskId); // Mark complete
    }

    writeDB(db);
    res.json({ dateStr, completedTaskIds: db.logs[dateStr] });
});

// Fallback Route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`⚡ TaskPulse Dynamic Express Server running on port ${PORT}`);
});
