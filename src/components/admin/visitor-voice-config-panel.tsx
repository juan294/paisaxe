"use client";

import { useState } from "react";
import { X, Plus, Loader2, AlertCircle } from "lucide-react";
import { updateFeatureFlagConfig } from "@/lib/admin-api";
import type { FeatureFlag, VisitorVoiceConfig } from "@/types/feature-flags";
import { cn } from "@/lib/utils";

interface VisitorVoiceConfigPanelProps {
  flag: FeatureFlag;
  onUpdate: (updatedFlag: FeatureFlag) => void;
}

export function VisitorVoiceConfigPanel({
  flag,
  onUpdate,
}: VisitorVoiceConfigPanelProps) {
  // Extract config with safe defaults
  const config = flag.config as Partial<VisitorVoiceConfig> | undefined;
  const initialEmails = config?.whitelisted_emails ?? [];
  const initialAgentId = config?.agent_id ?? "";

  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [agentId, setAgentId] = useState(initialAgentId);
  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;

    // Check for duplicates (case-insensitive)
    const isDuplicate = emails.some(
      (email) => email.toLowerCase() === trimmed
    );
    if (isDuplicate) {
      setNewEmail("");
      return;
    }

    setEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails((prev) => prev.filter((email) => email !== emailToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");

    const result = await updateFeatureFlagConfig("visitor_voice_agent", {
      whitelisted_emails: emails,
      agent_id: agentId,
    });

    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.data) {
      onUpdate(result.data);
    }
  };

  return (
    <div className="space-y-6 border-t border-stone-200 pt-6 dark:border-stone-800">
      {/* Agent ID */}
      <div className="space-y-2">
        <label
          htmlFor="agent-id"
          className="block font-mono text-xs uppercase tracking-widest text-stone-400"
        >
          ElevenLabs Agent ID
        </label>
        <input
          id="agent-id"
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Enter agent ID from ElevenLabs dashboard"
          className="w-full border border-stone-200 bg-transparent px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
        />
      </div>

      {/* Whitelisted Emails */}
      <div className="space-y-3">
        <label className="block font-mono text-xs uppercase tracking-widest text-stone-400">
          Whitelisted Emails
        </label>

        {/* Add email input */}
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="user@example.com"
            className="flex-1 border border-stone-200 bg-transparent px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="flex items-center gap-1 border border-stone-200 px-4 py-2 font-mono text-xs uppercase tracking-widest text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-100"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {/* Email list */}
        {emails.length === 0 ? (
          <p className="text-sm text-stone-400">
            No whitelisted emails. Add emails to grant voice access.
          </p>
        ) : (
          <ul className="space-y-2">
            {emails.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between border border-stone-100 px-3 py-2 dark:border-stone-800"
              >
                <span className="text-sm text-stone-700 dark:text-stone-300">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  aria-label={`Remove ${email}`}
                  className="text-stone-400 transition-colors hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className={cn(
          "flex items-center gap-2 border px-6 py-2 font-mono text-xs uppercase tracking-widest transition-all",
          isSaving
            ? "cursor-wait border-stone-200 text-stone-300"
            : "border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white dark:border-stone-100 dark:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900"
        )}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </button>
    </div>
  );
}
