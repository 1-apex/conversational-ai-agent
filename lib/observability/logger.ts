// Structured logger with an allowlist: a field not listed here is dropped, so
// transcripts and other caller content can't reach logs by accident. Raw error
// messages are excluded too, because provider errors can echo the request.
const ALLOWED_FIELDS = new Set([
  "route", "status", "durationMs", "code", "provider", "attempt", "errorName", "issuePaths",
]);

export type LogFields = Record<string, unknown>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createLogger(correlationId: string): Logger {
  const write = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) => {
    const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.has(key)));
    console[level](JSON.stringify({ level, event, correlationId, ...safe }));
  };
  return {
    info:  (event, fields) => write("info", event, fields),
    warn:  (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
