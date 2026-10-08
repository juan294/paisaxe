import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkGuidance, checkRepositoryGuidance } from './check-supabase-guidance.mjs';

const skillPaths = ['.agents/skills/supabase/SKILL.md', '.claude/skills/supabase/SKILL.md'];
const guidance = () => readFileSync(new URL(`../${skillPaths[0]}`, import.meta.url), 'utf8');

test('both installed skills meet the local safety guidance contract', () => {
  assert.deepEqual(checkRepositoryGuidance(), []);
});

test('blanket future public SELECT grants are rejected regardless of whitespace or role order', () => {
  for (const sql of [
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;',
    'alter default privileges for role postgres\n in schema public grant select on tables to authenticated, anon;',
    'ALTER DEFAULT PRIVILEGES GRANT ALL PRIVILEGES ON TABLES TO PUBLIC;',
    'ALTER DEFAULT PRIVILEGES GRANT SELECT, INSERT ON TABLES TO authenticated;',
    'ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO "anon";',
  ]) {
    const failures = checkGuidance(`${guidance()}\n\n\`\`\`sql\n${sql}\n\`\`\``, 'fixture');
    assert.ok(failures.some(({ code }) => code === 'public-default-grant'), sql);
  }
});

test('blanket existing-schema public reads are rejected too', () => {
  const sql = 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;';
  assert.ok(checkGuidance(`${guidance()}\n\n\`\`\`sql\n${sql}\n\`\`\``, 'fixture')
    .some(({ code }) => code === 'public-schema-grant'));
});

test('remote push cannot appear in the local stack recipe', () => {
  const changed = guidance().replace('supabase db reset --local', 'supabase db reset --local\nsupabase db push');
  assert.ok(checkGuidance(changed, 'fixture').some(({ code }) => code === 'remote-in-local-recipe'));
});

test('reset must explicitly select local and the recipe must require task ownership', () => {
  const changed = guidance().replaceAll('--local', '').replaceAll('task-owned', 'shared');
  const failures = checkGuidance(changed, 'fixture');
  assert.ok(failures.some(({ code }) => code === 'local-reset-required'));
  assert.ok(failures.some(({ code }) => code === 'task-ownership-required'));
});

test('permission and RLS explanations cannot collapse into a postgres-only smoke check', () => {
  const changed = guidance().replace(/## Access contracts[\s\S]*?## Default privileges/, '## Default privileges');
  assert.ok(checkGuidance(changed, 'fixture').some(({ code }) => code === 'access-contract-required'));
});

test('default-privilege owner and both catalog scopes remain documented', () => {
  const changed = guidance().replace(/## Default privileges[\s\S]*?## Fallback Observability/, '## Fallback Observability');
  assert.ok(checkGuidance(changed, 'fixture').some(({ code }) => code === 'default-inventory-required'));
});

test('explicit object or column grants and narrowly scoped service defaults remain permitted', () => {
  const sql = `GRANT SELECT (id, title) ON public.public_articles TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role;`;
  assert.deepEqual(checkGuidance(`${guidance()}\n\n\`\`\`sql\n${sql}\n\`\`\``, 'fixture'), []);
});

test('SQL comments do not turn explanations or commented statements into executable grants', () => {
  const sql = `-- ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO anon;
/* GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated; */
GRANT SELECT (id) ON public.public_articles TO anon;`;
  assert.deepEqual(checkGuidance(`${guidance()}\n\n\`\`\`sql\n${sql}\n\`\`\``, 'fixture'), []);
});

test('missing or divergent installed skills fail repository checks', () => {
  const files = new Map(skillPaths.map((path) => [path, guidance()]));
  files.delete(skillPaths[1]);
  assert.ok(checkRepositoryGuidance({ readFile: (path) => {
    if (!files.has(path)) throw new Error('ENOENT');
    return files.get(path);
  } }).some(({ code }) => code === 'missing-skill'));
  files.set(skillPaths[1], `${guidance()}\nExtra conflicting guidance.`);
  assert.ok(checkRepositoryGuidance({ readFile: (path) => files.get(path) })
    .some(({ code }) => code === 'skill-drift'));
});
