#!/usr/bin/env node

/**
 * Determines the next semver version from the current git branch name,
 * then updates every package.json in the monorepo.
 *
 * 1. Reads the current branch name
 * 2. Determines bump type: "major/*" → major, "minor/*" → minor, else → patch
 * 3. Collects the highest known version from local package.json and remote tags
 * 4. Bumps from that highest version, skipping any that already exist
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
  "apps/worker/package.json",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function getCurrentVersion() {
  const pkg = JSON.parse(
    readFileSync(resolve(ROOT, "package.json"), "utf-8"),
  );
  return pkg.version;
}

/** Single network call — returns a Set of version strings (without "v" prefix). */
function getRemoteTagVersions() {
  try {
    const output = git("ls-remote --tags origin");
    if (!output) return new Set();

    const versions = new Set();
    for (const line of output.split("\n")) {
      const match = line.match(/refs\/tags\/v(\d+\.\d+\.\d+)$/);
      if (match) {
        versions.add(match[1]);
      }
    }
    return versions;
  } catch {
    return new Set();
  }
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

/** Returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareSemver(a, b) {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

// ---------------------------------------------------------------------------
// Branch-based bump detection
// ---------------------------------------------------------------------------

function getBranchName() {
  return git("rev-parse --abbrev-ref HEAD");
}

function determineBumpType(branch) {
  if (branch.startsWith("major")) return "major";
  if (branch.startsWith("minor")) return "minor";
  return "patch";
}

// ---------------------------------------------------------------------------
// Version bumping
// ---------------------------------------------------------------------------

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

/**
 * Finds the highest version across local package.json and all remote tags.
 */
function findHighestVersion(local, remoteVersions) {
  let highest = local;
  for (const v of remoteVersions) {
    const parsed = parseSemver(v);
    if (compareSemver(parsed, highest) > 0) {
      highest = parsed;
    }
  }
  return highest;
}

/**
 * Starting from the highest known version, bump and increment until the
 * version doesn't exist in the remote tags.
 */
function findAvailableVersion(highest, bump, existingVersions) {
  let candidate = applyBump(highest, bump);

  while (existingVersions.has(formatVersion(candidate))) {
    candidate = applyBump(candidate, bump);
  }

  return candidate;
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

const currentVersion = getCurrentVersion();
const local = parseSemver(currentVersion);
const remoteVersions = getRemoteTagVersions();

const branch = getBranchName();
const bump = determineBumpType(branch);

const highest = findHighestVersion(local, remoteVersions);
const nextVersion = formatVersion(findAvailableVersion(highest, bump, remoteVersions));

if (dryRun) {
  console.error(`Branch:  ${branch}`);
  console.error(`Local:   ${currentVersion}`);
  console.error(`Highest: ${formatVersion(highest)}`);
  console.error(`Bump:    ${bump}`);
  console.error(`Next:    ${nextVersion}`);
  console.error(`Remote tags: ${remoteVersions.size}`);
} else {
  updatePackageVersions(nextVersion);
  console.error(`Bumped ${formatVersion(highest)} -> ${nextVersion} (${bump}, branch: ${branch})`);
  console.error(`Updated ${PACKAGE_PATHS.length} package.json files`);
}

// Last line of stdout is the version — CI captures this
console.log(nextVersion);
