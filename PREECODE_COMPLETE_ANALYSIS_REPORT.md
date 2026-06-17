# Preecode — Complete Project Analysis Report

## 🏗️ Project Overview

Preecode is a **coding practice + interview preparation platform** with 3 interconnected components:

1. **Backend** (`preecode-backend/`) — Node.js/Express REST API server
2. **VS Code Extension** (`preecode-extension/`) — TypeScript VS Code extension for in-editor coding practice
3. **Frontend Web Dashboard** (`preecode-frontend/`) — Vanilla JS + HTML/CSS web app

---

## 🧠 AI Models & APIs Used

### Primary AI Provider: OpenRouter API (Single Unified Provider)

**Backend** (`preecode-backend/services/aiService.js`):
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model fallback chain** (tried in order):
  1. `openrouter/auto`
  2. `openrouter/free`
  3. `meta-llama/llama-4-maverick:free`
  4. `mistralai/mistral-small-3.1-24b-instruct:free`
  5. `google/gemini-2.5-flash-exp:free`
  6. `deepseek/deepseek-chat-v3-0324:free`
- **API Key Rotation**: Supports multiple comma-separated keys, rotates on rate limits (429 errors)
- **Timeout**: 45s per request, 3 retries per model with delays of 800ms/2000ms/4000ms
- **Used for**: Question generation, AI chat, coding hints, code review, interview evaluation, resume analysis, project review

**Extension** (`preecode-extension/src/services/`):
- Three files (`aiService.ts`, `openaiService.ts`, `geminiService.ts`) all use the **same OpenRouter endpoint** with model: `nvidia/nemotron-3-ultra-550b-a55b:free`
- These files contain significant duplicate code

### Other Third-Party Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **SendGrid** | Transactional emails (OTP for password reset, notifications) | `@sendgrid/mail` NPM package |
| **Cloudinary** | Image uploads (user profile avatars) | `cloudinary` NPM package + Multer |
| **MongoDB Atlas** | Primary database | Mongoose ODM |
| **Hindsight (Vectorize.io)** | Vector memory storage for user activity logs | `@vectorize-io/hindsight-client` |
| **Multer** | File upload handling (resumes, avatars) | Express middleware |
| **Passport.js** | Google OAuth 2.0 authentication | `passport-google-oauth20` strategy |
| **JWT** | Token-based authentication | `jsonwebtoken` package, 7-day expiry |
| **Bcrypt.js** | Password hashing | User registration/login |
| **Tailwind CSS** | Frontend styling (via CDN) | Utility classes in HTML |
| **Vercel** | Frontend hosting | `preecode.vercel.app` |
| **Render** | Backend hosting | `preecode-backend.onrender.com` |

---

## 📦 Complete Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend Runtime** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose ODM |
| **Authentication** | JWT (7-day) + Passport.js (Google OAuth 2.0) |
| **File Uploads** | Multer (memory storage) |
| **Image Storage** | Cloudinary |
| **Email Service** | SendGrid |
| **Vector Memory** | Hindsight (Vectorize.io) |
| **AI/LLM** | OpenRouter API (multi-model fallback) |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 + Tailwind CDN |
| **Extension** | VS Code Extension (TypeScript) |
| **CI/CD** | GitHub Actions (extension publish workflow) |
| **Package Managers** | npm (backend) / pnpm (extension) |

---

## 🌐 Backend Architecture (`preecode-backend/`)

### Server Entry
- **File**: `server.js`
- Starts Express app, connects to MongoDB, configures CORS, serves static files
- Hosted on Render (production) + localhost:5000 (dev)
- Dynamic CORS origin based on environment via `runtimeConfig.js`

### Configuration (`config/`)
| File | Purpose |
|------|---------|
| `db.js` | MongoDB connection via Mongoose |
| `passport.js` | Google OAuth 2.0 strategy configuration |
| `cloudinary.js` | Cloudinary SDK config for image uploads |
| `runtimeConfig.js` | Environment-aware config (dev vs prod URLs) |
| `email.js` | SendGrid email transporter |

### Models (`models/`) — MongoDB Schemas

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **User** | name, email, password, avatar, googleId, role, isVerified, isEarlyAccess, accessCode, leetcodeProfile | User accounts, auth, profiles |
| **Submission** | userId, problemId, problemName, code, language, status, testCases, aiReview, hints, solution | Coding problem submissions with AI feedback |
| **Practice** | userId, code, language, question, feedback, rating, sessionTime | Practice session tracking |
| **Resume** | userId, resumeText, atsScore, analysis, skills, suggestions | Resume analysis & ATS scoring |
| **Interview** | userId, role, experience, question, answer, feedback, code, language | Mock interview sessions |
| **LearningPattern** | userId, patterns, recommendations, lastAnalyzed | ML-generated learning insights |
| **LearningMemory** | userId, sessionId, type, content, embeddings | Vector memory storage |

### Controllers (`controllers/`)

| Controller | Key Endpoints | Purpose |
|-----------|--------------|---------|
| **userController** | POST `/register`, POST `/login`, PUT `/profile`, POST `/forgot-password`, POST `/reset-password` | Auth, profile, password management |
| **aiController** | POST `/chat`, POST `/generate-question`, POST `/generate-hint`, POST `/code-review`, POST `/explain`, POST `/ask-solution` | All AI interactions |
| **submissionController** | CRUD for submissions | User coding submissions |
| **practiceController** | CRUD for practice sessions | Practice tracking |
| **resumeController** | POST `/analyze`, POST `/upload`, GET `/history` | Resume analysis + ATS scoring |
| **interviewController** | POST `/questions`, POST `/submit-answer`, POST `/evaluate` | Mock interview flow |
| **readinessController** | POST `/check-readiness` | Readiness assessment |
| **memoryController** | POST `/store`, GET `/stream` | Learning memory operations |
| **earlyAccessController** | POST `/join`, GET `/check` | Early access waitlist |

### Routes (`routes/`)
- 12 route files mapping HTTP methods to controllers
- Auth middleware applied to protected routes
- Upload routes handle file uploads via Multer to Cloudinary
- All routes prefixed under respective paths (e.g., `/api/auth`, `/api/ai`, `/api/submissions`)

### Services (`services/`)

| File | Purpose |
|------|---------|
| **aiService.js** | Core AI engine — OpenRouter API calls with model fallback, question generation, code review, chat, hint generation, interview evaluation, resume analysis |
| **hindsightService.js** | Vector memory logging — tracks user actions (practice sessions, submissions, chats, logins) to Hindsight for pattern analysis |

### Middleware (`middleware/`)
| File | Purpose |
|------|---------|
| `authMiddleware.js` | JWT verification, attaches user to request |
| `checkEarlyAccess.js` | Early access code validation |
| `errorMiddleware.js` | Global error handler |
| `validateObjectId.js` | MongoDB ObjectID validation |

---

## 🧩 VS Code Extension (`preecode-extension/`)

### Entry Point
- **`src/extension.ts`**: Activates extension, registers 5 commands, sets up onboarding, timers, sync services

### Commands Registered
| Command ID | Action |
|-----------|--------|
| `preecode.login` | Open login panel |
| `preecode.startCoding` | Start a practice session from editor |
| `preecode.reviewProject` | Review current project |
| `preecode.openMemorySettings` | Open learning memory configuration |
| `preecode.openDashboard` | Open web dashboard in browser |

### Services (`src/services/`)

| File | Purpose |
|------|---------|
| **apiService.ts** | Axios HTTP client — handles all backend API calls with JWT auth headers |
| **authService.ts** | Handles OAuth flow, token storage, token refresh |
| **aiService.ts** | Local AI fallback via OpenRouter (duplicate of openaiService.ts) |
| **openaiService.ts** | Identical to aiService.ts — local OpenRouter calls |
| **geminiService.ts** | Similar to aiService/openaiService but with additional Gemini-specific code |
| **similarityEngine.ts** | Code similarity comparison using Levenshtein distance |
| **learningMemoryService.ts** | Manages user learning memory store/retrieve via backend |
| **backendSyncService.ts** | Periodically syncs local data with backend |
| **timerService.ts** | Measures coding time per session |
| **runService.ts** | Runs code in terminal and captures output |
| **diagnosticsService.ts** | VS Code diagnostic collection/linting |
| **languageConfig.ts** | Language-specific configurations (Python, JavaScript, etc.) |
| **errorTrackingService.ts** | Error logging and reporting |
| **aiActionService.ts** | Orchestrates AI actions (code review, hints, chat) |
| **projectReviewService.ts** | Analyzes project structure and generates reports |
| **onboardingService.ts** | First-time user onboarding flow |

### Timer System (`src/timer/`)

| File | Purpose |
|------|---------|
| **practiceTimerService.ts** | Manages practice session timing |
| **runDetectionService.ts** | Detects when user runs code (start/pause timer) |

### Panels (`src/panels/`)
| File | Purpose |
|------|---------|
| **loginPanel.ts** | VS Code WebView for login |
| **aiActionPanel.ts** | WebView for AI chat/code review |
| **projectReviewPanel.ts** | WebView for project review results |
| **memorySettingsPanel.ts** | WebView for learning memory settings |

### State Management (`src/state/`)
| File | Purpose |
|------|---------|
| **types.ts** | TypeScript interfaces for user, session, practice, memory |
| **store.ts** | Central state store with VS Code globalState persistence |

### Views (`src/views/`)
| File | Purpose |
|------|---------|
| **controlCenterView.ts** | VS Code TreeView showing user stats and quick actions |

### Models (`src/models/`)
| File | Purpose |
|------|---------|
| **memoryModels.ts** | TypeScript interfaces for memory/learning data structures |

### Webview UI (`webview/`)
- **index.html**: Main webview HTML structure
- **script.js**: Webview JavaScript (communication with extension host)
- **style.css**: Webview styles
- **control-center.js/css**: Control center webview
- **login-panel.js/css**: Login panel webview
- **ai-panel.js/css**: AI action panel webview

### Extension Metadata
- **`package.json`**: Uses `pnpm`, named `preecode`, versioned, with VS Code engine `^1.93.0`
- **`.vscodeignore`**: Excludes src/, tsconfig.json, etc. from publish
- **GitHub Actions** (`publish-vscode-extension.yml`): Auto-publishes to VS Code Marketplace on tag push

---

## 🖥️ Frontend Web Dashboard (`preecode-frontend/`)

### Architecture
- **Zero frameworks** — Pure vanilla JavaScript + HTML + CSS
- **Hosted**: Vercel (`preecode.vercel.app`)
- **Mobile detection**: Force mobile layout for small screens (separate detection + enhancement scripts)
- **No bundler/webpack** — all files served as static assets

### Core Files

| File | Purpose |
|------|---------|
| **index.html** | Main landing page |
| **login.html / register.html** | Authentication pages |
| **forgot-password.html** | Password reset |
| **styles.css** | **188KB** — All styles in one file (Tailwind CDN utility classes + custom styles) |
| **api.js** | Axios-based API client with JWT auth, base URL: backend Render instance |
| **app.js** | Main app logic — 600+ lines, handles routing, auth state, UI initialization |

### Page Scripts (`js/` and `pages/`)

| File | Purpose |
|------|---------|
| **dashboard.js** | Main user dashboard — stats, recent activity, quick actions |
| **problems.js** | Coding problems list — browse, filter, select problems |
| **practice-here.js** | In-browser coding editor — write code, get AI feedback |
| **submissions.js** | View submission history and AI review results |
| **resume.js** | Resume analysis — upload, view ATS score, skill suggestions |
| **interview.js** | Mock interview — AI-generated questions, answer submission, evaluation |
| **readiness.js** | Readiness assessment — evaluate coding readiness |
| **settings.js** | User settings — profile edit, password change, preferences |
| **profile.js** | User profile page — display/edit profile info |
| **layout.js** | Layout management — navigation, sidebar, theme toggle |

### Premium/Landing Pages
- **premium-hero.html/css/js**: Premium landing page with animations
- **hero-premium.html**: Alternative hero section
- **about.html, terms.html, privacy.html, legal.html**: Static informational pages

### Mobile Support
- `mobile-detection.js`: Detects mobile devices
- `mobile-enhancements.js`: Mobile-specific UI enhancements
- `mobile-dashboard-fix.css`: Mobile layout fixes
- `force-mobile-styles.js`: Forces mobile layout when appropriate
- `mobile-test.js`: Mobile testing utilities

### Auth Pages
- **auth/callback.html**: OAuth callback handler (receives token from backend)
- **auth/logout.html**: Logout page

---

## 🔄 Key Data Flows

### 1. User Authentication Flow
```
Login Page → Frontend api.js → POST /api/auth/login
→ Backend userController → Verify bcrypt hash → Generate JWT (7-day)
→ Return token + user data → Frontend stores in localStorage
→ All subsequent requests include Authorization: Bearer <token>
```

### 2. Coding Practice Flow
```
Extension: User starts practice → Timer starts
→ Code typed in editor → Run detection service tracks runs
→ Submit → POST /api/submissions → Backend stores in MongoDB
→ POST /api/ai/code-review → OpenRouter analyzes code → Returns feedback
→ Hindsight logs the practice session asynchronously
```

### 3. Resume Analysis Flow
```
Frontend: User uploads resume (PDF/DOCX) → Multer parses file
→ POST /api/resume/upload → Cloudinary stores file
→ POST /api/resume/analyze → OpenRouter extracts text & analyzes
→ Backend returns ATS score, skills, suggestions → Stored in MongoDB
```

### 4. Mock Interview Flow
```
Frontend: User sets role & experience → POST /api/interview/questions
→ Backend AI generates 5 questions → User answers one by one
→ POST /api/interview/submit-answer → AI evaluates each answer
→ POST /api/interview/evaluate → AI generates overall feedback & score
```

### 5. Learning Memory Flow
```
User action (practice, chat, submission) → POST /api/memory/store
→ Backend stores in MongoDB LearningMemory collection
→ Hindsight logs vector representation for pattern analysis
→ GET /api/memory/stream → Retrieves relevant past memories
```

### 6. VS Code Extension Sync Flow
```
Extension startup → BackendSyncService initializes
→ Periodically: GET /api/user/profile (verify token)
→ GET /api/submissions?userId=X (sync submissions)
→ GET /api/practice?userId=X (sync practice data)
→ Local store persists data via VS Code globalState
```

---

## 🔑 Notable Observations

### Architecture Strengths
- Well-structured backend with clear MVC separation (Models → Controllers → Routes)
- Graceful AI model fallback chain handles rate limits and outages
- Extension communicates primarily through backend API rather than direct AI calls
- Hindsight integration enables vector-based memory for personalized learning
- Responsive design with mobile detection and dedicated mobile enhancements

### Architecture Weaknesses / Issues
1. **Duplicate AI code**: `aiService.ts`, `openaiService.ts`, and `geminiService.ts` in the extension are nearly identical — all use the same OpenRouter model. This is dead/redundant code.
2. **Monolithic frontend files**: `app.js` (600+ lines), `api.js`, and `styles.css` (188KB) are very large — could benefit from modularization.
3. **No testing infrastructure**: No test files found anywhere in the project (except a test stub in VS Code extension template).
4. **No TypeScript on backend/frontend**: Backend uses plain JavaScript, frontend uses vanilla JS — no type safety.
5. **Missing `authService.ts` file**: Referenced in extension code but the file doesn't exist on disk.
6. **No WebSocket/realtime**: All communication is request-response polling; no real-time collaboration or live updates.
7. **Debug/run feature is Python-only**: The inline code simulator (`runService.ts`) parses Python syntax specifically.
8. **No rate limiting**: No apparent rate limiting on backend API endpoints.
9. **Environment variable management**: Relies on `.env` file — no validation for missing env vars at startup.
10. **Error handling**: Basic try-catch patterns but inconsistent error responses across controllers.

### Security Notes
- JWT tokens stored in localStorage (vulnerable to XSS)
- Passwords hashed with bcrypt (good)
- CORS configured dynamically based on environment
- Early access system with access codes
- File uploads validated through Multer

### Package Management
- **Backend**: npm with `package-lock.json`
- **Extension**: pnpm with `pnpm-lock.yaml`
- **Frontend**: npm with `package.json` (minimal deps — mostly CDN-loaded)

---

## 📁 Project Structure (Simplified)

```
preecode/
├── preecode-backend/          # Node.js + Express Backend
│   ├── server.js              # Entry point
│   ├── config/                # DB, Passport, Cloudinary, Email
│   ├── models/                # 7 Mongoose schemas
│   ├── controllers/           # 9 controllers
│   ├── routes/                # 12 route files
│   ├── services/              # AI service + Hindsight
│   └── middleware/            # Auth, validation, error handling
│
├── preecode-extension/        # VS Code Extension
│   ├── src/extension.ts       # Entry point
│   ├── src/auth/              # Auth manager
│   ├── src/services/          # 15 service files
│   ├── src/timer/             # Practice timer + run detection
│   ├── src/panels/            # 4 WebView panels
│   ├── src/state/             # State store + types
│   ├── src/views/             # TreeView
│   └── webview/               # WebView HTML/CSS/JS
│
└── preecode-frontend/         # Web Dashboard
    ├── index.html             # Landing page
    ├── login.html / register.html
    ├── styles.css             # 188KB all styles
    ├── api.js                 # API client
    ├── app.js                 # Main app (600+ lines)
    ├── js/                    # Page-specific scripts
    ├── pages/                 # Page HTML files
    ├── layout/                # Layout manager
    └── auth/                  # OAuth callback
```
