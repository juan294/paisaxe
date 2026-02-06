/**
 * Prints the shared context instructions (read + write) to stdout.
 * Called by shell scripts via: npx tsx scripts/lib/print-shared-context-instructions.ts [read|write]
 */
import { SHARED_CONTEXT_READ_INSTRUCTION, SHARED_CONTEXT_WRITE_INSTRUCTION } from "../../src/config/agent-prompts";

const mode = process.argv[2];
if (!mode || !["read", "write"].includes(mode)) {
  process.stderr.write("Usage: print-shared-context-instructions.ts <read|write>\n");
  process.exit(1);
}

if (mode === "read") {
  process.stdout.write(SHARED_CONTEXT_READ_INSTRUCTION);
} else {
  process.stdout.write(SHARED_CONTEXT_WRITE_INSTRUCTION);
}
