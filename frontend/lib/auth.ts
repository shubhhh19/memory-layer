/**
 * Authentication utilities with encrypted storage
 */

import CryptoJS from 'crypto-js';

const TOKEN_KEY = 'memory-mesh-token';
const REFRESH_TOKEN_KEY = 'memory-mesh-refresh-token';
const USER_KEY = 'memory-mesh-user';
const ENCRYPTION_KEY = 'memory-mesh-encryption-key'; // In production, derive from user password

// Simple encryption for localStorage (in production, use proper key derivation)
function getEncryptionKey(): string {
    if (typeof window === 'undefined') return ENCRYPTION_KEY;
    
    let key = localStorage.getItem('_mm_ek');
    if (!key) {
        key = CryptoJS.lib.WordArray.random(256/8).toString();
        localStorage.setItem('_mm_ek', key);
    }
    return key;
}

function encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, getEncryptionKey()).toString();
}

function decrypt(encrypted: string): string {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, getEncryptionKey());
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return '';
    }
}

export interface User {
    id: string;
    email: string;
    username: string;
    full_name?: string;
    role: string;
    tenant_id?: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export function setAuthTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(TOKEN_KEY, encrypt(tokens.access_token));
        localStorage.setItem(REFRESH_TOKEN_KEY, encrypt(tokens.refresh_token));
        localStorage.setItem(`${TOKEN_KEY}_expires`, (Date.now() + tokens.expires_in * 1000).toString());
    } catch (error) {
        console.error('Failed to save tokens:', error);
    }
}

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
        const encrypted = localStorage.getItem(TOKEN_KEY);
        if (!encrypted) return null;
        
        const expires = localStorage.getItem(`${TOKEN_KEY}_expires`);
        if (expires && Date.now() > parseInt(expires)) {
            clearAuthTokens();
            return null;
        }
        
        return decrypt(encrypted);
    } catch {
        return null;
    }
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
        const encrypted = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!encrypted) return null;
        return decrypt(encrypted);
    } catch {
        return null;
    }
}

export function clearAuthTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(`${TOKEN_KEY}_expires`);
    localStorage.removeItem(USER_KEY);
}

export function setUser(user: User): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(USER_KEY, encrypt(JSON.stringify(user)));
    } catch (error) {
        console.error('Failed to save user:', error);
    }
}

export function getUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    try {
        const encrypted = localStorage.getItem(USER_KEY);
        if (!encrypted) return null;
        
        const decrypted = decrypt(encrypted);
        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

export function isAuthenticated(): boolean {
    return getAccessToken() !== null;
}

export function getAuthHeaders(): HeadersInit {
    const token = getAccessToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
}

