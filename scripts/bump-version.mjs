#!/usr/bin/env node

/**
 * Determines the next semver version from conventional commits since the last
 * git tag, then updates every package.json in the monorepo.
 *
 * Usage:
 *   node scripts/bump-version.mjs          # auto-detect bump type
 *   node scripts/bump-version.mjs --dry    # print next version without writing
 *
 * Outputs the new version string to stdout (last line) so CI can capture it:
 *   VERSION=$(node scripts/bump-version.mjs)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const PACKAGE_PATHS = [
  "package.json",
  "packages/core/package.json",
  "packages/api-contract/package.json",
  "packages/db/package.json",
  "packages/cef/package.json",
  "apps/api/package.json",
  "apps/cli/package.json",
];

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
  const log = git(`log ${range} --pretty="format:%s"`);
  if (!log) return [];
  return log.split("\n").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Version parsing
// ---------------------------------------------------------------------------

function parseSemver(version) {
  const clean = version.replace(/^v/, "");
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Cannot parse semver from "${version}"`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

// ---------------------------------------------------------------------------
// Conventional commit analysis
// ---------------------------------------------------------------------------

function determineBumpType(commits) {
  let bump = "patch"; // default

  for (const msg of commits) {
    // Breaking change: `feat!:`, `fix!:`, or body contains BREAKING CHANGE
    if (/^[a-z]+(\(.+\))?!:/.test(msg) || msg.includes("BREAKING CHANGE")) {
      return "major";
    }
    if (/^feat(\(.+\))?:/.test(msg)) {
      bump = "minor";
    }
    // fix:, chore:, docs:, etc. stay as patch
  }

  return bump;
}

function applyBump(version, bump) {
  switch (bump) {
    case "major":
      return { major: version.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: version.major, minor: version.minor + 1, patch: 0 };
    case "patch":
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
      };
    default:
      throw new Error(`Unknown bump type: ${bump}`);
  }
}

// ---------------------------------------------------------------------------
// Package.json updates
// ---------------------------------------------------------------------------

function updatePackageVersions(newVersion) {
  for (const rel of PACKAGE_PATHS) {
    const abs = resolve(ROOT, rel);
    const pkg = JSON.parse(readFileSync(abs, "utf-8"));
    pkg.version = newVersion;
    writeFileSync(abs, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes("--dry");

const latestTag = getLatestTag();
const currentVersion = latestTag
  ? parseSemver(latestTag)
  : parseSemver("0.0.0");

const commits = getCommitsSince(latestTag);

if (commits.length === 0) {
  console.error("No commits found since last tag. Nothing to bump.");
  process.exit(1);
}

const bump = determineBumpType(commits);
const nextVersion = formatVersion(applyBump(currentVersion, bump));

if (dryRun) {
  console.error(`Current: ${formatVersion(currentVersion)}`);
  console.error(`Bump:    ${bump}`);
  console.error(`Next:    ${nextVersion}`);
  console.error(`Commits: ${commits.length}`);
} else {
  updatePackageVersions(nextVersion);
  console.error(`Bumped ${formatVersion(currentVersion)} -> ${nextVersion} (${bump})`);
  console.error(`Updated ${PACKAGE_PATHS.length} package.json files`);
}

// Last line of stdout is the version — CI captures this
console.log(nextVersion);
