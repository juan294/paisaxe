import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TABS, type AdminTab } from "@/components/admin/admin-tabs";

const DEFAULT_ADMIN_TAB: AdminTab = "analytics";

function isAllowedAdminTab(tab: string | null): tab is AdminTab {
  return TABS.some((allowedTab) => allowedTab.value === tab);
}

function normalizeAdminTab(tab: string | null): AdminTab {
  return isAllowedAdminTab(tab) ? tab : DEFAULT_ADMIN_TAB;
}

export function useAdminTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // FE-H5: URL is the canonical source of truth; local state for instant responsiveness
  const urlTab = normalizeAdminTab(searchParams.get("tab"));
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


  return { activeTab, handleTabChange };
}
