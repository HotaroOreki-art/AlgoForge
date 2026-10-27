import { describe, expect, it } from 'vitest';
import { validateEmail, validateName, validatePassword } from '../pages/AuthPage.tsx';
import { validateHandle } from '../pages/ConnectPage.tsx';

describe('auth form validation', () => {
  it('rejects empty and malformed emails, accepts a normal one', () => {
    expect(validateEmail('')).toMatch(/enter your email/i);
    expect(validateEmail('   ')).toMatch(/enter your email/i);
    expect(validateEmail('not-an-email')).toMatch(/does not look right/i);
    expect(validateEmail('a@b')).toMatch(/does not look right/i);
    expect(validateEmail('  user@example.com ')).toBeNull();
  });

  it('enforces length and letter+digit rules only when registering', () => {
    expect(validatePassword('', 'login')).toMatch(/enter your password/i);
    expect(validatePassword('short', 'login')).toBeNull(); // login never judges strength
    expect(validatePassword('short', 'register')).toMatch(/at least 8/i);
    expect(validatePassword('onlyletters', 'register')).toMatch(/letters and at least one number/i);
    expect(validatePassword('12345678', 'register')).toMatch(/letters and at least one number/i);
    expect(validatePassword('forge-pass-2026', 'register')).toBeNull();
  });

  it('requires a display name between 2 and 60 characters', () => {
    expect(validateName('')).toMatch(/2\+ characters/);
    expect(validateName(' a ')).toMatch(/2\+ characters/);
    expect(validateName('x'.repeat(61))).toMatch(/bit long/i);
    expect(validateName('Amita')).toBeNull();
  });
});

describe('Codeforces handle validation', () => {
  it('accepts real-looking handles and trims whitespace', () => {
    expect(validateHandle(' tourist ')).toBeNull();
    expect(validateHandle('Um_nik')).toBeNull();
    expect(validateHandle('a.b-c_9')).toBeNull();
  });
  it('rejects empty, too short, too long and illegal characters', () => {
    expect(validateHandle('')).toMatch(/enter your codeforces handle/i);
    expect(validateHandle('ab')).toMatch(/3–24/);
    expect(validateHandle('x'.repeat(25))).toMatch(/3–24/);
    expect(validateHandle('bad handle')).toMatch(/3–24/);
    expect(validateHandle('<script>')).toMatch(/3–24/);
  });
});
