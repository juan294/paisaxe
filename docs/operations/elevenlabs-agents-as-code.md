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

## npm Scripts

| Command | What it does |
|---------|-------------|
| `npm run agents:pull` | Pull latest agent configs from ElevenLabs into `agent_configs/` |
| `npm run agents:push:dry` | Preview what would change (dry run — no write) |
| `npm run agents:push` | Apply `agent_configs/` changes to ElevenLabs |
| `npm run agents:status` | Show drift between local files and remote |
| `npm run tools:pull` | Pull tool configs into `tool_configs/` |
| `npm run tools:push:dry` | Preview tool changes |
| `npm run tools:push` | Apply `tool_configs/` changes |

## Workflow

### Editing an agent

```bash
# 1. Pull current state
npm run agents:pull

# 2. Edit the JSON config
code agent_configs/Paisaxe-Pelayo-\(Visitor-Guide\).json

# 3. Preview changes
npm run agents:push:dry

# 4. Apply
npm run agents:push

# 5. Commit the updated JSON
git add agent_configs/ && git commit -m "chore: update Pelayo system prompt"
```

### Reviewing a dashboard change

If someone edits the agent in the ElevenLabs dashboard directly:

```bash
npm run agents:pull
git diff agent_configs/
```

If the change is intentional, commit it. If not, revert and push.

## Authentication

The CLI reads `ELEVENLABS_API_KEY` from the environment. Global login is stored via:

```bash
npx elevenlabs auth login
```

## Limitations

The CLI tracks configuration but **cannot**:

- Upload or manage knowledge base PDF files (must be done in the ElevenLabs dashboard)
- Manage voice settings (voice ID, stability, similarity) — these are configured in the dashboard
- Create new agents or tools (use the dashboard, then add the ID to `agents.json`)

## What Changed vs Old Scripts

The following scripts were deprecated when the CLI workflow was adopted (March 2026) and should not be used:

- `scripts/check-pelayo-config.ts` → use `npm run agents:status`
- `scripts/fix-pelayo-agent.ts` → edit JSON + `npm run agents:push`
- `scripts/fix-pelayo-booking-tool.ts` → edit JSON + `npm run tools:push`
- `scripts/recreate-pelayo-agent.ts` → use ElevenLabs dashboard, then update `agents.json`
- `scripts/update-pelayo-prompt.ts` → edit `agent_configs/*.json` + `npm run agents:push`
