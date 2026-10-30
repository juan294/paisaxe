/** Reviewed translations of the fixed demo catalogue. Values and provider verdicts stay canonical. */
const ENGLISH: Readonly<Record<string,string>> = {
 'Descenso en canoa':'Canoe descent',
 'Paseo por la senda costera':'Coastal path walk',
 'Ruta de miradores en 4x4':'4x4 viewpoint tour',
 'Rutas del Sella (demo, ficticio)':'Rutas del Sella (fictional demo)',
 'Paseo guiado y llano por la senda costera, con paradas en los miradores. Experiencia de demostración (ficticia).':'A guided, level coastal path walk with stops at viewpoints. Fictional demo experience.',
 'Descenso en canoa por un tramo tranquilo del río, con monitor. Experiencia de demostración (ficticia).':'A guided canoe descent along a calm stretch of river. Fictional demo experience.',
 'Ruta en 4x4 por pistas de montaña hasta varios miradores. Experiencia de demostración (ficticia).':'A 4x4 tour along mountain tracks to several viewpoints. Fictional demo experience.',
 'Sendero llano de tierra compactada, sin escalones en todo el recorrido':'A level compacted-earth path with no steps along the route',
 'Parada de autobús a 300 m del punto de encuentro':'A bus stop 300 m from the meeting point',
 'Español e inglés':'Spanish and English',
 'Sin edad mínima':'No minimum age',
 'El embarcadero tiene escalones':'The embarkation point has steps',
 'Canoa, remo, chaleco y bidón estanco incluidos':'Canoe, paddle, life jacket and waterproof container included',
 'Edad mínima 8 años':'Minimum age: 8 years',
 'El proveedor no ha confirmado la accesibilidad':'The provider has not confirmed accessibility',
 'Sin transporte público al punto de salida':'No public transport to the departure point',
 'El proveedor no ha confirmado si se admiten mascotas':'The provider has not confirmed whether pets are allowed',
};
export function bookingDisplayText(value:string,locale?:string|null):string {
 return locale==='en' && Object.hasOwn(ENGLISH, value) ? ENGLISH[value] ?? value : value;
}
