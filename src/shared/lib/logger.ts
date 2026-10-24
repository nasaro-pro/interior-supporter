// src/shared/lib/logger.ts (A)
import 'server-only';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? ORDER.info;

/** 허용 필드만. 개인정보·비밀값 필드를 추가하지 않는다 */
export interface LogFields {
  ref?: string;
  route?: string;
  action?: string;
  userId?: string;
  companyId?: string;
  projectId?: string;
  objectId?: string;
  code?: string;
  dbCode?: string;
  status?: number;
  durationMs?: number;
}

function write(level: Level, msg: string, fields: LogFields = {}) {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, f?: LogFields) => write('debug', msg, f),
  info: (msg: string, f?: LogFields) => write('info', msg, f),
  warn: (msg: string, f?: LogFields) => write('warn', msg, f),
  error: (msg: string, f?: LogFields) => write('error', msg, f),
};

/** 문의용 상관관계 ID (10자, 추측 불가) */
export const newRef = () => crypto.randomUUID().replaceAll('-', '').slice(0, 10);
