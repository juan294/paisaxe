/**
 * Seed script to add draft cycling stories to the database
 * These stories are created with curation_status: "needs_curation"
 * so they appear in the admin panel for final curation and image selection.
 *
 * Run with: npx tsx scripts/seed-cycling-stories.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CyclingStory {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: "activities" | "culture";
  location: "eastern" | "central" | "western";
  duration: "day-trip" | "weekend" | "week";
  source_pdf: string;
  metadata: Record<string, unknown>;
  image_path: string;
  image_source: string;
}

const cyclingStories: CyclingStory[] = [
  {
    slug: "angliru-bestia-asturias",
    title: "Angliru: La Bestia de Asturias",
    subtitle: "Sierra del Aramo, Riosa",
    description:
      "El Alto del Angliru es el puerto más temido de La Vuelta a España. Con rampas que superan el 23% de pendiente, esta ascensión mítica ha sido escenario de hazañas épicas del ciclismo mundial. La carretera serpentea por la solitaria Sierra del Aramo, independiente del resto de la Cordillera Cantábrica, donde lobos y liebres del piornal encuentran refugio. Al pie del Angliru, las antiguas Minas de Texeo, ricas en cobre desde el año 2000 a.C., añaden historia a este paisaje de leyenda. Para los aficionados a la BTT, el anillo ciclista de la Montaña Central ofrece una alternativa menos vertical pero igualmente espectacular.",
    category: "activities",
    location: "central",
    duration: "day-trip",
    source_pdf: "7a0b1395-6aca-5b9d-fb73-41ec3cd34525.pdf",
    image_path: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=1920&q=80&auto=format&fit=crop",
    image_source: "unsplash-placeholder:Photo by Markus Spiske on Unsplash",
    metadata: {
      elevation: "1570m",
      distance: "12.5km",
      maxGradient: "23.5%",
      avgGradient: "10.2%",
      vueltaStages: "multiple",
      difficulty: "extreme",
      contentSources: [
        "669fe087-a991-8c69-74d0-d9fe860d2635.pdf",
        "ed05eaef-9db7-f243-3704-74709e9af034.pdf",
        "b7868711-15c2-d16c-cb97-57402d46450f.pdf",
      ],
    },
  },
  {
    slug: "lagos-covadonga-bicicleta",
    title: "Lagos de Covadonga en Bicicleta",
    subtitle: "Picos de Europa",
    description:
      "La subida a los Lagos de Covadonga es una de las ascensiones más icónicas del ciclismo español. Esta ruta épica atraviesa el corazón de los Picos de Europa hasta alcanzar los lagos glaciares de Enol y Ercina, rodeados de las cumbres más imponentes del macizo. El recorrido combina la dureza de sus rampas con paisajes de una belleza sobrecogedora: bosques de hayas, praderas de alta montaña y vistas que quitan el aliento. Escenario habitual de La Vuelta a España, cada pedalada aquí es un homenaje a los grandes del ciclismo que han dejado su huella en estas carreteras legendarias.",
    category: "activities",
    location: "eastern",
    duration: "day-trip",
    source_pdf: "7a0b1395-6aca-5b9d-fb73-41ec3cd34525.pdf",
    image_path: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=1920&q=80&auto=format&fit=crop",
    image_source: "unsplash-placeholder:Photo by David Marcu on Unsplash",
    metadata: {
      elevation: "1134m",
      distance: "14km",
      avgGradient: "7.3%",
      vueltaStages: "multiple",
      difficulty: "hard",
      highlights: ["Lago Enol", "Lago Ercina", "Mirador de la Reina"],
      contentSources: [
        "ed05eaef-9db7-f243-3704-74709e9af034.pdf",
        "de24eb27-a424-c06a-30e4-efaed63bc8ec.pdf",
      ],
    },
  },
  {
    slug: "vias-verdes-asturias",
    title: "Vías Verdes: De Raíles a Senderos",
    subtitle: "Rutas ciclistas para todos",
    description:
      "Las antiguas vías del ferrocarril minero de Asturias se han transformado en sendas verdes perfectas para recorrer en bicicleta. La Vía Verde de Fuso la Reina, cerca de Oviedo, nos invita a sumergirnos en la tranquilidad de los paisajes naturales asturianos. La de La Camocha en Gijón conecta con sendas fluviales de gran belleza. El Valle de Turón ofrece un circuito de 20 km entre praderías y vestigios de la historia minera. Y la Vía Verde del Eo, con sus 14 km completamente llanos, es ideal para familias. Todas conservan el espíritu de aquellas locomotoras que, con ingenio técnico y empeño humano, salvaron las montañas que rodean al Principado.",
    category: "activities",
    location: "central",
    duration: "day-trip",
    source_pdf: "7a0b1395-6aca-5b9d-fb73-41ec3cd34525.pdf",
    image_path: "https://images.unsplash.com/photo-1544191696-102dbdaeeaa0?w=1920&q=80&auto=format&fit=crop",
    image_source: "unsplash-placeholder:Photo by Murillo de Paula on Unsplash",
    metadata: {
      routes: [
        {
          name: "Vía Verde de Fuso la Reina",
          location: "Oviedo",
          distance: "15km",
        },
        {
          name: "Vía Verde de La Camocha",
          location: "Gijón",
          distance: "24km",
        },
        { name: "Valle de Turón", location: "Mieres", distance: "20km" },
        {
          name: "Vía Verde del Eo",
          location: "San Tirso de Abres",
          distance: "14km",
          elevation: "45m",
        },
        { name: "Valle de Loredo", location: "La Pereda", distance: "4km" },
      ],
      difficulty: "easy",
      familyFriendly: true,
      contentSources: [
        "68286f5a-b26f-7e77-6b7f-20224b256230.pdf",
        "Asturias-en-familia-ES.pdf",
        "b7868711-15c2-d16c-cb97-57402d46450f.pdf",
      ],
    },
  },
  {
    slug: "ruta-costera-llanes-niembro",
    title: "Pedaleando entre Playas: Llanes a Niembro",
    subtitle: "Costa oriental de Asturias",
    description:
      "Una ruta de 9 kilómetros que conecta algunas de las playas más hermosas de la costa asturiana. Partiendo de la playa de Poo, el recorrido serpentea junto al mar pasando por las playas de San Martín, Celoriu, Borizu, Troenzo, Sorraos y Barro, hasta llegar a la pintoresca ría de Niembro con su iglesia de Santa María de los Dolores. El camino ofrece vistas constantes del Cantábrico y la posibilidad de detenerse a refrescarse en cualquiera de estas calas de ensueño. El regreso puede hacerse por el mismo camino o tomando el tren en Celoriu para volver a Llanes, combinando bicicleta y ferrocarril en una jornada perfecta.",
    category: "activities",
    location: "eastern",
    duration: "day-trip",
    source_pdf: "Asturias-en-familia-ES.pdf",
    image_path: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1920&q=80&auto=format&fit=crop",
    image_source: "unsplash-placeholder:Photo by David Marcu on Unsplash",
    metadata: {
      distance: "9km",
      difficulty: "easy",
      beaches: [
        "Poo",
        "San Martín",
        "Celoriu",
        "Borizu",
        "Troenzo",
        "Sorraos",
        "Barro",
      ],
      endpoint: "Ría de Niembro",
      trainReturn: "Celoriu station",
      familyFriendly: true,
      contentSources: ["Asturias-en-familia-ES.pdf"],
    },
  },
  {
    slug: "camino-santiago-bicicleta",
    title: "El Camino de Santiago sobre Dos Ruedas",
    subtitle: "200 km de peregrinación ciclista",
    description:
      "Recorrer el Camino de Santiago en bicicleta es una forma única de vivir esta experiencia milenaria. Desde Asturias parten dos rutas históricas: el Camino Primitivo, la ruta jacobea más antigua que nace en la Catedral de Oviedo, y el Camino del Norte, que recorre la espectacular costa cantábrica entre acantilados, playas y villas marineras. Para obtener la Compostela, los peregrinos deben recorrer al menos los últimos 200 kilómetros en bicicleta. Los albergues públicos reservados para peregrinos ofrecen servicios pensados para ciclistas: garaje para bicicletas, zona de taller con herramientas, espacio de lavado y servicio de lavandería. Una aventura que une cultura, historia, naturaleza y sostenibilidad.",
    category: "culture",
    location: "central",
    duration: "week",
    source_pdf: "Planificador-Camino-ES.pdf",
    image_path: "https://images.unsplash.com/photo-1501147830916-ce44a6359892?w=1920&q=80&auto=format&fit=crop",
    image_source: "unsplash-placeholder:Photo by David Marcu on Unsplash",
    metadata: {
      routes: [
        {
          name: "Camino Primitivo",
          start: "Oviedo",
          stages: 14,
          terrain: "mountain",
        },
        {
          name: "Camino del Norte",
          start: "Costa cantábrica",
          terrain: "coastal",
        },
      ],
      minimumDistance: "200km",
      credential: "Required for albergues",
      compostela: "Certificate of completion",
      services: [
        "Bike storage",
        "Workshop tools",
        "Bike wash",
        "Laundry",
        "Route info",
      ],
      contentSources: [
        "Planificador-Camino-ES.pdf",
        "e3048e60-2cb9-2b39-a441-055f4f2287b7.pdf",
        "7a0b1395-6aca-5b9d-fb73-41ec3cd34525.pdf",
      ],
    },
  },
];

async function seedCyclingStories() {
  console.log("🚴 Seeding cycling stories...\n");

  // Get the current max display_order
  const { data: maxOrderStory } = await supabase
    .from("stories")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  let displayOrder = (maxOrderStory?.display_order ?? 500) + 1;

  for (const story of cyclingStories) {
    // Check if story already exists
    const { data: existing } = await supabase
      .from("stories")
      .select("id, slug")
      .eq("slug", story.slug)
      .single();

    if (existing) {
      console.log(`⏭️  Skipping "${story.title}" - already exists`);
      continue;
    }

    const { data, error } = await supabase
      .from("stories")
      .insert({
        slug: story.slug,
        title: story.title,
        subtitle: story.subtitle,
        description: story.description,
        category: story.category,
        location: story.location,
        duration: story.duration,
        source_pdf: story.source_pdf,
        metadata: story.metadata,
        display_order: displayOrder++,
        curation_status: "needs_curation",
        is_active: true,
        source_type: "curated",
        image_path: story.image_path,
        image_source: story.image_source,
      })
      .select("id, slug, title")
      .single();

    if (error) {
      console.error(`❌ Failed to insert "${story.title}":`, error.message);
    } else {
      console.log(`✅ Created draft: "${data.title}" (${data.slug})`);
    }
  }

  console.log("\n🎉 Done! Stories are now available in the admin panel.");
  console.log("   Navigate to /admin/stories to add images and approve them.");
}

seedCyclingStories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
