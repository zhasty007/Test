// RSS feeds the agent scans each run. Add or remove freely; a feed that fails
// to load is logged and skipped so one broken source never stops a run.
export const FEEDS = [
  {
    name: "Google News: Connecticut crashes",
    url: "https://news.google.com/rss/search?q=Connecticut+(crash+OR+collision+OR+%22struck+by%22)+when:2d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "Google News: Connecticut State Police crash",
    url: "https://news.google.com/rss/search?q=%22Connecticut+State+Police%22+crash+when:2d&hl=en-US&gl=US&ceid=US:en",
  },
  { name: "NBC Connecticut", url: "https://www.nbcconnecticut.com/news/local/feed/" },
  { name: "WTNH News 8", url: "https://www.wtnh.com/feed/" },
  { name: "FOX61", url: "https://www.fox61.com/feeds/syndication/rss/news/local" },
  { name: "WFSB Channel 3", url: "https://www.wfsb.com/arc/outboundfeeds/rss/?outputType=xml" },
  { name: "Hartford Courant", url: "https://www.courant.com/feed/" },
];

// Cheap keyword prefilter so only likely accident stories reach Claude.
export const KEYWORDS = [
  "crash", "collision", "collided", "wreck", "rollover", "rolled over", "wrong-way", "wrong way",
  "pedestrian struck", "struck by", "hit by", "hit-and-run", "hit and run", "motorcycle", "tractor-trailer",
  "fatal", "killed", "seriously injured", "critically injured", "life-threatening", "injured",
  "dies after", "died after", "accident", "lifeflight", "life star",
];
