/** Parse documented keys without interpreting values or reading the environment. */
export function parseEnvExampleKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const commented = trimmed.startsWith("# ");
    if (trimmed.startsWith("#") && !commented) continue;
    const assignment = commented ? trimmed.slice(2).trim() : trimmed;
    const equals = assignment.indexOf("=");
    if (equals < 0) continue;
    const key = assignment.slice(0, equals).trim();
    if (key && (!commented || /^[A-Z][A-Z0-9_]*$/.test(key))) keys.add(key);
  }
  return keys;
}
