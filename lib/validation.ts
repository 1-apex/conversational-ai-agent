export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
}

export function isValidDob(value: string): boolean {
  const s = value.trim();
  const isSlashOrDash = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s);
  const isIso = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isSlashOrDash && !isIso) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d < now && d.getFullYear() >= now.getFullYear() - 120;
}
