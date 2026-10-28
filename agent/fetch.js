import Parser from "rss-parser";
import { KEYWORDS } from "./sources.js";

const parser = new Parser({
  timeout: 20000,
  customFields: { item: ["source"] },
  headers: { "User-Agent": "FindAGreatCTAttorneyBot/1.0 (+news summary agent)" },
});

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function looksLikeAccident(text) {
  const t = text.toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
}

export async function fetchCandidates(feeds, { since, max }) {
  const items = [];
  const seenLinks = new Set();

  for (const feed of feeds) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.warn(`  ! feed failed: ${feed.name}: ${err.message}`);
      continue;
    }
    let kept = 0;
    for (const it of parsed.items || []) {
      const published = new Date(it.isoDate || it.pubDate || 0);
      if (Number.isNaN(published.getTime()) || published < since) continue;
      const title = stripHtml(it.title);
      const snippet = stripHtml(it.contentSnippet || it.content || it.summary || "").slice(0, 600);
      if (!it.link || seenLinks.has(it.link) || !looksLikeAccident(`${title} ${snippet}`)) continue;
      seenLinks.add(it.link);
      // Google News items carry the publisher in <source>; fall back to the feed name.
      const src = typeof it.source === "object" ? it.source?._ : it.source;
      const source = src || it.creator || feed.name;
      items.push({ title, snippet, link: it.link, source, published: published.toISOString() });
      kept++;
    }
    console.log(`  ${feed.name}: ${kept} candidate(s)`);
  }

  items.sort((a, b) => b.published.localeCompare(a.published));
  return items.slice(0, max);
}
