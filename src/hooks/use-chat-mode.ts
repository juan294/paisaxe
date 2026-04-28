import { useState, useCallback } from "react";

/**
 * useChatMode — owns the voice/text mode toggle state for VoiceChat.
 *
 * Encapsulates:
 * - `useElevenLabs`: whether voice mode (ElevenLabs) is active
 * - `toggle()`: flip the current mode
 * - `setUseElevenLabs(value)`: set the mode explicitly (e.g. from access sync effect)
 *
 * @param initialValue - Starting mode (default: false → text mode)
 */
export function useChatMode(initialValue = false) {
  const [useElevenLabs, setUseElevenLabs] = useState(initialValue);

  const toggle = useCallback(() => {
    setUseElevenLabs((prev) => !prev);
  }, []);

  return { useElevenLabs, setUseElevenLabs, toggle };
}
