#!/usr/bin/env node

/**
 * Generates a changelog entry from conventional commits since the last git tag
 * and prepends it to CHANGELOG.md.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs                 # auto-detect version from tag
 *   node scripts/generate-changelog.mjs --version 1.2.0 # explicit version
 *   node scripts/generate-changelog.mjs --dry           # print to stderr, don't write
 *
 * The version can be passed explicitly (e.g. from the bump-version script output)
 * or omitted to read from the root package.json.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CHANGELOG_PATH = resolve(ROOT, "CHANGELOG.md");

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function getLatestTag() {
  try {
    return git("describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function getCommitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const log = git(`log ${range} --pretty="format:%H %s"`);
  if (!log) return [];
  return log.split("\n").filter(Boolean).map((line) => {
    const spaceIdx = line.indexOf(" ");
    return {
      hash: line.slice(0, spaceIdx),
      message: line.slice(spaceIdx + 1),
    };
  });
}

// ---------------------------------------------------------------------------
// Commit classification
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "breaking", title: "Breaking Changes", pattern: /^[a-z]+(\(.+\))?!:|BREAKING CHANGE/ },
  { key: "feat", title: "Features", pattern: /^feat(\(.+\))?:/ },
  { key: "fix", title: "Bug Fixes", pattern: /^fix(\(.+\))?:/ },
  { key: "perf", title: "Performance", pattern: /^perf(\(.+\))?:/ },
  { key: "refactor", title: "Refactoring", pattern: /^refactor(\(.+\))?:/ },
  { key: "docs", title: "Documentation", pattern: /^docs(\(.+\))?:/ },
  { key: "test", title: "Tests", pattern: /^test(\(.+\))?:/ },
  { key: "ci", title: "CI/CD", pattern: /^ci(\(.+\))?:/ },
  { key: "chore", title: "Chores", pattern: /^chore(\(.+\))?:/ },
];

function classifyCommits(commits) {
  const groups = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]));
  groups.other = [];

  for (const commit of commits) {
    let matched = false;
    for (const cat of CATEGORIES) {
      if (cat.pattern.test(commit.message)) {
        groups[cat.key].push(commit);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.other.push(commit);
    }
  }

  return groups;
}

function formatCommit(commit) {
  // Strip the conventional commit prefix for cleaner display
  const cleaned = commit.message
    .replace(/^[a-z]+(\(.+?\))?!?:\s*/, "")
    .replace(/^./, (c) => c.toUpperCase());
  const shortHash = commit.hash.slice(0, 7);
  return `- ${cleaned} (${shortHash})`;
}

// ---------------------------------------------------------------------------
// Changelog generation
// ---------------------------------------------------------------------------

function generateEntry(version, groups) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`## [${version}] - ${date}`, ""];

  // Render categories that have entries, in order
  const allCategories = [
    ...CATEGORIES,
    { key: "other", title: "Other" },
  ];

  for (const cat of allCategories) {
    const entries = groups[cat.key];
    if (entries && entries.length > 0) {
      lines.push(`### ${cat.title}`, "");
      for (const commit of entries) {
        lines.push(formatCommit(commit));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function prependToChangelog(entry) {
  const header = "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";

  if (existsSync(CHANGELOG_PATH)) {
    const existing = readFileSync(CHANGELOG_PATH, "utf-8");
    // Insert after the header
    const headerEnd = existing.indexOf("\n## ");
    if (headerEnd !== -1) {
      const before = existing.slice(0, headerEnd);
      const after = existing.slice(headerEnd);
      writeFileSync(CHANGELOG_PATH, before + "\n" + entry + after, "utf-8");
    } else {
      // No existing entries — append after header
      writeFileSync(CHANGELOG_PATH, existing.trimEnd() + "\n\n" + entry, "utf-8");
    }
  } else {
    writeFileSync(CHANGELOG_PATH, header + entry, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");

let version;
const versionIdx = args.indexOf("--version");
if (versionIdx !== -1 && args[versionIdx + 1]) {
  version = args[versionIdx + 1];
} else {
  // Read from root package.json
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
  version = pkg.version;
}

const latestTag = getLatestTag();
const commits = getCommitsSince(latestTag);

if (commits.length === 0) {
  console.error("No commits found since last tag. Nothing to generate.");
  process.exit(1);
}

const groups = classifyCommits(commits);
const entry = generateEntry(version, groups);

if (dryRun) {
  console.error("--- Changelog entry (dry run) ---");
  console.error(entry);
} else {
  prependToChangelog(entry);
  console.error(`Changelog updated for v${version} (${commits.length} commits)`);
}
