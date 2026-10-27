import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { errorMessage } from '../api/client.ts';
import { BrandWordmark } from '../components/Brand.tsx';
import { Constellation } from '../components/Constellation.tsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.tsx';
import './AuthPage.css';

type Mode = 'login' | 'register';

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'That email address does not look right.';
  return null;
}

export function validatePassword(password: string, mode: Mode): string | null {
  if (!password) return 'Enter your password.';
  if (mode === 'register') {
    if (password.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Mix letters and at least one number.';
  }
  return null;
}

export function validateName(name: string): string | null {
  if (name.trim().length < 2) return 'Tell us what to call you (2+ characters).';
  if (name.trim().length > 60) return 'That name is a bit long.';
  return null;
}

export function AuthPage({ initialMode = 'login' }: { initialMode?: Mode }) {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (!loading && user && !success) return <Navigate to={from} replace />;

  const errors = {
    email: validateEmail(email),
    password: validatePassword(password, mode),
    displayName: mode === 'register' ? validateName(displayName) : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, displayName: true });
    setServerError(null);
    if (hasErrors) return;
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, displayName.trim());
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 450);
    } catch (err) {
      setServerError(errorMessage(err, 'Could not sign you in.'));
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setServerError(null);
    setTouched({});
  }

  return (
    <main className="auth">
      <header className="auth__top">
        <BrandWordmark />
        <ThemeSwitcher variant="labeled" />
      </header>

      <section className="auth__hero">
        <p className="eyebrow eyebrow--accent">personal programming environment · v0.1</p>
        <h1 className="auth__title">
          Your code.
          <br />
          Your patterns.
          <br />
          <span className="auth__title-accent">Your next move.</span>
        </h1>
        <p className="auth__lede">
          AlgoForge turns your Codeforces history into a map: what you have practised, where you struggled, which technique unlocks next —
          and a vault for the lessons you write in your own words.
        </p>
        <div className="auth__constellation">
          <Constellation />
        </div>
        <ul className="auth__loop" aria-label="The learning loop">
          <li>connect</li>
          <li>analyse</li>
          <li>explore</li>
          <li>solve</li>
          <li>record</li>
          <li>improve</li>
        </ul>
      </section>

      <section className={`auth__panel ticks ${success ? 'auth__panel--success' : ''}`} aria-labelledby="auth-heading">
        <div className="auth__tabs" role="tablist" aria-label="Sign in or create account">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth__tab auth__tab--active' : 'auth__tab'} onClick={() => switchMode('login')}>
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'auth__tab auth__tab--active' : 'auth__tab'}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <h2 id="auth-heading" className="auth__panel-title">
          {mode === 'login' ? 'Welcome back.' : 'Start your universe.'}
        </h2>
        <p className="muted auth__panel-sub">{mode === 'login' ? 'Pick up where your last session left off.' : 'A place for your history, your notes, your next problem.'}</p>

        <form className="auth__form" onSubmit={onSubmit} noValidate>
          {mode === 'register' && (
            <label className="field">
              <span className="field__label">Display name</span>
              <input
                className="field__input"
                type="text"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
                aria-invalid={Boolean(touched.displayName && errors.displayName)}
                placeholder="e.g. tourist_in_training"
              />
              {touched.displayName && errors.displayName && <span className="field__error">{errors.displayName}</span>}
            </label>
          )}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={Boolean(touched.email && errors.email)}
              placeholder="you@example.com"
            />
            {touched.email && errors.email && <span className="field__error">{errors.email}</span>}
          </label>

          <label className="field">
            <span className="field__label">
              Password
              {mode === 'register' && <span className="field__hint">8+ chars, letters + a number</span>}
            </span>
            <input
              className="field__input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={Boolean(touched.password && errors.password)}
              placeholder="••••••••"
            />
            {touched.password && errors.password && <span className="field__error">{errors.password}</span>}
          </label>

          {serverError && (
            <div className="alert alert--danger" role="alert">
              {serverError}
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--block auth__submit" disabled={submitting || success}>
            {success ? 'Entering…' : submitting ? <span className="spinner" aria-label="Signing in" /> : mode === 'login' ? 'Enter AlgoForge' : 'Create my account'}
          </button>
        </form>

        <p className="auth__foot muted">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="auth__link" onClick={() => switchMode('register')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already forged?{' '}
              <button type="button" className="auth__link" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          )}
        </p>
        <p className="auth__fine">Only your public Codeforces handle is ever requested. Your password is hashed; we never see it.</p>
      </section>
    </main>
  );
}
