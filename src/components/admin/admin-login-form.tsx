"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateAdminKey } from "@/lib/admin-api";

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Paisaxe Admin</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your admin key to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Admin secret key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isValidating}
          >
            {isValidating ? "Validating..." : "Enter Admin Panel"}
          </Button>
        </form>
      </div>
    </div>
  );
}
