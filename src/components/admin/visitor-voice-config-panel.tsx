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

    // Auto-add any pending email from the input field
    let emailsToSave = emails;
    const pendingEmail = newEmail.trim().toLowerCase();
    if (pendingEmail) {
      const isDuplicate = emails.some(
        (email) => email.toLowerCase() === pendingEmail
      );
      if (!isDuplicate) {
        emailsToSave = [...emails, pendingEmail];
        setEmails(emailsToSave);
      }
      setNewEmail("");
    }

    const result = await updateFeatureFlagConfig("visitor_voice_agent", {
      whitelisted_emails: emailsToSave,
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
    <div className="space-y-6 border-t border-[#e5e3de] pt-6 dark:border-[#3d3a36]">
      {/* Agent ID */}
      <div className="space-y-2">
        <label
          htmlFor="agent-id"
          className="block font-mono text-xs uppercase tracking-widest text-[#a39e98]"
        >
          ElevenLabs Agent ID
        </label>
        <input
          id="agent-id"
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Enter agent ID from ElevenLabs dashboard"
          className="w-full border border-[#e5e3de] bg-transparent px-4 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] focus-visible:border-[#a39e98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a55c] dark:border-[#3d3a36] dark:text-[#f5f3ee]"
        />
      </div>

      {/* Whitelisted Emails */}
      <div className="space-y-3">
        <label className="block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
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
            className="flex-1 border border-[#e5e3de] bg-transparent px-4 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] focus-visible:border-[#a39e98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a55c] dark:border-[#3d3a36] dark:text-[#f5f3ee]"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="flex items-center gap-1 border border-[#e5e3de] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:border-[#a39e98] hover:text-[#2d2a26] dark:border-[#3d3a36] dark:text-[#a39e98] dark:hover:border-[#6b6560] dark:hover:text-[#f5f3ee]"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {/* Email list */}
        {emails.length === 0 ? (
          <p className="text-sm text-[#a39e98]">
            No whitelisted emails. Add emails to grant voice access.
          </p>
        ) : (
          <ul className="space-y-2">
            {emails.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between border border-[#f5f3ee] px-3 py-2 dark:border-[#3d3a36]"
              >
                <span className="text-sm text-[#4d4944] dark:text-[#a39e98]">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  aria-label={`Remove ${email}`}
                  className="text-[#a39e98] transition-colors hover:text-red-500"
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
            ? "cursor-wait border-[#e5e3de] text-[#a39e98]"
            : "border-[#2d2a26] text-[#2d2a26] hover:bg-[#2d2a26] hover:text-white dark:border-[#f5f3ee] dark:text-[#f5f3ee] dark:hover:bg-[#f5f3ee] dark:hover:text-[#2d2a26]"
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
