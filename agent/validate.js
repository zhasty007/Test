// Last line of defense before a draft becomes a file. A draft that fails is
// skipped and reported in the PR, never published.

const NAME_PATTERNS = [
  /\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+/,
  // "Jane Doe, 34," or "John A. Smith, 52"
  /\b[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?,\s+(?:age\s+)?\d{1,3}\b/,
  /\b(?:identified as|was named as|named|victim was|driver was)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
];

const BANNED_PHRASES = [
  /\bbest (?:lawyer|attorney)s?\b/i,
  /\bguarantee/i,
  /\bsettlement\b/i,
  /\bif you (?:or a loved one )?were (?:involved|injured) in this\b/i,
  /\bcall (?:us|now)\b/i,
];

const REQUIRED = ["title", "description", "slug", "body_markdown"];

export function findNames(text) {
  return NAME_PATTERNS.map((re) => text.match(re)?.[0]).filter(Boolean);
}

// Swap em dashes for commas so posts match the site's plain style.
export function tidy(text) {
  return text.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, "-");
}

export function validateDraft(draft, incident, sources) {
  const problems = [];
  for (const key of REQUIRED) {
    if (!draft?.[key] || !String(draft[key]).trim()) problems.push(`missing ${key}`);
  }
  if (!sources?.length) problems.push("no sources");
  if (!incident?.town) problems.push("no town");
  if (incident?.county === "Unknown") problems.push("county unknown");

  const text = `${draft?.title ?? ""}\n${draft?.description ?? ""}\n${draft?.body_markdown ?? ""}`;
  for (const n of findNames(text)) problems.push(`possible personal name: "${n}"`);
  for (const re of BANNED_PHRASES) if (re.test(text)) problems.push(`banned phrase: ${re}`);
  if ((draft?.title ?? "").length > 100) problems.push("title too long");
  return problems;
}
