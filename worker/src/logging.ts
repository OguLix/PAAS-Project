export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minimumLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

export type LogContext = Record<string, unknown>;

/** Structured JSON logs with a correlation id. Never log secrets. */
function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  if (SEVERITY[level] < SEVERITY[minimumLevel]) {
    return;
  }

  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  });

  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
