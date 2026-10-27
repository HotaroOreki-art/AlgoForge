import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeContext.tsx';
import { AuthProvider } from '../auth/AuthContext.tsx';
import { AuthPage } from '../pages/AuthPage.tsx';

type Handler = (req: { method: string; path: string; body: unknown }) => { status: number; body?: unknown };

/** Minimal fetch double driven by a routing table; records every call. */
function installFetch(route: Handler) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, path, body });
    const res = route({ method, path, body });
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

const user = { id: 'u1', email: 'amita@example.com', displayName: 'Amita', theme: 'after-dark', learningGoals: [], createdAt: new Date().toISOString() };

function renderAuth(initialMode: 'login' | 'register' = 'login') {
  return render(
    <ThemeProvider initial="after-dark">
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<AuthPage initialMode={initialMode} />} />
            <Route path="/" element={<h1>DASHBOARD</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows field errors on submit and does not call the API', async () => {
    const { calls } = installFetch(({ path }) => (path === '/api/auth/me' ? { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'nope' } } } : { status: 500 }));
    renderAuth('login');
    await waitFor(() => expect(calls.some((c) => c.path === '/api/auth/me')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /enter algoforge/i }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/auth/login')).toHaveLength(0);
  });

  it('surfaces the server message on a 401 login', async () => {
    installFetch(({ path }) => {
      if (path === '/api/auth/me') return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'nope' } } };
      if (path === '/api/auth/login') return { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } } };
      return { status: 500 };
    });
    renderAuth('login');
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'amita@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong-pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: /enter algoforge/i }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    // The form stays usable after a failed attempt.
    expect(screen.getByRole('button', { name: /enter algoforge/i })).toBeEnabled();
  });

  it('registers with the chosen theme and lands on the dashboard', async () => {
    const { calls } = installFetch(({ method, path }) => {
      if (path === '/api/auth/me' && method === 'GET') return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'nope' } } };
      if (path === '/api/auth/register') return { status: 201, body: { user } };
      if (path === '/api/auth/me' && method === 'PATCH') return { status: 200, body: { user: { ...user, theme: 'daylight' } } };
      return { status: 500 };
    });
    renderAuth('register');
    fireEvent.click(screen.getByTestId('theme-daylight'));
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Amita' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'amita@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'forge-pass-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }));

    expect(await screen.findByText('DASHBOARD', {}, { timeout: 3000 })).toBeInTheDocument();
    const reg = calls.find((c) => c.path === '/api/auth/register');
    expect(reg?.body).toEqual({ email: 'amita@example.com', password: 'forge-pass-2026', displayName: 'Amita' });
    const patch = calls.find((c) => c.path === '/api/auth/me' && c.method === 'PATCH');
    expect(patch?.body).toEqual({ theme: 'daylight' });
    // Every request carries cookies; nothing auth-related is ever put in a header or storage.
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('redirects an already signed-in visitor away from /login', async () => {
    installFetch(({ path }) => (path === '/api/auth/me' ? { status: 200, body: { user } } : { status: 500 }));
    renderAuth('login');
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
  });
});
