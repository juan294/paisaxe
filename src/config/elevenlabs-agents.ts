/**
 * ElevenLabs Agent IDs
 *
 * These IDs are populated by running: npx ts-node scripts/setup-elevenlabs-agents.ts
 * After running the setup script, these values will be automatically updated.
 *
 * Until then, the voice chat will fall back to text mode.
 */

export const ELEVENLABS_AGENT_IDS = {
  xander: "", // Will be populated after running setup script
  iris: "", // Will be populated after running setup script
  penny: "", // Will be populated after running setup script
  tiko: "", // Will be populated after running setup script
} as const;

export type ElevenLabsAgentId = keyof typeof ELEVENLABS_AGENT_IDS;

/**
 * Check if ElevenLabs agents are configured
 */
export function areAgentsConfigured(): boolean {
  return Object.values(ELEVENLABS_AGENT_IDS).some((id) => id.length > 0);
}

/**
 * Get the ElevenLabs agent ID for a given agent
 */
export function getElevenLabsAgentId(agentId: string): string | undefined {
  if (!(agentId in ELEVENLABS_AGENT_IDS)) {
    return undefined;
  }
  const id = ELEVENLABS_AGENT_IDS[agentId as ElevenLabsAgentId];
  return id !== "" ? id : undefined;
}
