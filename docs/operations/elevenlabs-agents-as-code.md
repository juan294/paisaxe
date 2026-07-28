# ElevenLabs Agents as Code

Agent and tool configurations are tracked in git via the `@elevenlabs/cli` package. Changes made in the ElevenLabs dashboard can be pulled down, reviewed, and pushed back — treating voice agent configs like any other source file.

## File Structure

```
agents.json              # Registry of all 5 Paisaxe agents with IDs
tools.json               # Registry of 3 production webhook tools
agent_configs/           # Full agent configuration JSON files (pulled from ElevenLabs)
  Paisaxe-Pelayo-(Visitor-Guide).json
  Paisaxe-Pelayo-(Booking).json
  Paisaxe-Penny-(Pinterest).json
  Paisaxe-Iris-(Instagram).json
  Paisaxe-Xander-(X).json
tool_configs/            # Full tool configuration JSON files
  search_places.json
  make_booking.json
  get_weather.json
```

## Agent Registry (`agents.json`)

| Agent | ID |
|-------|----|
| Pelayo (Visitor Guide) | `agent_1201kgqhsdzxfkk9x7m1bjaew9mv` |
| Pelayo (Booking) | `agent_5201kgm2956ge8ct95yxjas867z5` |
| Penny (Pinterest) | `agent_1601kg4wghnzewc9aqpkf4r2fkfw` |
| Iris (Instagram) | `agent_1301kg4wggmvfwgbx91h7sn2xsbh` |
| Xander (X) | `agent_5901kg4wgebce0abca4ssyav3684` |

## Scoped npm scripts

| Command | What it does |
|---------|-------------|
| `npm run agents:pull -- --agent pelayo --branch <exact-id>` | Pull exactly one registered Paisaxe branch |
| `npm run agents:status -- --agent pelayo --branch <exact-id>` | Compare one registered branch with its live readback |
| `npm run agents:push:dry -- --agent pelayo --branch <exact-id>` | Preview one branch update |
| `npm run agents:push -- --agent pelayo --branch <exact-id> --apply` | PATCH exactly one registered branch and verify the returned branch/version |
| `npm run tools:pull -- --tool search_places` | Pull exactly one registered Paisaxe tool |
| `npm run tools:push:dry -- --tool search_places` | Preview exactly one tool update |
| `npm run tools:push -- --tool search_places --apply` | PATCH exactly one tool and verify readback |

Broad agent or tool pushes are intentionally unavailable. The scoped agent
writer uses the API directly because ElevenLabs CLI 0.5.4 resolves
`--branch` but reads the top-level Main config instead of the registered
branch config. Never bypass the scoped writer for a branch update.

## Workflow

### Editing an agent

```bash
# 1. Pull current branch state
npm run agents:pull -- --agent pelayo --branch <exact-branch-id>

# 2. Edit the JSON config
code agent_configs/Paisaxe-Pelayo-\(Visitor-Guide\).json

# 3. Preview changes
npm run agents:push:dry -- --agent pelayo --branch <exact-branch-id>

# 4. Apply
npm run agents:push -- --agent pelayo --branch <exact-branch-id> --apply

# 5. Commit the updated JSON
git add agent_configs/ && git commit -m "chore: update Pelayo system prompt"
```

### Reviewing a dashboard change

If someone edits the agent in the ElevenLabs dashboard directly:

```bash
npm run agents:pull -- --agent pelayo --branch <exact-branch-id>
git diff agent_configs/
```

If the change is intentional, commit it. If not, revert and push.

## Authentication

The CLI and scoped writer read `ELEVENLABS_API_KEY` from the process
environment. Never put it in a tracked file or command output. Global login is
stored via:

```bash
npx elevenlabs auth login
```

## Branch and production gates

- Keep `agents.json` top-level `branch_id` and `version_id` on Main. Candidate
  branches live under each agent's `branches` map.
- Candidate branches remain at zero traffic until behavioral tests, signed
  production sessions, and first-word audio review all pass.
- Authentication and privacy are shared production settings. Do not enable
  signed-only auth or change recording/retention until the deployed app proves
  signed visitor and admin sessions immediately before cutover.
- A language preset may be exposed only when its voice ID resolves in the
  workspace and its first spoken word has been reviewed.

## Current limitations

The tracked workflow does not:

- Upload or manage knowledge base PDF files (must be done in the ElevenLabs dashboard)
- Create new agents or tools. Create them deliberately, then add the exact ID
  and config to the scoped registry.
- Prove accent, interruption behavior, or background-noise behavior through
  text simulation. Those require an audio session and listening evidence.

`save_favorite` is not registered or attached because
`https://paisaxe.es/api/mcp/save-favorite` returned 404 during the 2026-07-25
audit. Add it only after the production endpoint exists and passes an
authenticated contract test.

## What Changed vs Old Scripts

The following scripts were deprecated when the CLI workflow was adopted (March 2026) and should not be used:

- `scripts/check-pelayo-config.ts` → use `npm run agents:status`
- `scripts/fix-pelayo-agent.ts` → edit JSON + `npm run agents:push`
- `scripts/fix-pelayo-booking-tool.ts` → edit JSON + `npm run tools:push`
- `scripts/recreate-pelayo-agent.ts` → use ElevenLabs dashboard, then update `agents.json`
- `scripts/update-pelayo-prompt.ts` → edit `agent_configs/*.json` + `npm run agents:push`
