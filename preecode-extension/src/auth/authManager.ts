import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { API_BASE, doFetch, getFrontendUrl } from '../services/apiService';
import { deleteToken, getToken, saveToken } from '../services/authService';

interface MeResponse {
  _id?: string;
  id?: string;
  username?: string;
  email?: string;
  avatar?: string;
}

interface CachedUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

type UserLookupResult =
  | { kind: 'ok'; user: CachedUser }
  | { kind: 'invalid' }
  | { kind: 'error' };

function formatDisplayFirstName(rawValue: string | null | undefined): string {
  const value = String(rawValue || '').trim();
  if (!value) {
    return 'User';
  }

  const beforeAt = value.includes('@') ? value.split('@')[0] : value;
  const firstSegment = beforeAt.split(/[._\-\s]+/).find(Boolean) || beforeAt;
  const cleaned = firstSegment.replace(/\d+/g, '').replace(/[^a-zA-Z]/g, '');
  if (!cleaned) {
    return 'User';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export class AuthManager implements vscode.UriHandler {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private isAllowedPostLoginUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private isTrustedCallback(uri: vscode.Uri): boolean {
    const extensionId = this.context.extension.id.toLowerCase();
    const authority = (uri.authority || '').toLowerCase();
    const normalizedPath = (uri.path || '').toLowerCase();
    return authority === extensionId && normalizedPath === '/auth';
  }

  async handleUri(uri: vscode.Uri): Promise<void> {
    if (!this.isTrustedCallback(uri)) {
      return;
    }

    const params = new URLSearchParams(uri.query);
    const action = params.get('action');
    if (action === 'logout') {
      await this.logout();
      vscode.window.showInformationMessage('Preecode logout synced from website.');
      return;
    }

    const token = params.get('token');
    const postLogin = params.get('postLogin');
    if (!token) {
      vscode.window.showErrorMessage('Preecode login callback missing token.');
      return;
    }

    await saveToken(this.context, token);
    const lookup = await this.fetchCurrentUser(token);
    const user = lookup.kind === 'ok' ? lookup.user : { id: '', username: 'User', email: '', avatar: '' };
    const displayName = formatDisplayFirstName(user.username || user.email);
    await this.context.workspaceState.update('preecode.cachedUser', user);
    preecodeStore.setState((state) => ({
      ...state,
      user: {
        isAuthenticated: true,
        userId: user.id || null,
        username: displayName,
        email: user.email || null,
        avatarUrl: user.avatar || null,
        token
      }
    }));

    vscode.window.showInformationMessage('Preecode login successful.');

    if (postLogin && this.isAllowedPostLoginUrl(postLogin)) {
      void vscode.env.openExternal(vscode.Uri.parse(postLogin));
    }

    // Close login panel after successful authentication
    const { LoginPanel } = await import('../panels/loginPanel.js');
    LoginPanel.closeCurrent();
  }

  async restoreSession(): Promise<void> {
    const token = await getToken(this.context);
    if (!token) {
      preecodeStore.setState((state) => ({
        ...state,
        user: {
          isAuthenticated: false,
          userId: null,
          username: null,
          email: null,
          avatarUrl: null,
          token: null
        }
      }));
      return;
    }

    const cached = this.context.workspaceState.get<CachedUser>('preecode.cachedUser');
    if (cached?.id) {
      const displayName = formatDisplayFirstName(cached.username || cached.email);
      preecodeStore.setState((state) => ({
        ...state,
        user: {
          isAuthenticated: true,
          userId: cached.id,
          username: displayName,
          email: cached.email || null,
          avatarUrl: cached.avatar || null,
          token
        }
      }));
    }

    const lookup = await this.fetchCurrentUser(token);
    if (lookup.kind === 'invalid') {
      await deleteToken(this.context);
      await this.context.workspaceState.update('preecode.cachedUser', undefined);
      preecodeStore.setState((state) => ({
        ...state,
        user: {
          isAuthenticated: false,
          userId: null,
          username: null,
          email: null,
          avatarUrl: null,
          token: null
        }
      }));
      return;
    }

    if (lookup.kind === 'ok') {
      const user = lookup.user;
      const displayName = formatDisplayFirstName(user.username || user.email);
      await this.context.workspaceState.update('preecode.cachedUser', user);
      preecodeStore.setState((state) => ({
        ...state,
        user: {
          isAuthenticated: true,
          userId: user.id,
          username: displayName,
          email: user.email,
          avatarUrl: user.avatar || null,
          token
        }
      }));
      return;
    }

    if (!cached?.id) {
      preecodeStore.setState((state) => ({
        ...state,
        user: {
          isAuthenticated: true,
          userId: null,
          username: 'User',
          email: null,
          avatarUrl: null,
          token
        }
      }));
    }
  }

  async syncFromStoredToken(): Promise<void> {
    await this.restoreSession();
  }

  async login(): Promise<void> {
    // Import LoginPanel here to avoid circular dependencies
    const { LoginPanel } = await import('../panels/loginPanel.js');
    LoginPanel.render(this.context, this.context.extension.extensionUri, this);
  }

  async loginWithToken(token: string): Promise<void> {
    await saveToken(this.context, token);
    const lookup = await this.fetchCurrentUser(token);
    const user = lookup.kind === 'ok' ? lookup.user : { id: '', username: 'User', email: '', avatar: '' };
    const displayName = formatDisplayFirstName(user.username || user.email);
    await this.context.workspaceState.update('preecode.cachedUser', user);
    preecodeStore.setState((state) => ({
      ...state,
      user: {
        isAuthenticated: true,
        userId: user.id || null,
        username: displayName,
        email: user.email || null,
        avatarUrl: user.avatar || null,
        token
      }
    }));

    vscode.window.showInformationMessage('Preecode login successful.');
  }

  async logout(): Promise<void> {
    await deleteToken(this.context);
    await this.context.workspaceState.update('preecode.cachedUser', undefined);
    preecodeStore.setState((state) => ({
      ...state,
      user: {
        isAuthenticated: false,
        userId: null,
        username: null,
        email: null,
        avatarUrl: null,
        token: null
      }
    }));
  }

  async clearAuthState(): Promise<void> {
    // Clear both secret storage and workspace state for a complete fresh start
    await deleteToken(this.context);
    await this.context.workspaceState.update('preecode.cachedUser', undefined);
    preecodeStore.setState((state) => ({
      ...state,
      user: {
        isAuthenticated: false,
        userId: null,
        username: null,
        email: null,
        avatarUrl: null,
        token: null
      }
    }));
  }

  private async fetchCurrentUser(token: string): Promise<UserLookupResult> {
    try {
      const response = await doFetch(`${API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        return { kind: 'invalid' };
      }

      if (!response.ok) {
        return { kind: 'error' };
      }

      const payload = (await response.json()) as MeResponse;
      const id = payload._id || payload.id;
      if (!id) {
        return { kind: 'invalid' };
      }

      return {
        kind: 'ok',
        user: {
          id,
          username: payload.username || 'User',
          email: payload.email || '',
          avatar: payload.avatar || ''
        }
      };
    } catch {
      return { kind: 'error' };
    }
  }
}
