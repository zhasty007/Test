# Find a Great CT Attorney

Static website (built with [Eleventy](https://www.11ty.dev/)) that refers seriously injured people in Connecticut to independently top-rated attorneys, plus a daily AI agent that drafts short, factual posts about serious Connecticut accidents so people searching for those accidents find the site.

## How the accident agent works

1. **Collect.** Every morning a GitHub Action (`.github/workflows/accident-agent.yml`) pulls the Connecticut news RSS feeds listed in `agent/sources.js` and keeps items from the last 36 hours that mention a crash, collision, pedestrian strike, and so on.
2. **Extract.** Claude reads the headlines and snippets, keeps only serious-injury or fatal accidents in Connecticut, groups duplicate stories about the same crash, and pulls out the town, county, road, date, accident type, and severity. Names of people involved are never recorded.
3. **Dedupe.** `agent/state/seen.json` remembers incidents and source links already written about, so a crash is never posted twice.
4. **Draft.** Claude writes a short post from the extracted facts only (not the original article text), with a "What to do after a serious crash in Connecticut" section. Prompts are in `agent/prompts/`.
5. **Check.** `agent/validate.js` rejects drafts that look like they contain a person's name, have no sources, or use banned phrases ("best lawyer", "guarantee", "call us", and so on).
6. **Review.** New posts are committed to a branch and a pull request is opened listing each post and its sources. **Nothing is published until you merge the pull request.** Merging triggers `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages.

## One-time setup

1. **API key.** Repository Settings > Secrets and variables > Actions > New repository secret: `ANTHROPIC_API_KEY`.
2. **Optional model.** Add a repository *variable* `CLAUDE_MODEL` to override the default (`claude-opus-5-5`). `claude-sonnet-5-5` is cheaper.
3. **Let Actions open pull requests.** Settings > Actions > General > Workflow permissions: choose "Read and write permissions" and tick "Allow GitHub Actions to create and approve pull requests".
4. **GitHub Pages.** Settings > Pages > Source: "GitHub Actions". The deploy workflow publishes from the repository's default branch. For a custom domain, set it there and update `url` in `src/_data/site.json`.
5. **Site details.** Edit `src/_data/site.json`: `ratingSource` (the independent rating organization you rely on), `formAction` (where the contact form posts, for example a Formspree URL), phone, and email.
6. Run it once by hand: Actions > Daily accident agent > Run workflow.

## Reviewing a daily pull request

- Open each linked source and confirm the town, road, date, and injuries match.
- Make sure no one is named and nothing speculates about fault.
- Edit the Markdown file right in the pull request if needed, delete any post you don't want, then merge.

## Local development

```bash
npm install
npm start                                          # site at http://localhost:8080
npm test                                           # agent unit tests
ANTHROPIC_API_KEY=... npm run agent -- --dry-run   # print drafts without writing files
```

The lookback window and posts per run are in `agent/config.js` and can be overridden with the `LOOKBACK_HOURS` and `MAX_POSTS_PER_RUN` environment variables.

## Compliance notes (please review with Connecticut ethics counsel)

- Every page carries an "Attorney Advertising" label and disclaimer (CT Rules of Professional Conduct 7.1 and 7.2).
- Accident posts are general public information and never name or address people involved, to stay clear of direct solicitation (Rule 7.3).
- Comparative claims such as "the very best" should be tied to the named independent rating source (`ratingSource`).
- How referral fees or attorney payments are structured is regulated (Rule 7.2(b)); confirm the business model with counsel before launch.
- Posts summarize and link to news sources rather than copying them.
