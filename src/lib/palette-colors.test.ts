import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config";

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const colors = tailwindConfig.theme.extend.colors as Record<string, unknown>;

// Approved Phase 8 values are invariant swatches. Explicit dark/hover/alpha
// modifiers select them; substituting the base semantic palette changes pixels.
const ADMIN = {
  ink: "#2d2a26",
  paper: "#f5f3ee",
  muted: "#6b6560",
  subtle: "#a39e98",
  line: "#e5e3de",
  depth: "#3d3a36",
  panel: "#252320",
  secondary: "#4d4944",
  "canvas-dark": "#1a1917",
  approve: "#5a7a5a",
  "approve-hover": "#4a6a4a",
  "health-success": "#7a9e7a",
  warning: "#c9a55c",
  "warning-hover": "#b89545",
  "health-error": "#c97a7a",
  delete: "#a85454",
  "delete-hover": "#8b4444",
  "skeleton-dot": "#d5d3ce",
} as const;

const SCENE = {
  black: "#000",
  white: "#fff",
  canvas: "oklch(14.5% 0 none)",
} as const;

const LIGHT_SEMANTICS = {
  background: "0 0% 100%",
  foreground: "222.2 84% 4.9%",
  card: "0 0% 100%",
  "card-foreground": "222.2 84% 4.9%",
  popover: "0 0% 100%",
  "popover-foreground": "222.2 84% 4.9%",
  primary: "142.1 76.2% 36.3%",
  "primary-foreground": "355.7 100% 97.3%",
  secondary: "210 40% 96.1%",
  "secondary-foreground": "222.2 47.4% 11.2%",
  muted: "210 40% 96.1%",
  "muted-foreground": "215.4 16.3% 46.9%",
  accent: "210 40% 96.1%",
  "accent-foreground": "222.2 47.4% 11.2%",
  destructive: "0 84.2% 60.2%",
  "destructive-foreground": "210 40% 98%",
  border: "214.3 31.8% 91.4%",
  input: "214.3 31.8% 91.4%",
  ring: "142.1 76.2% 36.3%",
  radius: "0.5rem",
};

const DARK_SEMANTICS = {
  background: "222.2 84% 4.9%",
  foreground: "210 40% 98%",
  card: "222.2 84% 4.9%",
  "card-foreground": "210 40% 98%",
  popover: "222.2 84% 4.9%",
  "popover-foreground": "210 40% 98%",
  primary: "142.1 76.2% 36.3%",
  "primary-foreground": "355.7 100% 97.3%",
  secondary: "217.2 32.6% 17.5%",
  "secondary-foreground": "210 40% 98%",
  muted: "217.2 32.6% 17.5%",
  "muted-foreground": "215 20.2% 65.1%",
  accent: "217.2 32.6% 17.5%",
  "accent-foreground": "210 40% 98%",
  destructive: "0 62.8% 30.6%",
  "destructive-foreground": "210 40% 98%",
  border: "217.2 32.6% 17.5%",
  input: "217.2 32.6% 17.5%",
  ring: "142.1 76.2% 36.3%",
};

// File/value exceptions, not whole-file exemptions. See docs/engineering/palette.md.
const RAW_EXCEPTIONS: Record<string, readonly string[]> = {
  "src/app/coming-soon/page.tsx": ["#030303"],
  "src/app/immersive/page.module.css": ["rgb(0 0 0 / 90%)"],
  "src/app/layout.tsx": ["#0a0a0a"],
  "src/app/operator/[capability]/operator-dashboard.tsx": ["#8b7355"],
  "src/components/admin/agents-dashboard/agent-card.tsx": ["#2a2724", "#fafaf8"],
  "src/components/admin/agents-dashboard/cross-agent-insights.tsx": ["#4a4540"],
  "src/components/admin/agents-dashboard/terminal-display.tsx": ["#111", "#1a1a1a", "#4a4540", "#d4d0ca"],
  "src/components/admin/costs-analytics-panel/index.tsx": ["#4d4a44"],
  "src/components/admin/github-analytics-panel.tsx": ["#10b981", "#3b82f6"],
  "src/components/admin/maintenance-config-panel.tsx": ["#030303"],
  "src/components/admin/stories-tab-panel.tsx": ["#8b6c2e", "#d4b876"],
  "src/components/admin/visitors-analytics-panel/chart.tsx": ["#10b981", "#3b82f6"],
  "src/components/booking/paypal-label.tsx": ["#001c64", "#003087", "#0070e0"],
  "src/components/immersive/voice-chat-elevenlabs.tsx": ["#f59e0b", "#fbbf24", "#fde047"],
  "src/components/ui/button.tsx": ["#111111", "#f2ba36", "#ffc439"],
  "src/components/ui/stat-card.tsx": ["#6b5a8a", "#8b7355", "#9b7ac9", "#a8c9a8", "#c4d9c4", "#c9b7e8", "#d4c4a8", "#d4c9e8"],
  "src/lib/og-image-helpers.ts": ["#06b6d4", "#0a0f1a", "#0d1b2a", "#22c55e", "#38bdf8", "#94a3b8", "#a78bfa", "#eab308", "#f97316", "#ffffff"],
};

function productionFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return ["test", "tests", "__tests__"].includes(entry.name) ? [] : productionFiles(file);
    return /\.(?:tsx?|css)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name) ? [file] : [];
  });
}

function rawColors(source: string): string[] {
  return [...source.matchAll(/(?<![\w])#(?:[\da-f]{8}|[\da-f]{6})(?![\w])|(?<=\[)#(?:[\da-f]{4}|[\da-f]{3})(?![\w])|(?:rgba?|hsla?|oklch)\([^)]*\)/gi)]
    .map(([value]) => value.toLowerCase());
}

function semanticVariables(selector: ":root" | ".dark") {
  const block = read("src/app/base.css").match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`))?.[1];
  expect(block, selector).toBeDefined();
  return Object.fromEntries([...block!.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
}

describe("Phase 8 palette equivalence", () => {
  it("defines the 18 exact invariant warm swatches without repurposing theme roles", () => {
    expect(colors.admin).toEqual(ADMIN);
  });

  it("defines invariant visitor scene colors identical to the installed Tailwind primitives", () => {
    expect(colors.scene).toEqual(SCENE);
    const theme = read("node_modules/tailwindcss/theme.css");
    for (const [token, primitive] of [["black", "black"], ["white", "white"], ["canvas", "neutral-950"]] as const) {
      expect(theme.match(new RegExp(`--color-${primitive}:\\s*([^;]+);`))?.[1].trim()).toBe(SCENE[token]);
    }
  });

  it("preserves every existing light and dark base semantic value", () => {
    expect(semanticVariables(":root")).toEqual(LIGHT_SEMANTICS);
    expect(semanticVariables(".dark")).toEqual(DARK_SEMANTICS);
    expect(tailwindConfig.darkMode).toBe("class");
    expect(colors.background).toBe("hsl(var(--background))");
    expect(colors.foreground).toBe("hsl(var(--foreground))");
    for (const role of ["card", "popover", "primary", "secondary", "muted", "accent", "destructive"]) {
      expect(colors[role]).toEqual({ DEFAULT: `hsl(var(--${role}))`, foreground: `hsl(var(--${role}-foreground))` });
    }
    for (const role of ["border", "input", "ring"]) expect(colors[role]).toBe(`hsl(var(--${role}))`);
  });

  it("preserves the complete existing conversion brand scale", () => {
    expect(colors.paisaxe).toEqual({ green: {
      200: "oklch(92.5% 0.084 155.995)",
      300: "oklch(87.1% 0.15 154.449)",
      400: "oklch(79.2% 0.209 151.711)",
      500: "oklch(72.3% 0.219 149.579)",
    } });
  });

  it("uses no raw mapped warm swatches in production source, including shared/operator consumers", () => {
    const mapped = new Set<string>(Object.values(ADMIN));
    const offenders = productionFiles("src").flatMap((file) => {
      const hits = [...new Set(rawColors(read(file)).filter((color) => mapped.has(color)))];
      return hits.length ? [`${file}: ${hits.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("uses scene aliases on the scoped viewer and pricing/checkout surfaces", () => {
    const files = [
      "src/components/immersive/story-viewer.tsx",
      "src/app/pricing/page.tsx",
      "src/app/pricing/loading.tsx",
      "src/app/pricing/checkout/page.tsx",
      "src/app/pricing/checkout/return/page.tsx",
    ];
    const offenders = files.flatMap((file) => {
      const hits = read(file).match(/\b(?:bg|text|border|ring|ring-offset|from|via|to|fill|stroke|shadow|divide|placeholder|decoration|outline)-(?:black|white|neutral-950)(?=[/\s"'`\]}]|$)/g) ?? [];
      return [...new Set(hits)].map((hit) => `${file}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });

  it("admits remaining raw colors only at their documented file/value exceptions", () => {
    const mapped = new Set<string>(Object.values(ADMIN));
    const offenders = productionFiles("src").flatMap((file) => [...new Set(rawColors(read(file)))]
      .filter((value) => !mapped.has(value) && !(RAW_EXCEPTIONS[file] ?? []).includes(value))
      .map((value) => `${file}: ${value}`));
    expect(offenders).toEqual([]);
  });
});
