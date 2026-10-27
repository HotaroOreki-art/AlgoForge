import { THEMES, useTheme } from '../theme/ThemeContext.tsx';
import './ThemeSwitcher.css';

/**
 * Three swatch buttons. Changing theme only flips a data attribute; no state
 * or data is reset.
 */
export function ThemeSwitcher({ variant = 'swatches' }: { variant?: 'swatches' | 'cards' | 'labeled' }) {
  const { theme, setTheme } = useTheme();
  if (variant === 'labeled') {
    return (
      <div className="themelabeled" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            aria-label={t.name}
            className={`themelabeled__btn ${theme === t.id ? 'themelabeled__btn--active' : ''}`}
            onClick={() => setTheme(t.id)}
            data-testid={`theme-${t.id}`}
          >
            <span className="themelabeled__dot" style={{ background: `linear-gradient(135deg, ${t.swatch[1]}, ${t.swatch[2]})` }} />
            <span className="themelabeled__copy">
              <span className="themelabeled__name">{t.name}</span>
              <span className="themelabeled__blurb">{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
  if (variant === 'cards') {
    return (
      <div className="themecards" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            className={`themecard ${theme === t.id ? 'themecard--active' : ''}`}
            onClick={() => setTheme(t.id)}
            data-testid={`theme-${t.id}`}
          >
            <span className="themecard__swatch" aria-hidden="true">
              {t.swatch.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <span className="themecard__name">{t.name}</span>
            <span className="themecard__blurb">{t.blurb}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="themeswitch" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.name}
          title={t.name}
          className={`themeswitch__btn ${theme === t.id ? 'themeswitch__btn--active' : ''}`}
          onClick={() => setTheme(t.id)}
          data-testid={`theme-${t.id}`}
        >
          <span className="themeswitch__dot" style={{ background: `linear-gradient(135deg, ${t.swatch[1]}, ${t.swatch[2]})`, boxShadow: `inset 0 0 0 2px ${t.swatch[0]}` }} />
        </button>
      ))}
    </div>
  );
}
