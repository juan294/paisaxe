import { StatCard } from "paisaxe";
import { CalendarCheck, CircleCheck, Sparkles, TriangleAlert } from "lucide-react";

const noop = () => {};

export const Variants = () => (
  <div className="bg-[#f5f3ee] p-6">
    <div className="grid grid-cols-2 gap-3" style={{width: 480}}>
    <StatCard icon={<CalendarCheck className="size-5" />} value={12} label="Próximas" variant="default" onClick={noop} />
    <StatCard icon={<TriangleAlert className="size-5" />} value={2} label="Incidencias" variant="warning" onClick={noop} />
    <StatCard icon={<CircleCheck className="size-5" />} value={31} label="Confirmadas" variant="success" onClick={noop} />
    <StatCard icon={<Sparkles className="size-5" />} value={5} label="Sugerencias" variant="purple" onClick={noop} />
  </div>
  </div>
);

export const Active = () => (
  <div className="bg-[#f5f3ee] p-6">
    <div className="" style={{width: 240}}>
    <StatCard icon={<TriangleAlert className="size-5" />} value={2} label="Incidencias" variant="warning" isActive onClick={noop} />
  </div>
  </div>
);
