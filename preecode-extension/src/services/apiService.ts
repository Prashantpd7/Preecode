import * as vscode from 'vscode';
import { getToken, deleteToken } from './authService';

export const API_BASE = 'https://preecode.onrender.com/api';

// Helper to obtain a fetch implementation in Node + ESM environments.
export async function doFetch(url: string, opts?: any): Promise<any> {
    if ((globalThis as any).fetch) {
        return (globalThis as any).fetch(url, opts);
    }
    const mod = await import('node-fetch');
    const fn = (mod && (mod.default || mod)) as any;
    return fn(url, opts);
}

// Shape of practice data sent after each successful run
export interface PracticeData {
    question: string;
    timeTaken: string;      // formatted "MM:SS"
    hintsUsed: number;
    solutionViewed: boolean;
    language: string;
    date: string;           // ISO 8601 date string
}

// Shape of submission data sent when user submits a solution from the extension
export interface SubmissionData {
    problemName: string;
    difficulty?: string;
    status: string; // e.g., 'Accepted', 'Wrong Answer'
    date?: string;  // ISO string
}

function normalizeDifficulty(input?: string): 'easy' | 'medium' | 'hard' {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'easy' || value === 'medium' || value === 'hard') return value;
    return 'easy';
}

function normalizeStatus(input: string): 'accepted' | 'wrong' {
    const value = String(input || '').trim().toLowerCase();
    if (value.includes('accept') || value.includes('correct')) return 'accepted';
    return 'wrong';
}

export async function sendSubmission(
    context: vscode.ExtensionContext,
    data: SubmissionData
): Promise<boolean> {
    const token = await getToken(context);
    if (!token) {
        vscode.window.showErrorMessage('preecode: Please login first to submit.');
        return false;
    }

    try {
        // Resolve userId from /users/me so backend receives an explicit userId
        let userId: string | undefined;
        try {
            const meRes = await doFetch(`${API_BASE}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (meRes && meRes.ok) {
                const meJson: any = await meRes.json();
                userId = meJson._id || meJson.id;
            }
        } catch (e) { /* ignore */ }

        const response = await doFetch(`${API_BASE}/submissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                problemName: (data.problemName || 'Practice Session').trim(),
                difficulty: normalizeDifficulty(data.difficulty),
                status: normalizeStatus(data.status),
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage('preecode: Session expired. Please login again.');
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(`preecode: Failed to submit (${response.status}).`);
            return false;
        }

        vscode.window.showInformationMessage(`preecode: Submission saved (${(data.problemName || 'Practice Session').trim()})`);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage('preecode: Could not reach server. Submission not saved.');
        return false;
    }
}

/**
 * Sends practice session data to the backend after a successful run.
 *
 * Phase 2: POST /api/practice with Bearer token.
 * Phase 4: Handles fetch failures and 401 session expiry cleanly.
 *
 * Returns true if data was sent successfully, false otherwise.
 */
export async function sendPracticeData(
    context: vscode.ExtensionContext,
    data: PracticeData
): Promise<boolean> {
    console.log("🔥 sendPracticeData CALLED");
console.log("Data being sent:", data);


    // Get stored token — if missing, user is not logged in
    const token = await getToken(context);

    if (!token) {
        vscode.window.showErrorMessage(
            'preecode: Please login first to save your practice data. Use "preecode: Login" command.'
        );
        return false;
    }

    try {
        const response = await doFetch(`${API_BASE}/practice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        // Phase 4: 401 means token is expired or invalid — auto logout
        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage(
                'preecode: Session expired. Please login again using "preecode: Login".'
            );
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(
                `preecode: Failed to save practice data (${response.status}). Will try again next time.`
            );
            return false;
        }

        // Notify user of saved practice (non-blocking)
        try {
            vscode.window.showInformationMessage(`preecode: Practice saved — ${data.timeTaken}`);
        } catch (e) {
            console.log('Could not show notification:', e);
        }

        return true;

    } catch (error: any) {
        // Phase 4: Network failure or fetch error — show message, do not crash
        vscode.window.showErrorMessage(
            'preecode: Could not reach server. Practice data not saved. Check your connection.'
        );
        return false;
    }
}