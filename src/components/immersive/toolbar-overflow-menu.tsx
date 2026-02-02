"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarOverflowMenuProps {
  children: React.ReactNode;
}

export function ToolbarOverflowMenu({ children }: ToolbarOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="More options"
        aria-expanded={isOpen}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <MoreVertical className="h-5 w-5 text-white" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 min-w-[160px] rounded-lg bg-black/90 backdrop-blur-md border border-white/10 shadow-xl py-2 z-50",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1 px-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface ToolbarOverflowItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export function ToolbarOverflowItem({ icon, label, onClick, active }: ToolbarOverflowItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm",
        active && "text-white bg-white/10"
      )}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
