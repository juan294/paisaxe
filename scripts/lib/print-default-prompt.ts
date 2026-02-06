/**
 * Prints the default prompt for an agent to stdout.
 * Called by shell scripts via: npx tsx scripts/lib/print-default-prompt.ts <flag_key>
 */
import { AGENT_PROMPT_DEFAULTS } from "../../src/config/agent-prompts";

const key = process.argv[2];
if (!key) {
  process.stderr.write("Usage: print-default-prompt.ts <flag_key>\n");
  process.exit(1);
}

const config = AGENT_PROMPT_DEFAULTS[key];
if (config) {
  process.stdout.write(config.prompt);
} else {
  process.stderr.write(`Unknown agent key: ${key}\n`);
  process.exit(1);
}
