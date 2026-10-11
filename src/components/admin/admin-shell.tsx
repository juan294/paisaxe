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

import dynamic from "next/dynamic";
import { useAdminTab } from "./admin-shell/use-admin-tab";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRole } from "@/hooks/use-admin-role";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ArrowUpRight, LogOut, Loader2, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load tab panel components to reduce initial bundle size
function TabPanelFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-admin-panel">
      <Loader2 className="h-6 w-6 animate-spin text-admin-subtle" />
      <p className="mt-4 text-sm text-admin-muted dark:text-admin-subtle">Loading...</p>
    </div>
  );
}

// FE-M7 (#769): StoriesTabPanel is the largest admin tab panel (~500 lines) —
// it was the only static import among the six tab panels, defeating the
// "load tab code on demand" intent that motivated dynamic-importing the rest.
const StoriesTabPanel = dynamic(
  () =>
    import("@/components/admin/stories-tab-panel").then((m) => ({
      default: m.StoriesTabPanel,
    })),
  { ssr: false, loading: TabPanelFallback }
);

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
  const { activeTab, handleTabChange } = useAdminTab();

  const handleLogout = async () => {
    await signOut();
  };

  // ── Auth gating ─────────────────────────────────────────────────────────────

  if (isAuthLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-paper dark:bg-admin-canvas-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-admin-ink dark:bg-admin-paper p-3">
            <Loader2 className="h-6 w-6 animate-spin text-admin-paper dark:text-admin-ink" />
          </div>
          <p className="text-sm font-medium text-admin-muted dark:text-admin-subtle">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-paper dark:bg-admin-canvas-dark p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-admin-panel">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-ink p-3 dark:bg-admin-paper">
              <Logo className="text-admin-paper dark:text-admin-ink" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-admin-ink dark:text-admin-paper">
              Paisaxe Admin
            </h1>
            <p className="mt-2 text-sm text-admin-muted dark:text-admin-subtle">
              Sign in to access the admin panel
            </p>
            <Button
              onClick={() => signInWithGoogle("/admin")}
              className="mt-6 h-12 w-full rounded-2xl bg-admin-ink text-sm font-medium text-admin-paper transition-all hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
            >
              Sign in with Google
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-admin-subtle">Protected area</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-paper dark:bg-admin-canvas-dark p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-admin-panel">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-warning">
              <ShieldX className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-admin-ink dark:text-admin-paper">
              Access Denied
            </h1>
            <p className="mt-2 text-sm text-admin-muted dark:text-admin-subtle">
              Your account does not have admin privileges.
            </p>
            <p className="mt-3 text-xs text-admin-subtle">Signed in as {user.email}</p>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="mt-6 h-12 w-full rounded-2xl text-sm font-medium text-admin-muted hover:bg-admin-paper hover:text-admin-ink dark:text-admin-subtle dark:hover:bg-admin-ink dark:hover:text-admin-paper"
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
    <div className="min-h-screen bg-admin-paper dark:bg-admin-canvas-dark">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-admin-paper/80 backdrop-blur-xl dark:bg-admin-canvas-dark/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin-ink p-2 dark:bg-admin-paper">
              <Logo className="text-admin-paper dark:text-admin-ink" />
            </div>
            <span className="text-sm font-semibold text-admin-ink dark:text-admin-paper">
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
                "text-admin-muted hover:bg-white hover:text-admin-ink",
                "dark:text-admin-subtle dark:hover:bg-admin-panel dark:hover:text-admin-paper"
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
