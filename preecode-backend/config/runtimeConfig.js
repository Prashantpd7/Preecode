function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function readRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalUrlEnv(name) {
  const value = String(process.env[name] || '').trim();
  return value ? normalizeBaseUrl(value) : '';
}

// Keep auth/runtime URLs env-driven so extension and backend do not silently drift.
const backendUrl = readOptionalUrlEnv('BACKEND_URL');
const frontendUrl = readRequiredEnv('FRONTEND_URL');
const frontendDevUrl = readOptionalUrlEnv('FRONTEND_DEV_URL');
const isDev = process.env.NODE_ENV === 'development' && frontendDevUrl;
const googleCallbackUrl = isDev
  ? (backendUrl ? `${backendUrl}/api/auth/google/callback` : '')
  : (readOptionalUrlEnv('GOOGLE_CALLBACK_URL') || 
     (backendUrl ? `${backendUrl}/api/auth/google/callback` : ''));

// Make Google OAuth config optional — allows running without Google auth for local dev
const googleClientId = readOptionalUrlEnv('GOOGLE_CLIENT_ID');
const googleClientSecret = readOptionalUrlEnv('GOOGLE_CLIENT_SECRET');

module.exports = {
  backendUrl,
  frontendUrl,
  frontendDevUrl,
  googleCallbackUrl,
  jwtSecret: readRequiredEnv('JWT_SECRET'),
  googleClientId,
  googleClientSecret,
};
