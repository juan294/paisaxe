import { ChatComposer } from "paisaxe";

const noop = () => {};
const panel = "rounded-2xl border border-white/20 bg-white/10 overflow-hidden";

export const Empty = () => (
  <div className="p-6">
    <div className={panel} style={{ width: 460 }}>
      <ChatComposer value="" isLoading={false} onChange={noop} onSubmit={(e) => e?.preventDefault()} />
    </div>
  </div>
);

export const Typing = () => (
  <div className="p-6">
    <div className={panel} style={{ width: 460 }}>
      <ChatComposer
        value="¿Se puede llegar al mirador en silla de ruedas?"
        isLoading={false}
        onChange={noop}
        onSubmit={(e) => e?.preventDefault()}
      />
    </div>
  </div>
);

export const WhileStreaming = () => (
  <div className="p-6">
    <div className={panel} style={{ width: 460 }}>
      <ChatComposer value="" isLoading onChange={noop} onSubmit={(e) => e?.preventDefault()} />
    </div>
  </div>
);
