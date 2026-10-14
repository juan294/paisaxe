import { ChatErrorBanner } from "paisaxe";

export const Default = () => (
  <div className="p-6">
    <div className="rounded-2xl border border-white/20 bg-white/10 py-4" style={{ width: 460 }}>
      <ChatErrorBanner
        error="No he podido responder ahora mismo. Inténtalo de nuevo en unos segundos."
        isLoading={false}
        onRetry={() => {}}
      />
    </div>
  </div>
);
