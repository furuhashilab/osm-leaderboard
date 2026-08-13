// Parses locally-saved https://hdyc.neis-one.org ("How Did You Contribute")
// snapshot pages and distills them into a small correction dataset the
// leaderboard uses to backfill All Time stats our own live aggregation
// can't fully cover (OSM API pagination is capped — see CLAUDE.md).
//
// Input:  HDCY2OSMlogs/HDYC2OpenStreetMap_<username>.html (saved via browser
//         "Save Page As" from a logged-in HDYC session; not committed, see
//         .gitignore — these are large personal exports, not source).
// Output: artifacts/osm-leaderboard/public/hdyc-corrections.json (small,
//         committed — this is what the frontend actually fetches).
//
// Run: pnpm --filter @workspace/scripts run extract-hdyc

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const INPUT_DIR = path.join(REPO_ROOT, "HDCY2OSMlogs");
const OUTPUT_PATH = path.join(REPO_ROOT, "artifacts/osm-leaderboard/public/hdyc-corrections.json");

const FILENAME_RE = /^HDYC2OpenStreetMap_(.+)\.html$/;
const CONTRIBUTOR_JSON_RE = /var contributor = (\{.*?\});/s;

interface HdycContributorJson {
  contributor: { name: string; since: string };
  waytags?: Record<string, string> | null;
  changesets: { no: string; changes: string };
}

interface Correction {
  asOf: string; // date the HDYC snapshot was saved (file mtime, approximate)
  since: string; // first-edit date, as reported by HDYC
  totalChangesets: number;
  totalChanges: number;
  buildingsCreated: number;
  buildingsModified: number;
}

function parseHdycFile(filePath: string): HdycContributorJson {
  const html = readFileSync(filePath, "utf-8");
  const match = html.match(CONTRIBUTOR_JSON_RE);
  if (!match) throw new Error(`No embedded "var contributor = {...}" JSON found in ${filePath}`);
  return JSON.parse(match[1]);
}

function toInt(value: string | undefined): number {
  return value ? parseInt(value, 10) || 0 : 0;
}

function main() {
  let files: string[];
  try {
    files = readdirSync(INPUT_DIR).filter(f => FILENAME_RE.test(f));
  } catch {
    console.error(`No ${INPUT_DIR} directory found — nothing to extract.`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`No HDYC2OpenStreetMap_*.html files found in ${INPUT_DIR}.`);
    process.exit(1);
  }

  const users: Record<string, Correction> = {};

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    const usernameFromFilename = file.match(FILENAME_RE)![1];

    let data: HdycContributorJson;
    try {
      data = parseHdycFile(filePath);
    } catch (err) {
      console.warn(`Skipping ${file}: ${(err as Error).message}`);
      continue;
    }

    if (data.contributor?.name && data.contributor.name.toLowerCase() !== usernameFromFilename.toLowerCase()) {
      console.warn(
        `${file}: filename says "${usernameFromFilename}" but the page is for "${data.contributor.name}" — using the filename as the key (must match users.yaml), double-check this file.`
      );
    }

    const asOf = statSync(filePath).mtime.toISOString().slice(0, 10);
    const waytags = data.waytags ?? {};

    users[usernameFromFilename] = {
      asOf,
      since: data.contributor?.since ?? "",
      totalChangesets: toInt(data.changesets?.no),
      totalChanges: toInt(data.changesets?.changes),
      buildingsCreated: toInt(waytags.c_building),
      buildingsModified: toInt(waytags.m_building),
    };

    console.log(`${usernameFromFilename}: ${users[usernameFromFilename].totalChangesets} changesets, ${users[usernameFromFilename].buildingsCreated + users[usernameFromFilename].buildingsModified} buildings (as of ${asOf})`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "https://hdyc.neis-one.org",
    users,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(users).length} user(s) to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`);
}

main();
