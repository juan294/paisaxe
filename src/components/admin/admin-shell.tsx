"use client";

/**
 * AdminShell
 *
 * Handles auth gating, tab state, and routing between admin tab panels.
 * Extracted from src/app/admin/page.tsx (AR-M2).
 *
 * FE-M2: StatCard extracted to src/components/ui/stat-card.tsx
 *        StoriesTabPanel extracted to src/components/admin/stories-tab-panel.tsx
 * FE-M3: Tab panels are conditionally rendered — unmounted when inactive.
 * PE-M5: Stories are paginated server-side inside StoriesTabPanel.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRole } from "@/hooks/use-admin-role";
import { StoriesTabPanel } from "@/components/admin/stories-tab-panel";
import { AdminTabs, TABS, type AdminTab } from "@/components/admin/admin-tabs";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ArrowUpRight, LogOut, Loader2, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load tab panel components to reduce initial bundle size
function TabPanelFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
      <Loader2 className="h-6 w-6 animate-spin text-[#a39e98]" />
      <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading...</p>
    </div>
  );
}

const FeatureTogglesPanel = dynamic(
  () =>
    import("@/components/admin/feature-toggles-panel").then((m) => ({
      default: m.FeatureTogglesPanel,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const AnalyticsDashboard = dynamic(
  () =>
    import("@/components/admin/analytics-dashboard").then((m) => ({
      default: m.AnalyticsDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const MarketingDashboard = dynamic(
  () =>
    import("@/components/admin/marketing-dashboard").then((m) => ({
      default: m.MarketingDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const SuggestionsPanel = dynamic(
  () =>
    import("@/components/admin/suggestions-panel").then((m) => ({
      default: m.SuggestionsPanel,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const AgentsDashboard = dynamic(
  () =>
    import("@/components/admin/agents-dashboard").then((m) => ({
      default: m.AgentsDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
);

export function AdminShell() {
  const {
    user,
    isLoading: isAuthLoading,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { isAdmin, isLoading: isRoleLoading } = useAdminRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  // FE-H5: URL is the canonical source of truth; local state for instant responsiveness
  const urlTab = (searchParams.get("tab") ?? "analytics") as AdminTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const handleTabChange = useCallback(
    (tab: AdminTab) => {
      setActiveTab(tab);
      router.push(`?tab=${tab}`, { scroll: false });
    },
    [router]
  );

  // Keyboard shortcuts: Cmd+1 through Cmd+N to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;

      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= TABS.length) {
        e.preventDefault();
        const tab = TABS[keyNum - 1];
        if (tab) {
          handleTabChange(tab.value);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTabChange]);

  const handleLogout = async () => {
    await signOut();
  };

  // ── Auth gating ─────────────────────────────────────────────────────────────

  if (isAuthLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#2d2a26] dark:bg-[#f5f3ee] p-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#f5f3ee] dark:text-[#2d2a26]" />
          </div>
          <p className="text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917] p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-[#252320]">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2d2a26] p-3 dark:bg-[#f5f3ee]">
              <Logo className="text-[#f5f3ee] dark:text-[#2d2a26]" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
              Paisaxe Admin
            </h1>
            <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
              Sign in to access the admin panel
            </p>
            <Button
              onClick={() => signInWithGoogle("/admin")}
              className="mt-6 h-12 w-full rounded-2xl bg-[#2d2a26] text-sm font-medium text-[#f5f3ee] transition-all hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              Sign in with Google
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-[#a39e98]">Protected area</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917] p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-[#252320]">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a55c]">
              <ShieldX className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
              Access Denied
            </h1>
            <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
              Your account does not have admin privileges.
            </p>
            <p className="mt-3 text-xs text-[#a39e98]">Signed in as {user.email}</p>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="mt-6 h-12 w-full rounded-2xl text-sm font-medium text-[#6b6560] hover:bg-[#f5f3ee] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin panel ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f3ee] dark:bg-[#1a1917]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f5f3ee]/80 backdrop-blur-xl dark:bg-[#1a1917]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2a26] p-2 dark:bg-[#f5f3ee]">
              <Logo className="text-[#f5f3ee] dark:text-[#2d2a26]" />
            </div>
            <span className="text-sm font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
              Paisaxe
            </span>
          </div>

          {/* Center tabs */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={handleLogout}
              aria-label="Logout"
              className={cn(
                "flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                "text-[#6b6560] hover:bg-white hover:text-[#2d2a26]",
                "dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]"
              )}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tab panels — conditionally rendered (FE-M3: unmount on hide) */}
        {activeTab === "stories" && <StoriesTabPanel />}
        {activeTab === "features" && <FeatureTogglesPanel />}
        {activeTab === "analytics" && <AnalyticsDashboard />}
        {activeTab === "marketing" && <MarketingDashboard />}
        {activeTab === "suggestions" && <SuggestionsPanel />}
        {activeTab === "agents" && <AgentsDashboard />}
      </main>
    </div>
  );
}
