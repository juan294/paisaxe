import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPaths = ['.agents/skills/supabase/SKILL.md', '.claude/skills/supabase/SKILL.md'];
const publicRoles = /\b(?:anon|authenticated|public)\b/i;
const body = (source) => source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();

/** Offline guard for executable examples and the repository's migration guidance. */
export function checkGuidance(source, path) {
  const failures = [];
  const fail = (code, message) => failures.push({ path, code, message });
  const blocks = [...source.matchAll(/^```(sql|bash)\s*\r?\n([\s\S]*?)^```/gm)];
  for (const [, language, contents] of blocks) {
    if (language !== 'sql') continue;
    const sql = contents.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    for (const statement of sql.split(';')) {
      const grantsReads = /\bGRANT\s+(?:ALL(?:\s+PRIVILEGES)?|[\s\S]*?\bSELECT\b)[\s\S]*?\bON\s+(?:ALL\s+)?TABLES\b[\s\S]*?\bTO\s+([\s\S]*)/i.exec(statement);
      if (!grantsReads || !publicRoles.test(grantsReads[1])) continue;
      if (/\bALTER\s+DEFAULT\s+PRIVILEGES\b/i.test(statement)) {
        fail('public-default-grant', 'Remove blanket future-table read grants to public client roles; use explicit intended object/column grants.');
      } else if (/\bON\s+ALL\s+TABLES\s+IN\s+SCHEMA\b/i.test(statement)) {
        fail('public-schema-grant', 'Remove blanket schema read grants to public client roles.');
      }
    }
  }
  const local = /## Local migration testing\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(source)?.[1] ?? '';
  if (!/task-owned/.test(local)) fail('task-ownership-required', 'Require a disposable task-owned stack and preserve shared data.');
  if (!/supabase db reset --local/.test(local)) fail('local-reset-required', 'Local reset must explicitly select --local.');
  if (/\bsupabase\s+db\s+push\b/.test(local)) fail('remote-in-local-recipe', 'Keep remote db push outside the local testing recipe.');
  if (!/separately authorized/.test(source) || !/target inspection/.test(source)) {
    fail('remote-authority-required', 'Remote migration requires separate authorization after target inspection.');
  }
  const access = /## Access contracts\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(source)?.[1] ?? '';
  if (!/SQL grants permit operations/.test(access) || !/RLS policies constrain rows/.test(access)
    || !/positive/.test(access) || !/denial/.test(access) || !/column/.test(access)) {
    fail('access-contract-required', 'Explain grants separately from RLS and require allowed/denied role and column checks.');
  }
  const defaults = /## Default privileges\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(source)?.[1] ?? '';
  if (!/named owner/.test(defaults) || !/global/.test(defaults) || !/per-schema/.test(defaults)
    || !/pg_default_acl/.test(defaults) || !/future private/.test(defaults)) {
    fail('default-inventory-required', 'Document named-owner future defaults, both catalog scopes and a future private-table check.');
  }
  return failures;
}

export function checkRepositoryGuidance({ readFile = (path) => readFileSync(resolve(root, path), 'utf8') } = {}) {
  const failures = [];
  const sources = [];
  for (const path of skillPaths) {
    try {
      const source = readFile(path);
      sources.push(source);
      failures.push(...checkGuidance(source, path));
    } catch (error) {
      failures.push({ path, code: 'missing-skill', message: `Cannot read required skill: ${error.message}` });
    }
  }
  if (sources.length === 2 && body(sources[0]) !== body(sources[1])) {
    failures.push({ path: skillPaths.join(', '), code: 'skill-drift', message: 'Supabase skill bodies must agree across native runtimes.' });
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkRepositoryGuidance();
  if (failures.length) {
    for (const failure of failures) console.error(`${failure.path}: [${failure.code}] ${failure.message}`);
    process.exitCode = 1;
  } else {
    console.log(`Supabase guidance: ${skillPaths.length} installed skills passed (offline documentation check only).`);
  }
}
