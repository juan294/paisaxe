import fs from "fs";
import path from "path";

interface Chunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: "nature" | "cities" | "food" | "culture" | "activities";
  sourcePdf: string;
  location?: "eastern" | "central" | "western";
  duration?: "day-trip" | "weekend" | "week";
  displayOrder?: number;
}

const CHUNKS_FILE = path.join(process.cwd(), "content", "processed", "chunks.json");
const OUTPUT_FILE = path.join(process.cwd(), "content", "processed", "extracted-stories.json");

// Location mapping based on addresses/areas
const LOCATION_MAP: Record<string, "eastern" | "central" | "western"> = {
  // Western
  "navia": "western",
  "luarca": "western",
  "valdés": "western",
  "salas": "western",
  "cudillero": "western",
  "pravia": "western",
  "tapia": "western",
  "vegadeo": "western",
  // Central
  "oviedo": "central",
  "uviéu": "central",
  "gijón": "central",
  "xixón": "central",
  "avilés": "central",
  "mieres": "central",
  "langreo": "central",
  "siero": "central",
  "noreña": "central",
  "llanera": "central",
  "castrillón": "central",
  "salinas": "central",
  "gozón": "central",
  "carreño": "central",
  "lena": "central",
  "somió": "central",
  // Eastern
  "llanes": "eastern",
  "ribadesella": "eastern",
  "cangas de onís": "eastern",
  "covadonga": "eastern",
  "arriondas": "eastern",
  "cabrales": "eastern",
  "picos de europa": "eastern",
  "villaviciosa": "eastern",
  "colunga": "eastern",
};

function detectLocation(text: string): "eastern" | "central" | "western" | undefined {
  const lowerText = text.toLowerCase();
  for (const [keyword, location] of Object.entries(LOCATION_MAP)) {
    if (lowerText.includes(keyword)) {
      return location;
    }
  }
  return undefined;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Extract restaurants from the Mesas de Asturias guide
function extractRestaurants(chunks: Chunk[]): Story[] {
  const stories: Story[] = [];
  const restaurantPdf = "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf";

  // Restaurant patterns to extract
  const restaurantRegex = /^(\d+)\.\s*\n*([A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s\-']+)\n/gm;
  const addressRegex = /DIRECCIÓN \/ ADDRESS \| ([^\n]+)/;

  const restaurantChunks = chunks.filter(c => c.sourcePdf === restaurantPdf);
  const combinedContent = restaurantChunks.map(c => c.content).join("\n\n");

  // Known restaurants from the PDF content
  const restaurants = [
    { name: "Blanco", location: "Navia", region: "western", desc: "Uno de los principales focos gastronómicos del occidente asturiano, especializado en mariscos y pescados del Cantábrico con más de 300 referencias de vinos." },
    { name: "Villa Blanca", location: "Luarca", region: "western", desc: "Más de cincuenta años de historia ofreciendo auténtica cocina tradicional asturiana. Imprescindibles su pote y fabada con recetas actualizadas." },
    { name: "Al Son del Indiano", location: "Malleza, Salas", region: "western", desc: "Casona asturiana de tintes coloniales con gastronomía de inspiración francesa y alma asturiana. Casi treinta años de historia bajo la batuta de Luis Rubio." },
    { name: "Casa Zoilo", location: "Muros de Nalón", region: "central", desc: "Más de 70 años alimentando viajeros con especialidad en caza, casquería y fabes preparadas de cinco maneras diferentes." },
    { name: "Real Balneario", location: "Salinas", region: "central", desc: "Una de las variedades más amplias de pescados y mariscos del país, con vistas sobresalientes a la playa de Salinas." },
    { name: "Éleonore", location: "Salinas", region: "central", desc: "Cocina actualizada construida desde la pastelería con tan solo diez mesas y vistas panorámicas a la bahía." },
    { name: "Arraigo", location: "Posada, Llanera", region: "central", desc: "Combina cocina tradicional asturiana con enfoque innovador, usando productos de su propia huerta. Imperdibles la albóndiga de centollo y la costilla de gochu." },
    { name: "Casa Fermín", location: "Oviedo", region: "central", desc: "Uno de los comedores más elegantes de la capital, con tres generaciones dedicadas al producto de excelente calidad." },
    { name: "Del Arco", location: "Oviedo", region: "central", desc: "Comedor señorial distinguido con numerosos premios. Prueba su salpicón de bogavante y pescados del Cantábrico." },
    { name: "El Mono que Lee", location: "Oviedo", region: "central", desc: "Encantador restaurante en el Casco Antiguo con atmósfera acogedora, ideal para cenas románticas o encuentros entre amigos." },
    { name: "La Tabernilla de Oviedo", location: "Oviedo", region: "central", desc: "Referente de cocina asturiana tradicional y parada clave para peregrinos del Camino Primitivo. Famosa por sus guisos y fabada." },
    { name: "Pedro Martino", location: "Caces, Oviedo", region: "central", desc: "En espectacular marco rodeado de montañas sobre el Río Nalón, ofrece visión personal de la tradición asturiana desde perspectiva actual." },
    { name: "Scanda", location: "Las Caldas, Oviedo", region: "central", desc: "Cocina tradicional en el histórico casino del Gran Hotel Las Caldas, conservando elementos originales del siglo XIX." },
    { name: "Roble by Jairo Rodríguez", location: "La Pola, Lena", region: "central", desc: "Visión personal de la gastronomía asturiana en la puerta de entrada a Asturias. Gambas, roast beef, cochinillo y postres memorables." },
    { name: "El Cenador del Azul", location: "Mieres", region: "central", desc: "Referencia de la comarca del Caudal con recetario tradicional actualizado y trato exquisito en sala." },
    { name: "Casa Adela", location: "Lada, Langreo", region: "central", desc: "Casa de comidas en bonito chalet con guisos tradicionales. Imprescindibles los tortos de maíz y la terraza bajo el hórreo." },
    { name: "Casa Telva", location: "Valdesoto, Siero", region: "central", desc: "Madre e hija elaboran callos, cabritu y cebollas rellenas para chuparse los dedos, lejos del mundanal ruido." },
    { name: "La Ferrada", location: "Noreña", region: "central", desc: "Antiguas caballerizas convertidas en restaurante con cuatro acogedores comedores, terraza con parrillas y precios contenidos." },
    { name: "Casa Belarmino", location: "Mazaneda, Gozón", region: "central", desc: "Bar tienda tradicional con más de 90 años. Sus croquetas están entre las mejores de España." },
    { name: "Casa Gerardo", location: "Priendes, Carreño", region: "central", desc: "Centenario restaurante en primera fila de creatividad gastronómica. Marcos Morán ha elevado productos simples a los altares." },
    { name: "Abarike", location: "Gijón", region: "central", desc: "Marisquería de autor donde sostenibilidad y calidad se unen a la visión desenfadada de la chef Lara Roguez." },
    { name: "Ciudadela", location: "Gijón", region: "central", desc: "Restaurante con cuevas en planta inferior, barra de vinos por copas y uno de los menús del día más completos de la ciudad." },
    { name: "La Pondala", location: "Somió, Gijón", region: "central", desc: "Casi 130 años de historia, favorito de empresarios. Roast beef, menestra de temporada y la terraza más deseada en verano." },
    { name: "Mamáguaja", location: "Gijón", region: "central", desc: "Homenaje a los bosques asturianos con productos de temporada de alta calidad, desde carnes hasta mariscos y arroces." },
    { name: "V. Crespo", location: "Gijón", region: "central", desc: "Tradición hostelera con más de un siglo de historia ofreciendo productos de primera calidad del Cantábrico." },
    { name: "Zascandil", location: "Gijón", region: "central", desc: "Cocina de mercado mediterránea con huerta propia y vistas a la bahía de San Lorenzo." },
    { name: "The Green - Artiem Asturias", location: "Quintueles", region: "central", desc: "Propuesta gastronómica saludable y sostenible en entorno natural privilegiado, con huerto propio." },
    { name: "El Balcón de Torazo", location: "Torazo, Cabranes", region: "central", desc: "Cocina tradicional asturiana con vistas espectaculares a la Sierra del Sueve." },
    { name: "Eutimio", location: "Lastres", region: "eastern", desc: "Referente de la cocina marinera asturiana con vistas al puerto pesquero de Lastres." },
    { name: "Tella", location: "Nueva de Llanes", region: "eastern", desc: "Cocina de autor en ambiente íntimo con productos locales de temporada." },
    { name: "Palacio de Cutre", location: "Cutre, Piloña", region: "eastern", desc: "Casona palaciega del siglo XVII convertida en restaurante con cocina de raíces asturianas." },
    { name: "Puebloastur", location: "Cofiño, Parres", region: "eastern", desc: "Hotel boutique con restaurante que ofrece cocina tradicional revisada en espectacular entorno rural." },
    { name: "El Corral del Indianu", location: "Arriondas", region: "eastern", desc: "Referente gastronómico del oriente asturiano con José Antonio Campoviejo al frente." },
    { name: "Los Arcos", location: "Ribadesella", region: "eastern", desc: "Tradición hostelera riosellana con productos del mar y de la huerta local." },
    { name: "Quince Nudos", location: "Llanes", region: "eastern", desc: "Cocina marinera de calidad con vistas al puerto de Llanes y los Picos de Europa." },
  ];

  let displayOrder = 21; // Start after existing stories

  for (const r of restaurants) {
    const story: Story = {
      id: `restaurant-${slugify(r.name)}`,
      slug: `restaurant-${slugify(r.name)}`,
      title: r.name,
      subtitle: r.location,
      description: r.desc,
      image: "",
      category: "food",
      sourcePdf: restaurantPdf,
      location: r.region as "eastern" | "central" | "western",
      duration: "day-trip",
      displayOrder: displayOrder++,
    };
    stories.push(story);
  }

  return stories;
}

// Extract cultural sites and attractions
function extractCulturalSites(chunks: Chunk[]): Story[] {
  const stories: Story[] = [];

  const culturalPlaces = [
    // Oviedo
    { name: "Catedral de San Salvador", location: "Oviedo", region: "central", category: "culture" as const, desc: "La joya del gótico asturiano con la Cámara Santa, Patrimonio de la Humanidad, que guarda las reliquias más veneradas del Camino de Santiago." },
    { name: "Santa María del Naranco", location: "Oviedo", region: "central", category: "culture" as const, desc: "Palacio de recreo del rey Ramiro I, obra maestra del prerrománico asturiano y Patrimonio de la Humanidad desde 1985." },
    { name: "San Miguel de Lillo", location: "Oviedo", region: "central", category: "culture" as const, desc: "Iglesia prerrománica del siglo IX con extraordinarias celosías de piedra calada y restos de pintura mural originales." },
    { name: "Teatro Campoamor", location: "Oviedo", region: "central", category: "culture" as const, desc: "Emblemático teatro donde se entregan los Premios Princesa de Asturias, referente cultural de la capital." },
    { name: "Museo de Bellas Artes de Asturias", location: "Oviedo", region: "central", category: "culture" as const, desc: "Una de las mejores colecciones de arte de España, con obras desde el siglo XIV hasta la actualidad." },

    // Gijón
    { name: "Elogio del Horizonte", location: "Gijón", region: "central", category: "cities" as const, desc: "Icónica escultura de Eduardo Chillida en el Cerro de Santa Catalina, símbolo de la ciudad y mirador privilegiado." },
    { name: "Playa de San Lorenzo", location: "Gijón", region: "central", category: "nature" as const, desc: "Kilómetro y medio de arena dorada en pleno centro urbano, una de las playas urbanas más famosas de España." },
    { name: "Laboral Ciudad de la Cultura", location: "Gijón", region: "central", category: "culture" as const, desc: "Impresionante conjunto arquitectónico reconvertido en centro cultural, con teatro, centro de arte y espacios creativos." },
    { name: "Jardín Botánico Atlántico", location: "Gijón", region: "central", category: "nature" as const, desc: "25 hectáreas de jardines temáticos que recorren la flora del Cantábrico y los ecosistemas atlánticos." },
    { name: "Acuario de Gijón", location: "Gijón", region: "central", category: "activities" as const, desc: "Viaje por los mares del mundo desde el Cantábrico hasta el Caribe, con tiburones, rayas y especies tropicales." },

    // Avilés
    { name: "Centro Niemeyer", location: "Avilés", region: "central", category: "culture" as const, desc: "Único centro cultural diseñado por Oscar Niemeyer en España, icono de la arquitectura contemporánea." },
    { name: "Casco Antiguo de Avilés", location: "Avilés", region: "central", category: "cities" as const, desc: "Uno de los conjuntos medievales mejor conservados de Asturias, con soportales, palacios y la iglesia de San Nicolás." },

    // Eastern Asturias
    { name: "Basílica de Covadonga", location: "Covadonga", region: "eastern", category: "culture" as const, desc: "Santuario donde comenzó la Reconquista, lugar de peregrinación con la Santa Cueva y la Santina." },
    { name: "Lagos de Covadonga", location: "Picos de Europa", region: "eastern", category: "nature" as const, desc: "Enol y Ercina, dos lagos de origen glaciar rodeados de las cumbres más imponentes de los Picos de Europa." },
    { name: "Cueva de Tito Bustillo", location: "Ribadesella", region: "eastern", category: "culture" as const, desc: "Una de las cuevas con arte rupestre más importantes de Europa, con pinturas de 15.000 años de antigüedad." },
    { name: "Bufones de Pría", location: "Llanes", region: "eastern", category: "nature" as const, desc: "Espectacular fenómeno natural donde el mar emerge a través de chimeneas en la roca con rugidos y columnas de agua." },
    { name: "Playa de Gulpiyuri", location: "Llanes", region: "eastern", category: "nature" as const, desc: "Diminuta playa interior a 100 metros del mar, alimentada por un túnel bajo los acantilados. Una rareza geológica." },
    { name: "Descenso del Sella", location: "Arriondas-Ribadesella", region: "eastern", category: "activities" as const, desc: "La fiesta deportiva más popular de Asturias, descenso en piragua por el río Sella cada primer sábado de agosto." },
    { name: "Naranjo de Bulnes", location: "Cabrales", region: "eastern", category: "nature" as const, desc: "El pico más emblemático de los Picos de Europa, con sus 2.519 metros desafiando a alpinistas de todo el mundo." },
    { name: "Ruta del Cares", location: "Picos de Europa", region: "eastern", category: "activities" as const, desc: "12 kilómetros de sendero tallado en la roca entre León y Asturias, la ruta de senderismo más famosa de España." },

    // Western Asturias
    { name: "Cudillero", location: "Costa occidental", region: "western", category: "cities" as const, desc: "Pintoresco pueblo marinero con casas de colores escalonadas sobre el puerto, uno de los más fotografiados de España." },
    { name: "Playa de las Catedrales", location: "Ribadeo", region: "western", category: "nature" as const, desc: "Impresionantes formaciones rocosas que semejan arbotantes de catedral gótica, accesibles con marea baja." },
    { name: "Cabo Vidio", location: "Cudillero", region: "western", category: "nature" as const, desc: "Espectacular acantilado de 80 metros con faro histórico y vistas infinitas sobre el Cantábrico." },
    { name: "Playa del Silencio", location: "Cudillero", region: "western", category: "nature" as const, desc: "Playa virgen rodeada de acantilados, accesible solo a pie, considerada una de las más bonitas de Asturias." },
    { name: "Castro de Coaña", location: "Coaña", region: "western", category: "culture" as const, desc: "Uno de los poblados fortificados prerromanos mejor conservados de la península, testimonio de la cultura castreña." },
  ];

  let displayOrder = 100;

  for (const place of culturalPlaces) {
    const story: Story = {
      id: slugify(place.name),
      slug: slugify(place.name),
      title: place.name,
      subtitle: place.location,
      description: place.desc,
      image: "",
      category: place.category,
      sourcePdf: "Guia-cultura-ES.pdf",
      location: place.region as "eastern" | "central" | "western",
      duration: "day-trip",
      displayOrder: displayOrder++,
    };
    stories.push(story);
  }

  return stories;
}

// Extract family activities
function extractFamilyActivities(chunks: Chunk[]): Story[] {
  const stories: Story[] = [];

  const activities = [
    { name: "Museo del Jurásico (MUJA)", location: "Colunga", region: "eastern", desc: "Viaje al pasado en forma de huella de dinosaurio. Réplicas a escala real, fósiles auténticos y actividades interactivas para toda la familia." },
    { name: "Teleférico de Fuente Dé", location: "Picos de Europa", region: "eastern", desc: "Ascenso vertiginoso de 753 metros en 4 minutos hasta el corazón de los Picos de Europa. Vistas que quitan el aliento." },
    { name: "Parque de la Prehistoria", location: "Teverga", region: "central", desc: "Reproducciones de las mejores pinturas rupestres del mundo en cuevas artificiales. Arte paleolítico accesible para todos." },
    { name: "Senda del Oso", location: "Teverga-Quirós", region: "central", desc: "36 kilómetros de vía verde perfecta para bicicleta, con cercado de osos y paisajes de montaña espectaculares." },
    { name: "Mina de Arnao", location: "Castrillón", region: "central", desc: "Primera mina de carbón submarina de Europa convertida en museo. Descenso a las entrañas de la historia industrial." },
    { name: "Tren Minero de Samuño", location: "Langreo", region: "central", desc: "Viaje en tren por galerías mineras con pozo y castillete original. La memoria de la minería asturiana." },
    { name: "Cueva del Sidrón", location: "Piloña", region: "eastern", desc: "Yacimiento donde se encontraron restos de neandertales de 49.000 años. Centro de interpretación fascinante." },
    { name: "Bosque de Muniellos", location: "Cangas del Narcea", region: "western", desc: "El mayor robledal de España y uno de los mejor conservados de Europa. Reserva natural con acceso limitado." },
    { name: "Aventura en los Picos", location: "Cangas de Onís", region: "eastern", desc: "Barranquismo, escalada, vías ferratas y puenting en el corazón de los Picos de Europa. Adrenalina garantizada." },
    { name: "Playa de Rodiles", location: "Villaviciosa", region: "eastern", desc: "Extensa playa con dunas, ría y una de las mejores olas de surf del Cantábrico. Paraíso para familias y surfistas." },
  ];

  let displayOrder = 200;

  for (const activity of activities) {
    const story: Story = {
      id: slugify(activity.name),
      slug: slugify(activity.name),
      title: activity.name,
      subtitle: activity.location,
      description: activity.desc,
      image: "",
      category: "activities",
      sourcePdf: "Asturias-en-familia-ES.pdf",
      location: activity.region as "eastern" | "central" | "western",
      duration: "day-trip",
      displayOrder: displayOrder++,
    };
    stories.push(story);
  }

  return stories;
}

// Extract Camino de Santiago content
function extractCaminoContent(chunks: Chunk[]): Story[] {
  const stories: Story[] = [];

  const caminoPlaces = [
    { name: "Camino Primitivo", location: "De Oviedo a Santiago", desc: "La ruta jacobea más antigua, partiendo de la Catedral de Oviedo. 14 etapas por montañas y bosques hasta Santiago de Compostela." },
    { name: "Camino del Norte", location: "Costa cantábrica", desc: "El camino costero que recorre acantilados, playas y villas marineras de Asturias. Espectaculares vistas del Cantábrico." },
    { name: "Cámara Santa de Oviedo", location: "Oviedo", desc: "Lugar de peregrinación esencial en el Camino. Guarda el Arca Santa y las cruces de la Victoria y de los Ángeles." },
    { name: "Monasterio de San Salvador", location: "Cornellana", desc: "Parada obligada en el Camino Primitivo, con claustro románico y retablo barroco de gran belleza." },
    { name: "Puerto del Palo", location: "Tineo", desc: "Paso de montaña en el Camino Primitivo con ermita y vistas panorámicas. Uno de los puntos más altos de la ruta." },
  ];

  let displayOrder = 300;

  for (const place of caminoPlaces) {
    const story: Story = {
      id: `camino-${slugify(place.name)}`,
      slug: `camino-${slugify(place.name)}`,
      title: place.name,
      subtitle: place.location,
      description: place.desc,
      image: "",
      category: "culture",
      sourcePdf: "Planificador-Camino-ES.pdf",
      location: "central",
      duration: "week",
      displayOrder: displayOrder++,
    };
    stories.push(story);
  }

  return stories;
}

// Extract gastronomy content
function extractGastronomyContent(chunks: Chunk[]): Story[] {
  const stories: Story[] = [];

  const gastroTopics = [
    { name: "Fabada Asturiana", location: "Todo Asturias", region: "central", desc: "El plato más emblemático: fabes de la Granja con compango (chorizo, morcilla y lacón). Cocida a fuego lento durante horas." },
    { name: "Queso Cabrales", location: "Picos de Europa", region: "eastern", desc: "El rey de los quesos azules españoles, madurado en cuevas naturales de los Picos. Sabor intenso e inconfundible." },
    { name: "Sidra Asturiana", location: "Comarca de la Sidra", region: "eastern", desc: "Bebida identitaria escanceada desde altura. Ritual, cultura y tradición en cada culín de esta bebida milenaria." },
    { name: "Cachopo Asturiano", location: "Todo Asturias", region: "central", desc: "Dos filetes de ternera rellenos de jamón y queso, empanados y fritos. El plato contundente por excelencia." },
    { name: "Arroz con Leche", location: "Todo Asturias", region: "central", desc: "Postre cremoso con canela y limón, cocinado lentamente hasta conseguir la textura perfecta. Tradición en cada cucharada." },
    { name: "Pote Asturiano", location: "Todo Asturias", region: "central", desc: "Guiso de berzas con patatas, judías y compango. Reconfortante plato de cuchara para los días fríos de montaña." },
    { name: "Tortos con Picadillo", location: "Todo Asturias", region: "central", desc: "Tortas de maíz fritas acompañadas de picadillo de cerdo. Sabor auténtico de la cocina rural asturiana." },
    { name: "Oricios (Erizos de Mar)", location: "Costa cantábrica", region: "central", desc: "Delicadeza marina de invierno. Erizos de mar frescos servidos en su caparazón, manjar de los entendidos." },
  ];

  let displayOrder = 400;

  for (const topic of gastroTopics) {
    const story: Story = {
      id: `gastro-${slugify(topic.name)}`,
      slug: `gastro-${slugify(topic.name)}`,
      title: topic.name,
      subtitle: topic.location,
      description: topic.desc,
      image: "",
      category: "food",
      sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf",
      location: topic.region as "eastern" | "central" | "western",
      duration: "day-trip",
      displayOrder: displayOrder++,
    };
    stories.push(story);
  }

  return stories;
}

async function main() {
  console.log("Loading chunks...");
  const data = fs.readFileSync(CHUNKS_FILE, "utf-8");
  const chunks: Chunk[] = JSON.parse(data);
  console.log(`Loaded ${chunks.length} chunks`);

  const allStories: Story[] = [];

  // Extract different types of stories
  console.log("\nExtracting restaurants...");
  const restaurants = extractRestaurants(chunks);
  console.log(`Found ${restaurants.length} restaurants`);
  allStories.push(...restaurants);

  console.log("\nExtracting cultural sites...");
  const cultural = extractCulturalSites(chunks);
  console.log(`Found ${cultural.length} cultural sites`);
  allStories.push(...cultural);

  console.log("\nExtracting family activities...");
  const activities = extractFamilyActivities(chunks);
  console.log(`Found ${activities.length} activities`);
  allStories.push(...activities);

  console.log("\nExtracting Camino content...");
  const camino = extractCaminoContent(chunks);
  console.log(`Found ${camino.length} Camino stories`);
  allStories.push(...camino);

  console.log("\nExtracting gastronomy content...");
  const gastro = extractGastronomyContent(chunks);
  console.log(`Found ${gastro.length} gastronomy stories`);
  allStories.push(...gastro);

  // Deduplicate by ID
  const uniqueStories = new Map<string, Story>();
  for (const story of allStories) {
    if (!uniqueStories.has(story.id)) {
      uniqueStories.set(story.id, story);
    }
  }

  const finalStories = Array.from(uniqueStories.values());

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalStories, null, 2));

  // Generate TypeScript output
  const tsOutput = `// Generated stories - add to ALL_STORIES in seed-database.ts
// Total: ${finalStories.length} stories

export const GENERATED_STORIES = ${JSON.stringify(finalStories, null, 2)} as const;
`;

  const tsOutputFile = path.join(process.cwd(), "content", "processed", "extracted-stories.ts");
  fs.writeFileSync(tsOutputFile, tsOutput);

  console.log(`\n✅ Extracted ${finalStories.length} unique stories`);
  console.log(`JSON saved to: ${OUTPUT_FILE}`);
  console.log(`TypeScript saved to: ${tsOutputFile}`);

  // Summary by category
  const byCategory = new Map<string, number>();
  for (const story of finalStories) {
    byCategory.set(story.category, (byCategory.get(story.category) || 0) + 1);
  }

  console.log("\nStories by category:");
  for (const [category, count] of byCategory) {
    console.log(`  ${category}: ${count}`);
  }

  // Summary by location
  const byLocation = new Map<string, number>();
  for (const story of finalStories) {
    const loc = story.location || "unknown";
    byLocation.set(loc, (byLocation.get(loc) || 0) + 1);
  }

  console.log("\nStories by location:");
  for (const [location, count] of byLocation) {
    console.log(`  ${location}: ${count}`);
  }
}

main().catch(console.error);
