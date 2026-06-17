import * as vscode from 'vscode';

// Secret storage key — consistent across all auth operations
const TOKEN_KEY = 'CFX_AUTH_TOKEN';

/**
 * Saves the JWT token securely using VS Code's SecretStorage.
 * SecretStorage is encrypted on disk by VS Code — safe for tokens.
 */
export async function saveToken(
    context: vscode.ExtensionContext,
    token: string
): Promise<void> {
    console.log('[Preecode Auth DIAG] saveToken: storing token, length=' + token.length);
    await context.secrets.store(TOKEN_KEY, token);
    // Verify it was stored
    const verify = await context.secrets.get(TOKEN_KEY);
    console.log('[Preecode Auth DIAG] saveToken: verify stored=' + (verify ? 'YES (len=' + verify.length + ')' : 'NO'));
}

/**
 * Retrieves the stored JWT token.
 * Returns null if no token is stored (user not logged in).
 */
export async function getToken(
    context: vscode.ExtensionContext
): Promise<string | null> {
    const token = await context.secrets.get(TOKEN_KEY);
    const exists = token !== undefined && token !== null && token.length > 0;
    console.log('[Preecode Auth DIAG] getToken: token=' + (exists ? 'YES (len=' + token!.length + ')' : 'NO') + ' | source=SecretStorage(' + TOKEN_KEY + ')');
    return token ?? null;
}

/**
 * Deletes the stored JWT token.
 * Used on logout and on 401 session expiry.
 */
export async function deleteToken(
    context: vscode.ExtensionContext
): Promise<void> {
    const callerStack = new Error().stack?.split('\n').slice(2, 8).join(' | ');
    console.log('[Preecode Auth DIAG] deleteToken: CALLED from:', callerStack || 'unknown');
    // Check what we're about to delete
    const before = await context.secrets.get(TOKEN_KEY);
    console.log('[Preecode Auth DIAG] deleteToken: token existed before delete=' + (before ? 'YES (len=' + before.length + ')' : 'NO'));
    await context.secrets.delete(TOKEN_KEY);
    const after = await context.secrets.get(TOKEN_KEY);
    console.log('[Preecode Auth DIAG] deleteToken: token exists after delete=' + (after ? 'YES' : 'NO'));
}

/**
 * Returns true if a token is currently stored.
 * Does NOT validate the token against the server —
 * validation happens implicitly on the first API call.
 */
export async function isLoggedIn(
    context: vscode.ExtensionContext
): Promise<boolean> {
    const token = await context.secrets.get(TOKEN_KEY);
    return token !== undefined && token !== null && token.length > 0;
}