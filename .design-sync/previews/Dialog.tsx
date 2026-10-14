import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "paisaxe";

export const Open = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>¿Cancelar la reserva?</DialogTitle>
        <DialogDescription>
          Cancelas con más de 24 horas de antelación: te devolvemos la señal completa, 30,00 €.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline">Mantener reserva</Button>
        <Button variant="destructive">Cancelar y reembolsar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
