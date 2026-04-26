# Launchd Agent Configurations

macOS launchd plist files for scheduled agent runs.

## Installation

Copy the plist files to your LaunchAgents directory and load them:

```bash
cp scripts/launchd/*.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.paisaxe.*.plist
```

## Schedule

| Agent | Schedule | Description |
|-------|----------|-------------|
| coverage-agent | Daily 2:00 AM | Runs tests, identifies coverage gaps, writes new tests |
| cost-analyst-agent | Daily 3:00 AM | Queries billing APIs, detects spend anomalies |
| localization-agent | Sundays 7:00 AM | Ensures 100% translation coverage across all 6 locales |
| documentation-agent | Sundays 6:00 AM | Checks documentation freshness, updates stale docs |
| qa-agent | Sundays 8:00 AM | Runs LLM quality tests (requires dev server) |
| security-agent | Mondays 9:00 AM | Scans for vulnerabilities, analyzes exploitability |
| performance-agent | Saturdays 10:00 AM | Runs Lighthouse audits, tracks performance trends |
| cc-rpi-update | Daily 3:30 AM | Syncs cc-rpi blueprint updates into the project |

## Requirements

- macOS Full Disk Access permission for Terminal/bash (System Settings > Privacy & Security)
- Claude CLI installed at `~/.local/bin/claude`
- Project dependencies installed (`npm install`)

## Logs

Logs are written to `logs/` in the project directory:
- `*-launchd.log` - stdout
- `*-launchd-err.log` - stderr

## Manual Trigger

To run an agent immediately:

```bash
launchctl start com.paisaxe.coverage-agent
```

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.paisaxe.*.plist
rm ~/Library/LaunchAgents/com.paisaxe.*.plist
```
