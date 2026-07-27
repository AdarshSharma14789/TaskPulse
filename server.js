const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'taskpulse_jwt_secret_key_2026_secure';
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
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tasks: [], logs: {} }, null, 2));
    }
}

// Helper: Read DB
function readDB() {
    ensureDBExists();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(raw);
        if (!db.users) db.users = [];
        if (!db.tasks) db.tasks = [];
        if (!db.logs) db.logs = {};
        return db;
    } catch (e) {
        console.error('Error reading DB file:', e);
        return { users: [], tasks: [], logs: {} };
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

// Helper: Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        req.user = null; // Guest user
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            req.user = null;
        } else {
            req.user = decoded; // { id, name, email }
        }
        next();
    });
}

// --- AUTHENTICATION API ENDPOINTS ---

// 1. POST /api/auth/signup - Register new user account
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const db = readDB();

        // Check duplicate email
        const existingUser = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this email address already exists.' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: 'user-' + Date.now(),
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            createdAt: new Date().toISOString()
        };

        db.users.push(newUser);
        writeDB(db);

        // Generate JWT token
        const token = jwt.sign(
            { id: newUser.id, name: newUser.name, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email }
        });
    } catch (e) {
        console.error('Signup error:', e);
        res.status(500).json({ error: 'Server error during user registration.' });
    }
});

// 2. POST /api/auth/login - Authenticate user credentials
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const db = readDB();

        const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Check password match
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Server error during user login.' });
    }
});

// 3. GET /api/auth/me - Verify session token
app.get('/api/auth/me', authenticateToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    res.json({ user: req.user });
});

// --- TASKS & LOGS ENDPOINTS (USER-PARTITIONED) ---

// 4. GET /api/tasks - Retrieve tasks (filtered by user ID)
app.get('/api/tasks', authenticateToken, (req, res) => {
    const db = readDB();
    const userId = req.user ? req.user.id : 'guest';
    const userTasks = db.tasks.filter(t => (t.userId || 'guest') === userId);
    res.json(userTasks);
});

// 5. POST /api/tasks - Create new task
app.post('/api/tasks', authenticateToken, (req, res) => {
    const db = readDB();
    const task = req.body;
    const userId = req.user ? req.user.id : 'guest';

    if (!task || !task.title || !task.frequency || !task.startDate) {
        return res.status(400).json({ error: 'Task title, frequency, and start date are required.' });
    }

    task.id = 'task-' + Date.now();
    task.userId = userId;
    task.createdAt = new Date().toISOString();

    db.tasks.push(task);
    writeDB(db);

    res.status(201).json(task);
});

// 6. PUT /api/tasks/:id - Update existing task
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const { id } = req.params;
    const userId = req.user ? req.user.id : 'guest';
    const updatedData = req.body;

    const index = db.tasks.findIndex(t => t.id === id && (t.userId || 'guest') === userId);
    if (index === -1) {
        return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }

    db.tasks[index] = { ...db.tasks[index], ...updatedData, id, userId };
    writeDB(db);

    res.json(db.tasks[index]);
});

// 7. DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const db = readDB();
    const { id } = req.params;
    const userId = req.user ? req.user.id : 'guest';

    const taskExists = db.tasks.some(t => t.id === id && (t.userId || 'guest') === userId);
    if (!taskExists) {
        return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }

    db.tasks = db.tasks.filter(t => !(t.id === id && (t.userId || 'guest') === userId));

    // Clean up task from user logs
    if (db.logs[userId]) {
        Object.keys(db.logs[userId]).forEach(dateStr => {
            db.logs[userId][dateStr] = db.logs[userId][dateStr].filter(tId => tId !== id);
        });
    }

    writeDB(db);
    res.json({ message: 'Task deleted successfully.', id });
});

// 8. GET /api/logs - Retrieve completion logs for user
app.get('/api/logs', authenticateToken, (req, res) => {
    const db = readDB();
    const userId = req.user ? req.user.id : 'guest';
    res.json(db.logs[userId] || {});
});

// 9. POST /api/logs/toggle - Toggle completion status for a date
app.post('/api/logs/toggle', authenticateToken, (req, res) => {
    const db = readDB();
    const { taskId, dateStr } = req.body;
    const userId = req.user ? req.user.id : 'guest';

    if (!taskId || !dateStr) {
        return res.status(400).json({ error: 'taskId and dateStr are required.' });
    }

    if (!db.logs[userId]) {
        db.logs[userId] = {};
    }
    if (!db.logs[userId][dateStr]) {
        db.logs[userId][dateStr] = [];
    }

    const index = db.logs[userId][dateStr].indexOf(taskId);
    if (index > -1) {
        db.logs[userId][dateStr].splice(index, 1); // Unmark complete
    } else {
        db.logs[userId][dateStr].push(taskId); // Mark complete
    }

    writeDB(db);
    res.json({ dateStr, completedTaskIds: db.logs[userId][dateStr] });
});

// Fallback Route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`⚡ TaskPulse Server with Auth running on port ${PORT}`);
});
