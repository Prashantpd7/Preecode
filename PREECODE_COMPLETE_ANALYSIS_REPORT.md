# Preecode — Complete Project Analysis Report

> **Author:** AI Analysis Agent  
> **Date:** June 18, 2026  
> **Version:** 1.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Architecture](#2-project-architecture)
3. [Preecode VS Code Extension (preecode-extension/)](#3-preecode-vs-code-extension)
4. [Preecode Backend API (preecode-backend/)](#4-preecode-backend-api)
5. [Preecode Frontend Web Dashboard (preecode-frontend/)](#5-preecode-frontend-web-dashboard)
6. [Complete Tech Stack](#6-complete-tech-stack)
7. [Third-Party Services & APIs Used](#7-third-party-services--apis-used)
8. [Authentication System](#8-authentication-system)
9. [AI & LLM Integration](#9-ai--llm-integration)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Deployment & Hosting](#11-deployment--hosting)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Security System](#13-security-system)
14. [Notable Observations & Architecture Analysis](#14-notable-observations--architecture-analysis)
15. [File Inventory](#15-file-inventory)

---

## 1. Project Overview

**Preecode** is a comprehensive AI-powered coding practice and interview preparation platform designed to help developers practice, learn, and improve their coding skills without leaving their development environment. It is a three-part system that works together seamlessly:

### Core Mission
> *"From first commit to first offer."*

Preecode enables developers to practice coding questions in VS Code, receive AI-powered feedback, take mock interviews with AI evaluation, analyze resumes for ATS compatibility, and track their progress — all from a single platform.

### Platform Components

| Component | Location | Purpose | Hosted At |
|-----------|----------|---------|-----------|
| **VS Code Extension** | `preecode-extension/` | In-editor coding practice, AI chat, debugging, code review | VS Code Marketplace |
| **Backend API Server** | `preecode-backend/` | REST API, AI orchestration, database, authentication | Render |
| **Web Dashboard (Frontend)** | `preecode-frontend/` | User dashboard, analytics, profile management | Vercel |

### Key Features

1. **AI-Powered Coding Practice** — Generate practice questions, get hints, view solutions, and receive AI code evaluations directly in VS Code
2. **AI Code Review** — Review selected code for correctness, edge cases, time complexity, and quality
3. **AI Chat Assistant** — Context-aware AI chat that understands the user's current file, diagnostics, and practice question
4. **Code Debugging** — Step-through code execution with variable state tracking
5. **Code Fixing** — Automatic error fixing using AI diagnostics
6. **Security Analysis** — Code vulnerability scanning with ArmorIQ integration (security score, issue detection, recommendations)
7. **Mock Interviews** — AI-generated interview questions with answer evaluation across 5 scoring dimensions (technical accuracy, relevance, completeness, communication, confidence)
8. **Resume Analysis** — Upload PDF/DOCX/TXT resumes, AI extracts text, calculates ATS score, structure score, match score, and provides suggestions
9. **Placement Readiness** — Combined score from problem-solving (40%), interview performance (30%), and resume quality (30%)
10. **Learning Memory** — Tracks recurring errors, solutions, and patterns to help users identify weak areas
11. **Progress Dashboard** — Statistics, streak tracking, skill heatmap, leaderboard percentile, recent submissions table
12. **Early Access System** — Pro plan with founding member badges, referral sharing rewards
13. **Password Reset via OTP** — SendGrid emails with 6-digit OTP for password reset
14. **Google OAuth Login** — One-click authentication via Google
15. **Interactive Onboarding Tour** — Step-by-step guide for new users inside the VS Code extension
16. **Practice Timer** — Automatic time tracking when user types code
17. **Backend Sync** — Periodic data synchronization between extension and backend

---

## 2. Project Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS Code Extension                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  extension.ts (entry point)                                 ││
│  │  ├── AuthManager              ─── OAuth + JWT + sessions   ││
│  │  ├── ControlCenterViewProvider ─── WebView UI (sidebar)    ││
│  │  ├── PracticeTimerService     ─── Coding time tracker      ││
│  │  ├── RunDetectionService      ─── Code run detection       ││
│  │  ├── BackendSyncService       ─── Periodic data sync       ││
│  │  ├── OnboardingService        ─── Interactive tour         ││
│  │  ├── apiService.ts            ─── HTTP client to backend   ││
│  │  └── 10+ other services       ─── AI, memory, security...  ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (JWT Auth)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js + Express)                │
│                                                                   │
│  Routes → Controllers → Services → Models (MongoDB)              │
│                                                                   │
│  AI Service (OpenRouter) ─── Multi-model fallback chain          │
│  Hindsight Service ─────── Vector memory storage                  │
│  ArmorClaw Service ─────── Security analysis                      │
│  ArmorIQ Service ──────── Security intelligence + audit           │
│  SendGrid ──────────────── Email (OTP, notifications)             │
│  Cloudinary ────────────── Image uploads (avatars)                │
└──────────────────────────┬────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Frontend Web Dashboard (Vanilla JS + HTML + CSS)      │
│                                                                     │
│  Landing Page → Auth Pages → Dashboard → Profile → Settings       │
│  ├── Resume Analysis (upload + ATS scoring)                        │
│  ├── Mock Interviews (start + answer + evaluate)                   │
│  ├── Coding Problems (browse + practice)                           │
│  ├── Placement Dashboard (readiness score)                         │
│  └── Chatbot (AI assistant)                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Extension ↔ Backend**: All communication is via HTTPS REST API using JWT Bearer token authentication
2. **Frontend ↔ Backend**: Same HTTPS REST API using JWT tokens stored in localStorage
3. **Extension uses OpenRouter directly** only as a fallback; primary AI calls go through backend
4. **Frontend is static** — no bundler, no framework, served directly from Vercel

---

## 3. Preecode VS Code Extension

### 3.1 Entry Point: `src/extension.ts`

The extension entry point (~1,800 lines) handles:

1. **Activation** — Registers all commands, initializes services
2. **State Management** — Central store (`preecodeStore`) for user session, editor state, practice state, chat, and onboarding
3. **Command Registration** — 9 commands registered:
   - `preecode.openControlCenter` — Opens the Preecode sidebar
   - `preecode.login` — Opens login panel
   - `preecode.logout` — Logs out user
   - `preecode.quickPractice` — Prepares for practice (resets timer, hints, etc.)
   - `preecode.debugSelection` — Opens debug panel
   - `preecode.explainSelection` — Explains selected code
   - `preecode.reviewCode` — Reviews code
   - `preecode.securityAnalyze` — Security code analysis
   - `preecode.restartTour` — Restarts the onboarding tour
4. **Practice Actions** — Generate questions, detect questions, show hints, show solutions, evaluate code, save questions, different approaches
5. **Tool Actions** — Debug, fix, explain, review, security analyze
6. **AI Chat** — Context-aware chat with editor state, diagnostics, practice question, and conversation history
7. **Onboarding Integration** — Tour steps tied to store state changes
8. **Extension Version Management** — Clears auth state on version change (handles reinstall/uninstall)

### 3.2 Auth System: `src/auth/authManager.ts`

- Implements `vscode.UriHandler` to receive OAuth callbacks via `vscode://preecode.preecode/auth`
- `handleUri()` — Processes OAuth callback, saves token, fetches user profile, updates store
- `restoreSession()` — On activation, checks for stored token and validates with backend
- `login()` — Opens login panel webview
- `logout()` — Clears token and store
- `clearAuthState()` — Complete state reset (for version changes)
- `fetchCurrentUser()` — Calls `/api/users/me` to validate token
- `syncFromStoredToken()` — Called when VS Code window regains focus
- Token stored in `context.secrets` (VS Code SecretStorage)
- Cached user data stored in `context.workspaceState`

### 3.3 State Management: `src/state/store.ts` + `types.ts`

- Singleton store with EventEmitter pattern
- State shape (`PreecodeState`):
  - `user` — Session info (isAuthenticated, userId, username, email, avatarUrl, token)
  - `syncStatus` — Backend sync status (idle/syncing/success/error)
  - `compactTimer` — Formatted timer string
  - `editor` — Current editor state (fileName, language, selection, diagnostics, etc.)
  - `practice` — Practice session state (topic, difficulty, question, hints, etc.)
  - `onboarding` — Tour state (active, currentStep, completed)
  - `chat` — Chat state (messages, isLoading, dockHeight)
- `subscribe()` returns unsubscribe function
- Supports both partial state and updater function

### 3.4 WebView UI: `webview/` directory

The extension uses VS Code WebView for its UI. There are 5 webview files:

| File | Purpose |
|------|---------|
| **control-center.js/css/html** | Main sidebar control center — the primary interface |
| **ai-panel.js/css** | AI action panel (Monaco Editor integration for code diff) |
| **login-panel.js/css** | Login/signup panel with email + Google OAuth |
| **script.js** | Older script with chat, tools, and practice screens (legacy) |

#### Control Center (`control-center.js`)
- Communication via `vscode.postMessage` / `acquireVsCodeApi()`
- Features:
  - Profile display with avatar (initials or image)
  - Login/Dashboard button
  - Tools flow: Security Analyze, Start Practicing, Debug Code, Fix Code, Explain Selection, Review Code
  - Practice flow: Generate Question, Detect Question
  - Solution flow: Explain Question, Show Hint, Show Solution, Different Approach, Explain Solution, Evaluate Code, Save Question
  - AI Chat dock with resizable height
  - Debug panel with line-by-line step execution
  - Onboarding tour with tooltips and overlays
  - Problem-in-code and expected-fix previews
  - Practice timer display
- Syntax highlighting for debug code view
- Profile menu (logout option)
- Panel narrow width detection

#### Login Panel (`login-panel.js`)
- Tab-based: Sign In / Sign Up
- Forgot password flow (3 steps: enter email → enter OTP → set new password)
- Google OAuth button
- Password visibility toggle
- Form validation (email format, password length)
- Loading spinner and error/success messages
- Message-based communication with extension host

### 3.5 Panels: `src/panels/`

| File | Purpose |
|------|---------|
| **loginPanel.ts** | Creates and renders the login webview panel |
| **aiActionPanel.ts** | WebView panel for AI actions (code review results, explanations) |
| **projectReviewPanel.ts** | WebView panel for project-level code review results |
| **memorySettingsPanel.ts** | WebView for learning memory configuration |

### 3.6 Services: `src/services/`

| File | Lines | Purpose |
|------|-------|---------|
| **apiService.ts** | ~350 | Axios/fetch-based HTTP client; handles all backend API calls with JWT auth, 35s timeout, question generation, chat, practice data, submissions |
| **authService.ts** | ~50 | Token storage/retrieval from VS Code SecretStorage |
| **aiService.ts** | ~200 | **Local AI fallback** — direct OpenRouter calls using NVIDIA Nemotron model (duplicate of openaiService.ts) |
| **openaiService.ts** | ~200 | Identical to aiService.ts — direct OpenRouter calls |
| **geminiService.ts** | ~180 | Same pattern as aiService.ts but with Gemini-specific model name |
| **securityAnalyzeService.ts** | ~200 | Security vulnerability analysis via backend `/api/security/analyze`, with result formatting |
| **backendSyncService.ts** | ~100 | Periodic sync every 2 minutes, syncs practice state to backend |
| **learningMemoryService.ts** | ~250 | Learning memory CRUD, error tracking via backend `/api/memory/*`, similarity checking |
| **similarityEngine.ts** | ~50 | Levenshtein distance-based code similarity comparison |
| **diagnosticsService.ts** | ~60 | VS Code diagnostic collection and linting analysis |
| **languageConfig.ts** | ~40 | Language-specific configurations (Python, JavaScript, Java, C++, etc.) |
| **timerService.ts** | ~50 | General coding time measurement |
| **errorTrackingService.ts** | ~80 | Error classification, hashing, and monitoring |
| **runService.ts** | ~40 | Inline code execution (Python-focused) |
| **aiActionService.ts** | ~100 | Orchestrates AI actions (code review, hints, chat requests to backend) |
| **projectReviewService.ts** | ~80 | Analyzes project structure, bundles files, sends for AI review |

**Note on AI Service Duplication**: `aiService.ts`, `openaiService.ts`, and `geminiService.ts` are nearly identical — all use OpenRouter with the same model (`nvidia/nemotron-3-ultra-550b-a55b:free`). They appear to be remnants of different development phases and contain significant dead/duplicate code.

### 3.7 Timer System: `src/timer/`

| File | Purpose |
|------|---------|
| **practiceTimerService.ts** | Manages practice session timer: start, pause, resume, stop, reset; starts on typing detection; pauses on run; integrates with store |
| **runDetectionService.ts** | Detects terminal code execution via `onDidStartTerminal`/`onDidEndTerminalShellExecution`; reports run results to timer and store |

### 3.8 Views: `src/views/controlCenterView.ts`

- `ControlCenterViewProvider` implements `vscode.WebviewViewProvider`
- Renders the sidebar webview with all UI elements
- Message routing: receives messages from webview and dispatches to handlers
- Handlers: quickAction, timerMenu, panelNarrowHint, logout, askChat, newChat, login, tourStep, sidebarOpened, debugStart, debugNavigate, debugAsk, openDashboard

### 3.9 Onboarding: `src/onboarding/onboardingService.ts`

- 14-step tour flow: initial-popup → click-sidebar-icon → sidebar-open → login → start-practicing → debug-code → fix-code → explain-selection → review-code → ai-chat → dashboard → profile → completed
- State persisted in VS Code globalState
- Tour can be restarted via `preecode.restartTour` command
- Shows initial welcome popup on first activation

### 3.10 Extension Packaging

| File | Purpose |
|------|---------|
| `package.json` | vsce packaging, pnpm, version 0.1.8 |
| `tsconfig.json` | TypeScript config: Node16 module, ES2022 target |
| `.vscodeignore` | Excludes src/, tsconfig.json from published extension |
| `.vscode-test.mjs` | VS Code test configuration |

---

## 4. Preecode Backend API

### 4.1 Server Entry: `server.js`

- **Framework**: Node.js + Express.js
- **Port**: Configurable via `PORT` env, falls back through ports if in use (non-production)
- **Features**:
  - `.env` + `.env.local` loading (local overrides)
  - Helmet security headers
  - Rate limiting: 500 requests per 15 minutes (auth routes exempted)
  - CORS: Allows configured frontend URLs + any `*.vercel.app` subdomain
  - Request logging with timestamp, method, URL, IP, origin
  - JSON body parser with 10MB limit
  - Cookie parser
  - Passport.js initialization
  - Global error handler
  - Graceful shutdown on unhandled rejections

### 4.2 Configuration: `config/`

| File | Purpose | Key Details |
|------|---------|-------------|
| **db.js** | MongoDB connection via Mongoose | Production: 30s timeout, Dev: 5s timeout; Starts server even without DB in dev; Detailed error classification (AUTH/DNS/NETWORK/UNKNOWN) with actionable advice |
| **passport.js** | Google OAuth 2.0 | Only configures if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present; Auto-generates unique usernames; Updates avatar on re-login |
| **cloudinary.js** | Image upload config | Validates CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET at startup |
| **runtimeConfig.js** | Environment-aware config | Reads FRONTEND_URL, BACKEND_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, GOOGLE_CALLBACK_URL; Normalizes URLs |
| **email.js** | SendGrid email | `sendOtpEmail()` sends styled HTML OTP emails for password reset |

### 4.3 Models: `models/`

All 8 MongoDB schemas:

#### User (`User.js`)
- Fields: username, email, password, firstName, lastName, avatar, plan (free/pro), subscriptionStatus, earlyAccessEndDate, earlyAccessMonthsGranted, hasShared, foundingBadgeLevel (basic/elite), certificateId (UUID), tokenVersion
- Pre-save hook: Hashes password (if modified), sets 3-month early access and UUID certificate on new users
- Method: `comparePassword()` using bcrypt

#### Submission (`Submission.js`)
- Fields: userId, problemName, difficulty (easy/medium/hard), status (accepted/wrong/runtime_error/compilation_error/time_limit_exceeded), topic, timeTaken, submittedAt
- Used for all coding problem submissions

#### Practice (`Practice.js`)
- Fields: userId, question, timeTaken, topic, difficulty, hintsUsed, hintUsagePercent, aiRating (0-10), solutionViewed, language, date
- Tracks each practice session

#### Resume (`Resume.js`)
- Fields: userId, fileName, fileType (pdf/docx/txt), fileSize, fileData (Buffer), textContent, targetRole, atsScore, structureScore, skills, analysis (matchScore, missingSkills, missingKeywords, strengths, weaknesses, suggestions, rawAnalysis)
- Indexed on userId + uploadedAt

#### Interview (`Interview.js`)
- Fields: userId, role, difficulty, status (in_progress/completed), resumeId, overallScore, currentQuestion, totalQuestions, questions array (questionText, expectedKeywords, audioBase64, transcription, aiFeedback, answerScore, speechMetrics, expectedAnswer, keyPoints, detectedConcepts, missingConcepts, improvedAnswer, technicalAccuracy, communication, confidence)
- Indexed on userId + createdAt

#### LearningPattern (`LearningPattern.js`)
- Fields: userId, patternType (recurring_error/common_mistake/skill_gap/learning_opportunity), description, category, affectedAreas, frequency, confidenceScore, recommendations, resources
- Indexed on userId + patternType

#### LearningMemory (`LearningMemory.js`)
- Fields: userId, memoryType (error/success/pattern), errorId, errorMessage, stackTrace, errorCategory (syntax/runtime/logic/type/async/performance/other), projectInfo, fileName, solutions array, occurrences, severity, tags, expiresAt (180 day TTL)
- 4 compound indexes

#### SecurityAudit (`SecurityAudit.js`)
- Fields: userId, action (security_scan/policy_check/audit_log/code_review_security/vulnerability_scan/dependency_scan), resource, status, fileName, language, securityScore, issueCount, severity, details (Mixed), ip, userAgent
- Used by ArmorIQ integration

### 4.4 Routes: `routes/`

| Route File | Base Path | Endpoints | Auth Required |
|-----------|-----------|-----------|---------------|
| **authRoutes.js** | `/api/auth` | GET /google, GET /google/callback, GET /redirect-complete, GET /dev-login, GET /debug | No |
| **userRoutes.js** | `/api/users` | POST /login, POST /, POST /forgot-password, POST /verify-otp, POST /reset-password, GET /me, GET /stats/:id, GET /:id, PUT /:id, POST /logout, POST /change-password, DELETE /:id, POST /logout-all-devices, PUT /notification-prefs | Mixed |
| **submissionRoutes.js** | `/api/submissions` | POST /, GET /:id | Yes |
| **practiceRoutes.js** | `/api/practice` | POST /, GET / | Yes |
| **aiRoutes.js** | `/api/ai` | POST /generate-question, POST /chat, POST /hint, POST /review, POST /project-review | Yes |
| **resumeRoutes.js** | `/api/v2/resume` | POST /upload, GET /list/:userId, GET /analysis/:resumeId | Yes |
| **interviewRoutes.js** | `/api/v2/interview` | POaST /start, POST /answer, GET /history/:userId, GET /results/:interviewId | Yes |
| **readinessRoutes.js** | `/api/v2/readiness` | GET /:userId | Yes |
| **memoryRoutes.js** | `/api/memory` | POST /track-error, POST /track-solution, GET /similar-errors, GET /history, GET /patterns, POST /export, POST /delete, POST /settings | Yes |
| **securityRoutes.js** | `/api/security` | POST /analyze, GET /audit-logs | Mixed (dev skips auth for analyze) |
| **armoriqMcpRoutes.js** | `/api/armoriq` | POST /mcp, GET /mcp, POST /audit, POST /policy, POST /event | No |
| **uploadRoutes.js** | `/api/upload` | POST /avatar | Yes |
| **earlyAccessRoutes.js** | `/api/early-access` | POST /confirm-share, GET /status | Yes |
| **health** | `/api/health` | GET (status + environment) | No |

### 4.5 Auth Routes Details: `authRoutes.js`

- **Google OAuth Flow**:
  1. `GET /api/auth/google` — Initiates Google OAuth, stores `redirect` param (optional VS Code deep link)
  2. User authenticates with Google
  3. `GET /api/auth/google/callback` — Passport callback, generates JWT (7-day expiry), retrieves stored redirect
  4. If `vscode://` redirect: renders success page with meta refresh to deep link
  5. If web redirect: redirects to frontend callback page
  6. In-memory store for OAuth redirects (15-minute TTL)
- **Dev Login**: `GET /api/auth/dev-login` — Quick JWT for first user in DB (development only)
- **Debug**: `GET /api/auth/debug` — Test VS Code deep links

### 4.6 Controllers: `controllers/`

| Controller | Routes | Key Functionality |
|-----------|--------|-------------------|
| **userController** | 12 handlers | Login, register, profile CRUD, stats, forgot/reset password, change password, delete account, logout all devices, notification prefs |
| **aiController** | 5 handlers | Chat, generate question, hint, code review, project review — all with Hindsight memory tracking |
| **submissionController** | 2 handlers | Create submission (with status parsing: accepted/wrong/runtime_error/compilation_error/time_limit_exceeded), list user submissions |
| **practiceController** | 2 handlers | Create practice session (with validation), list practices (last 50) |
| **resumeController** | 3 handlers | Upload (PDF/DOCX/TXT extraction + AI analysis), list resumes, get analysis |
| **interviewController** | 4 handlers | Start interview (AI-generated questions), submit answer (AI evaluation with 5 scores), get history, get results |
| **readinessController** | 1 handler | Combined readiness score: problem-solving (40%), interview (30%), resume (30%) |
| **memoryController** | 8 handlers | Track error, track solution, find similar errors, get history, analyze patterns, export, delete, update settings |
| **securityController** | 2 handlers | Analyze code (full ArmorIQ 6-step workflow), get audit logs |
| **earlyAccessController** | 2 handlers | Confirm share (extends early access by 1 month, sets elite badge), get status |

### 4.7 User Controller Details

- **Login**: Validates credentials, compares password with bcrypt, generates JWT with tokenVersion
- **Register**: Validates uniqueness, creates user with auto-generated avatar from unavatar.io
- **GET /me**: Dual verification — first tries `jwt.verify()`, falls back to `jwt.decode()` (allows extension with production JWT to talk to local backend with different JWT_SECRET)
- **Stats**: Calculates from Submission collection (totalSolved = accepted count, easy/medium/hard breakdown, weekly count, recent 10 submissions)
- **Forgot/Reset Password**: 3-step flow: request OTP → verify OTP → reset password with token; invalidates all sessions via tokenVersion bump
- **Logout**: Increments tokenVersion (invalidates all existing JWTs)

### 4.8 AI Controller Details

- **generatePracticeQuestion**: Calls `generateQuestion()` in aiService with language, difficulty, topic → returns question, title, hint, solution, company
- **chatWithAI**: Calls `chat()` with message, context, history → returns response
- **getAIHint**: Calls `getHint()` with problemDescription, language → returns hint
- **reviewUserCode**: Calls `reviewCode()` with code, language, problemDescription → returns review
- **reviewProjectCode**: Calls `reviewProject()` with files array, projectInfo, analysisLevel → returns project review
- All controllers fire-and-forget Hindsight memory saves

### 4.9 Resume Controller Details

- **File Upload**: Accepts PDF, DOCX, TXT up to 5MB via Multer
- **Text Extraction**: Multi-strategy extraction:
  - PDF: tries pdf-parse library → falls back to regex-based PDF text extraction → latin1 string extraction
  - DOCX: tries mammoth → falls back to Python zipfile script
  - TXT: direct UTF-8 decode
  - Generic fallback: removes non-printable chars, extracts word-like sequences
- **AI Analysis**: Comprehensive prompt requesting ATS score (0-100), structure score, match score, skills, missing keywords, strengths, weaknesses, suggestions
- Role-specific keyword maps for: Frontend Developer, Backend Developer, Full Stack Developer, SDE, AI/ML Engineer
- **Strict extraction rules**: AI must only list skills that appear EXACTLY in the resume text
- Stores full analysis in MongoDB including file buffer for future retrieval

### 4.10 Interview Controller Details

- **Start Interview**: Creates session with AI-generated first question based on role, difficulty, and optional resume context
- **Submit Answer**: Evaluates candidate's transcribed answer across 5 dimensions:
  - technicalAccuracy (0-100)
  - relevance (0-100)
  - completeness (0-100)
  - communication (0-100)
  - confidence (0-100)
- Generates: feedback, expected answer, key points, detected/missing concepts, improved answer
- Generates next question or completes session (5 questions default)
- **Results**: Returns full interview data with all evaluation fields

### 4.11 Middleware

| File | Purpose |
|------|---------|
| **authMiddleware.js** | JWT verification, tokenVersion check, attaches user to req |
| **errorMiddleware.js** | Centralized handler for JWT errors, Mongoose validation/duplicate/CastError, generic errors |
| **checkEarlyAccess.js** | Auto-downgrades pro plan to free if early access expired |
| **validateObjectId.js** | Validates MongoDB ObjectId format in params |

### 4.12 Services

#### aiService.js — Core AI Engine (~420 lines)

- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model Fallback Chain** (tried in order with retries):
  1. `openrouter/auto`
  2. `openrouter/free`
  3. `meta-llama/llama-4-maverick:free`
  4. `mistralai/mistral-small-3.1-24b-instruct:free`
  5. `google/gemini-2.5-flash-exp:free`
  6. `deepseek/deepseek-chat-v3-0324:free`
- **Retry Logic**: 3 retries per model with delays 800ms/2000ms/4000ms
- **Timeout**: 45 seconds per request
- **Rate Limiting**: 200ms minimum spacing between requests
- **Key Rotation**: Supports comma-separated multiple API keys, rotates on 429 rate limits
- **Error Handling**: Structured errors with model, attempt, provider status, retryability
- **Exported Functions**:
  - `call_openrouter(messages, options)` — Raw OpenRouter call with full fallback chain
  - `generateResponse(messages, options)` — Wrapped call with error normalization
  - `chat(message, context, history)` — Chat with system prompt, context, and conversation history
  - `getHint(problemDescription, language)` — Hint generation for coding problems
  - `reviewCode(code, language, problemDescription)` — Code review with structured format
  - `generateQuestion(language, difficulty, topic)` — Question generation with language-specific instructions
  - `verifyCodeOutput(question, code, output, language)` — Output verification
  - `reviewProject(files, projectInfo, analysisLevel)` — Project-level code review

#### hindsightService.js — Vector Memory (~120 lines)

- Uses `@vectorize-io/hindsight-client` SDK
- **Functions**: `saveMemory()`, `getUserMemories()`, `searchUserMemories()`, `isHindsightConfigured()`
- Stores memory in a configurable memory bank (`HINDSIGHT_MEMORY_BANK`)
- All calls are fire-and-forget (non-blocking)
- Gracefully handles missing API key
- Metadata values converted to strings (Hindsight API requirement)

#### armorclawService.js — Security Analysis (~350 lines)

- Uses OpenRouter AI to analyze code for security vulnerabilities
- **10 categories**: Hardcoded Secrets, Injection Flaws (SQL/NoSQL/Command/Code), XSS (Reflected/Stored/DOM), Insecure Crypto, Path Traversal, Insecure Deserialization, Auth/Authorization Issues, Information Exposure, Input Validation, Dependency Risks
- Scoring: 0-100, severity: critical/high/medium/low
- JSON extraction with 4 fallback strategies (direct parse, code block extraction, brace matching, syntax fixing)
- Designed with `ARMORCLAW_INTEGRATION` markers for future SDK integration
- Audits all scans via armoriqService

#### armoriqService.js — ArmorIQ SDK Integration (~500 lines)

- Uses real `@armoriq/sdk` package
- **Client Configuration**: ARMORIQ_API_KEY, USER_ID, AGENT_ID, CONTEXT_ID, backendEndpoint (with timeout, maxRetries)
- **Functions**:
  - `logSecurityScan()` — Full 3-step ArmorIQ flow: capturePlan → getIntentToken → invoke; fallback to local audit
  - `evaluatePolicy()` — Policy evaluation with intent token; recognizes 7 policies (no-hardcoded-secrets, no-sql-injection, no-xss, input-validation, secure-crypto, safe-deserialization, auth-best-practices)
  - `createAuditEntry()` — Audit logging with SDK
  - `reportSecurityEvent()` — Security event reporting
  - `verifyIntentToken()` — Token verification
  - `getAuditEntries()` — Query audit entries
- **Exception Handling**: InvalidTokenException, IntentMismatchException, MCPInvocationException, TokenExpiredException

### 4.13 ArmorIQ MCP Server: `armoriqMcpRoutes.js`

- Implements **Model Context Protocol (MCP)** Streamable HTTP transport
- **Endpoint**: `POST /api/armoriq/mcp`
- **MCP Methods**:
  - `initialize` — Returns server capabilities + protocol version (2025-11-25)
  - `tools/list` — Returns 4 tools: log_security_scan, create_audit_entry, evaluate_policy, report_security_event
  - `tools/call` — Executes tool by name with arguments
- **Legacy REST endpoints** for backward compatibility: POST /api/armoriq/audit, /policy, /event
- Designed to be registered as 3 MCP servers (preecode-audit-mcp, preecode-policy-mcp, preecode-event-mcp) all pointing to same endpoint
- Stores security events to SecurityAudit collection when called

---

## 5. Preecode Frontend Web Dashboard

### 5.1 Architecture

- **Framework**: Zero frameworks — pure vanilla JavaScript + HTML5 + CSS3
- **Styling**: Tailwind CSS (via CDN) + custom CSS (`styles.css` ~188KB)
- **Hosting**: Vercel (`preecode.vercel.app`)
- **Bundling**: None — all files served as static assets
- **Mobile**: Dedicated mobile detection, enhancements, and dashboard fixes

### 5.2 Core Files

| File | Size/Complexity | Purpose |
|------|----------------|---------|
| **index.html** | Landing page | Modern hero section with feature cards, language showcase, testimonials, FAQ, footer |
| **styles.css** | ~188KB | All styles (Tailwind + custom components) |
| **api.js** | ~350 lines | API client with all backend endpoints (login, register, stats, submissions, AI, resume, interview, early access, profile, password reset, etc.) |
| **app.js** | ~200 lines | Auth handler (login + register form logic, token storage, redirect) |

### 5.3 Page Structure

| Page | File | Purpose |
|------|------|---------|
| Landing | `index.html` | Marketing page with hero, features, testimonials, FAQ |
| Login | `login.html` | Email/password login with Google OAuth |
| Register | `register.html` | Email/password registration with Google OAuth |
| Forgot Password | `forgot-password.html` | Password reset flow |
| Dashboard | `pages/dashboard.html` + `pages/dashboard.js` | Stats cards, practice environment, streak tracker, submissions table |
| Profile | `pages/profile.html` + `pages/profile.js` | User profile, rank system, badges, submissions history |
| Settings | `pages/settings.html` + `pages/settings.js` | Account, appearance, security, notifications, danger zone |
| Problems | `pages/problems.html` + `pages/problems.js` | Coding problem list browser |
| Practice | `pages/practice-here.html` + `pages/practice-here.js` | In-browser coding environment |
| Submissions | `pages/submissions.html` + `pages/submissions.js` | Submission history viewer |
| Resume Upload | `pages/resume-upload.html` | Resume file upload interface |
| Resume Analysis | `pages/resume-analysis.html` + `js/resume.js` | ATS score, skills, suggestions display |
| Interview Setup | `pages/interview-setup.html` | Configure interview (role, difficulty) |
| Interview Session | `pages/interview-session.html` + `js/interview.js` | AI-powered mock interview |
| Interview Results | `pages/interview-results.html` | Interview evaluation results |
| Certificate | `pages/certificate.html` + `pages/certificate.js` | Early access founding member certificate |
| Placement Dashboard | `pages/placement-dashboard.html` | Readiness score, improvement plan |
| About, Terms, Privacy, Legal | `about.html`, `terms.html`, `privacy.html`, `legal.html` | Static informational pages |

### 5.4 Dashboard (V4)

- **Stats Cards**: Total solved (animated counter), accuracy rate, avg solve time, placement readiness
- **Practice Environment**: Total time, last session, session count, "Start Practice" deep link to VS Code
- **Streak Tracker**: Current streak (circular progress ring), best streak, milestones (7, 30, 100 days)
- **Skill Heatmap**: Horizontal mastery bars for 6 topics (Arrays, Strings, DP, Trees, Graphs, Recursion); locked until 5 problems solved
- **Leaderboard/Rank**: Ghost preview when < 3 problems solved; percentile + weekly position + problems count when unlocked
- **Submissions Table**: Sortable (by problem, difficulty, status, time, date) with empty state
- All sections animated with staggered CSS animations

### 5.5 Profile Page

- Avatar (initials + first name)
- Display name + "Member since" date
- Primary metrics: total solved, accuracy, streak
- Difficulty breakdown (easy/medium/hard bars)
- Badge system: First Solve, 7-Day Streak, 50 Problems, Hard Master
- Rank system: 6 levels (Beginner → Apprentice → Intermediate → Advanced → Expert → Master) with XP bar
- Tabbed interface: Overview, Submissions
- Edit profile modal (username, avatar URL)

### 5.6 API Client (`api.js`)

- Dynamic API base URL resolution:
  - Checks for `window.PREECODE_CONFIG.BACKEND_URL` (runtime override)
  - Localhost/127.0.0.1 → `http://localhost:5001/api`
  - Production → `https://preecode-backend.onrender.com/api`
- 20 API methods covering all backend endpoints
- `_authHeaders()` helper adds `Authorization: Bearer <token>` from localStorage
- Error handling: reads `.message` from JSON response, wraps network errors

### 5.7 Auth Pages

- **login.html**: Animated background orbs, sleek dark/light card design, Google OAuth + GitHub button (GitHub shows "coming soon" message), forgot password link, server wake-up overlay
- **register.html**: Same design as login, email validation, password 6-char minimum
- **forgot-password.html**: 3-step form (email → OTP → new password)
- **auth/callback.html**: OAuth callback page that stores token and redirects to dashboard
- **auth/logout.html**: Logout page

### 5.8 Layout System: `layout/`

| File | Purpose |
|------|---------|
| **layout.js** | Navigation, sidebar, theme toggle |
| **chatbot.js** | AI chatbot widget embedded in dashboard |
| **early-access.js** | Early access status banner and sharing prompt |

### 5.9 Mobile Support

- `mobile-detection.js` — Detects mobile/tablet devices
- `mobile-enhancements.js` — Touch-friendly UI adjustments
- `mobile-dashboard-fix.css` — Mobile layout fixes
- `force-mobile-styles.js` — Forces mobile layout when appropriate
- `mobile-test.js` — Mobile testing utilities
- `pages/mobile-app-enhancements.js` — Page-specific mobile enhancements

### 5.10 Theme System

- `theme.js` — Handles dark/light mode with CSS custom properties
- Tailwind dark mode configuration in `tailwind-config.js`
- Preferences stored in localStorage, respects system preference via `prefers-color-scheme`

---

## 6. Complete Tech Stack

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | Latest |
| **Framework** | Express.js | ^4.18.2 |
| **Database** | MongoDB + Mongoose ODM | ^8.0.3 |
| **Authentication** | JWT + Passport.js (Google OAuth 2.0) | ^9.0.3, ^0.7.0 |
| **File Uploads** | Multer (memory storage) | ^2.1.1 |
| **PDF Parsing** | pdf-parse | ^2.4.5 |
| **DOCX Parsing** | mammoth | ^1.12.0 |
| **Image Storage** | Cloudinary | ^2.9.0 |
| **Email Service** | SendGrid | ^8.1.6 |
| **Vector Memory** | Hindsight (Vectorize.io) | ^0.7.2 |
| **Security SDK** | ArmorIQ SDK | ^0.3.8 |
| **Security** | Helmet + express-rate-limit | ^8.1.0, ^8.2.1 |
| **Password Hashing** | bcryptjs | ^3.0.3 |
| **Cookies** | cookie-parser | ^1.4.7 |
| **CORS** | cors | ^2.8.5 |
| **Environment** | dotenv | ^16.4.5 |
| **Dev** | nodemon | ^3.1.11 |

### Frontend
| Layer | Technology |
|-------|-----------|
| **Core** | Vanilla JavaScript, HTML5, CSS3 |
| **CSS Framework** | Tailwind CSS (CDN) |
| **Fonts** | Google Fonts (Inter) |
| **Icons** | Heroicons (via inline SVG) |
| **Hosting** | Vercel |
| **Dev Server** | serve | ^14.2.5 |

### VS Code Extension
| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript | ^5.9.3 |
| **Runtime** | VS Code API | ^1.109.0 |
| **Package Manager** | pnpm |
| **Linting** | ESLint | ^9.39.2 |
| **Testing** | @vscode/test-electron | ^2.5.2 |
| **Dependencies** | dotenv, monaco-editor, node-fetch |

---

## 7. Third-Party Services & APIs Used

### Primary AI Provider: OpenRouter API
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Purpose**: All AI features (question generation, chat, hints, code review, interview evaluation, resume analysis, security analysis)
- **Fallback Chain**: 6 models with 3 retries each, 45s timeout
- **Key Rotation**: Multiple comma-separated API keys supported
- **Extension Direct Usage**: `nvidia/nemotron-3-ultra-550b-a55b:free` model (fallback)

### SendGrid (Twilio)
- **Purpose**: Transactional emails (OTP for password reset)
- **Package**: `@sendgrid/mail`
- **Configuration**: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
- **Features**: Styled HTML email templates, OTP delivery

### Cloudinary
- **Purpose**: Image upload and transformation for user avatars
- **Package**: `cloudinary` v2
- **Configuration**: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- **Features**: Face-aware cropping, auto quality/format, 200x200 avatar transformation

### MongoDB Atlas
- **Purpose**: Primary database for all data persistence
- **ODM**: Mongoose
- **Collections**: Users, Submissions, Practices, Resumes, Interviews, LearningPatterns, LearningMemories, SecurityAudits
- **Connection**: SRV connection string

### Hindsight (Vectorize.io)
- **Purpose**: Vector memory storage for user activity logs
- **Package**: `@vectorize-io/hindsight-client`
- **Configuration**: HINDSIGHT_API_KEY, HINDSIGHT_BASE_URL, HINDSIGHT_MEMORY_BANK
- **Data Stored**: Practice sessions, submissions, AI chats, hints, code reviews, question generation

### ArmorIQ SDK
- **Purpose**: Security intelligence, audit logging, policy evaluation
- **Package**: `@armoriq/sdk`
- **Features**: capturePlan, getIntentToken, invoke, verifyToken
- **Exception Types**: InvalidTokenException, IntentMismatchException, MCPInvocationException, TokenExpiredException

### Google OAuth 2.0
- **Purpose**: User authentication via Google accounts
- **Package**: `passport-google-oauth20`
- **Scopes**: profile, email
- **Callback URL**: Configurable per environment

### Unavatar.io
- **Purpose**: Auto-generate avatar URLs from email addresses
- **Usage**: Default avatar when user has no custom avatar set

### Google Fonts
- **Purpose**: Inter font family across the entire frontend

---

## 8. Authentication System

### Flow Overview

```
User → Login Page/Extension Login → Email+Password or Google OAuth
        ↓
  Backend validates credentials (bcrypt compare or Google profile)
        ↓
  JWT generated with { id, tokenVersion } + 7-day expiry
        ↓
  Token returned → stored in:
    - Frontend: localStorage
    - Extension: VS Code SecretStorage + workspaceState cache
        ↓
  All subsequent API calls: Authorization: Bearer <token>
        ↓
  authMiddleware.js verifies JWT + tokenVersion match
```

### Key Details

1. **Password Hashing**: bcryptjs with 10 salt rounds
2. **JWT Payload**: `{ id, tokenVersion }` — allows session invalidation via tokenVersion bump
3. **Token Expiry**: 7 days
4. **Token Versioning**: Incremented on password change, logout all devices, password reset
5. **Extension Auth Flow**: VS Code deep link → OAuth → JWT returned → stored in SecretStorage
6. **Dual Verification (GET /me)**: First tries `jwt.verify()`, falls back to `jwt.decode()` without signature — allows extension with production JWT to talk to local backend
7. **Google OAuth**: In-memory redirect store (15-min TTL), cookie-based state tracking, renders VS Code deep link success page
8. **Password Reset**: 3-step OTP flow via SendGrid email

---

## 9. AI & LLM Integration

### Architecture

```
Extension (TypeScript)                  Backend (Node.js)
┌────────────────────┐               ┌──────────────────────┐
│                    │               │                      │
│  API Calls via     │──── HTTPS ───>│  aiService.js        │
│  apiService.ts     │               │  ├── chat()          │
│                    │               │  ├── getHint()       │
│  Local Fallback:   │               │  ├── reviewCode()    │
│  aiService.ts      │               │  ├── generateQuestion│
│  openaiService.ts  │  OpenRouter   │  ├── reviewProject() │
│  geminiService.ts  │─── HTTPS ────>│  └── verifyCodeOutput│
│                    │               │                      │
│  (3 duplicate      │               │  OpenRouter API      │
│   files - dead     │               │  ────────────────    │
│   code)            │               │  6 models in         │
└────────────────────┘               │  fallback chain      │
                                      │  3 retries per model │
                                      │  45s timeout         │
                                      └──────────────────────┘
```

### AI Features by Endpoint

| Endpoint | AI Function | System Prompt | Temperature | Max Tokens |
|----------|------------|---------------|-------------|------------|
| `/api/ai/chat` | Chat | "You are Preecode AI, a helpful coding assistant..." | 0.5 | 512 |
| `/api/ai/generate-question` | Question Gen | Language-specific instructions with JSON format | 0.75 | 600 |
| `/api/ai/hint` | Hint | "Provide a helpful hint that guides without giving away..." | 0.6 | 512 |
| `/api/ai/review` | Code Review | "Analyze this code and provide a concise review..." | 0.4 | 512 |
| `/api/ai/project-review` | Project Review | "Comprehensive code reviewer. Analyze this project..." | 0.3 | 2000 |
| `POST /v2/resume/upload` | Resume Analysis | "Expert resume reviewer and ATS analyst..." | 0.2 | 2000 |
| `POST /v2/interview/answer` | Interview Eval | "Strict technical interview evaluator..." | 0.2 | 1500 |

---

## 10. Data Flow Diagrams

### 10.1 Coding Practice Flow (Extension → Backend)

```
User clicks "Generate Question"
        ↓
  extension.ts: runQuickAction('generate')
        ↓
  apiService.ts: generateQuestionFromBackend({ language, difficulty })
        ↓  HTTPS POST /api/ai/generate-question (JWT Bearer)
  aiController.generatePracticeQuestion()
        ↓
  aiService.generateQuestion(language, difficulty, topic)
        ↓  OpenRouter API (multi-model fallback chain)
  AI returns { question, title, hint, solution, company }
        ↓
  Returned to extension, inserted as comments in editor
        ↓
  User writes code, runs it

User clicks "Save Question"
        ↓
  apiService.ts: 
    1. sendPracticeData() → POST /api/practice
    2. sendSubmission() → POST /api/submissions
        ↓
  Both saved to MongoDB
  Hindsight memory saved asynchronously
```

### 10.2 Resume Analysis Flow (Frontend → Backend)

```
User uploads PDF/DOCX/TXT file
        ↓
  resumeRoutes: Multer parses file (memory storage, 5MB limit)
        ↓
  resumeController.uploadResume()
        ↓
  extractTextFromBuffer(buffer, fileType)
    1. PDF → pdf-parse → regex extraction → latin1 fallback
    2. DOCX → mammoth → Python zipfile fallback
    3. TXT → direct UTF-8 decode
        ↓
  AI Analysis (aiService.generateResponse)
    - ATS Score (0-100): contact, education, experience, projects, skills, keywords, achievements
    - Structure Score (0-100): headers, consistency, flow, readability
    - Match Score (0-100): keyword overlap with target role
    - Skills, Missing Keywords, Strengths, Weaknesses, Suggestions
        ↓
  Resume saved to MongoDB with full analysis
        ↓
  Response: resumeId, fileName, scores
```

### 10.3 Mock Interview Flow (Frontend → Backend)

```
User sets role + difficulty → POST /api/v2/interview/start
        ↓
  AI generates personalized first question based on role
  Interview session created in MongoDB (in_progress)
        ↓
  User records answer (audio) + types transcript → POST /api/v2/interview/answer
        ↓
  AI Evaluation:
    1. technicalAccuracy (0-100)
    2. relevance (0-100)
    3. completeness (0-100)
    4. communication (0-100)
    5. confidence (0-100)
    + Expected answer, key points, detected/missing concepts, improved answer
        ↓
  Next question generated (different topic from previous)
  OR interview completed → overallScore calculated
        ↓
  GET /api/v2/interview/results/:id → Full evaluation data
```

### 10.4 Security Analysis Flow (Extension → Backend → ArmorIQ)

```
User clicks "Security Analyze" → Code sent to backend
        ↓
  Step 1: Extension handles UI
  Step 2: ArmorClaw AI analysis → score + issues + recommendations
  Step 3: Findings sent to ArmorIQ (capturePlan → getIntentToken → invoke)
  Step 4: ArmorIQ policy evaluation (evaluatePolicy)
  Step 5: Audit logs created (SecurityAudit MongoDB + ArmorIQ audit)
  Step 5b: Security event reported if score < 70
  Step 6: Response returned to extension
        ↓
  Formatted result displayed in new VS Code document (markdown)
```

### 10.5 Learning Memory Flow

```
User action (practice, submission, AI chat, hint, code review)
        ↓
  Controller fire-and-forgets:
  saveMemory({ user_id, memory_type, content, metadata }).catch(...)
        ↓
  HindsightClient.retain(memoryBank, content, { metadata })
        ↓
  Vector stored in Hindsight cloud (searchable later)
        ↓
  GET /api/memory/similar-errors → search past errors
  GET /api/memory/patterns → aggregated error patterns
```

---

## 11. Deployment & Hosting

### Backend: Render
- **URL**: `https://preecode-backend.onrender.com`
- **Start Command**: `node server.js`
- **Environment Variables**: MONGO_URI, JWT_SECRET, OPENROUTER_API_KEY, SENDGRID_API_KEY, CLOUDINARY_*, GOOGLE_*, HINDSIGHT_*, ARMORIQ_*

### Frontend: Vercel
- **URL**: `https://preecode.vercel.app`
- **Framework**: Static (no build step)
- **Build Command**: `npm run build` (copies static files to dist/)
- **vercel.json**: Configured for SPA routing (not shown in file tree, but exists in the project root at `preecode-frontend/vercel.json`)

### Extension Hosting: VS Code Marketplace
- **Publisher**: Preecode
- **Extension ID**: `preecode`
- **Install**: via marketplace or VSIX
- **Auto-Publish**: GitHub Actions on tag push

### DNS / Domains
- Frontend: `preecode.vercel.app` (Vercel subdomain)
- Backend: `preecode-backend.onrender.com` (Render subdomain)
- Contact email: `preecodeai@gmail.com`
- Social: X/Twitter `@preecodeai`
- GitHub: `https://github.com/Prashantpd7/Preecode.git`

---

## 12. CI/CD Pipeline

### GitHub Actions: `publish-vscode-extension.yml`

```yaml
Trigger: Push tag (v*)
Steps:
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies (pnpm)
  4. Run compile (tsc)
  5. Package extension (vsce package)
  6. Publish to VS Code Marketplace
```

---

## 13. Security System

### 13.1 ArmorClaw Security Analysis

The security system uses the ArmorClaw service (via OpenRouter AI) to analyze code for 10 categories of vulnerabilities:

1. **Hardcoded Secrets** — API keys, passwords, tokens, credentials
2. **Injection Flaws** — SQL, NoSQL, command, code injection
3. **XSS** — Reflected, stored, DOM-based
4. **Insecure Crypto** — Weak algorithms, hardcoded keys
5. **Path Traversal** — Unsanitized file paths
6. **Insecure Deserialization** — Unsafe deserialization
7. **Authentication/Authorization Issues** — Weak auth, missing checks
8. **Information Exposure** — Sensitive data in logs/errors
9. **Input Validation** — Missing sanitization
10. **Dependency Risks** — Import-identifiable supply chain risks

**Scoring**: 0-100 (100 = perfectly secure)
**Severity**: critical → high → medium → low

### 13.2 ArmorIQ Integration

The 6-step security workflow:
1. User initiates security scan (extension UI)
2. ArmorClaw AI generates findings (score, issues, recommendations)
3. Findings sent to ArmorIQ via SDK (capturePlan → getIntentToken → invoke)
4. ArmorIQ policy evaluation (pre-defined policies)
5. Audit logs created (MongoDB SecurityAudit + ArmorIQ audit)
6. Response returned to Preecode extension

### 13.3 Security Audit Logging

- All security scans logged to `SecurityAudit` MongoDB collection
- Tracks: userId, action, resource, status, fileName, language, score, issueCount, severity, IP, userAgent
- Security events reported to ArmorIQ when score < 70

### 13.4 Backend Security Measures

- **Helmet**: Security headers (X-XSS-Protection, X-Frame-Options, etc.)
- **Rate Limiting**: 500 requests/15min (auth routes exempt)
- **CORS**: Strict origin validation (configured frontends + *.vercel.app)
- **JWT**: 7-day expiry with token version for session invalidation
- **Password Hashing**: bcrypt with 10 rounds
- **Input Validation**: Mongoose schema validation, Multer file type/size limits
- **Error Handling**: Centralized error handler, no stack traces in production
- **Body Limits**: 10MB JSON/URL-encoded request limit
- **Early Access Enforcement**: Auto-downgrade expired pro accounts

---

## 14. Notable Observations & Architecture Analysis

### Strengths

1. **Comprehensive Feature Set** — Covers the full developer journey: practice → interview → resume → placement
2. **Graceful Degradation** — AI fallback chain through 6 models, local AI fallback in extension, ArmorIQ SDK fallback to local audit
3. **Fire-and-Forget Architecture** — Hindsight memory saves never block API responses
4. **Multi-Strategy Resume Parsing** — Multiple fallback techniques for PDF/DOCX text extraction
5. **Token Versioning** — Allows instant session invalidation across all devices
6. **VS Code Deep Linking** — Seamless web ↔ extension integration via custom URI scheme
7. **Mobile-Responsive** — Dedicated mobile detection, enhancements, and layout fixes
8. **Animated UI** — Staggered animations, animated counters, progress bars, scroll reveal
9. **Early Access System** — Referral rewards, badges, certificates, time-limited pro plans
10. **MCP Protocol Support** — Implements Model Context Protocol for future AI agent integration

### Weaknesses / Issues

1. **Duplicate Extension AI Code** — `aiService.ts`, `openaiService.ts`, and `geminiService.ts` are nearly identical — all use the same OpenRouter model. This is dead/redundant code.
2. **Monolithic Frontend Files** — `styles.css` is 188KB, difficult to maintain and debug
3. **No Test Infrastructure** — No unit tests, integration tests, or E2E tests across the project (only test stub in VS Code extension template)
4. **No TypeScript on Backend/Frontend** — Backend uses plain JavaScript, frontend uses vanilla JS — no type safety
5. **JWT Stored in localStorage** — Vulnerable to XSS attacks (frontend)
6. **Inconsistent Error Responses** — Some errors return `{ message }`, others `{ error }`, others `{ error: { message } }`
7. **No WebSocket/Realtime** — All communication is request-response polling; no real-time collaboration or live updates
8. **Missing `authService.ts` File** — Referenced in imports but doesn't exist on disk
9. **Environment Variable Validation** — DONE for DB/Cloudinary, but missing for other critical vars at startup
10. **Debug/Run Feature Limited** — Python-specific code simulation in `runService.ts`

### Security Notes
- JWT tokens in localStorage (vulnerable to XSS)
- Passwords hashed with bcrypt ✓
- CORS configured dynamically ✓
- Early access system with access codes ✓
- No rate limiting on auth routes (explicitly skipped) ⚠️

### Package Management
- **Backend**: npm with lockfile
- **Extension**: pnpm with lockfile
- **Frontend**: npm, minimal dependencies (mostly CDN-served)

---

## 15. File Inventory

### Backend (`preecode-backend/`) — 35 files

```
server.js                    — Express server entry point
config/                      — Configuration modules
  db.js                      — MongoDB connection
  passport.js                — Google OAuth strategy
  cloudinary.js              — Cloudinary config
  runtimeConfig.js           — Environment-aware config
  email.js                   — SendGrid email service
models/                      — MongoDB schemas
  User.js                    — User accounts
  Submission.js              — Coding submissions
  Practice.js                — Practice sessions
  Resume.js                  — Resume analysis
  Interview.js               — Mock interviews
  LearningPattern.js         — Learning patterns
  LearningMemory.js          — Learning memory
  SecurityAudit.js           — Security audit logs
controllers/                 — Route handlers
  userController.js          — Auth, profile, password, stats
  aiController.js            — AI chat, hints, review, questions
  submissionController.js    — Submission CRUD
  practiceController.js      — Practice CRUD
  resumeController.js        — Resume upload + analysis
  interviewController.js     — Interview flow
  readinessController.js     — Placement readiness
  memoryController.js        — Learning memory
  securityController.js      — Security analysis + audit
  earlyAccessController.js   — Early access management
routes/                      — Express routers
  authRoutes.js              — Google OAuth, dev-login, debug
  userRoutes.js              — User endpoints
  submissionRoutes.js        — Submission endpoints
  practiceRoutes.js          — Practice endpoints
  aiRoutes.js                — AI endpoints
  resumeRoutes.js            — Resume v2 endpoints
  interviewRoutes.js         — Interview v2 endpoints
  readinessRoutes.js         — Readiness v2 endpoints
  memoryRoutes.js            — Memory endpoints
  securityRoutes.js          — Security endpoints
  armoriqMcpRoutes.js        — ArmorIQ MCP server
  uploadRoutes.js            — Avatar upload
  earlyAccessRoutes.js       — Early access endpoints
services/                    — Business logic
  aiService.js               — OpenRouter AI engine
  hindsightService.js        — Hindsight vector memory
  armorclawService.js        — Security analysis
  armoriqService.js          — ArmorIQ SDK integration
middleware/                  — Express middleware
  authMiddleware.js          — JWT verification
  errorMiddleware.js         — Error handler
  checkEarlyAccess.js        — Early access expiry
  validateObjectId.js        — ID format validation
```

### VS Code Extension (`preecode-extension/`) — 30 files

```
src/extension.ts             — Extension entry point (~1800 lines)
src/auth/
  authManager.ts             — Auth + URI handler
src/state/
  types.ts                   — TypeScript interfaces
  store.ts                   — State store (singleton)
src/views/
  controlCenterView.ts       — WebView provider
src/services/
  apiService.ts              — HTTP client
  authService.ts             — Token storage
  aiService.ts               — AI fallback (OpenRouter direct)
  openaiService.ts           — Duplicate AI fallback
  geminiService.ts           — Duplicate AI fallback
  securityAnalyzeService.ts  — Security analysis
  backendSyncService.ts      — Periodic data sync
  learningMemoryService.ts   — Learning memory CRUD
  similarityEngine.ts        — Code similarity
  diagnosticsService.ts      — Linting
  languageConfig.ts          — Language configs
  timerService.ts            — Timer
  errorTrackingService.ts    — Error tracking
  runService.ts              — Code execution
  aiActionService.ts         — AI action orchestration
  projectReviewService.ts    — Project review
src/timer/
  practiceTimerService.ts    — Practice timer
  runDetectionService.ts     — Run detection
src/panels/
  loginPanel.ts              — Login panel
  aiActionPanel.ts           — AI action panel
  projectReviewPanel.ts      — Project review panel
  memorySettingsPanel.ts     — Memory settings panel
src/models/
  memoryModels.ts            — Memory data types
src/onboarding/
  onboardingService.ts       — Interactive tour
webview/                     — WebView UI
  control-center.js          — Main UI (~500 lines)
  control-center.css         — Styles
  ai-panel.js                — AI panel
  ai-panel.css               — Styles
  login-panel.js             — Login UI (~400 lines)
  login-panel.css            — Styles
  script.js                  — Legacy UI script
  style.css                  — Styles
  index.html                 — WebView HTML
```

### Frontend (`preecode-frontend/`) — 45 files

```
index.html                   — Landing page
login.html                   — Login page
register.html                — Registration page
forgot-password.html         — Password reset
styles.css                   — All styles (~188KB)
api.js                       — API client (~350 lines)
app.js                       — Auth handlers (~200 lines)
theme.js                     — Dark/light theme
tailwind-config.js           — Tailwind configuration
pages/
  dashboard.html             — Main dashboard
  dashboard.js               — Dashboard logic
  profile.html               — User profile
  profile.js                 — Profile logic
  settings.html              — Settings
  settings.js                — Settings logic
  problems.html              — Problem browser
  problems.js                — Problem logic
  practice-here.html         — In-browser practice
  practice-here.js           — Practice logic
  submissions.html           — Submission history
  submissions.js             — Submissions logic
  resume-upload.html         — Resume upload
  resume-analysis.html       — Resume analysis
  interview-setup.html       — Interview setup
  interview-session.html     — Interview session
  interview-results.html     — Interview results
  certificate.html           — Early access certificate
  certificate.js             — Certificate logic
  placement-dashboard.html   — Placement readiness
  mobile-app-enhancements.js — Mobile enhancements
js/
  interview.js               — Interview API
  resume.js                  — Resume API
  readiness.js               — Readiness API
layout/
  layout.js                  — Navigation/sidebar
  chatbot.js                 — AI chatbot widget
  early-access.js            — Early access banner
auth/
  callback.html              — OAuth callback
  logout.html                — Logout page
dist/                        — Built output
  (mirrors root files for Vercel deployment)
```

---

*End of Report*
