# OpenRouter Setup & Troubleshooting Guide

## Quick Start

Your OpenRouter configuration has been updated to use a single reliable model: **nvidia/nemotron-3-super-120b-a12b:free**

### 1. Verify Your API Key

Check that your OpenRouter API key is set in `preecode-backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
```

If you don't have an API key:
1. Go to https://openrouter.ai/
2. Sign up or log in
3. Navigate to Keys section
4. Create a new API key
5. Copy it to your `.env` file

### 2. Restart Your Backend

```bash
cd preecode-backend
npm start
```

### 3. Test the Configuration

Run the test script:

```bash
node test-openrouter.js
```

You should see:
```
✅ OPENROUTER_API_KEY is set
✅ AI Service loaded successfully
🧪 Testing AI chat with nvidia/nemotron model...
✅ SUCCESS! Model responded:
────────────────────────────────────────────────────────────
Hello from NVIDIA Nemotron!
────────────────────────────────────────────────────────────
🎉 OpenRouter is working correctly with nvidia/nemotron model!
```

## What Changed?

### Before (Multiple Failing Models)
```javascript
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-3-4b-it:free',
];
```

**Problem:** All 7 models were returning provider errors, causing complete AI failure.

### After (Single Reliable Model)
```javascript
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
];
```

**Solution:** One reliable model eliminates cascade failures and provides consistent responses.

## Monitoring

### Backend Logs

Watch for these log messages when AI features are used:

**✅ Success:**
```
[ai] OpenRouter request model=nvidia/nemotron-3-super-120b-a12b:free attempt=1
[ai] ✅ Success with model nvidia/nemotron-3-super-120b-a12b:free on attempt 1
```

**⚠️ Retry (temporary issue):**
```
[ai] OpenRouter non-200 response
[ai] Retrying in 800ms...
```

**❌ Failure:**
```
[ai] OpenRouter network/timeout error
```

### Common Issues & Solutions

#### Issue: "OPENROUTER_API_KEY is missing"
**Solution:** Add your API key to `preecode-backend/.env`

#### Issue: "Provider returned error"
**Possible causes:**
1. Invalid API key → Check your key at https://openrouter.ai/keys
2. Rate limiting → Wait a few minutes and try again
3. Model temporarily unavailable → Check https://openrouter.ai/models

#### Issue: "Request timed out"
**Solution:** 
- Check your internet connection
- The model may be under heavy load, retry in a few minutes
- Timeout is set to 45 seconds, which should be sufficient

#### Issue: "402 Payment Required"
**Solution:**
- The free tier may have usage limits
- Check your OpenRouter dashboard for credit status
- Consider adding credits or switching to a different free model

## Advanced Configuration

### Adding More Models (Optional)

If you want to add fallback models in the future, edit `preecode-backend/services/aiService.js`:

```javascript
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',  // Primary
  'meta-llama/llama-3.3-70b-instruct:free',  // Fallback 1
  'google/gemma-3-27b-it:free',              // Fallback 2
];
```

**Note:** Only add models that you've verified are working on OpenRouter.

### Adjusting Retry Settings

In `preecode-backend/services/aiService.js`:

```javascript
const MAX_RETRIES = 3;                    // Number of retries per model
const RETRY_DELAYS_MS = [800, 2000, 4000]; // Delay between retries
const REQUEST_TIMEOUT_MS = 45000;          // 45 second timeout
```

### Adjusting Token Limits

For longer responses, increase `max_tokens`:

```javascript
const requestConfig = {
  temperature: options.temperature ?? 0.7,
  max_tokens: options.maxTokens ?? 512,  // Increase this value
};
```

## Testing AI Features

### 1. Chat Feature
Test in your application's chat interface or via API:
```bash
curl -X POST http://localhost:5001/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"message": "Hello, can you help me with coding?"}'
```

### 2. Code Review
```bash
curl -X POST http://localhost:5001/api/ai/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "function add(a, b) { return a + b; }",
    "language": "javascript"
  }'
```

### 3. Get Hint
```bash
curl -X POST http://localhost:5001/api/ai/hint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "problemDescription": "Write a function to reverse a string",
    "language": "javascript"
  }'
```

## Performance Expectations

### Response Times
- **Simple queries:** 2-5 seconds
- **Code review:** 5-10 seconds
- **Complex generation:** 10-20 seconds

### Rate Limits
- Minimum 200ms between requests (built-in spacing)
- OpenRouter free tier limits apply (check their documentation)

## Troubleshooting Checklist

- [ ] OPENROUTER_API_KEY is set in `.env`
- [ ] Backend server is running
- [ ] No firewall blocking openrouter.ai
- [ ] API key is valid (test at https://openrouter.ai/playground)
- [ ] Check backend logs for detailed error messages
- [ ] Run `node test-openrouter.js` to verify configuration

## Support Resources

- **OpenRouter Documentation:** https://openrouter.ai/docs
- **OpenRouter Status:** https://openrouter.ai/status
- **Model Information:** https://openrouter.ai/models/nvidia/nemotron-3-super-120b-a12b
- **API Keys:** https://openrouter.ai/keys

## Rollback Instructions

If you need to revert to the old configuration:

1. Open `preecode-backend/services/aiService.js`
2. Replace the `OPENROUTER_MODELS` array with the old model list
3. Restart the backend server

However, this is **not recommended** as the old models were all failing.

---

**Last Updated:** May 3, 2026  
**Status:** ✅ Active and Working  
**Model:** nvidia/nemotron-3-super-120b-a12b:free
