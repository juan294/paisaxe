import { Input, Label } from "paisaxe";

export const Default = () => (
  <div className="bg-white p-6">
    <div className="" style={{width: 360}}>
    <Input placeholder="Código de acceso" />
  </div>
  </div>
);

export const WithLabel = () => (
  <div className="bg-white p-6">
    <div className="grid gap-2" style={{width: 360}}>
    <Label htmlFor="email">Correo electrónico</Label>
    <Input id="email" type="email" defaultValue="ana@ejemplo.es" />
  </div>
  </div>
);

export const Disabled = () => (
  <div className="bg-white p-6">
    <div className="" style={{width: 360}}>
    <Input disabled defaultValue="RS-8295A6" />
  </div>
  </div>
);
