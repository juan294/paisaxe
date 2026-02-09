"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { MarketingPlatform, MarketingAccountPublic } from "@/types/marketing";
import { PLATFORM_BADGES, PLATFORM_NAMES, PLATFORM_CREDENTIALS } from "./constants";

export function AccountConfigDialog({
  platform,
  existingAccount,
  onClose,
  onSaved,
}: {
  platform: MarketingPlatform | null;
  existingAccount: MarketingAccountPublic | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountName, setAccountName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when platform changes
  useEffect(() => {
    if (platform) {
      setAccountName(existingAccount?.accountName || "Paisaxe");
      setAccountHandle(existingAccount?.accountHandle || "");
      setCredentials({});
      setShowSecrets({});
      setError("");
    }
  }, [platform, existingAccount]);

  const handleSave = async () => {
    if (!platform) return;

    // Validate required fields
    const requiredFields = PLATFORM_CREDENTIALS[platform].filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !credentials[f.key]?.trim());

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.map((f) => f.label).join(", ")}`);
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          accountName: accountName.trim() || "Paisaxe",
          accountHandle: accountHandle.trim() || undefined,
          credentials,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save account");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!platform) return null;

  const credentialFields = PLATFORM_CREDENTIALS[platform];

  return (
    <Dialog open={!!platform} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-[#e5e3de] bg-white dark:border-[#3d3a36] dark:bg-[#252320]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[#2d2a26] dark:text-[#f5f3ee]">
            <div className="flex h-8 w-8 items-center justify-center border border-[#2d2a26] font-mono text-xs font-medium dark:border-[#f5f3ee]">
              {PLATFORM_BADGES[platform]}
            </div>
            {existingAccount ? "Configure" : "Connect"} {PLATFORM_NAMES[platform]}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6b6560]">
            Enter your API credentials to enable automated posting
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Account Name */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Paisaxe"
              className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Account Handle */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Handle / Username
            </label>
            <input
              type="text"
              value={accountHandle}
              onChange={(e) => setAccountHandle(e.target.value)}
              placeholder="@paisaxe"
              className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Credential Fields */}
          <div className="space-y-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <p className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              API Credentials
            </p>
            {credentialFields.map((field) => (
              <div key={field.key}>
                <label className="mb-2 flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets[field.key] ? "text" : "password"}
                    value={credentials[field.key] || ""}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="w-full border border-[#e5e3de] bg-transparent px-3 py-2 pr-10 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39e98] hover:text-[#6b6560]"
                  >
                    {showSecrets[field.key] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 font-mono text-xs text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-[#2d2a26] font-mono text-xs uppercase tracking-widest text-white hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : existingAccount ? (
                "Update"
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
