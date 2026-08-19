"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface ToolbarOverflowMenuProps {
  children: React.ReactNode;
}

export function ToolbarOverflowMenu({ children }: ToolbarOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

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

  // Close on Escape key and return focus to trigger
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (isOpen && menuListRef.current) {
      const firstItem = menuListRef.current.querySelector<HTMLElement>(
        'button, [role="menuitem"]'
      );
      firstItem?.focus();
    }
  }, [isOpen]);

  // Arrow key navigation and focus trapping
  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    const menu = menuListRef.current;
    if (!menu) return;

    const items = Array.from(
      menu.querySelectorAll<HTMLElement>('button, [role="menuitem"]')
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev].focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
      } else {
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
      }
    }
  }, []);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <Button
        ref={triggerRef}
        variant="glassIcon"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label={t("accessibility.more_options")}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical className="h-5 w-5 text-white" />
      </Button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 min-w-[140px] rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl py-2 z-50",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          <div ref={menuListRef} className="flex flex-col gap-1 px-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface ToolbarOverflowItemProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export function ToolbarOverflowItem({ icon, label, onClick, active }: ToolbarOverflowItemProps) {
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        // UX-M6 (#899): min-h-11 (44px) touch-target floor.
        "flex items-center gap-3 w-full px-3 py-2 min-h-11 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm",
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
