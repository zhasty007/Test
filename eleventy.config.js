export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.addCollection("accidents", (api) =>
    api.getFilteredByGlob("src/posts/accidents/*.md").sort((a, b) => b.date - a.date)
  );

  // Unique sorted list of counties used by posts, for tag pages and filters.
  eleventyConfig.addCollection("counties", (api) => {
    const set = new Set();
    api.getFilteredByGlob("src/posts/accidents/*.md").forEach((p) => p.data.county && set.add(p.data.county));
    return [...set].sort();
  });

  eleventyConfig.addFilter("slug", (s = "") =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  );
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("ymd", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());
  eleventyConfig.addFilter("byCounty", (posts, county) => posts.filter((p) => p.data.county === county));
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
