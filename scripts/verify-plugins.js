/**
 * Plugin Framework Verification Script
 *
 * This script performs basic static validation of plugin definitions.
 * Run with: node scripts/verify-plugins.js
 */

const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listPluginFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listPluginFiles(p));
    else if (e.isFile() && p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function validatePluginModuleText(filePath, text) {
  // This is intentionally a lightweight check (no TS compilation).
  // Ensures plugin file looks like it exports an IPlugin with metadata/functions/execute.
  assert(/export\s+const\s+\w+Plugin\s*:\s*IPlugin\s*=/.test(text) || /export\s+const\s+\w+\s*=\s*{/.test(text), `${filePath}: missing exported plugin const`);
  assert(/metadata\s*:/.test(text), `${filePath}: missing metadata`);
  assert(/functions\s*:/.test(text), `${filePath}: missing functions`);
  assert(/execute\s*\(/.test(text), `${filePath}: missing execute()`);
}

console.log("🔍 Plugin Framework Verification\n");

const builtinDir = path.join(process.cwd(), "src", "plugins", "builtin");
const exampleDir = path.join(process.cwd(), "plugins", "examples");

const pluginFiles = [
  ...listPluginFiles(builtinDir),
  ...(fs.existsSync(exampleDir) ? listPluginFiles(exampleDir) : []),
];

const seenFunctionNames = new Map(); // fnName -> file
for (const file of pluginFiles) {
  const text = fs.readFileSync(file, "utf8");
  validatePluginModuleText(file, text);

  // Best-effort: find function name strings in the functions array.
  // Only treat "name:" keys inside the functions array as tool names.
  // This avoids counting plugin metadata.name or other "name" fields.
  const fnMatches = [...text.matchAll(/functions\s*:\s*\[[\s\S]*?name:\s*["']([a-zA-Z0-9_-]+)["']/g)].map((m) => m[1]);
  for (const fn of fnMatches) {
    if (!seenFunctionNames.has(fn)) seenFunctionNames.set(fn, file);
    else {
      const prev = seenFunctionNames.get(fn);
      throw new Error(`Function name collision "${fn}" between:\n- ${prev}\n- ${file}`);
    }
  }
}

console.log("✅ Plugin files validated:");
for (const file of pluginFiles) console.log(`   - ${path.relative(process.cwd(), file)}`);

console.log("\n✨ Verification completed successfully.");



