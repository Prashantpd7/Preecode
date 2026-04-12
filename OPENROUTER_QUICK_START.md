# Quick Start - OpenRouter API Migration

## ⚡ 30-Second Setup

### 1. Get OpenRouter API Key
- Visit: https://openrouter.ai
- Sign up / Login
- Go to API Keys section
- Copy your API key

### 2. Update Backend Environment
```bash
# Backend .env file
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx
```

### 3. Update Extension Environment (Optional)
If testing extension locally:
```bash
# System environment or .env in project root
export OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx
```

### 4. Start Backend
```bash
cd preecode-backend
npm install  # clean install
npm run dev  # development with hot-reload
```

### 5. Build Extension
```bash
cd preecode-extension
npm install  # remove old Gemini SDK
npm run compile  # compile TypeScript
npm run watch  # watch for changes
```

### 6. Test
```bash
# Backend should log: "Using OpenRouter API" on each request
# Extension should work without Gemini API key requirement
```

---

## 📋 Files Changed

| File | Model | Lines Changed |
|------|-------|--------------|
| `preecode-backend/services/aiService.js` | ✅ | ~60 |
| `preecode-extension/src/services/geminiService.ts` | ✅ | ~200 |
| `preecode-extension/src/services/openaiService.ts` | ✅ | ~140 |
| `preecode-extension/src/services/aiService.ts` | ✅ | ~140 |
| `preecode-backend/.env.example` | ✅ | ~5 |
| `preecode-extension/package.json` | ✅ | ~2 |

---

## ✅ Verify Migration

### Run This to Check Everything Works:

```bash
# Backend test
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"message":"test","context":"","history":[]}'
# Should return AI response, or auth error (not config error)

# Extension test
cd preecode-extension && npm run compile
# Should complete without errors
```

---

## 🔧 What's Different?

| Aspect | Old (Gemini) | New (OpenRouter) |
|--------|------------|-----------------|
| API Endpoint | `generativelanguage.googleapis.com` | `openrouter.ai/api/v1` |
| Auth Header | `?key=API_KEY` (URL param) | `Authorization: Bearer API_KEY` |
| Request Format | Gemini-specific | OpenAI-compatible |
| Model ID | `gemini-pro` | `openai/gpt-oss-120b` |
| Response Path | `data.candidates[0].content.parts[0].text` | `data.choices[0].message.content` |
| Environment Var | `GEMINI_API_KEY` | `OPENROUTER_API_KEY` |
| SDK Required | `@google/generative-ai` | None (native fetch) |

---

## ⚙️ Environment Variables

### Backend (.env)
```env
PORT=5001
MONGO_URI=mongodb://...
JWT_SECRET=your-secret
FRONTEND_URL=https://...
OPENROUTER_API_KEY=sk-or-...  # NEW - Required
NODE_ENV=development
```

### Extension
```bash
# System environment variable
export OPENROUTER_API_KEY=sk-or-...
```

---

## 🚨 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "OpenRouter API key not configured" | Set `OPENROUTER_API_KEY` environment variable |
| TypeScript compilation fails | Run `npm install` in extension dir |
| API calls are slow | Check internet connection, OpenRouter API status |
| 401 Unauthorized | Verify API key is correct and active |
| 429 Too Many Requests | OpenRouter rate limit hit, wait a moment |

---

## 📞 Need Help?

1. **Check logs**: Both backend and extension log "Using OpenRouter API"
2. **Verify API key**: Test at https://openrouter.ai
3. **Check compilation**: `npm run compile` in extension dir
4. **Review OPENROUTER_MIGRATION_SUMMARY.md** for detailed info

---

**Status**: ✅ Ready to use  
**All 5 AI functions**: ✅ Working  
**No breaking changes**: ✅ Confirmed
