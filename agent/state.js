import fs from "node:fs";

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function incidentKey(inc) {
  return [inc.incident_date, norm(inc.town), norm(inc.road), norm(inc.accident_type)].join("|");
}

export function loadState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    return { incidents: s.incidents ?? {}, urls: s.urls ?? {} };
  } catch {
    return { incidents: {}, urls: {} };
  }
}

export function saveState(file, state, retentionDays, now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays * 864e5).toISOString().slice(0, 10);
  const keep = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v.seen >= cutoff).sort());
  const out = { incidents: keep(state.incidents), urls: keep(state.urls) };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
}

// True if we already wrote about this incident, by key or by any shared source link.
export function alreadySeen(state, inc, links) {
  return Boolean(state.incidents[incidentKey(inc)]) || links.some((l) => state.urls[l]);
}

export function markSeen(state, inc, links, file, now = new Date()) {
  const seen = now.toISOString().slice(0, 10);
  state.incidents[incidentKey(inc)] = { seen, file };
  for (const l of links) state.urls[l] = { seen };
}
