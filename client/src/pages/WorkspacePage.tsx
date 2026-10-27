import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.ts';
import type { ExecutionResult, WorkspaceLanguage } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { useToast } from '../components/Toast.tsx';
import './WorkspacePage.css';

const LANGS: { id: WorkspaceLanguage; label: string; template: string }[] = [
  {
    id: 'cpp',
    label: 'C++17',
    template: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    if (!(cin >> n)) return 0;
    long long sum = 0;
    for (int i = 0; i < n; i++) { long long x; cin >> x; sum += x; }
    cout << sum << "\\n";
    return 0;
}
`,
  },
  {
    id: 'java',
    label: 'Java 17',
    template: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        long sum = 0;
        st = new StringTokenizer(br.readLine());
        for (int i = 0; i < n; i++) sum += Long.parseLong(st.nextToken());
        System.out.println(sum);
    }
}
`,
  },
  {
    id: 'python',
    label: 'Python 3',
    template: `import sys

def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    print(sum(map(int, data[1:1 + n])))

main()
`,
  },
];

export function WorkspacePage() {
  const [params] = useSearchParams();
  const toast = useToast();
  const problemKey = params.get('problem') ?? '';
  const status = useFetch<{ executionConfigured: boolean; languages: WorkspaceLanguage[] }>('/api/workspace/status');
  const [lang, setLang] = useState<WorkspaceLanguage>('cpp');
  const [code, setCode] = useState(LANGS[0]!.template);
  const [stdin, setStdin] = useState('3\n1 2 3\n');
  const [expected, setExpected] = useState('6');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draft = useFetch<{ draft: { code: string; stdin: string; updatedAt: string } | null }>(`/api/workspace/drafts?problemKey=${encodeURIComponent(problemKey)}&language=${lang}`);
  const loadedFor = useRef<string>('');

  // Load a draft when language/problem changes; fall back to the template.
  useEffect(() => {
    if (draft.loading) return;
    const k = `${problemKey}|${lang}`;
    if (loadedFor.current === k) return;
    loadedFor.current = k;
    if (draft.data?.draft) {
      setCode(draft.data.draft.code);
      setStdin(draft.data.draft.stdin);
    } else {
      setCode(LANGS.find((l) => l.id === lang)!.template);
    }
  }, [draft.data, draft.loading, lang, problemKey]);

  async function saveDraft() {
    setSaving('saving');
    try {
      await api('/api/workspace/drafts', { method: 'PUT', body: { problemKey, language: lang, code, stdin } });
      setSaving('saved');
      setTimeout(() => setSaving('idle'), 1500);
    } catch (err) {
      setSaving('idle');
      toast.push(errorMessage(err), 'danger');
    }
  }

  async function run() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await api<{ result: ExecutionResult }>('/api/workspace/run', {
        method: 'POST',
        body: { language: lang, code, stdin, expectedOutput: expected.trim() ? expected : undefined },
      });
      setResult(res.result);
      if (res.result.status === 'accepted') toast.push('Sample passed on your input. (Not an official verdict.)', 'celebrate');
    } catch (err) {
      setRunError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = code.slice(0, start) + '    ' + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void saveDraft();
    }
  }

  const configured = status.data?.executionConfigured ?? false;
  const lines = code.split('\n').length;

  return (
    <div className="ws rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">06 · workspace</p>
          <h1 className="page-head__title">Scratch, run, keep.</h1>
          <p className="page-head__sub">
            Drafts are saved per problem and language. Runs go to an isolated judge — never this server — and check your own input, which is not the same as an official verdict.
          </p>
        </div>
        <div className="row">
          {status.data && (
            <span className={`tag ${configured ? 'tag--ok' : 'tag--warn'}`} data-testid="exec-status">
              {configured ? 'execution: on' : 'execution: not configured'}
            </span>
          )}
          {problemKey && <span className="tag tag--accent mono">{problemKey.replace('codeforces:', '')}</span>}
        </div>
      </header>

      {status.data && !configured && (
        <div className="alert alert--warn" role="status">
          Code execution needs a Judge0-compatible service. Set <code>JUDGE0_URL</code> (and <code>JUDGE0_KEY</code> if required) on the server to enable Run. Editing and drafts work regardless.
        </div>
      )}

      <div className="ws__layout">
        <section className="ws__editor panel ticks">
          <div className="ws__bar">
            <div className="row" role="radiogroup" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} className={`tag tag--button ${lang === l.id ? 'tag--active' : ''}`} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="row">
              <span className="faint mono" style={{ fontSize: '0.72rem' }}>
                {lines} lines{draft.data?.draft ? ' · draft loaded' : ''}
              </span>
              <button type="button" className="btn btn--sm" onClick={saveDraft} disabled={saving === 'saving'}>
                {saving === 'saved' ? 'Saved ✓' : saving === 'saving' ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" className="btn btn--sm btn--primary" onClick={run} disabled={running || !configured} title={configured ? 'Run with custom input' : 'Execution not configured'}>
                {running ? (
                  <>
                    <span className="spinner" /> Running…
                  </>
                ) : (
                  '▶ Run'
                )}
              </button>
            </div>
          </div>
          <div className="ws__code">
            <pre className="ws__gutter" aria-hidden="true">
              {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
            </pre>
            <textarea className="ws__textarea" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown} spellCheck={false} aria-label="Code editor" data-testid="code-editor" />
          </div>
        </section>

        <aside className="ws__io">
          <label className="field">
            <span className="field__label">Custom input (stdin)</span>
            <textarea className="textarea textarea--code" rows={5} value={stdin} onChange={(e) => setStdin(e.target.value)} spellCheck={false} />
          </label>
          <label className="field">
            <span className="field__label">Expected output (optional)</span>
            <textarea className="textarea textarea--code" rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} spellCheck={false} />
            <span className="field__hint">Compared ignoring trailing whitespace. Passing here does not mean passing hidden tests.</span>
          </label>

          <div className="panel panel--tight ticks ws__out">
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              output
            </p>
            {runError && <div className="alert alert--danger">{runError}</div>}
            {!result && !runError && <p className="faint">Run to see compilation and runtime output here.</p>}
            {result && (
              <div className="stack">
                <span className={`tag ${result.status === 'accepted' ? 'tag--ok' : result.status === 'wrong_answer' ? 'tag--danger' : 'tag--warn'}`}>
                  {result.status.replace('_', ' ')} · {result.statusDescription}
                  {result.timeSeconds !== null ? ` · ${result.timeSeconds}s` : ''}
                  {result.memoryKb !== null ? ` · ${Math.round(result.memoryKb / 1024)} MB` : ''}
                </span>
                {result.compileOutput && (
                  <div>
                    <p className="eyebrow">compiler</p>
                    <pre className="ws__pre ws__pre--err">{result.compileOutput}</pre>
                  </div>
                )}
                {result.stdout && (
                  <div>
                    <p className="eyebrow">stdout</p>
                    <pre className="ws__pre">{result.stdout}</pre>
                  </div>
                )}
                {result.stderr && (
                  <div>
                    <p className="eyebrow">stderr</p>
                    <pre className="ws__pre ws__pre--err">{result.stderr}</pre>
                  </div>
                )}
                {result.status === 'wrong_answer' && result.expectedOutput && (
                  <div>
                    <p className="eyebrow">expected</p>
                    <pre className="ws__pre">{result.expectedOutput}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
