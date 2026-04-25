#!/usr/bin/env node
// Verifies only one copy of react and react-dom is installed.
// Run via: node scripts/check-react-dedup.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const findPkg = (name) => {
  const results = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === ".cache" || e.name === ".vite") continue;
      const full = join(dir, e.name);
      if (e.isDirectory() || e.isSymbolicLink()) {
        try {
          const pkgPath = join(full, "package.json");
          const stat = statSync(pkgPath);
          if (stat.isFile()) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
            if (pkg.name === name) results.push({ path: full, version: pkg.version });
          }
        } catch {}
        if (e.name === "node_modules" || e.name.startsWith("@")) walk(full, depth + 1);
        else if (e.name.startsWith(".bun") || e.name.startsWith(".")) walk(full, depth + 1);
        else if (depth < 2) walk(full, depth + 1);
      }
    }
  };
  walk(join(ROOT, "node_modules"));
  // Dedup by resolved real path / version
  const seen = new Map();
  for (const r of results) {
    const key = `${r.version}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
};

let failed = false;
for (const name of ["react", "react-dom"]) {
  const copies = findPkg(name);
  if (copies.length === 0) {
    console.error(`✗ ${name}: not found`);
    failed = true;
  } else if (copies.length === 1) {
    console.log(`✓ ${name}@${copies[0].version} (single version)`);
  } else {
    console.error(`✗ ${name}: found ${copies.length} versions:`);
    for (const c of copies) console.error(`   - ${c.version} at ${c.path}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
