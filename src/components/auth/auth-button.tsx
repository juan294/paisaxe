"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthButtonProps {
  className?: string;
}

export function AuthButton({ className }: AuthButtonProps) {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  if (isLoading) {
    return (
      <div
        className={cn(
          "h-10 w-10 rounded-full bg-white/10 animate-pulse",
          className
        )}
      />
    );
  }

  if (user) {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown((prev) => !prev);
          }}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name || "User avatar"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-white text-sm font-medium">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
            </span>
          )}
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
              }}
            />
            <div
              className="absolute right-0 top-12 z-50 w-48 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white text-sm font-medium truncate">
                  {user.name || "Usuario"}
                </p>
                <p className="text-white/60 text-xs truncate">{user.email}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  signOut();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Cerrar sesion</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        signInWithGoogle();
      }}
      className={cn(
        "h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full transition-all hover:scale-105",
        className
      )}
      aria-label="Entrar"
      title="Entrar"
    >
      <LogIn className="h-5 w-5" />
    </button>
  );
}
