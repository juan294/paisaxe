import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "paisaxe";

export const Closed = () => (
  <div className="bg-white p-6">
    <div className="grid gap-2" style={{width: 280}}>
    <Label>Idioma</Label>
    <Select defaultValue="es">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="ast">Asturianu</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </Select>
  </div>
  </div>
);

export const Open = () => (
  <div className="bg-white p-6">
    <div className="" style={{width: 280, height: 260}}>
    <Select defaultValue="en" open>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="ast">Asturianu</SelectItem>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="fr">Français</SelectItem>
      </SelectContent>
    </Select>
  </div>
  </div>
);
