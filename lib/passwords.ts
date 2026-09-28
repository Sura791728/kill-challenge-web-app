const encoder = new TextEncoder();
const ITERATIONS = 600_000;

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function usernameOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(name) ? name : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: hexBytes(salt), iterations: ITERATIONS}, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function equalHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function recoveryCode(): string {
  return randomHex(32).match(/.{8}/g)!.join('-');
}

export function normalizeRecoveryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.replaceAll('-', '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(code) ? code : null;
}

function hexBytes(value: string): ArrayBuffer {
  if (!/^[0-9a-f]{32}$/.test(value)) throw Error('Invalid salt');
  return Uint8Array.from(value.match(/../g)!, part => parseInt(part, 16)).buffer as ArrayBuffer;
}
