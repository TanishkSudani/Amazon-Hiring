# 📦 Amazon Shift Automation & Unified Client System

[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-Cyberpunk%20Glassmorphism-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![HTML5](https://img.shields.io/badge/HTML5-Single%20Page%20App-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-10b981)]()
[![Platform](https://img.shields.io/badge/Platform-Client--Side%20Browser-38bdf8)]()

> **Amazon Shift Booking Automation, Unified Candidate Management, Live Hiring Feed & Schedule Scanner Portal.**  
> A zero-dependency, ultra-fast client-side web application crafted with high-performance Vanilla JavaScript and modern 3D Glassmorphism aesthetics.

---

## 🌟 Key Features

- **📡 Live Amazon Hiring Feed:**
  - Real-time aggregation of shifts from `hiring.amazon.ca` (Canada) and `hiring.amazon.com` (USA).
  - Smart Shift Recovery with direct live warehouse search links (`YYZ4`, `YYC1`, `PHX7`, `DFW6`, `YKF1`, etc.) to eliminate "Job doesn't exist" errors.
  
- **🔔 Job Alerts & Cohort Forecasting:**
  - Warehouse Watch List: Track targeted fulfillment centers per candidate.
  - Advance 14-day alert notifications for expected Amazon seasonal hiring cohorts.
  - Automated background monitoring running every 5 minutes.

- **🤖 1-Click Bot Modal & Automation Assistant:**
  - Instant pre-fill of candidate credentials (Job ID, Schedule ID, Name, Web Password, App Password).
  - 1-Click "Copy All Credentials" and "Copy Auto-Fill Console Script".
  - Country Switcher (Canada / USA) to prevent cross-border website warnings.

- **👥 Hierarchical Role-Based Access Control (RBAC):**
  - **Super Admin:** Full visibility and master control over all candidates, operators, and settings.
  - **Admin:** Manages own candidates and downstream operators.
  - **Operator:** Strict data isolation; only views candidates they personally created.
  - **Candidate:** Secure self-service portal showing only personal application and shift booking status.

- **🔍 Amazon Schedule ID Scanner:**
  - High-speed scanner for requisition patterns (`SCH-CA-XXXXXX`).
  - Configurable scan delay, range, and live progress visualizer.

- **🔐 2FA & IMAP OTP Hub:**
  - Built-in tool for managing Amazon two-factor authentication codes and app passwords.

- **🛡️ Security Guard:**
  - 1-Hour inactivity auto-logout protection.
  - `sessionStorage` authentication guard on all protected views.

---

## 📂 Project Architecture

```text
Amazon Job/
├── index.html                 # Main SPA dashboard shell (App root, toast container, script loader)
├── login.html                 # 3D animated perspective canvas login portal with RBAC
├── README.md                  # Project overview, installation guide & documentation
├── CODEBASE_STRUCTURE.md      # In-depth architectural documentation (Gujarati & English)
├── Last Convertation.md       # Session handover, work tracking & master recovery file
├── css/
│   └── styles.css             # Unified cyberpunk glassmorphism design system (~49 KB)
└── js/
    ├── bundle.js              # Production standalone bundle (~4,400+ lines of core logic)
    ├── app.js                 # Modular router & session activity listener
    ├── state.js               # Central State Store with LocalStorage persistence
    ├── unifiedDashboard.js    # Dashboard tabs & UI rendering engine
    ├── publicScanner.js       # Schedule ID scanning logic
    └── mockWorker.js          # Background simulation worker (IMAP OTP & bookings)
```

---

## 🚀 Quick Start / Local Setup

Because this project is built entirely on native Web technologies (HTML, CSS, JavaScript), no build step or node package installation is strictly required.

### Option 1: Open Directly in Browser
Simply double-click [`login.html`](login.html) or [`index.html`](index.html) in your browser (Google Chrome, Microsoft Edge, Firefox, or Safari).

### Option 2: Run with a Local Static Server
For optimal browser caching and module support:

```bash
# Using Python
python -m http.server 3000

# OR using Node npx serve
npx serve . -p 3000
```
Then visit `http://localhost:3000/login.html` in your browser.

---

## 🔑 Test Login Credentials

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Super Admin** | `admin2003@gmail.com` | `admin2003` | Full system access across all candidates and operators |
| **Operator** | `operator@amazon.com` | `password123` | Operator view; sees only own candidates |
| **Candidate** | `vishantsutaria4@gmail.com` | `password123` | Personal candidate portal & shift status |

---

## 🛠️ Technology Stack

- **Markup:** Semantic HTML5
- **Styling:** Vanilla CSS3 (Custom Variables, 3D CSS Transforms, Glassmorphism, Responsive Grid)
- **Typography:** Google Fonts (`Inter`, `JetBrains Mono`)
- **Logic:** Vanilla JavaScript (ES6+ Modules, IIFE Production Bundle, Web Storage API)
- **State Management:** Reactive Custom State Store with `localStorage` synchronization
- **Version Control:** Git & GitHub

---

## 📄 License
This project is proprietary and intended for Amazon Shift Automation & Candidate Management.
