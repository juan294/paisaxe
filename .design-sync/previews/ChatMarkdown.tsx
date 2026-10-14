import { ChatMarkdown } from "paisaxe";

const reply = `El **Mirador del Fitu** está a unos 20 minutos de Arriondas en coche.

- La plataforma superior tiene escaleras.
- El aparcamiento y la zona baja son accesibles.

Al atardecer se ven a la vez los Picos de Europa y la costa. Más información en [turismoasturias.es](https://www.turismoasturias.es).`;

export const AssistantReply = () => (
  <div className="p-6">
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 space-y-4" style={{ width: 460 }}>
      <div className="ml-auto max-w-[85%] p-3 rounded-2xl bg-white text-gray-900">¿Cómo llego al Fitu?</div>
      <div className="max-w-[85%] p-3 rounded-2xl bg-white/20 text-white">
        <ChatMarkdown content={reply} />
      </div>
    </div>
  </div>
);
