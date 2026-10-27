import { loadEnv } from '../config/env.ts';
import { AppError } from '../lib/errors.ts';
import type { WorkspaceLanguage } from '../models/Draft.ts';

/**
 * Thin adapter over a Judge0-compatible execution service. User code is never
 * executed on this server; it is sent to the isolated judge.
 *
 * Judge0 language ids (CE 1.13): 54 = C++ (GCC 9.2), 62 = Java (OpenJDK 13), 71 = Python 3.8.
 * These are the stable public ids; a self-hosted instance may differ, so they
 * can be overridden through JUDGE0_LANG_<LANG> if needed.
 */
const LANGUAGE_IDS: Record<WorkspaceLanguage, number> = {
  cpp: Number(process.env.JUDGE0_LANG_CPP ?? 54),
  java: Number(process.env.JUDGE0_LANG_JAVA ?? 62),
  python: Number(process.env.JUDGE0_LANG_PYTHON ?? 71),
};

export interface ExecutionResult {
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'error';
  statusDescription: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeSeconds: number | null;
  memoryKb: number | null;
  expectedOutput: string | null;
}

export function executionConfigured(): boolean {
  const env = loadEnv();
  return Boolean(env.JUDGE0_URL);
}

function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}
function unb64(s: string | null | undefined) {
  return s ? Buffer.from(s, 'base64').toString('utf8') : '';
}

/** Compare outputs the way most judges do: trim trailing whitespace per line. */
export function outputsMatch(actual: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');
  return norm(actual) === norm(expected);
}

export async function executeCode(params: {
  language: WorkspaceLanguage;
  code: string;
  stdin: string;
  expectedOutput?: string | null;
}): Promise<ExecutionResult> {
  const env = loadEnv();
  if (!env.JUDGE0_URL) {
    throw AppError.notConfigured('Code execution is not configured on this deployment. Set JUDGE0_URL (and JUDGE0_KEY if required).');
  }
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (env.JUDGE0_KEY) {
    headers['X-RapidAPI-Key'] = env.JUDGE0_KEY;
    headers['X-Auth-Token'] = env.JUDGE0_KEY;
  }
  if (env.JUDGE0_HOST) headers['X-RapidAPI-Host'] = env.JUDGE0_HOST;

  const url = `${env.JUDGE0_URL.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        language_id: LANGUAGE_IDS[params.language],
        source_code: b64(params.code),
        stdin: b64(params.stdin),
        expected_output: params.expectedOutput ? b64(params.expectedOutput) : undefined,
        cpu_time_limit: 2,
        memory_limit: 256000,
      }),
    });
  } catch (err) {
    const aborted = (err as { name?: string }).name === 'AbortError';
    throw AppError.upstream(aborted ? 'The execution service timed out.' : 'Could not reach the execution service.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw AppError.upstream(`The execution service returned an error (${res.status}).`);
  }
  const data = (await res.json()) as {
    status?: { id: number; description: string };
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    time?: string | null;
    memory?: number | null;
  };

  const statusId = data.status?.id ?? 0;
  const stdout = unb64(data.stdout);
  // Judge0 status ids: 3 Accepted, 4 Wrong Answer, 5 TLE, 6 Compilation Error, 7-12 Runtime errors, 13 Internal, 14 Exec format
  let status: ExecutionResult['status'];
  if (statusId === 6) status = 'compile_error';
  else if (statusId === 5) status = 'time_limit';
  else if (statusId >= 7 && statusId <= 12) status = 'runtime_error';
  else if (statusId === 3) status = params.expectedOutput ? (outputsMatch(stdout, params.expectedOutput) ? 'accepted' : 'wrong_answer') : 'accepted';
  else if (statusId === 4) status = 'wrong_answer';
  else status = 'error';

  return {
    status,
    statusDescription: data.status?.description ?? 'Unknown',
    stdout,
    stderr: unb64(data.stderr),
    compileOutput: unb64(data.compile_output),
    timeSeconds: data.time ? Number(data.time) : null,
    memoryKb: data.memory ?? null,
    expectedOutput: params.expectedOutput ?? null,
  };
}
