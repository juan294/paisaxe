import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "paisaxe";

export const Default = () => (
  <div className="p-6 bg-white">
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Descenso del Sella</CardTitle>
        <CardDescription>Arriondas · 2 h · Rutas del Sella</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tramo tranquilo del río con monitor. Chaleco y pala incluidos; se sale del embarcadero de
          Arriondas.
        </p>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-sm font-semibold">60,00 €</span>
        <Button size="sm">Ver horarios</Button>
      </CardFooter>
    </Card>
  </div>
);

export const HeaderOnly = () => (
  <div className="p-6 bg-white">
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Reservas de hoy</CardTitle>
        <CardDescription>3 confirmadas · 1 pendiente de pago</CardDescription>
      </CardHeader>
    </Card>
  </div>
);
