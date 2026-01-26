"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateAdminKey } from "@/lib/admin-api";
import { AlertCircle, Loader2, ArrowRight } from "lucide-react";

interface AdminLoginFormProps {
  onLogin: (adminKey: string) => void;
}

export function AdminLoginForm({ onLogin }: AdminLoginFormProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key.trim()) {
      setError("Please enter the admin key");
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await validateAdminKey(key);
      if (isValid) {
        onLogin(key);
      } else {
        setError("Invalid admin key");
      }
    } catch {
      setError("Failed to validate key");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Paisaxe Admin
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Enter your access key to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Access key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
              className="h-10 border-neutral-200 bg-white text-sm placeholder:text-neutral-400 focus-visible:ring-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
            />

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="h-10 w-full bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
          Protected area
        </p>
      </div>
    </div>
  );
}
