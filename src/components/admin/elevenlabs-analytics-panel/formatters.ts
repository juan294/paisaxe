export function formatLanguage(lang: string): string {
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    de: "German",
    fr: "French",
    pt: "Portuguese",
    it: "Italian",
    Unknown: "Unknown",
  };
  return languageNames[lang] || lang;
}

export function formatStatus(status: string): string {
  const statusNames: Record<string, string> = {
    done: "Completed",
    failed: "Failed",
    "in-progress": "In Progress",
    initiated: "Initiated",
    processing: "Processing",
  };
  return statusNames[status] || status;
}

export function formatTime(unix: number | undefined): string {
  if (!unix) return "—";
  const date = new Date(unix * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

