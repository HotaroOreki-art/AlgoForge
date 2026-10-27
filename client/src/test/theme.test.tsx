import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ThemeProvider, useTheme } from '../theme/ThemeContext.tsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.tsx';

function Probe() {
  const { theme } = useTheme();
  const [count, setCount] = useState(0);
  return (
    <div>
      <output data-testid="theme">{theme}</output>
      <button onClick={() => setCount((c) => c + 1)}>bump</button>
      <output data-testid="count">{count}</output>
    </div>
  );
}

describe('theme switching', () => {
  it('applies data-theme to <html>, persists to localStorage, and keeps unrelated state', () => {
    render(
      <ThemeProvider initial="after-dark">
        <ThemeSwitcher />
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('after-dark');

    fireEvent.click(screen.getByText('bump'));
    fireEvent.click(screen.getByText('bump'));
    expect(screen.getByTestId('count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('theme-daylight'));
    expect(screen.getByTestId('theme').textContent).toBe('daylight');
    expect(document.documentElement.getAttribute('data-theme')).toBe('daylight');
    expect(localStorage.getItem('algoforge.theme')).toBe('daylight');
    expect(screen.getByTestId('theme-daylight')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-after-dark')).toHaveAttribute('aria-checked', 'false');
    // Switching themes must never reset application state.
    expect(screen.getByTestId('count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('theme-dreamscape'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dreamscape');
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('restores the stored theme on mount', () => {
    localStorage.setItem('algoforge.theme', 'dreamscape');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('dreamscape');
  });

  it('ignores garbage in storage and falls back to after-dark', () => {
    localStorage.setItem('algoforge.theme', 'neon-sewer');
    document.documentElement.removeAttribute('data-theme');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('after-dark');
  });
});
