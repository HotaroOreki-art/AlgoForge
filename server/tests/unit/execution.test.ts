import { describe, expect, it } from 'vitest';
import { outputsMatch } from '../../src/services/execution.ts';

describe('outputsMatch', () => {
  it('treats trailing whitespace and newlines as insignificant', () => {
    expect(outputsMatch('6\n', '6')).toBe(true);
    expect(outputsMatch('1 2  \n3\n\n', '1 2\n3')).toBe(true);
    expect(outputsMatch('a\r\nb\r\n', 'a\nb')).toBe(true);
  });

  it('does not treat different values as a match', () => {
    expect(outputsMatch('6', '7')).toBe(false);
    expect(outputsMatch('1 2', '1  2')).toBe(false);
  });
});
