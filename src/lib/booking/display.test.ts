import { expect,it } from 'vitest';
import { bookingDisplayText } from './display';
it('presents known fixture copy in English without rewriting unknown provider facts',()=>{
 expect(bookingDisplayText('Paseo por la senda costera','en')).toBe('Coastal path walk');
 expect(bookingDisplayText('El proveedor no ha confirmado la accesibilidad','en')).toBe('The provider has not confirmed accessibility');
 expect(bookingDisplayText('El embarcadero tiene escalones','en')).toBe('The embarkation point has steps');
 expect(bookingDisplayText('Rutas del Sella (demo, ficticio)','en')).toBe('Rutas del Sella (fictional demo)');
 expect(bookingDisplayText('Provider-owned unknown text','en')).toBe('Provider-owned unknown text');
 expect(bookingDisplayText('Paseo por la senda costera','es')).toBe('Paseo por la senda costera');
});
it.each(['constructor','toString','__proto__'])('preserves unknown provider text even when it is an object prototype key: %s',value=>expect(bookingDisplayText(value,'en')).toBe(value));
