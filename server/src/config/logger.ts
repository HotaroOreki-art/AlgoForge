import pino from 'pino';

const level =
  process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  base: { service: 'algoforge-api' },
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', 'passwordHash'],
});
