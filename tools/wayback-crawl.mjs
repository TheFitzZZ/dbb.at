#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const WAYBACK_CDX = "https://web.archive.org/cdx";
const WAYBACK_REPLAY = "https://web.archive.org/web";

const DEFAULT_EXCLUDE = [
  "captcha",
  "favicon",
  "symbols/",
  "templates/.+\\.(?:css|gif|jpe?g|png|swf)$",
  "uploads/rss",
  "\\.(?:css|gif|ico|jpe?g|js|png|swf)(?:$|[?#])",
].join("|");

const HELP = `
Usage:
  npm run wayback:crawl -- [options]

Examples:
  npm run wayback:crawl -- --search DEEJAY,master,FitzZZ --include "modules/(newbb|news|smartsection)|mod=board|mod=users"
  npm run wayback:crawl -- --pattern "http://www.dbb.at:80/aurora3/modules/newbb/*" --candidate-min-count 2
  npm run wayback:crawl -- --renderer camoufox --search DEEJAY --max-pages 50
  npm run wayback:camoufox:fetch

Options:
  --domain <domain>          Same-site domain for link discovery. Default: dbb.at
  --root <host>              CDX root to query. Repeatable. Default: dbb.at and www.dbb.at
  --pattern <cdx-pattern>    Exact CDX url pattern to query. Repeatable. Overrides --root discovery.
  --from <year>              First Wayback year. Default: 1998
  --to <year>                Last Wayback year. Default: current year
  --out <dir>                Cache/output directory. Default: .wayback-cache/dbb-at
  --renderer <fetch|camoufox>  HTML renderer. Default: fetch
  --search <a,b,c>           Comma-separated search terms to report with snippets.
  --no-candidates            Disable nickname candidate mining. Candidate mining is on by default.
  --candidate-min-count <n>   Minimum source pages for candidates.md. Default: 1
  --include <regex>          Only crawl original URLs matching this regex.
  --exclude <regex>          Skip original URLs matching this regex. Default skips assets/noise.
  --discover-links           Extract same-domain links from fetched pages and query their snapshots.
  --max-discovered <n>       Max new original URLs to add via --discover-links. Default: 500
  --max-pages <n>            Stop after n pages. 0 means no limit. Default: 0
  --delay-ms <n>             Delay between replay fetches. Default: 750
  --timeout-ms <n>           Per-request timeout. Default: 30000
  --help                     Show this help.

Notes:
  The Camoufox renderer requires optional dependencies plus the browser download:
    npm install
    npm run wayback:camoufox:fetch
`;

function parseArgs(argv) {
  const options = {
    domain: "dbb.at",
    roots: [],
    patterns: [],
    from: "1998",
    to: String(new Date().getFullYear()),
    out: path.join(".wayback-cache", "dbb-at"),
    renderer: "fetch",
    search: [],
    candidates: true,
    candidateMinCount: 1,
    include: null,
    exclude: DEFAULT_EXCLUDE,
    discoverLinks: false,
    maxDiscovered: 500,
    maxPages: 0,
    delayMs: 750,
    timeoutMs: 30000,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--domain") {
      options.domain = next();
    } else if (arg === "--root") {
      options.roots.push(next());
    } else if (arg === "--pattern") {
      options.patterns.push(next());
    } else if (arg === "--from") {
      options.from = next();
    } else if (arg === "--to") {
      options.to = next();
    } else if (arg === "--out") {
      options.out = next();
    } else if (arg === "--renderer") {
      options.renderer = next();
    } else if (arg === "--search") {
      options.search.push(...splitList(next()));
    } else if (arg === "--no-candidates") {
      options.candidates = false;
    } else if (arg === "--candidate-min-count") {
      options.candidateMinCount = Number(next());
    } else if (arg === "--include") {
      options.include = next();
    } else if (arg === "--exclude") {
      options.exclude = next();
    } else if (arg === "--discover-links") {
      options.discoverLinks = true;
    } else if (arg === "--max-discovered") {
      options.maxDiscovered = Number(next());
    } else if (arg === "--max-pages") {
      options.maxPages = Number(next());
    } else if (arg === "--delay-ms") {
      options.delayMs = Number(next());
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(next());
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.roots.length) {
    options.roots = [options.domain, `www.${options.domain}`];
  }

  if (!["fetch", "camoufox"].includes(options.renderer)) {
    throw new Error("--renderer must be either fetch or camoufox");
  }

  return options;
}

function splitList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function compileRegex(pattern) {
  return pattern ? new RegExp(pattern, "i") : null;
}

async function fetchJson(url, timeoutMs) {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "dbb-wayback-crawler/1.0 (+local archival research)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function cdxQuery(urlPattern, options) {
  const url = new URL(WAYBACK_CDX);
  url.searchParams.set("url", urlPattern);
  url.searchParams.set("from", options.from);
  url.searchParams.set("to", options.to);
  url.searchParams.set("output", "json");
  url.searchParams.set("fl", "timestamp,original,mimetype,statuscode,digest");
  url.searchParams.append("filter", "statuscode:200");
  url.searchParams.set("collapse", "digest");

  const json = await fetchJson(url, options.timeoutMs);
  return json.slice(1).map((row) => ({
    timestamp: row[0],
    original: decodeHtml(row[1]),
    mimetype: row[2] || "",
    statuscode: row[3] || "",
    digest: row[4] || "",
  }));
}

async function discoverInitialSnapshots(options) {
  const rows = [];
  const seen = new Set();
  const patterns = options.patterns.length
    ? options.patterns
    : options.roots.flatMap((root) => [`${root}/*`, `${root}/`]);

  for (const pattern of patterns) {
    let result;

    try {
      result = await cdxQuery(pattern, options);
    } catch (error) {
      console.warn(`CDX query failed for ${pattern}: ${error.message}`);
      continue;
    }

    for (const row of result) {
      const key = rowKey(row);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row);
      }
    }
  }

  return rows;
}

function rowKey(row) {
  return `${row.timestamp} ${row.original}`;
}

function shouldCrawl(row, includeRegex, excludeRegex) {
  if (!row.mimetype.toLowerCase().startsWith("text/html")) {
    return false;
  }

  if (includeRegex && !includeRegex.test(row.original)) {
    return false;
  }

  if (excludeRegex && excludeRegex.test(row.original)) {
    return false;
  }

  return true;
}

function archiveUrl(row) {
  return `${WAYBACK_REPLAY}/${row.timestamp}id_/${row.original}`;
}

async function createRenderer(options) {
  if (options.renderer === "fetch") {
    return {
      html: (url) => fetchText(url, options.timeoutMs),
      close: async () => {},
    };
  }

  let launchOptions;
  let firefox;

  try {
    ({ launchOptions } = await import("camoufox-js"));
    ({ firefox } = await import("playwright-core"));
  } catch (error) {
    throw new Error(
      `Camoufox renderer is unavailable. Run npm install and npm run wayback:camoufox:fetch. ${error.message}`,
    );
  }

  const browser = await firefox.launch({
    ...(await launchOptions()),
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    html: async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
      return page.content();
    },
    close: async () => {
      await browser.close();
    },
  };
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(tr|td|th|p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return named[entity.toLowerCase()] ?? match;
  });
}

function pageId(row) {
  const hash = createHash("sha1").update(rowKey(row)).digest("hex").slice(0, 12);
  return `${row.timestamp}-${hash}`;
}

function findHits(text, terms, contextLength = 180) {
  const hits = [];
  const lower = text.toLowerCase();

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index === -1) {
      continue;
    }

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + term.length + contextLength);
    hits.push({
      term,
      snippet: text.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }

  return hits;
}

const CANDIDATE_STOP_WORDS = new Set([
  "active",
  "admin",
  "administrator",
  "all",
  "anonymous",
  "archive",
  "aurora",
  "beginner",
  "benutzer",
  "board",
  "clan",
  "clanwar",
  "comment",
  "contact",
  "default",
  "download",
  "email",
  "forum",
  "gallery",
  "guest",
  "home",
  "homepage",
  "image",
  "login",
  "member",
  "members",
  "message",
  "nachricht",
  "news",
  "nick",
  "none",
  "password",
  "profile",
  "register",
  "registration",
  "search",
  "statistics",
  "stats",
  "system",
  "topic",
  "user",
  "users",
  "view",
  "wohlfinden",
]);

function extractCandidates(text, html) {
  const candidates = [];

  collectRegexCandidates(candidates, text, /\bdbB\s*\+\s*([A-Za-z0-9ÄÖÜäöüß^][A-Za-z0-9ÄÖÜäöüß^_.\s-]{1,45})/gi, "dbB tag", 1, true);
  collectRegexCandidates(candidates, text, /\bNick\s*(?:\||:)?\s*([A-Za-z0-9ÄÖÜäöüß^_.+-]{2,32})/gi, "Nick field");
  collectRegexCandidates(candidates, text, /\bBenutzer\s*-\s*([A-Za-z0-9ÄÖÜäöüß^_.+-]{2,32})\b/gi, "profile heading");
  collectRegexCandidates(candidates, text, /neustes Mitglied:\s*([A-Za-z0-9ÄÖÜäöüß^_.+-]{2,32})/gi, "newest member");
  collectActiveUsers(candidates, text);
  collectAnchorCandidates(candidates, html);

  return dedupeCandidates(candidates);
}

function collectRegexCandidates(candidates, text, regex, source, groupIndex = 1, hasDbBPrefix = false) {
  let match;
  while ((match = regex.exec(text))) {
    const raw = match[groupIndex];
    addCandidate(candidates, raw, source, match.index, text, hasDbBPrefix);
  }
}

function collectActiveUsers(candidates, text) {
  const regex = /Aktivste Benutzer\s*(?:\||:)?\s*([^\n|]+)/gi;
  let match;

  while ((match = regex.exec(text))) {
    for (const part of match[1].split(/,|;/)) {
      const name = part.replace(/\([^)]*\)/g, " ").trim();
      addCandidate(candidates, name, "active users", match.index, text, false);
    }
  }
}

function collectAnchorCandidates(candidates, html) {
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html))) {
    const attrs = match[1];
    if (!/(?:mod=users|userinfo\.php|action=profile|action=view|\/profile\/)/i.test(attrs)) {
      continue;
    }

    const label = htmlToText(match[2]).replace(/\s+/g, " ").trim();
    addCandidate(candidates, label, "profile link", match.index, htmlToText(html), false);
  }
}

function addCandidate(candidates, rawName, source, index, text, hasDbBPrefix) {
  const normalized = normalizeCandidate(rawName, hasDbBPrefix);
  if (!normalized || !isPlausibleCandidate(normalized)) {
    return;
  }

  candidates.push({
    name: normalized,
    source,
    snippet: snippetAt(text, index, 140),
  });
}

function normalizeCandidate(rawName, hasDbBPrefix = false) {
  let name = decodeHtml(rawName)
    .replace(/\s+/g, " ")
    .replace(/\s*<\s*TR\b/i, " <TR")
    .replace(/\bNachricht\b.*$/i, "")
    .replace(/\bBenutzer\b.*$/i, "")
    .replace(/\b\d+\s*(?:Beiträge|Kommentare|Posts?)\b.*$/i, "")
    .replace(/[|:;,()[\]{}]+$/g, "")
    .trim();

  if (hasDbBPrefix) {
    name = name.replace(/\s{2,}.*/, "").trim();
    name = name.split(/\s+(?:Unser|Der|Die|Ein|Eine|Er|Sie|Es|und|with|from)\b/i)[0].trim();
    name = collapseRepeatedName(name);
    name = `dbB+${name.replace(/^\+/, "").trim()}`;
  }

  return name;
}

function collapseRepeatedName(name) {
  const tokens = name.split(/\s+/).filter(Boolean);

  if (tokens.length > 1 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    const left = tokens.slice(0, half).join(" ").toLowerCase();
    const right = tokens.slice(half).join(" ").toLowerCase();

    if (left === right) {
      return tokens.slice(0, half).join(" ");
    }
  }

  return name;
}

function isPlausibleCandidate(name) {
  const plain = name.replace(/^dbB\+\s*/i, "").trim();
  const lower = plain.toLowerCase();

  if (plain.length < 2 || plain.length > 40) {
    return false;
  }

  if (CANDIDATE_STOP_WORDS.has(lower)) {
    return false;
  }

  if (/^(?:http|www\.|\.com|\.at)/i.test(plain)) {
    return false;
  }

  if (!/[A-Za-zÄÖÜäöüß]/.test(plain)) {
    return false;
  }

  if (/^dbB\+/i.test(name) && /[.!?]/.test(plain)) {
    return false;
  }

  if (/^dbB\+/i.test(name) && /^[a-zäöüß]/.test(plain) && /\s/.test(plain)) {
    return false;
  }

  if (/\s/.test(plain) && !/^dbB\+/i.test(name) && plain.split(/\s+/).length > 2) {
    return false;
  }

  return true;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const deduped = [];

  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()} ${candidate.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(candidate);
    }
  }

  return deduped;
}

function snippetAt(text, index, contextLength = 160) {
  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + contextLength);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function recordCandidates(aggregate, page, candidates) {
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();

    if (!aggregate.has(key)) {
      aggregate.set(key, {
        name: candidate.name,
        sources: new Set(),
        evidence: [],
      });
    }

    const entry = aggregate.get(key);
    entry.sources.add(page.original);
    entry.evidence.push({
      source: candidate.source,
      timestamp: page.timestamp,
      original: page.original,
      replayUrl: page.replayUrl,
      snippet: candidate.snippet,
    });
  }
}

async function writeCandidatesReport(file, aggregate, minCount) {
  const entries = [...aggregate.values()]
    .filter((entry) => entry.sources.size >= minCount)
    .sort((a, b) => b.sources.size - a.sources.size || a.name.localeCompare(b.name));

  let markdown = "# Candidate Member Names\n\n";
  markdown += "These are automatically mined nickname-like strings. Treat them as review candidates, not verified members.\n\n";
  markdown += `Minimum source pages: ${minCount}\n\n`;
  markdown += "| Candidate | Source pages | Evidence types | First evidence |\n";
  markdown += "| --- | ---: | --- | --- |\n";

  for (const entry of entries) {
    const first = entry.evidence[0];
    const types = [...new Set(entry.evidence.map((item) => item.source))].join(", ");
    markdown += `| ${escapeMarkdownTable(entry.name)} | ${entry.sources.size} | ${escapeMarkdownTable(types)} | ${first.timestamp} ${escapeMarkdownTable(first.original)} |\n`;
  }

  markdown += "\n## Evidence\n\n";

  for (const entry of entries) {
    markdown += `### ${entry.name}\n\n`;

    for (const evidence of entry.evidence.slice(0, 8)) {
      markdown += `- ${evidence.timestamp} ${evidence.original}\n`;
      markdown += `  - Type: ${evidence.source}\n`;
      markdown += `  - Replay: ${evidence.replayUrl}\n`;
      markdown += `  - Snippet: ${evidence.snippet}\n`;
    }

    if (entry.evidence.length > 8) {
      markdown += `- ... ${entry.evidence.length - 8} more evidence rows\n`;
    }

    markdown += "\n";
  }

  await writeFile(file, markdown, "utf8");
}

function escapeMarkdownTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function extractOriginalLinks(html, baseOriginal, domain) {
  const links = new Set();
  const hrefPattern = /\bhref\s*=\s*(["'])(.*?)\1/gi;
  let match;

  while ((match = hrefPattern.exec(html))) {
    const original = toOriginalUrl(match[2], baseOriginal);

    if (!original) {
      continue;
    }

    try {
      const parsed = new URL(original);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (host === domain || host.endsWith(`.${domain}`)) {
        parsed.hash = "";
        links.add(parsed.toString());
      }
    } catch {
      // Ignore malformed links in archived HTML.
    }
  }

  return [...links];
}

function toOriginalUrl(href, baseOriginal) {
  const trimmed = href.trim();

  if (!trimmed || /^(?:#|javascript:|mailto:|tel:)/i.test(trimmed)) {
    return null;
  }

  const replayMatch = trimmed.match(/\/web\/\d+(?:[a-z_]+)?\/(https?:\/\/[^\s"'<>]+)/i);
  if (replayMatch) {
    return replayMatch[1];
  }

  try {
    return new URL(trimmed, baseOriginal).toString();
  } catch {
    return null;
  }
}

async function appendJsonl(file, value) {
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP.trim());
    return;
  }

  const includeRegex = compileRegex(options.include);
  const excludeRegex = compileRegex(options.exclude);
  const domain = options.domain.toLowerCase().replace(/^www\./, "");
  const outputDir = path.resolve(options.out);
  const pagesDir = path.join(outputDir, "pages");
  const textDir = path.join(outputDir, "text");
  const manifestFile = path.join(outputDir, "manifest.jsonl");
  const errorsFile = path.join(outputDir, "errors.jsonl");
  const hitsJsonlFile = path.join(outputDir, "hits.jsonl");
  const hitsMarkdownFile = path.join(outputDir, "hits.md");
  const candidateEvidenceFile = path.join(outputDir, "candidate-evidence.jsonl");
  const candidatesMarkdownFile = path.join(outputDir, "candidates.md");
  const discoveredFile = path.join(outputDir, "discovered-links.txt");

  await mkdir(pagesDir, { recursive: true });
  await mkdir(textDir, { recursive: true });
  await writeFile(manifestFile, "", "utf8");
  await writeFile(errorsFile, "", "utf8");
  await writeFile(hitsJsonlFile, "", "utf8");
  await writeFile(hitsMarkdownFile, `# Wayback Hits\n\nSearch terms: ${options.search.join(", ") || "(none)"}\n\n`, "utf8");
  await writeFile(candidateEvidenceFile, "", "utf8");
  await writeFile(candidatesMarkdownFile, "# Candidate Member Names\n\nNo pages processed yet.\n", "utf8");
  await writeFile(discoveredFile, "", "utf8");

  console.log(`Discovering CDX snapshots for: ${options.roots.join(", ")}`);
  const initialRows = await discoverInitialSnapshots(options);
  const queue = initialRows.filter((row) => shouldCrawl(row, includeRegex, excludeRegex));
  const seenRows = new Set(queue.map(rowKey));
  const seenOriginals = new Set(queue.map((row) => row.original));
  const renderer = await createRenderer(options);
  const stats = { processed: 0, failed: 0, hits: 0, candidates: 0, discovered: 0 };
  const candidateAggregate = new Map();

  console.log(`Queued ${queue.length} HTML snapshots after filters (${initialRows.length} discovered before filters).`);

  try {
    for (let index = 0; index < queue.length; index += 1) {
      if (options.maxPages && stats.processed >= options.maxPages) {
        break;
      }

      const row = queue[index];
      const replayUrl = archiveUrl(row);
      const id = pageId(row);
      const htmlPath = path.join(pagesDir, `${id}.html`);
      const textPath = path.join(textDir, `${id}.txt`);

      await delay(options.delayMs);

      try {
        const html = await renderer.html(replayUrl);
        const text = htmlToText(html);
        const hits = findHits(text, options.search);
        const candidates = options.candidates ? extractCandidates(text, html) : [];

        await writeFile(htmlPath, html, "utf8");
        await writeFile(textPath, text, "utf8");
        await appendJsonl(manifestFile, {
          id,
          timestamp: row.timestamp,
          original: row.original,
          replayUrl,
          mimetype: row.mimetype,
          digest: row.digest,
          htmlPath: path.relative(outputDir, htmlPath),
          textPath: path.relative(outputDir, textPath),
          hits: hits.map((hit) => hit.term),
          candidates: candidates.map((candidate) => candidate.name),
        });

        for (const hit of hits) {
          stats.hits += 1;
          const record = {
            id,
            term: hit.term,
            timestamp: row.timestamp,
            original: row.original,
            replayUrl,
            snippet: hit.snippet,
          };
          await appendJsonl(hitsJsonlFile, record);
          await appendFile(
            hitsMarkdownFile,
            `## ${hit.term}\n\n- Capture: ${row.timestamp}\n- Original: ${row.original}\n- Replay: ${replayUrl}\n- Cache: ${path.relative(outputDir, textPath)}\n\n> ${hit.snippet}\n\n`,
            "utf8",
          );
        }

        if (candidates.length) {
          stats.candidates += candidates.length;
          const page = { timestamp: row.timestamp, original: row.original, replayUrl };
          recordCandidates(candidateAggregate, page, candidates);

          for (const candidate of candidates) {
            await appendJsonl(candidateEvidenceFile, {
              name: candidate.name,
              source: candidate.source,
              timestamp: row.timestamp,
              original: row.original,
              replayUrl,
              snippet: candidate.snippet,
            });
          }
        }

        if (options.discoverLinks && stats.discovered < options.maxDiscovered) {
          for (const link of extractOriginalLinks(html, row.original, domain)) {
            if (stats.discovered >= options.maxDiscovered || seenOriginals.has(link)) {
              continue;
            }

            seenOriginals.add(link);
            await appendFile(discoveredFile, `${link}\n`, "utf8");
            const discoveredRows = await cdxQuery(link, options);

            for (const discoveredRow of discoveredRows) {
              const key = rowKey(discoveredRow);
              if (!seenRows.has(key) && shouldCrawl(discoveredRow, includeRegex, excludeRegex)) {
                seenRows.add(key);
                queue.push(discoveredRow);
              }
            }

            stats.discovered += 1;
          }
        }

        stats.processed += 1;
      } catch (error) {
        stats.failed += 1;
        await appendJsonl(errorsFile, {
          timestamp: row.timestamp,
          original: row.original,
          replayUrl,
          error: error.message,
        });
      }

      if ((stats.processed + stats.failed) % 25 === 0) {
        console.log(`Progress: processed=${stats.processed} failed=${stats.failed} hits=${stats.hits} candidates=${candidateAggregate.size} queue=${queue.length}`);
      }
    }
  } finally {
    await renderer.close();
  }

  if (options.candidates) {
    await writeCandidatesReport(candidatesMarkdownFile, candidateAggregate, options.candidateMinCount);
  }

  console.log(`Done. processed=${stats.processed} failed=${stats.failed} hits=${stats.hits} candidates=${candidateAggregate.size} discovered=${stats.discovered}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
