const encoder = new TextEncoder();
const ITERATIONS_PER_ROUND = 100_000;
const ROUNDS = 6;

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
  // Workers caps each PBKDF2 deriveBits call at 100,000 iterations. Chain six
  // independently salted rounds so the total work remains 600,000 iterations.
  let material: ArrayBuffer = encoder.encode(password).buffer as ArrayBuffer;
  const roundSalt = new Uint8Array(new ArrayBuffer(17));
  roundSalt.set(new Uint8Array(hexBytes(salt)));
  for (let round = 0; round < ROUNDS; round++) {
    roundSalt[16] = round;
    const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    material = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: roundSalt.buffer, iterations: ITERATIONS_PER_ROUND}, key, 256);
  }
  return Array.from(new Uint8Array(material), byte => byte.toString(16).padStart(2, '0')).join('');
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
