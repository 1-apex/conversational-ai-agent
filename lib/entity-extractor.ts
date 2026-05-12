import { EntityMap } from "./types";

export const EMPTY_ENTITY_MAP: EntityMap = {
  names: [], companies: [], products: [],
  emails: [], phones: [], dates: [], prices: [],
};

export function mergeEntities(a: EntityMap, b: EntityMap): EntityMap {
  const merge = (x: string[], y: string[]) =>
    [...new Set([...x, ...y].map((s) => s.trim()).filter(Boolean))];
  return {
    names:     merge(a.names,     b.names),
    companies: merge(a.companies, b.companies),
    products:  merge(a.products,  b.products),
    emails:    merge(a.emails,    b.emails),
    phones:    merge(a.phones,    b.phones),
    dates:     merge(a.dates,     b.dates),
    prices:    merge(a.prices,    b.prices),
  };
}

export function extractEntities(text: string): EntityMap {
  return {
    emails:    extractEmails(text),
    phones:    extractPhones(text),
    prices:    extractPrices(text),
    dates:     extractDates(text),
    names:     extractNames(text),
    companies: extractCompanies(text),
    products:  extractProducts(text),
  };
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))];
}

function extractEmails(text: string): string[] {
  return unique(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []);
}

function extractPhones(text: string): string[] {
  const raw = text.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)?\d{3}[\s.\-]?\d{4}\b/g) ?? [];
  return unique(raw.filter((m) => m.replace(/\D/g, "").length >= 10));
}

function extractPrices(text: string): string[] {
  return unique(
    text.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:thousand|million|billion|k|m))?/gi) ?? []
  );
}

function extractDates(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/gi,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b(?:next|this|coming)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|quarter)/gi,
  ];
  for (const p of patterns) found.push(...(text.match(p) ?? []));
  return unique(found);
}

function extractNames(text: string): string[] {
  // Regex literals inside the function — recreated each call, no lastIndex leak
  const patterns = [
    /\b(?:i(?:'m| am)|this is|my name is)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b/gi,
    /\b(?:speak(?:ing)? with|talk(?:ing)? to|calling for|ask(?:ing)? for)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b/gi,
  ];
  const found: string[] = [];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) found.push(m[1]);
  }
  return unique(found);
}

function extractCompanies(text: string): string[] {
  const STOP = new Set(["The", "A", "An", "We", "Our", "Your", "Their", "This", "That", "Hi", "Hello"]);
  const patterns = [
    /\b([A-Z][a-zA-Z\s]{1,30}?)\s+(?:Inc\.?|LLC\.?|Corp\.?|Ltd\.?|Company|Solutions|Technologies|Services|Group|Partners)\b/g,
    /\b(?:calling from|i(?:'m| am) with|we(?:'re| are) at|i work at|from)\s+([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})?)/g,
  ];
  const found: string[] = [];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) found.push(m[1].trim());
  }
  return unique(found.filter((s) => s.length > 2 && !STOP.has(s)));
}

function extractProducts(text: string): string[] {
  const patterns = [
    /"([^"]{2,40})"/g,
    /\b(?:using|we use|currently using|switching from|migrate to|looking at|evaluating)\s+([A-Z][a-zA-Z]{1,25}(?:\s+[A-Z][a-zA-Z]{1,25})?)/g,
  ];
  const found: string[] = [];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) found.push(m[1].trim());
  }
  return unique(found.filter((s) => s.length > 1 && s.length < 40));
}
