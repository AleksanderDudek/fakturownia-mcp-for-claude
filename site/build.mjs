#!/usr/bin/env node
// Builds the landing page into _site/ by injecting the current release
// version, download links and "what's new" notes into the HTML template.
// Zero dependencies — Node built-ins only.
//
// Sources (in priority order):
//   version : env SITE_VERSION (release tag) -> manifest.json > version
//   notes   : env SITE_NOTES  (release body) -> latest CHANGELOG.md section
//   repo    : env REPO ("owner/name")        -> fallback constant below
//
// The download button always points at the stable "latest release" asset URL,
// so it keeps working even between page rebuilds.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, "..");
const OUT = join(ROOT, "_site");

const FALLBACK_REPO = "AleksanderDudek/fakturownia-mcp-for-claude";
const ASSET = "fakturownia.mcpb";

const repo = (process.env.REPO || FALLBACK_REPO).trim();
const repoUrl = `https://github.com/${repo}`;
const downloadUrl = `${repoUrl}/releases/latest/download/${ASSET}`;
const releaseUrl = `${repoUrl}/releases/latest`;

// ---- Version ----
function readManifestVersion() {
  try {
    const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
    return m.version || "";
  } catch {
    return "";
  }
}
function stripV(v) {
  return (v || "").trim().replace(/^v/i, "");
}

// ---- Notes (+ version) from the latest CHANGELOG.md section ----
function latestChangelogSection() {
  let md;
  try {
    md = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  } catch {
    return { version: "", body: "" };
  }
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+\[/.test(l));
  if (start === -1) return { version: "", body: "" };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const version = (lines[start].match(/^##\s+\[([^\]]+)\]/) || [])[1] || "";
  // Drop the version header line itself; keep the body.
  const body = lines.slice(start + 1, end).join("\n").trim();
  return { version, body };
}

const changelog = latestChangelogSection();

// Version: release tag (authoritative) -> CHANGELOG (matches shown notes) -> manifest.
const version =
  stripV(process.env.SITE_VERSION) ||
  changelog.version ||
  readManifestVersion() ||
  "0.0.0";

const notesMd = (process.env.SITE_NOTES || "").trim() || changelog.body;

// ---- Minimal, safe Markdown -> HTML (headings + bullet lists + paragraphs) ----
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s) {
  // `code`, **bold**, and bare links — applied to already-escaped text.
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>');
}

function mdToHtml(md) {
  if (!md) return "<p>Zobacz pełną historię zmian na GitHubie.</p>";
  const out = [];
  let list = null;
  const flush = () => {
    if (list) {
      out.push(`<ul>${list.map((i) => `<li>${i}</li>`).join("")}</ul>`);
      list = null;
    }
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^#{2,4}\s+(.*)$/); // ### Dodane / ## ...
    if (h) {
      flush();
      out.push(`<h4>${inline(h[1])}</h4>`);
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      (list ||= []).push(inline(li[1]));
      continue;
    }
    // Continuation of a wrapped bullet: attach to the last list item.
    if (list && list.length) {
      list[list.length - 1] += " " + inline(line);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("\n");
}

// ---- Render ----
const tokens = {
  "{{VERSION}}": escapeHtml(version),
  "{{REPO_URL}}": repoUrl,
  "{{DOWNLOAD_URL}}": downloadUrl,
  "{{RELEASE_URL}}": releaseUrl,
  "{{WHATS_NEW}}": mdToHtml(notesMd),
};

let html = readFileSync(join(SITE, "index.html"), "utf8");
for (const [k, v] of Object.entries(tokens)) {
  html = html.split(k).join(v);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
copyFileSync(join(SITE, "styles.css"), join(OUT, "styles.css"));
copyFileSync(join(ROOT, "icon.png"), join(OUT, "icon.png"));

console.log(`Built _site/ — version v${version}, repo ${repo}`);
