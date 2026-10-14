import { Input, Label } from "paisaxe";

export const WithInput = () => (
  <div className="bg-white p-6">
    <div className="grid gap-2" style={{width: 360}}>
    <Label htmlFor="party">Número de personas</Label>
    <Input id="party" type="number" defaultValue="4" />
  </div>
  </div>
);
