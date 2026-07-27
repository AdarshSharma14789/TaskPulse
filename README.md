# TaskPulse ⚡

> A modern, feature-rich **To-Do & Recurring Task Manager** built with high-aesthetic glassmorphism UI, date-based completion history, and flexible habit frequency tracking.

![TaskPulse Interface](https://img.shields.io/badge/Status-Complete-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Built%20With-HTML5%20%7C%20CSS3%20%7C%20JS%20(ES6%2B)-6366f1?style=for-the-badge)

---

## ✨ Features

- **✅ Task Checkbox & Strikethrough Feedback**: Check off completed tasks with instant visual feedback, strikethrough styling, and live completion progress updates.
- **📅 Daily & Historical Navigation**: 
  - Switch between **Today**, past dates, or future dates using the interactive date picker or navigation arrows.
  - View separate lists for **Tasks To Do** (Pending) and **Tasks Completed** (Done) on any selected day.
- **🔄 Flexible Frequency Options**:
  - **Daily**: Automatically appears every day.
  - **Weekly**: Repeats on user-selected days of the week (e.g., Mon, Wed, Fri).
  - **Monthly**: Repeats on the same date of each month (e.g., 1st or 15th).
  - **One-Time**: Appears on a single specified target date.
- **📊 Real-Time Progress & Stats**: Overview card showing the day's completion percentage rate (0% - 100%), pending task counts, completed counts, and total scheduled tasks.
- **🔍 Smart Search & Multi-Filters**: Filter by frequency (*Daily*, *Weekly*, *Monthly*, *One-Time*) or priority (*High*, *Medium*, *Low*), and search by title or category.
- **🎨 Glassmorphism & Dark Mode Aesthetic**: Sleek dark UI with vibrant gradients, custom checkboxes, badge tags, and interactive micro-animations.
- **💾 LocalStorage Persistence**: Saves all your tasks and completion history locally in your browser so no data is lost on refresh.

---

## 🚀 Quick Start

No complex build tools required! Simply open the app in any modern browser:

### Option 1: Open Directly
Double-click `index.html` to open it directly in your web browser.

### Option 2: Run with Local HTTP Server
```bash
# Using Python
python -m http.server 8080

# Or using Node serve / npx
npx serve .
```
Then visit `http://localhost:8080` in your web browser.

---

## 🛠️ Project Structure

```
TaskPulse/
├── index.html     # Semantic HTML5 layout, header, stats overview, task lists & dialog modal
├── styles.css     # Design tokens, glassmorphism card styling, custom checkboxes & pulse animations
├── app.js         # Recurrence calculation engine, date-based completion logger, localStorage & DOM handlers
└── README.md      # Project documentation
```

---

## 💡 How Recurrence Works

TaskPulse uses a dynamic date evaluation algorithm:
1. **Daily**: Active for all dates on or after the task's start date.
2. **Weekly**: Evaluates the day of the week (Monday through Sunday) for the active date and matches it against your chosen days.
3. **Monthly**: Matches the day number of the month (e.g. 15th) with the active date.
4. **One-Time**: Active strictly on the task's start date.

---

## 📄 License

Distributed under the MIT License. Feel free to customize and extend!
