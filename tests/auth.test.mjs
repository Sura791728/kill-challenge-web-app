import assert from 'node:assert/strict';
import {equalHex,normalizeRecoveryCode,passwordHash,randomHex,recoveryCode,sha256,usernameOf,validPassword} from '../lib/passwords.ts';

assert.equal(usernameOf('  Streamer_1  '),'streamer_1');
assert.equal(usernameOf('ab'),null);
assert.equal(usernameOf('name-with-dash'),null);
assert.equal(validPassword('long enough password'),true);
assert.equal(validPassword('short'),false);

const salt=randomHex(16),password='a memorable passphrase 123';
const hash=await passwordHash(password,salt);
assert.equal(hash.length,64);
assert.equal(equalHex(hash,await passwordHash(password,salt)),true);
assert.equal(equalHex(hash,await passwordHash('different password',salt)),false);
assert.equal(equalHex(hash,await passwordHash(password,randomHex(16))),false);

const code=recoveryCode(),plain=normalizeRecoveryCode(code);
assert.equal(plain?.length,64);
assert.equal(await sha256(plain),await sha256(code.replaceAll('-','')));
assert.equal(normalizeRecoveryCode('invalid'),null);
console.log('PASS: credentials, password hashing, recovery-code validation');
