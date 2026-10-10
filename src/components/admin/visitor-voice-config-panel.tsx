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
    <div className="space-y-6 border-t border-admin-line pt-6 dark:border-admin-depth">
      {/* Agent ID */}
      <div className="space-y-2">
        <label
          htmlFor="agent-id"
          className="block font-mono text-xs uppercase tracking-widest text-admin-subtle"
        >
          ElevenLabs Agent ID
        </label>
        <input
          id="agent-id"
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Enter agent ID from ElevenLabs dashboard"
          className="w-full border border-admin-line bg-transparent px-4 py-2 text-sm text-admin-ink placeholder-admin-subtle focus-visible:border-admin-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-warning dark:border-admin-depth dark:text-admin-paper"
        />
      </div>

      {/* Whitelisted Emails */}
      <div className="space-y-3">
        <label className="block font-mono text-xs uppercase tracking-widest text-admin-subtle">
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
            className="flex-1 border border-admin-line bg-transparent px-4 py-2 text-sm text-admin-ink placeholder-admin-subtle focus-visible:border-admin-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-warning dark:border-admin-depth dark:text-admin-paper"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="flex items-center gap-1 border border-admin-line px-4 py-2 font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:border-admin-subtle hover:text-admin-ink dark:border-admin-depth dark:text-admin-subtle dark:hover:border-admin-muted dark:hover:text-admin-paper"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {/* Email list */}
        {emails.length === 0 ? (
          <p className="text-sm text-admin-subtle">
            No whitelisted emails. Add emails to grant voice access.
          </p>
        ) : (
          <ul className="space-y-2">
            {emails.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between border border-admin-paper px-3 py-2 dark:border-admin-depth"
              >
                <span className="text-sm text-admin-secondary dark:text-admin-subtle">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  aria-label={`Remove ${email}`}
                  className="text-admin-subtle transition-colors hover:text-red-500"
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
            ? "cursor-wait border-admin-line text-admin-subtle"
            : "border-admin-ink text-admin-ink hover:bg-admin-ink hover:text-white dark:border-admin-paper dark:text-admin-paper dark:hover:bg-admin-paper dark:hover:text-admin-ink"
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
