import { Label, Textarea } from "paisaxe";

export const Default = () => (
  <div className="bg-white p-6">
    <div className="grid gap-2" style={{width: 400}}>
    <Label htmlFor="why">¿Por qué merece la pena este lugar?</Label>
    <Textarea id="why" rows={4} placeholder="Cuéntanos qué lo hace especial…" />
  </div>
  </div>
);

export const Filled = () => (
  <div className="bg-white p-6">
    <div className="" style={{width: 400}}>
    <Textarea rows={4} defaultValue="El mirador del Fitu al atardecer: se ven los Picos de Europa y la costa a la vez." />
  </div>
  </div>
);
