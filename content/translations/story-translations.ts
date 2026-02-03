/**
 * Story translations for en, fr, de, pt, ast locales.
 * Spanish (es) is the default and stored in the main story fields.
 *
 * These translations are used by the seed-translations.ts script
 * to populate the stories.metadata.translations field in the database.
 */

import type { StoryLocale, StoryTranslation } from '@/types/immersive';

export type StoryTranslations = Record<string, Partial<Record<StoryLocale, StoryTranslation>>>;

export const STORY_TRANSLATIONS: StoryTranslations = {
  // ============================================
  // CORE STORIES (20 stories from seed-database.ts)
  // ============================================

  'lagos-covadonga': {
    en: {
      title: 'Lakes of Covadonga',
      subtitle: 'Picos de Europa',
      description: 'Two glacial lakes surrounded by the imposing peaks of Picos de Europa. A breathtaking landscape in any season.',
    },
    fr: {
      title: 'Lacs de Covadonga',
      subtitle: 'Pics d\'Europe',
      description: 'Deux lacs d\'origine glaciaire entourés des sommets imposants des Pics d\'Europe. Un paysage à couper le souffle en toute saison.',
    },
    de: {
      title: 'Seen von Covadonga',
      subtitle: 'Picos de Europa',
      description: 'Zwei Gletscherseen umgeben von den imposanten Gipfeln der Picos de Europa. Eine atemberaubende Landschaft zu jeder Jahreszeit.',
    },
    pt: {
      title: 'Lagos de Covadonga',
      subtitle: 'Picos da Europa',
      description: 'Dois lagos de origem glaciar rodeados pelos imponentes picos dos Picos da Europa. Uma paisagem de tirar o fôlego em qualquer época do ano.',
    },
    ast: {
      title: 'Llagos de Cuadonga',
      subtitle: 'Picos d\'Europa',
      description: 'Dos llagos d\'orixe glaciar arrodiaos polos imponentes picos de los Picos d\'Europa. Un paisaxe de quitar l\'aliendu en cualquier temporada.',
    },
  },

  'oviedo-catedral': {
    en: {
      title: 'Oviedo Cathedral',
      subtitle: 'Capital of the Principality',
      description: 'The jewel of Asturian Gothic architecture, with its Holy Chamber declared a World Heritage Site. Centuries of history in every stone.',
    },
    fr: {
      title: 'Cathédrale d\'Oviedo',
      subtitle: 'Capitale de la Principauté',
      description: 'Le joyau du gothique asturien, avec sa Chambre Sainte classée au patrimoine mondial. Des siècles d\'histoire dans chaque pierre.',
    },
    de: {
      title: 'Kathedrale von Oviedo',
      subtitle: 'Hauptstadt des Fürstentums',
      description: 'Das Juwel der asturischen Gotik mit ihrer zum Weltkulturerbe erklärten Heiligen Kammer. Jahrhunderte Geschichte in jedem Stein.',
    },
    pt: {
      title: 'Catedral de Oviedo',
      subtitle: 'Capital do Principado',
      description: 'A joia do gótico asturiano, com a sua Câmara Santa declarada Património da Humanidade. Séculos de história em cada pedra.',
    },
    ast: {
      title: 'Catedral d\'Uviéu',
      subtitle: 'Capital del Principáu',
      description: 'La xoya del góticu asturianu, cola so Cámara Santa declarada Patrimoniu de la Humanidá. Sieglos d\'historia en cada piedra.',
    },
  },

  'fabada': {
    en: {
      title: 'Fabada Asturiana',
      subtitle: 'Tradition in every spoonful',
      description: 'The most emblematic dish of our gastronomy. White beans, chorizo, morcilla and ham slow-cooked with all the flavor of Asturias.',
    },
    fr: {
      title: 'Fabada Asturienne',
      subtitle: 'Tradition dans chaque cuillerée',
      description: 'Le plat le plus emblématique de notre gastronomie. Haricots blancs, chorizo, boudin noir et jambon mijotés avec toute la saveur des Asturies.',
    },
    de: {
      title: 'Fabada Asturiana',
      subtitle: 'Tradition in jedem Löffel',
      description: 'Das emblematischste Gericht unserer Gastronomie. Weiße Bohnen, Chorizo, Blutwurst und Schinken langsam gegart mit dem ganzen Geschmack Asturiens.',
    },
    pt: {
      title: 'Fabada Asturiana',
      subtitle: 'Tradição em cada colherada',
      description: 'O prato mais emblemático da nossa gastronomia. Feijão branco, chouriço, morcela e presunto cozinhados lentamente com todo o sabor das Astúrias.',
    },
    ast: {
      title: 'Fabada Asturiana',
      subtitle: 'Tradición en cada cucharada',
      description: 'El platu más emblemáticu de la nuesa gastronomía. Fabes blanques, chorizu, morciellu y xamón cocíos a fueu lento con tol sabor d\'Asturies.',
    },
  },

  'prerromanico': {
    en: {
      title: 'Pre-Romanesque Art',
      subtitle: 'World Heritage',
      description: 'Santa María del Naranco, San Miguel de Lillo... Unique architectural treasures in the world that tell the story of the Kingdom of Asturias.',
    },
    fr: {
      title: 'Art Préroman',
      subtitle: 'Patrimoine Mondial',
      description: 'Santa María del Naranco, San Miguel de Lillo... Des trésors architecturaux uniques au monde qui racontent l\'histoire du Royaume des Asturies.',
    },
    de: {
      title: 'Präromanische Kunst',
      subtitle: 'Weltkulturerbe',
      description: 'Santa María del Naranco, San Miguel de Lillo... Einzigartige architektonische Schätze der Welt, die die Geschichte des Königreichs Asturien erzählen.',
    },
    pt: {
      title: 'Arte Pré-Românica',
      subtitle: 'Património Mundial',
      description: 'Santa María del Naranco, San Miguel de Lillo... Tesouros arquitetónicos únicos no mundo que contam a história do Reino das Astúrias.',
    },
    ast: {
      title: 'Arte Prerrománicu',
      subtitle: 'Patrimoniu Mundial',
      description: 'Santa María del Narancu, San Miguel de Lliño... Ayalgues arquitectóniques úniques nel mundu que cuenten la hestoria del Reinu d\'Asturies.',
    },
  },

  'ruta-cares': {
    en: {
      title: 'Cares Route',
      subtitle: 'The Divine Gorge',
      description: '12 kilometers carved into the rock between Caín and Poncebos. One of the most spectacular hiking trails in Europe.',
    },
    fr: {
      title: 'Route du Cares',
      subtitle: 'La Gorge Divine',
      description: '12 kilomètres creusés dans la roche entre Caín et Poncebos. L\'une des randonnées les plus spectaculaires d\'Europe.',
    },
    de: {
      title: 'Cares-Route',
      subtitle: 'Die Göttliche Schlucht',
      description: '12 Kilometer in den Felsen gehauen zwischen Caín und Poncebos. Einer der spektakulärsten Wanderwege Europas.',
    },
    pt: {
      title: 'Rota do Cares',
      subtitle: 'A Garganta Divina',
      description: '12 quilómetros escavados na rocha entre Caín e Poncebos. Uma das trilhas mais espetaculares da Europa.',
    },
    ast: {
      title: 'Ruta\'l Cares',
      subtitle: 'La Garganta Divina',
      description: '12 quilómetros escavaos na roca ente Caín y Poncebos. Una de les rutes de senderismu más espectaculares d\'Europa.',
    },
  },

  'playa-silencio': {
    en: {
      title: 'Beach of Silence',
      subtitle: 'Cudillero',
      description: 'A natural amphitheater of cliffs embracing crystal-clear waters. Silence, peace and the wild beauty of the Cantabrian Sea.',
    },
    fr: {
      title: 'Plage du Silence',
      subtitle: 'Cudillero',
      description: 'Un amphithéâtre naturel de falaises embrassant des eaux cristallines. Silence, paix et beauté sauvage de la mer Cantabrique.',
    },
    de: {
      title: 'Strand der Stille',
      subtitle: 'Cudillero',
      description: 'Ein natürliches Amphitheater aus Klippen, das kristallklares Wasser umschließt. Stille, Frieden und die wilde Schönheit des Kantabrischen Meeres.',
    },
    pt: {
      title: 'Praia do Silêncio',
      subtitle: 'Cudillero',
      description: 'Um anfiteatro natural de falésias abraçando águas cristalinas. Silêncio, paz e a beleza selvagem do Mar Cantábrico.',
    },
    ast: {
      title: 'Playa\'l Silenciu',
      subtitle: 'Paraísu natural',
      description: 'Una cala escondida arrodiada de cantiles verdes. Agües cristalinas y tranquilidá absoluta nún de los rincones más guapos d\'Asturies.',
    },
  },

  'sidra': {
    en: {
      title: 'Asturian Cider',
      subtitle: 'Liquid culture',
      description: 'The art of pouring, century-old cider houses, the ritual of the culín. More than a drink, a way of understanding life.',
    },
    fr: {
      title: 'Cidre Asturien',
      subtitle: 'Culture liquide',
      description: 'L\'art de verser, les cidreries centenaires, le rituel du culín. Plus qu\'une boisson, une façon de comprendre la vie.',
    },
    de: {
      title: 'Asturischer Apfelwein',
      subtitle: 'Flüssige Kultur',
      description: 'Die Kunst des Einschenkens, jahrhundertealte Apfelweinhäuser, das Ritual des Culín. Mehr als ein Getränk, eine Lebensart.',
    },
    pt: {
      title: 'Sidra Asturiana',
      subtitle: 'Cultura líquida',
      description: 'A arte de escanciar, as sidrerias centenárias, o ritual do culín. Mais do que uma bebida, uma forma de entender a vida.',
    },
    ast: {
      title: 'Sidra Asturiana',
      subtitle: 'Tradición llíquida',
      description: 'L\'arte d\'escanciar y el sabor únicu de la nuesa bébora tradicional. Una esperiencia gastronómica qu\'hai que vivir en Asturies.',
    },
  },

  'gijon': {
    en: {
      title: 'Gijón',
      subtitle: 'City and sea',
      description: 'Cimadevilla, San Lorenzo, the Praise of the Horizon... A city that looks to the sea with the unique personality of the authentic.',
    },
    fr: {
      title: 'Gijón',
      subtitle: 'Ville et mer',
      description: 'Cimadevilla, San Lorenzo, l\'Éloge de l\'Horizon... Une ville tournée vers la mer avec la personnalité unique de l\'authentique.',
    },
    de: {
      title: 'Gijón',
      subtitle: 'Stadt und Meer',
      description: 'Cimadevilla, San Lorenzo, das Lob des Horizonts... Eine Stadt, die mit der einzigartigen Persönlichkeit des Authentischen aufs Meer blickt.',
    },
    pt: {
      title: 'Gijón',
      subtitle: 'Cidade e mar',
      description: 'Cimadevilla, San Lorenzo, o Elogio do Horizonte... Uma cidade que olha para o mar com a personalidade única do autêntico.',
    },
    ast: {
      title: 'Xixón',
      subtitle: 'Mar y cultura',
      description: 'La ciudá más grande d\'Asturies combina playes urbanes, gastronomía marinera y una vida cultural vibrante. El Cantábricu na so máxima espresión.',
    },
  },

  'aviles': {
    en: {
      title: 'Avilés',
      subtitle: 'Town of the Adelantado',
      description: 'The best-preserved old quarter in Asturias, with its medieval arcades and the modern Niemeyer Center looking to the future.',
    },
    fr: {
      title: 'Avilés',
      subtitle: 'Ville de l\'Adelantado',
      description: 'Le centre historique le mieux préservé des Asturies, avec ses arcades médiévales et le moderne Centre Niemeyer tourné vers l\'avenir.',
    },
    de: {
      title: 'Avilés',
      subtitle: 'Stadt des Adelantado',
      description: 'Die am besten erhaltene Altstadt Asturiens mit ihren mittelalterlichen Arkaden und dem modernen Niemeyer-Zentrum, das in die Zukunft blickt.',
    },
    pt: {
      title: 'Avilés',
      subtitle: 'Vila do Adelantado',
      description: 'O centro histórico mais bem preservado das Astúrias, com as suas arcadas medievais e o moderno Centro Niemeyer virado para o futuro.',
    },
    ast: {
      title: 'Avilés',
      subtitle: 'Medieval y vanguardista',
      description: 'Un cascu hestóricu medieval que convive col futurismu del Centru Niemeyer. Arquiteutura de distintos sieglos nun equilibriu perfectu.',
    },
  },

  'camino-santiago': {
    en: {
      title: 'Camino de Santiago',
      subtitle: 'Primitive Route',
      description: 'The original path traced by King Alfonso II from Oviedo. Historic trails through mountains and valleys of Asturias.',
    },
    fr: {
      title: 'Chemin de Saint-Jacques',
      subtitle: 'Voie Primitive',
      description: 'Le chemin original tracé par le roi Alphonse II depuis Oviedo. Sentiers historiques à travers montagnes et vallées des Asturies.',
    },
    de: {
      title: 'Jakobsweg',
      subtitle: 'Primitiver Weg',
      description: 'Der ursprüngliche Weg, den König Alfons II. von Oviedo aus bahnte. Historische Pfade durch Berge und Täler Asturiens.',
    },
    pt: {
      title: 'Caminho de Santiago',
      subtitle: 'Caminho Primitivo',
      description: 'O caminho original traçado pelo Rei Afonso II desde Oviedo. Trilhos históricos através das montanhas e vales das Astúrias.',
    },
    ast: {
      title: 'Camín de Santiagu',
      subtitle: 'Camín Primitivu',
      description: 'La ruta orixinal del Camín de Santiagu, dende Uviéu hasta Compostela. Atraviesa paisaxes montañoses y pueblos con encanto.',
    },
  },

  'llanes': {
    en: {
      title: 'Llanes',
      subtitle: 'Between beaches and mountains',
      description: 'More than 30 beaches, spectacular cliffs and a charming historic quarter. The essence of eastern Asturias.',
    },
    fr: {
      title: 'Llanes',
      subtitle: 'Entre plages et montagnes',
      description: 'Plus de 30 plages, des falaises spectaculaires et un centre historique charmant. L\'essence des Asturies orientales.',
    },
    de: {
      title: 'Llanes',
      subtitle: 'Zwischen Stränden und Bergen',
      description: 'Mehr als 30 Strände, spektakuläre Klippen und eine bezaubernde Altstadt. Die Essenz Ostasturiens.',
    },
    pt: {
      title: 'Llanes',
      subtitle: 'Entre praias e montanhas',
      description: 'Mais de 30 praias, falésias espetaculares e um centro histórico encantador. A essência das Astúrias orientais.',
    },
    ast: {
      title: 'Llanes',
      subtitle: 'Costera y señorial',
      description: 'Una villa marinera con playes espectaculares y un cascu hestóricu declaráu Conxuntu Hestóricu-Artísticu. Los Cubos de la Memoria son icónicos.',
    },
  },

  'cangas-onis': {
    en: {
      title: 'Cangas de Onís',
      subtitle: 'First capital of the kingdom',
      description: 'The Roman bridge over the Sella, the Basilica of Covadonga and the gateway to the Picos de Europa.',
    },
    fr: {
      title: 'Cangas de Onís',
      subtitle: 'Première capitale du royaume',
      description: 'Le pont romain sur le Sella, la basilique de Covadonga et la porte d\'entrée des Pics d\'Europe.',
    },
    de: {
      title: 'Cangas de Onís',
      subtitle: 'Erste Hauptstadt des Königreichs',
      description: 'Die Römerbrücke über den Sella, die Basilika von Covadonga und das Tor zu den Picos de Europa.',
    },
    pt: {
      title: 'Cangas de Onís',
      subtitle: 'Primeira capital do reino',
      description: 'A ponte romana sobre o Sella, a Basílica de Covadonga e a porta de entrada para os Picos da Europa.',
    },
    ast: {
      title: 'Cangues d\'Onís',
      subtitle: 'Puerta de los Picos',
      description: 'El conceyu que da entrada a los Picos d\'Europa y los Llagos de Cuadonga. La so ponte romana ye unu de los símbolos d\'Asturies.',
    },
  },

  'descenso-del-sella': {
    en: {
      title: 'Sella River Descent',
      subtitle: 'The Canoe Race',
      description: 'The most emblematic sporting festival of Asturias. Every August, thousands of paddlers descend the river from Arriondas to Ribadesella.',
    },
    fr: {
      title: 'Descente du Sella',
      subtitle: 'Les Pirogues',
      description: 'La fête sportive la plus emblématique des Asturies. Chaque août, des milliers de pagayeurs descendent la rivière d\'Arriondas à Ribadesella.',
    },
    de: {
      title: 'Sella-Abfahrt',
      subtitle: 'Die Kanufahrt',
      description: 'Das emblematischste Sportfest Asturiens. Jeden August fahren Tausende Paddler den Fluss von Arriondas nach Ribadesella hinab.',
    },
    pt: {
      title: 'Descida do Sella',
      subtitle: 'As Pirogas',
      description: 'A festa desportiva mais emblemática das Astúrias. Todos os agostos, milhares de remadores descem o rio de Arriondas a Ribadesella.',
    },
    ast: {
      title: 'Descensu del Sella',
      subtitle: 'La Fiesta de les Piragües',
      description: 'Dende 1930, miles de palistes baxen el ríu Sella n\'agostu. Una fiesta declarada d\'Interés Turísticu Internacional.',
    },
  },

  'quesos-asturianos': {
    en: {
      title: 'Asturian Cheeses',
      subtitle: 'More than 40 varieties',
      description: 'Cabrales, Gamonéu, Afuega\'l Pitu... A unique cheese-making tradition in Europe, with flavors from mild to intense.',
    },
    fr: {
      title: 'Fromages Asturiens',
      subtitle: 'Plus de 40 variétés',
      description: 'Cabrales, Gamonéu, Afuega\'l Pitu... Une tradition fromagère unique en Europe, des saveurs douces aux plus intenses.',
    },
    de: {
      title: 'Asturische Käse',
      subtitle: 'Mehr als 40 Sorten',
      description: 'Cabrales, Gamonéu, Afuega\'l Pitu... Eine einzigartige Käsetradition in Europa mit Geschmacksrichtungen von mild bis intensiv.',
    },
    pt: {
      title: 'Queijos Asturianos',
      subtitle: 'Mais de 40 variedades',
      description: 'Cabrales, Gamonéu, Afuega\'l Pitu... Uma tradição queijeira única na Europa, com sabores que vão do suave ao intenso.',
    },
    ast: {
      title: 'Quesos Asturianos',
      subtitle: 'Variedá y calidá',
      description: 'Más de 40 variedaes de quesu, incluyendo\'l Cabrales con D.O. Una tradición quesera que s\'esparde per tola xeografía asturiana.',
    },
  },

  'senda-oso': {
    en: {
      title: 'Bear Trail',
      subtitle: 'Green valley route',
      description: '30 kilometers of old railway track converted into a path. Ideal for families, through forests and the habitat of the brown bear.',
    },
    fr: {
      title: 'Sentier de l\'Ours',
      subtitle: 'Route verte de la vallée',
      description: '30 kilomètres d\'ancienne voie ferrée reconvertis en sentier. Idéal pour les familles, à travers forêts et habitat de l\'ours brun.',
    },
    de: {
      title: 'Bärenpfad',
      subtitle: 'Grüne Talroute',
      description: '30 Kilometer alte Bahnstrecke in einen Wanderweg umgewandelt. Ideal für Familien, durch Wälder und den Lebensraum des Braunbären.',
    },
    pt: {
      title: 'Senda do Urso',
      subtitle: 'Rota verde do vale',
      description: '30 quilómetros de antigo traçado ferroviário convertidos em trilho. Ideal para famílias, entre bosques e o habitat do urso-pardo.',
    },
    ast: {
      title: 'Sienda l\'Osu',
      subtitle: 'Naturaleza en familia',
      description: 'Una vía verde de 36 km al traviés de paisaxes de monte. Perfecta pa dir en bici o caminando, con árees de descansu y puntos d\'interés.',
    },
  },

  'cudillero': {
    en: {
      title: 'Cudillero',
      subtitle: 'The amphitheater of the sea',
      description: 'Colorful houses climbing up the hillside to form a picturesque amphitheater facing the Cantabrian Sea. A unique fishing village.',
    },
    fr: {
      title: 'Cudillero',
      subtitle: 'L\'amphithéâtre de la mer',
      description: 'Maisons colorées grimpant sur la colline pour former un amphithéâtre pittoresque face à la mer Cantabrique. Un village de pêcheurs unique.',
    },
    de: {
      title: 'Cudillero',
      subtitle: 'Das Amphitheater des Meeres',
      description: 'Bunte Häuser, die den Hang hinaufklettern und ein malerisches Amphitheater zum Kantabrischen Meer bilden. Ein einzigartiges Fischerdorf.',
    },
    pt: {
      title: 'Cudillero',
      subtitle: 'O anfiteatro do mar',
      description: 'Casas coloridas que trepam pela encosta formando um pitoresco anfiteatro virado para o Mar Cantábrico. Uma aldeia piscatória única.',
    },
    ast: {
      title: 'Cuideiru',
      subtitle: 'El pueblu anfiteatru',
      description: 'Cases de colores afeataes nún cantil sobre\'l mar. Ún de los pueblos más fotoxénicos d\'Asturies, con tradición marinera.',
    },
  },

  'taramundi': {
    en: {
      title: 'Taramundi',
      subtitle: 'Knife-making tradition',
      description: 'The village that revitalized rural tourism in Spain. Artisan knives, blacksmiths and the magic of western Asturias.',
    },
    fr: {
      title: 'Taramundi',
      subtitle: 'Tradition coutelière',
      description: 'Le village qui a revitalisé le tourisme rural en Espagne. Couteaux artisanaux, forgerons et magie de l\'ouest asturien.',
    },
    de: {
      title: 'Taramundi',
      subtitle: 'Messerschmiedetradition',
      description: 'Das Dorf, das den ländlichen Tourismus in Spanien wiederbelebte. Handgeschmiedete Messer, Schmiede und die Magie Westasturiens.',
    },
    pt: {
      title: 'Taramundi',
      subtitle: 'Tradição cuteleira',
      description: 'A aldeia que revitalizou o turismo rural em Espanha. Facas artesanais, ferreiros e a magia do interior ocidental das Astúrias.',
    },
    ast: {
      title: 'Taramundi',
      subtitle: 'Artesanía y naturaleza',
      description: 'Famosa poles sos navayaes artesanales. Un conceyu del interior que conserva tradiciones centenaries y paisaxes prístinos.',
    },
  },

  'bufones-de-pria': {
    en: {
      title: 'Bufones de Pría',
      subtitle: 'The roar of the sea',
      description: 'Natural chimneys through which the sea shoots jets of water and spray with a thunderous sound. The raw power of the Cantabrian.',
    },
    fr: {
      title: 'Bufones de Pría',
      subtitle: 'Le rugissement de la mer',
      description: 'Cheminées naturelles par lesquelles la mer projette jets d\'eau et embruns avec un bruit tonitruant. La puissance brute du Cantabrique.',
    },
    de: {
      title: 'Bufones de Pría',
      subtitle: 'Das Tosen des Meeres',
      description: 'Natürliche Schornsteine, durch die das Meer Wasserfontänen und Gischt mit donnerndem Geräusch schießt. Die rohe Kraft des Kantabrischen.',
    },
    pt: {
      title: 'Bufones de Pría',
      subtitle: 'O rugido do mar',
      description: 'Chaminés naturais pelas quais o mar lança jatos de água e espuma com som estrondoso. A força bruta do Cantábrico.',
    },
    ast: {
      title: 'Bufones de Pría',
      subtitle: 'Espectáculu natural',
      description: 'Formaciones xeolóxiques que llancen chorros d\'agua y soníu cuando\'l mar ta bravu. Un fenómenu únicu na costa asturiana.',
    },
  },

  'luarca': {
    en: {
      title: 'Luarca',
      subtitle: 'The white villa of the coast',
      description: 'Fishing port, cemetery with sea views and cobblestone streets. The seafaring elegance of western Asturias.',
    },
    fr: {
      title: 'Luarca',
      subtitle: 'La ville blanche de la côte',
      description: 'Port de pêche, cimetière avec vue sur la mer et rues pavées. L\'élégance maritime de l\'ouest des Asturies.',
    },
    de: {
      title: 'Luarca',
      subtitle: 'Die weiße Villa der Küste',
      description: 'Fischerhafen, Friedhof mit Meerblick und Kopfsteinpflasterstraßen. Die maritime Eleganz Westasturiens.',
    },
    pt: {
      title: 'Luarca',
      subtitle: 'A vila branca da costa',
      description: 'Porto pesqueiro, cemitério com vistas para o mar e ruas empedradas. A elegância marinheira do ocidente asturiano.',
    },
    ast: {
      title: 'Lluarca',
      subtitle: 'La villa blanca',
      description: 'Villa marinera conocida como la Villa Blanca de la Costa Verde. Destaca\'l so faru, el puertu y la so tradición ballenera.',
    },
  },

  // ============================================
  // GENERATED STORIES - RESTAURANTS (35 stories)
  // ============================================

  'restaurant-blanco': {
    en: {
      title: 'Blanco',
      subtitle: 'Navia',
      description: 'One of the main gastronomic attractions of western Asturias, specializing in seafood from the Cantabrian with over 300 wine references.',
    },
    fr: {
      title: 'Blanco',
      subtitle: 'Navia',
      description: 'L\'un des principaux foyers gastronomiques de l\'ouest asturien, spécialisé dans les fruits de mer du Cantabrique avec plus de 300 références de vins.',
    },
    de: {
      title: 'Blanco',
      subtitle: 'Navia',
      description: 'Einer der wichtigsten gastronomischen Anziehungspunkte Westasturiens, spezialisiert auf Meeresfrüchte aus dem Kantabrischen Meer mit über 300 Weinreferenzen.',
    },
    pt: {
      title: 'Blanco',
      subtitle: 'Navia',
      description: 'Um dos principais focos gastronómicos do ocidente asturiano, especializado em mariscos e peixes do Cantábrico com mais de 300 referências de vinhos.',
    },
    ast: {
      title: 'Blanco',
      subtitle: 'Navia',
      description: 'Ún de los principales focos gastronómicos d\'Asturies occidental, especializáu en mariscos del Cantábricu con más de 300 referencies de vinos.',
    },
  },

  'restaurant-villa-blanca': {
    en: {
      title: 'Villa Blanca',
      subtitle: 'Luarca',
      description: 'Over fifty years of history offering authentic traditional Asturian cuisine. Their pote and fabada with updated recipes are a must.',
    },
    fr: {
      title: 'Villa Blanca',
      subtitle: 'Luarca',
      description: 'Plus de cinquante ans d\'histoire offrant une authentique cuisine traditionnelle asturienne. Leur pote et fabada aux recettes actualisées sont incontournables.',
    },
    de: {
      title: 'Villa Blanca',
      subtitle: 'Luarca',
      description: 'Über fünfzig Jahre Geschichte mit authentischer traditioneller asturischer Küche. Ihr Pote und Fabada mit aktualisierten Rezepten sind ein Muss.',
    },
    pt: {
      title: 'Villa Blanca',
      subtitle: 'Luarca',
      description: 'Mais de cinquenta anos de história oferecendo autêntica cozinha tradicional asturiana. O seu pote e fabada com receitas atualizadas são imperdíveis.',
    },
    ast: {
      title: 'Villa Blanca',
      subtitle: 'Lluarca',
      description: 'Más de cincuenta años d\'historia ufiertando auténtica cocina tradicional asturiana. El so pote y fabada con recetes actualizaes son imprescindibles.',
    },
  },

  'restaurant-al-son-del-indiano': {
    en: {
      title: 'Al Son del Indiano',
      subtitle: 'Malleza, Salas',
      description: 'Colonial-style Asturian manor with French-inspired gastronomy and Asturian soul. Nearly thirty years of history under Luis Rubio\'s guidance.',
    },
    fr: {
      title: 'Al Son del Indiano',
      subtitle: 'Malleza, Salas',
      description: 'Maison asturienne aux touches coloniales avec gastronomie d\'inspiration française et âme asturienne. Près de trente ans d\'histoire sous la direction de Luis Rubio.',
    },
    de: {
      title: 'Al Son del Indiano',
      subtitle: 'Malleza, Salas',
      description: 'Asturisches Herrenhaus im Kolonialstil mit französisch inspirierter Gastronomie und asturischer Seele. Fast dreißig Jahre Geschichte unter Luis Rubios Führung.',
    },
    pt: {
      title: 'Al Son del Indiano',
      subtitle: 'Malleza, Salas',
      description: 'Casona asturiana com toques coloniais com gastronomia de inspiração francesa e alma asturiana. Quase trinta anos de história sob a batuta de Luis Rubio.',
    },
    ast: {
      title: 'Al Son del Indiano',
      subtitle: 'Malleza, Salas',
      description: 'Casona asturiana con toques coloniales con gastronomía d\'inspiración francesa y alma asturiana. Cuasi trenta años d\'historia baxo la batuta de Luis Rubio.',
    },
  },

  'restaurant-casa-zoilo': {
    en: {
      title: 'Casa Zoilo',
      subtitle: 'Muros de Nalón',
      description: 'Over 70 years feeding travelers with specialty in game, offal and fabes prepared five different ways.',
    },
    fr: {
      title: 'Casa Zoilo',
      subtitle: 'Muros de Nalón',
      description: 'Plus de 70 ans à nourrir les voyageurs avec spécialité en gibier, abats et fabes préparés de cinq façons différentes.',
    },
    de: {
      title: 'Casa Zoilo',
      subtitle: 'Muros de Nalón',
      description: 'Über 70 Jahre Gastfreundschaft mit Spezialitäten aus Wild, Innereien und Fabes auf fünf verschiedene Arten zubereitet.',
    },
    pt: {
      title: 'Casa Zoilo',
      subtitle: 'Muros de Nalón',
      description: 'Mais de 70 anos a alimentar viajantes com especialidade em caça, miudezas e fabes preparados de cinco maneiras diferentes.',
    },
    ast: {
      title: 'Casa Zoilo',
      subtitle: 'Muros de Nalón',
      description: 'Más de 70 años dando de comer a viaxeros con especialidá en caza, casquería y fabes preparaes de cinco maneres distintes.',
    },
  },

  'restaurant-real-balneario': {
    en: {
      title: 'Real Balneario',
      subtitle: 'Salinas',
      description: 'One of the widest varieties of fish and seafood in the country, with outstanding views of Salinas beach.',
    },
    fr: {
      title: 'Real Balneario',
      subtitle: 'Salinas',
      description: 'L\'une des plus grandes variétés de poissons et fruits de mer du pays, avec des vues exceptionnelles sur la plage de Salinas.',
    },
    de: {
      title: 'Real Balneario',
      subtitle: 'Salinas',
      description: 'Eine der größten Fisch- und Meeresfrüchteauswahl des Landes mit hervorragendem Blick auf den Strand von Salinas.',
    },
    pt: {
      title: 'Real Balneario',
      subtitle: 'Salinas',
      description: 'Uma das maiores variedades de peixes e mariscos do país, com vistas soberbas para a praia de Salinas.',
    },
    ast: {
      title: 'Real Balneario',
      subtitle: 'Salines',
      description: 'Una de les mayores variedaes de pexe y mariscu del país, con vistes soberbies a la playa de Salines.',
    },
  },

  'restaurant-eleonore': {
    en: {
      title: 'Éleonore',
      subtitle: 'Salinas',
      description: 'Contemporary cuisine built from pastry with only ten tables and panoramic views of the bay.',
    },
    fr: {
      title: 'Éleonore',
      subtitle: 'Salinas',
      description: 'Cuisine contemporaine construite depuis la pâtisserie avec seulement dix tables et vues panoramiques sur la baie.',
    },
    de: {
      title: 'Éleonore',
      subtitle: 'Salinas',
      description: 'Zeitgenössische Küche, aufgebaut auf Patisserie, mit nur zehn Tischen und Panoramablick auf die Bucht.',
    },
    pt: {
      title: 'Éleonore',
      subtitle: 'Salinas',
      description: 'Cozinha atualizada construída desde a pastelaria com apenas dez mesas e vistas panorâmicas para a baía.',
    },
    ast: {
      title: 'Éleonore',
      subtitle: 'Salines',
      description: 'Cocina contemporánea construyida dende la pastelería con namás diez meses y vistes panorámiques a la badea.',
    },
  },

  'restaurant-arraigo': {
    en: {
      title: 'Arraigo',
      subtitle: 'Posada, Llanera',
      description: 'Combines traditional Asturian cuisine with an innovative approach, using products from their own garden. Must-try: the spider crab meatball and gochu rib.',
    },
    fr: {
      title: 'Arraigo',
      subtitle: 'Posada, Llanera',
      description: 'Combine cuisine traditionnelle asturienne et approche innovante, utilisant les produits de leur propre potager. Incontournables : la boulette d\'araignée de mer et la côte de gochu.',
    },
    de: {
      title: 'Arraigo',
      subtitle: 'Posada, Llanera',
      description: 'Verbindet traditionelle asturische Küche mit innovativem Ansatz unter Verwendung von Produkten aus dem eigenen Garten. Unbedingt probieren: Seespinnen-Frikadelle und Gochu-Rippe.',
    },
    pt: {
      title: 'Arraigo',
      subtitle: 'Posada, Llanera',
      description: 'Combina cozinha tradicional asturiana com abordagem inovadora, usando produtos da sua própria horta. Imperdíveis: a almôndega de santola e a costela de gochu.',
    },
    ast: {
      title: 'Arraigo',
      subtitle: 'Posada, Llanera',
      description: 'Combina cocina tradicional asturiana con enfoque innovador, usando productos de la so propia güerta. Imprescindibles: l\'albóndiga de ñocla y la costiella de gochu.',
    },
  },

  'restaurant-casa-fermin': {
    en: {
      title: 'Casa Fermín',
      subtitle: 'Oviedo',
      description: 'One of the most elegant dining rooms in the capital, with three generations dedicated to excellent quality products.',
    },
    fr: {
      title: 'Casa Fermín',
      subtitle: 'Oviedo',
      description: 'L\'une des salles à manger les plus élégantes de la capitale, avec trois générations dédiées aux produits d\'excellente qualité.',
    },
    de: {
      title: 'Casa Fermín',
      subtitle: 'Oviedo',
      description: 'Einer der elegantesten Speisesäle der Hauptstadt mit drei Generationen, die sich exzellenten Qualitätsprodukten widmen.',
    },
    pt: {
      title: 'Casa Fermín',
      subtitle: 'Oviedo',
      description: 'Uma das salas de jantar mais elegantes da capital, com três gerações dedicadas a produtos de excelente qualidade.',
    },
    ast: {
      title: 'Casa Fermín',
      subtitle: 'Uviéu',
      description: 'Una de les sales de comer más elegantes de la capital, con tres xeneraciones dedicaes a productos d\'escelente calidá.',
    },
  },

  'restaurant-del-arco': {
    en: {
      title: 'Del Arco',
      subtitle: 'Oviedo',
      description: 'Distinguished elegant dining room with numerous awards. Try their lobster salad and Cantabrian fish.',
    },
    fr: {
      title: 'Del Arco',
      subtitle: 'Oviedo',
      description: 'Salle à manger élégante et distinguée avec de nombreux prix. Essayez leur salade de homard et les poissons du Cantabrique.',
    },
    de: {
      title: 'Del Arco',
      subtitle: 'Oviedo',
      description: 'Ausgezeichneter eleganter Speisesaal mit zahlreichen Preisen. Probieren Sie den Hummersalat und Kantabrischen Fisch.',
    },
    pt: {
      title: 'Del Arco',
      subtitle: 'Oviedo',
      description: 'Sala de jantar elegante distinguida com numerosos prémios. Experimente a sua salada de lavagante e peixes do Cantábrico.',
    },
    ast: {
      title: 'Del Arco',
      subtitle: 'Uviéu',
      description: 'Sala de comer elegante distinguida con numberosos premios. Prueba la so ensalada de llagosta y pexes del Cantábricu.',
    },
  },

  'restaurant-el-mono-que-lee': {
    en: {
      title: 'El Mono que Lee',
      subtitle: 'Oviedo',
      description: 'Charming restaurant in the Old Town with cozy atmosphere, ideal for romantic dinners or gatherings with friends.',
    },
    fr: {
      title: 'El Mono que Lee',
      subtitle: 'Oviedo',
      description: 'Restaurant charmant dans la vieille ville avec une atmosphère chaleureuse, idéal pour dîners romantiques ou retrouvailles entre amis.',
    },
    de: {
      title: 'El Mono que Lee',
      subtitle: 'Oviedo',
      description: 'Charmantes Restaurant in der Altstadt mit gemütlicher Atmosphäre, ideal für romantische Abendessen oder Treffen mit Freunden.',
    },
    pt: {
      title: 'El Mono que Lee',
      subtitle: 'Oviedo',
      description: 'Restaurante encantador no Centro Histórico com atmosfera acolhedora, ideal para jantares românticos ou encontros entre amigos.',
    },
    ast: {
      title: 'El Mono que Lee',
      subtitle: 'Uviéu',
      description: 'Restaurante encantador nel Cascu Antiguu con atmósfera acoexedora, ideal pa cenes románticos o xuntanzas con amigos.',
    },
  },

  'restaurant-la-tabernilla-de-oviedo': {
    en: {
      title: 'La Tabernilla de Oviedo',
      subtitle: 'Oviedo',
      description: 'Reference for traditional Asturian cuisine and key stop for Primitive Way pilgrims. Famous for its stews and fabada.',
    },
    fr: {
      title: 'La Tabernilla de Oviedo',
      subtitle: 'Oviedo',
      description: 'Référence de la cuisine traditionnelle asturienne et étape clé pour les pèlerins du Chemin Primitif. Célèbre pour ses ragoûts et fabada.',
    },
    de: {
      title: 'La Tabernilla de Oviedo',
      subtitle: 'Oviedo',
      description: 'Referenz für traditionelle asturische Küche und wichtige Station für Pilger des Primitiven Weges. Berühmt für Eintöpfe und Fabada.',
    },
    pt: {
      title: 'La Tabernilla de Oviedo',
      subtitle: 'Oviedo',
      description: 'Referência da cozinha tradicional asturiana e paragem chave para peregrinos do Caminho Primitivo. Famosa pelos seus guisados e fabada.',
    },
    ast: {
      title: 'La Tabernilla d\'Uviéu',
      subtitle: 'Uviéu',
      description: 'Referencia de la cocina tradicional asturiana y parada clave pa pelegrinos del Camín Primitivu. Famosa polos sos guisaos y fabada.',
    },
  },

  'restaurant-pedro-martino': {
    en: {
      title: 'Pedro Martino',
      subtitle: 'Caces, Oviedo',
      description: 'In a spectacular setting surrounded by mountains above the Nalón River, offering a personal vision of Asturian tradition from a contemporary perspective.',
    },
    fr: {
      title: 'Pedro Martino',
      subtitle: 'Caces, Oviedo',
      description: 'Dans un cadre spectaculaire entouré de montagnes au-dessus du fleuve Nalón, offrant une vision personnelle de la tradition asturienne dans une perspective contemporaine.',
    },
    de: {
      title: 'Pedro Martino',
      subtitle: 'Caces, Oviedo',
      description: 'In spektakulärer Lage umgeben von Bergen über dem Nalón-Fluss, mit persönlicher Vision der asturischen Tradition aus zeitgenössischer Perspektive.',
    },
    pt: {
      title: 'Pedro Martino',
      subtitle: 'Caces, Oviedo',
      description: 'Em cenário espetacular rodeado de montanhas sobre o Rio Nalón, oferecendo visão pessoal da tradição asturiana desde perspetiva atual.',
    },
    ast: {
      title: 'Pedro Martino',
      subtitle: 'Caces, Uviéu',
      description: 'Nun escenariu espectacular arrodiáu de montes sobre\'l ríu Nalón, ufiertando una visión personal de la tradición asturiana dende perspectiva actual.',
    },
  },

  'restaurant-scanda': {
    en: {
      title: 'Scanda',
      subtitle: 'Las Caldas, Oviedo',
      description: 'Traditional cuisine in the historic casino of Gran Hotel Las Caldas, preserving original 19th-century elements.',
    },
    fr: {
      title: 'Scanda',
      subtitle: 'Las Caldas, Oviedo',
      description: 'Cuisine traditionnelle dans le casino historique du Gran Hotel Las Caldas, préservant des éléments originaux du XIXe siècle.',
    },
    de: {
      title: 'Scanda',
      subtitle: 'Las Caldas, Oviedo',
      description: 'Traditionelle Küche im historischen Casino des Gran Hotel Las Caldas, mit erhaltenen Originalelementen aus dem 19. Jahrhundert.',
    },
    pt: {
      title: 'Scanda',
      subtitle: 'Las Caldas, Oviedo',
      description: 'Cozinha tradicional no casino histórico do Gran Hotel Las Caldas, conservando elementos originais do século XIX.',
    },
    ast: {
      title: 'Scanda',
      subtitle: 'Les Caldes, Uviéu',
      description: 'Cocina tradicional nel casino hestóricu del Gran Hotel Les Caldes, conservando elementos orixinales del sieglu XIX.',
    },
  },

  'restaurant-roble-by-jairo-rodriguez': {
    en: {
      title: 'Roble by Jairo Rodríguez',
      subtitle: 'La Pola, Lena',
      description: 'Personal vision of Asturian gastronomy at the gateway to Asturias. Prawns, roast beef, suckling pig and memorable desserts.',
    },
    fr: {
      title: 'Roble by Jairo Rodríguez',
      subtitle: 'La Pola, Lena',
      description: 'Vision personnelle de la gastronomie asturienne à l\'entrée des Asturies. Crevettes, rosbif, cochon de lait et desserts mémorables.',
    },
    de: {
      title: 'Roble by Jairo Rodríguez',
      subtitle: 'La Pola, Lena',
      description: 'Persönliche Vision der asturischen Gastronomie am Tor zu Asturien. Garnelen, Roastbeef, Spanferkel und unvergessliche Desserts.',
    },
    pt: {
      title: 'Roble by Jairo Rodríguez',
      subtitle: 'La Pola, Lena',
      description: 'Visão pessoal da gastronomia asturiana na porta de entrada das Astúrias. Gambas, rosbife, leitão e sobremesas memoráveis.',
    },
    ast: {
      title: 'Roble by Jairo Rodríguez',
      subtitle: 'La Pola, Llena',
      description: 'Visión personal de la gastronomía asturiana na puerta d\'entrada d\'Asturies. Camarones, rosbif, cochinillu y postres memorables.',
    },
  },

  'restaurant-casa-gerardo': {
    en: {
      title: 'Casa Gerardo',
      subtitle: 'Priendes, Carreño',
      description: 'Centenary restaurant at the forefront of gastronomic creativity. Marcos Morán has elevated simple products to culinary heights.',
    },
    fr: {
      title: 'Casa Gerardo',
      subtitle: 'Priendes, Carreño',
      description: 'Restaurant centenaire à la pointe de la créativité gastronomique. Marcos Morán a élevé les produits simples aux sommets culinaires.',
    },
    de: {
      title: 'Casa Gerardo',
      subtitle: 'Priendes, Carreño',
      description: 'Hundertjähriges Restaurant an der Spitze gastronomischer Kreativität. Marcos Morán hat einfache Produkte zu kulinarischen Höhen erhoben.',
    },
    pt: {
      title: 'Casa Gerardo',
      subtitle: 'Priendes, Carreño',
      description: 'Restaurante centenário na vanguarda da criatividade gastronómica. Marcos Morán elevou produtos simples aos altares da culinária.',
    },
    ast: {
      title: 'Casa Gerardo',
      subtitle: 'Priendes, Carreño',
      description: 'Restaurante centenariu a la vanguardia de la creatividá gastronómica. Marcos Morán elevó productos simples a les altures culinaries.',
    },
  },

  // ============================================
  // GENERATED STORIES - CULTURE (continues...)
  // ============================================

  'catedral-de-san-salvador': {
    en: {
      title: 'San Salvador Cathedral',
      subtitle: 'Oviedo',
      description: 'The jewel of Asturian Gothic with the Holy Chamber, World Heritage Site, housing the most venerated relics of the Camino de Santiago.',
    },
    fr: {
      title: 'Cathédrale San Salvador',
      subtitle: 'Oviedo',
      description: 'Le joyau du gothique asturien avec la Chambre Sainte, Patrimoine Mondial, qui garde les reliques les plus vénérées du Chemin de Saint-Jacques.',
    },
    de: {
      title: 'Kathedrale San Salvador',
      subtitle: 'Oviedo',
      description: 'Das Juwel der asturischen Gotik mit der Heiligen Kammer, Weltkulturerbe, die die verehrtesten Reliquien des Jakobsweges bewahrt.',
    },
    pt: {
      title: 'Catedral de San Salvador',
      subtitle: 'Oviedo',
      description: 'A joia do gótico asturiano com a Câmara Santa, Património Mundial, que guarda as relíquias mais veneradas do Caminho de Santiago.',
    },
    ast: {
      title: 'Catedral de San Salvador',
      subtitle: 'Uviéu',
      description: 'La xoya del góticu asturianu cola Cámara Santa, Patrimoniu Mundial, que guarda les reliquies más veneraes del Camín de Santiagu.',
    },
  },

  'santa-maria-del-naranco': {
    en: {
      title: 'Santa María del Naranco',
      subtitle: 'Oviedo',
      description: 'Recreation palace of King Ramiro I, masterpiece of Asturian pre-Romanesque and World Heritage Site since 1985.',
    },
    fr: {
      title: 'Santa María del Naranco',
      subtitle: 'Oviedo',
      description: 'Palais de plaisance du roi Ramiro I, chef-d\'œuvre du préroman asturien et Patrimoine Mondial depuis 1985.',
    },
    de: {
      title: 'Santa María del Naranco',
      subtitle: 'Oviedo',
      description: 'Lustschloss von König Ramiro I., Meisterwerk der asturischen Präromanik und Weltkulturerbe seit 1985.',
    },
    pt: {
      title: 'Santa María del Naranco',
      subtitle: 'Oviedo',
      description: 'Palácio de recreio do rei Ramiro I, obra-prima do pré-românico asturiano e Património Mundial desde 1985.',
    },
    ast: {
      title: 'Santa María del Narancu',
      subtitle: 'Uviéu',
      description: 'Palaciu de recreo del rei Ramiru I, obra maestra del prerrománicu asturianu y Patrimoniu Mundial dende 1985.',
    },
  },

  'san-miguel-de-lillo': {
    en: {
      title: 'San Miguel de Lillo',
      subtitle: 'Oviedo',
      description: '9th-century pre-Romanesque church with extraordinary carved stone lattices and original mural painting remains.',
    },
    fr: {
      title: 'San Miguel de Lillo',
      subtitle: 'Oviedo',
      description: 'Église préromane du IXe siècle avec d\'extraordinaires claustras de pierre sculptée et des vestiges de peintures murales originales.',
    },
    de: {
      title: 'San Miguel de Lillo',
      subtitle: 'Oviedo',
      description: 'Präromanische Kirche aus dem 9. Jahrhundert mit außergewöhnlichen geschnitzten Steingittern und originalen Wandmalereiresten.',
    },
    pt: {
      title: 'San Miguel de Lillo',
      subtitle: 'Oviedo',
      description: 'Igreja pré-românica do século IX com extraordinárias gelosias de pedra rendilhada e restos de pintura mural originais.',
    },
    ast: {
      title: 'San Miguel de Lliño',
      subtitle: 'Uviéu',
      description: 'Ilesia prerrománica del sieglu IX con estraordinaries celoxíes de piedra tallada y restos de pintura mural orixinales.',
    },
  },

  'teatro-campoamor': {
    en: {
      title: 'Teatro Campoamor',
      subtitle: 'Oviedo',
      description: 'Iconic theater where the Princess of Asturias Awards are presented, cultural landmark of the capital.',
    },
    fr: {
      title: 'Teatro Campoamor',
      subtitle: 'Oviedo',
      description: 'Théâtre emblématique où sont remis les Prix Princesse des Asturies, référence culturelle de la capitale.',
    },
    de: {
      title: 'Teatro Campoamor',
      subtitle: 'Oviedo',
      description: 'Ikonisches Theater, in dem die Prinzessin-von-Asturien-Preise verliehen werden, kulturelles Wahrzeichen der Hauptstadt.',
    },
    pt: {
      title: 'Teatro Campoamor',
      subtitle: 'Oviedo',
      description: 'Teatro emblemático onde são entregues os Prémios Princesa das Astúrias, referência cultural da capital.',
    },
    ast: {
      title: 'Teatru Campoamor',
      subtitle: 'Uviéu',
      description: 'Teatru emblemáticu onde s\'entreguen los Premios Princesa d\'Asturies, referencia cultural de la capital.',
    },
  },

  'elogio-del-horizonte': {
    en: {
      title: 'Praise of the Horizon',
      subtitle: 'Gijón',
      description: 'Iconic sculpture by Eduardo Chillida on Santa Catalina Hill, symbol of the city and privileged viewpoint.',
    },
    fr: {
      title: 'Éloge de l\'Horizon',
      subtitle: 'Gijón',
      description: 'Sculpture iconique d\'Eduardo Chillida sur la colline de Santa Catalina, symbole de la ville et point de vue privilégié.',
    },
    de: {
      title: 'Lob des Horizonts',
      subtitle: 'Gijón',
      description: 'Ikonische Skulptur von Eduardo Chillida auf dem Hügel Santa Catalina, Symbol der Stadt und privilegierter Aussichtspunkt.',
    },
    pt: {
      title: 'Elogio do Horizonte',
      subtitle: 'Gijón',
      description: 'Escultura icónica de Eduardo Chillida no Cerro de Santa Catalina, símbolo da cidade e miradouro privilegiado.',
    },
    ast: {
      title: 'Eloxu del Horizonte',
      subtitle: 'Xixón',
      description: 'Escultura icónica d\'Eduardo Chillida nel Cerru de Santa Catalina, símbolu de la ciudá y mirador privilexáu.',
    },
  },

  'centro-niemeyer': {
    en: {
      title: 'Niemeyer Center',
      subtitle: 'Avilés',
      description: 'The only cultural center designed by Oscar Niemeyer in Spain, icon of contemporary architecture.',
    },
    fr: {
      title: 'Centre Niemeyer',
      subtitle: 'Avilés',
      description: 'Le seul centre culturel conçu par Oscar Niemeyer en Espagne, icône de l\'architecture contemporaine.',
    },
    de: {
      title: 'Niemeyer-Zentrum',
      subtitle: 'Avilés',
      description: 'Das einzige von Oscar Niemeyer in Spanien entworfene Kulturzentrum, Ikone zeitgenössischer Architektur.',
    },
    pt: {
      title: 'Centro Niemeyer',
      subtitle: 'Avilés',
      description: 'O único centro cultural desenhado por Oscar Niemeyer em Espanha, ícone da arquitetura contemporânea.',
    },
    ast: {
      title: 'Centru Niemeyer',
      subtitle: 'Avilés',
      description: 'L\'únicu centru cultural diseñáu por Oscar Niemeyer n\'España, iconu de l\'arquiteutura contemporánea.',
    },
  },

  'basilica-de-covadonga': {
    en: {
      title: 'Basilica of Covadonga',
      subtitle: 'Covadonga',
      description: 'Sanctuary where the Reconquista began, pilgrimage site with the Holy Cave and the Virgin of Covadonga.',
    },
    fr: {
      title: 'Basilique de Covadonga',
      subtitle: 'Covadonga',
      description: 'Sanctuaire où la Reconquista a commencé, lieu de pèlerinage avec la Sainte Grotte et la Santina.',
    },
    de: {
      title: 'Basilika von Covadonga',
      subtitle: 'Covadonga',
      description: 'Heiligtum, wo die Reconquista begann, Wallfahrtsort mit der Heiligen Höhle und der Santina.',
    },
    pt: {
      title: 'Basílica de Covadonga',
      subtitle: 'Covadonga',
      description: 'Santuário onde começou a Reconquista, local de peregrinação com a Santa Gruta e a Santina.',
    },
    ast: {
      title: 'Basílica de Cuadonga',
      subtitle: 'Cuadonga',
      description: 'Santuariu onde empezó la Reconquista, llugar de pelegrinación cola Cueva Santa y la Virxen de Cuadonga.',
    },
  },

  'cueva-de-tito-bustillo': {
    en: {
      title: 'Tito Bustillo Cave',
      subtitle: 'Ribadesella',
      description: 'One of the most important cave art sites in Europe, with paintings dating back 15,000 years.',
    },
    fr: {
      title: 'Grotte de Tito Bustillo',
      subtitle: 'Ribadesella',
      description: 'L\'un des sites d\'art rupestre les plus importants d\'Europe, avec des peintures vieilles de 15 000 ans.',
    },
    de: {
      title: 'Tito-Bustillo-Höhle',
      subtitle: 'Ribadesella',
      description: 'Eine der wichtigsten Höhlen mit Felskunst in Europa, mit 15.000 Jahre alten Malereien.',
    },
    pt: {
      title: 'Gruta de Tito Bustillo',
      subtitle: 'Ribadesella',
      description: 'Uma das grutas com arte rupestre mais importantes da Europa, com pinturas de 15.000 anos de antiguidade.',
    },
    ast: {
      title: 'Cueva de Tito Bustillo',
      subtitle: 'Ribesella',
      description: 'Ún de los xacimientos d\'arte rupestre más importantes d\'Europa, con pintures de 15.000 años d\'antigüedá.',
    },
  },

  'naranjo-de-bulnes': {
    en: {
      title: 'Naranjo de Bulnes',
      subtitle: 'Cabrales',
      description: 'The most emblematic peak of Picos de Europa, with its 2,519 meters challenging climbers from around the world.',
    },
    fr: {
      title: 'Naranjo de Bulnes',
      subtitle: 'Cabrales',
      description: 'Le sommet le plus emblématique des Pics d\'Europe, avec ses 2 519 mètres défiant les alpinistes du monde entier.',
    },
    de: {
      title: 'Naranjo de Bulnes',
      subtitle: 'Cabrales',
      description: 'Der emblematischste Gipfel der Picos de Europa mit seinen 2.519 Metern, der Bergsteiger aus aller Welt herausfordert.',
    },
    pt: {
      title: 'Naranjo de Bulnes',
      subtitle: 'Cabrales',
      description: 'O pico mais emblemático dos Picos da Europa, com os seus 2.519 metros desafiando alpinistas de todo o mundo.',
    },
    ast: {
      title: 'Naranjo de Bulnes',
      subtitle: 'Cabrales',
      description: 'El picu más emblemáticu de los Picos d\'Europa, colos sos 2.519 metros desafiando alpinistes de tol mundu.',
    },
  },

  'playa-de-gulpiyuri': {
    en: {
      title: 'Gulpiyuri Beach',
      subtitle: 'Llanes',
      description: 'Tiny inland beach 100 meters from the sea, fed by a tunnel under the cliffs. A geological rarity.',
    },
    fr: {
      title: 'Plage de Gulpiyuri',
      subtitle: 'Llanes',
      description: 'Minuscule plage intérieure à 100 mètres de la mer, alimentée par un tunnel sous les falaises. Une rareté géologique.',
    },
    de: {
      title: 'Strand von Gulpiyuri',
      subtitle: 'Llanes',
      description: 'Winziger Binnenstrand 100 Meter vom Meer, gespeist durch einen Tunnel unter den Klippen. Eine geologische Rarität.',
    },
    pt: {
      title: 'Praia de Gulpiyuri',
      subtitle: 'Llanes',
      description: 'Diminuta praia interior a 100 metros do mar, alimentada por um túnel sob as falésias. Uma raridade geológica.',
    },
    ast: {
      title: 'Playa de Gulpiyuri',
      subtitle: 'Llanes',
      description: 'Pequeña playa interior a 100 metros del mar, alimentada por un túnel baxo los cantiles. Una rareza xeolóxica.',
    },
  },

  'playa-de-san-lorenzo': {
    en: {
      title: 'San Lorenzo Beach',
      subtitle: 'Gijón',
      description: 'A kilometer and a half of golden sand in the heart of the city, one of the most famous urban beaches in Spain.',
    },
    fr: {
      title: 'Plage de San Lorenzo',
      subtitle: 'Gijón',
      description: 'Un kilomètre et demi de sable doré en plein centre-ville, l\'une des plages urbaines les plus célèbres d\'Espagne.',
    },
    de: {
      title: 'Strand von San Lorenzo',
      subtitle: 'Gijón',
      description: 'Anderthalb Kilometer goldener Sand im Stadtzentrum, einer der berühmtesten Stadtstrände Spaniens.',
    },
    pt: {
      title: 'Praia de San Lorenzo',
      subtitle: 'Gijón',
      description: 'Quilómetro e meio de areia dourada em pleno centro urbano, uma das praias urbanas mais famosas de Espanha.',
    },
    ast: {
      title: 'Playa de San Llorienzo',
      subtitle: 'Xixón',
      description: 'Quilómetru y mediu d\'arena dorao en plenu centru urbanu, una de les playes urbanes más famoses d\'España.',
    },
  },

  'jardin-botanico-atlantico': {
    en: {
      title: 'Atlantic Botanical Garden',
      subtitle: 'Gijón',
      description: '25 hectares of themed gardens exploring the flora of the Cantabrian and Atlantic ecosystems.',
    },
    fr: {
      title: 'Jardin Botanique Atlantique',
      subtitle: 'Gijón',
      description: '25 hectares de jardins thématiques explorant la flore du Cantabrique et des écosystèmes atlantiques.',
    },
    de: {
      title: 'Atlantischer Botanischer Garten',
      subtitle: 'Gijón',
      description: '25 Hektar Themengärten, die die Flora des Kantabrischen und atlantischer Ökosysteme erkunden.',
    },
    pt: {
      title: 'Jardim Botânico Atlântico',
      subtitle: 'Gijón',
      description: '25 hectares de jardins temáticos que percorrem a flora do Cantábrico e dos ecossistemas atlânticos.',
    },
    ast: {
      title: 'Xardín Botánicu Atlánticu',
      subtitle: 'Xixón',
      description: '25 hectárees de xardinos temáticos esplorando la flora del Cantábricu y los ecosistemes atlánticos.',
    },
  },

  'laboral-ciudad-de-la-cultura': {
    en: {
      title: 'Laboral Ciudad de la Cultura',
      subtitle: 'Gijón',
      description: 'Impressive architectural complex converted into a cultural center, with theater, art center and creative spaces.',
    },
    fr: {
      title: 'Laboral Cité de la Culture',
      subtitle: 'Gijón',
      description: 'Impressionnant ensemble architectural reconverti en centre culturel, avec théâtre, centre d\'art et espaces créatifs.',
    },
    de: {
      title: 'Laboral Stadt der Kultur',
      subtitle: 'Gijón',
      description: 'Beeindruckender Architekturkomplex, umgewandelt in ein Kulturzentrum mit Theater, Kunstzentrum und kreativen Räumen.',
    },
    pt: {
      title: 'Laboral Cidade da Cultura',
      subtitle: 'Gijón',
      description: 'Impressionante conjunto arquitetónico reconvertido em centro cultural, com teatro, centro de arte e espaços criativos.',
    },
    ast: {
      title: 'Llaboral Ciudá de la Cultura',
      subtitle: 'Xixón',
      description: 'Impresionante conxuntu arquitectónicu reconvertíu en centru cultural, con teatru, centru d\'arte y espacios creativos.',
    },
  },

  'acuario-de-gijon': {
    en: {
      title: 'Gijón Aquarium',
      subtitle: 'Gijón',
      description: 'Journey through the world\'s seas from the Cantabrian to the Caribbean, with sharks, rays and tropical species.',
    },
    fr: {
      title: 'Aquarium de Gijón',
      subtitle: 'Gijón',
      description: 'Voyage à travers les mers du monde du Cantabrique aux Caraïbes, avec requins, raies et espèces tropicales.',
    },
    de: {
      title: 'Aquarium von Gijón',
      subtitle: 'Gijón',
      description: 'Reise durch die Meere der Welt vom Kantabrischen bis zur Karibik, mit Haien, Rochen und tropischen Arten.',
    },
    pt: {
      title: 'Aquário de Gijón',
      subtitle: 'Gijón',
      description: 'Viagem pelos mares do mundo desde o Cantábrico até às Caraíbas, com tubarões, raias e espécies tropicais.',
    },
    ast: {
      title: 'Acuariu de Xixón',
      subtitle: 'Xixón',
      description: 'Viaxe pelos mares del mundu dende\'l Cantábricu al Caribe, con tiburones, rayes y especies tropicales.',
    },
  },

  'casco-antiguo-de-aviles': {
    en: {
      title: 'Old Town of Avilés',
      subtitle: 'Avilés',
      description: 'One of the best-preserved medieval ensembles in Asturias, with arcades, palaces and the church of San Nicolás.',
    },
    fr: {
      title: 'Vieille Ville d\'Avilés',
      subtitle: 'Avilés',
      description: 'L\'un des ensembles médiévaux les mieux préservés des Asturies, avec arcades, palais et l\'église de San Nicolás.',
    },
    de: {
      title: 'Altstadt von Avilés',
      subtitle: 'Avilés',
      description: 'Eines der am besten erhaltenen mittelalterlichen Ensembles Asturiens mit Arkaden, Palästen und der Kirche San Nicolás.',
    },
    pt: {
      title: 'Centro Histórico de Avilés',
      subtitle: 'Avilés',
      description: 'Um dos conjuntos medievais mais bem conservados das Astúrias, com arcadas, palácios e a igreja de San Nicolás.',
    },
    ast: {
      title: 'Cascu Antiguu d\'Avilés',
      subtitle: 'Avilés',
      description: 'Ún de los conxuntos medievales meyor conservaos d\'Asturies, con arcades, palacios y la ilesia de San Nicolás.',
    },
  },

  'castro-de-coana': {
    en: {
      title: 'Castro de Coaña',
      subtitle: 'Coaña',
      description: 'One of the best-preserved pre-Roman fortified settlements of the peninsula, testimony of the castro culture.',
    },
    fr: {
      title: 'Castro de Coaña',
      subtitle: 'Coaña',
      description: 'L\'un des villages fortifiés préromains les mieux conservés de la péninsule, témoignage de la culture des castros.',
    },
    de: {
      title: 'Castro de Coaña',
      subtitle: 'Coaña',
      description: 'Eine der am besten erhaltenen vorrömischen befestigten Siedlungen der Halbinsel, Zeugnis der Castro-Kultur.',
    },
    pt: {
      title: 'Castro de Coaña',
      subtitle: 'Coaña',
      description: 'Um dos povoados fortificados pré-romanos mais bem conservados da península, testemunho da cultura castreja.',
    },
    ast: {
      title: 'Castru de Coaña',
      subtitle: 'Coaña',
      description: 'Ún de los poblaos fortificaos prerromanos meyor conservaos de la península, testimoniu de la cultura castreña.',
    },
  },

  'cabo-vidio': {
    en: {
      title: 'Cape Vidio',
      subtitle: 'Cudillero',
      description: 'Spectacular 80-meter cliff with historic lighthouse and infinite views over the Cantabrian Sea.',
    },
    fr: {
      title: 'Cap Vidio',
      subtitle: 'Cudillero',
      description: 'Falaise spectaculaire de 80 mètres avec phare historique et vues infinies sur la mer Cantabrique.',
    },
    de: {
      title: 'Kap Vidio',
      subtitle: 'Cudillero',
      description: 'Spektakuläre 80-Meter-Klippe mit historischem Leuchtturm und unendlichen Ausblicken über das Kantabrische Meer.',
    },
    pt: {
      title: 'Cabo Vidio',
      subtitle: 'Cudillero',
      description: 'Falésia espetacular de 80 metros com farol histórico e vistas infinitas sobre o Mar Cantábrico.',
    },
    ast: {
      title: 'Cabu Vidio',
      subtitle: 'Cuideiru',
      description: 'Cantil espectacular de 80 metros con faru históricu y vistes infinites sobre\'l Mar Cantábricu.',
    },
  },

  'playa-de-las-catedrales': {
    en: {
      title: 'Beach of the Cathedrals',
      subtitle: 'Ribadeo',
      description: 'Impressive rock formations resembling Gothic cathedral buttresses, accessible at low tide.',
    },
    fr: {
      title: 'Plage des Cathédrales',
      subtitle: 'Ribadeo',
      description: 'Impressionnantes formations rocheuses ressemblant à des arcs-boutants de cathédrale gothique, accessibles à marée basse.',
    },
    de: {
      title: 'Strand der Kathedralen',
      subtitle: 'Ribadeo',
      description: 'Beeindruckende Felsformationen, die gotischen Kathedralenstrebebögen ähneln, bei Ebbe zugänglich.',
    },
    pt: {
      title: 'Praia das Catedrais',
      subtitle: 'Ribadeo',
      description: 'Impressionantes formações rochosas semelhantes a arcobotantes de catedral gótica, acessíveis com maré baixa.',
    },
    ast: {
      title: 'Playa de les Catedrales',
      subtitle: 'Ribadeo',
      description: 'Impresionantes formaciones rocoses que s\'asemeyen a arcobotantes de catedral gótica, accesibles con marea baxa.',
    },
  },

  // ============================================
  // ACTIVITIES & FAMILY
  // ============================================

  'museo-del-jurasico-muja': {
    en: {
      title: 'Jurassic Museum (MUJA)',
      subtitle: 'Colunga',
      description: 'Journey to the past in the shape of a dinosaur footprint. Full-scale replicas, authentic fossils and interactive activities for the whole family.',
    },
    fr: {
      title: 'Musée du Jurassique (MUJA)',
      subtitle: 'Colunga',
      description: 'Voyage dans le passé en forme d\'empreinte de dinosaure. Répliques à l\'échelle, fossiles authentiques et activités interactives pour toute la famille.',
    },
    de: {
      title: 'Juramuseum (MUJA)',
      subtitle: 'Colunga',
      description: 'Reise in die Vergangenheit in Form eines Dinosaurier-Fußabdrucks. Originalgetreue Repliken, echte Fossilien und interaktive Aktivitäten für die ganze Familie.',
    },
    pt: {
      title: 'Museu do Jurássico (MUJA)',
      subtitle: 'Colunga',
      description: 'Viagem ao passado em forma de pegada de dinossauro. Réplicas à escala real, fósseis autênticos e atividades interativas para toda a família.',
    },
    ast: {
      title: 'Muséu del Xurásicu (MUJA)',
      subtitle: 'Colunga',
      description: 'Viaxe al pasáu en forma de buelga de dinosauriu. Répliques a escala real, fósiles auténticos y actividaes interactives pa tola familia.',
    },
  },

  'teleferico-de-fuente-de': {
    en: {
      title: 'Fuente Dé Cable Car',
      subtitle: 'Picos de Europa',
      description: 'Vertiginous ascent of 753 meters in 4 minutes to the heart of Picos de Europa. Breathtaking views.',
    },
    fr: {
      title: 'Téléphérique de Fuente Dé',
      subtitle: 'Pics d\'Europe',
      description: 'Ascension vertigineuse de 753 mètres en 4 minutes jusqu\'au cœur des Pics d\'Europe. Vues à couper le souffle.',
    },
    de: {
      title: 'Seilbahn von Fuente Dé',
      subtitle: 'Picos de Europa',
      description: 'Schwindelerregender Aufstieg von 753 Metern in 4 Minuten ins Herz der Picos de Europa. Atemberaubende Ausblicke.',
    },
    pt: {
      title: 'Teleférico de Fuente Dé',
      subtitle: 'Picos da Europa',
      description: 'Subida vertiginosa de 753 metros em 4 minutos até ao coração dos Picos da Europa. Vistas de tirar o fôlego.',
    },
    ast: {
      title: 'Teleféricu de Fuente Dé',
      subtitle: 'Picos d\'Europa',
      description: 'Xubida vertixinosa de 753 metros en 4 minutos al corazón de los Picos d\'Europa. Vistes de quitar l\'aliendu.',
    },
  },

  'parque-de-la-prehistoria': {
    en: {
      title: 'Prehistory Park',
      subtitle: 'Teverga',
      description: 'Reproductions of the world\'s best cave paintings in artificial caves. Paleolithic art accessible to all.',
    },
    fr: {
      title: 'Parc de la Préhistoire',
      subtitle: 'Teverga',
      description: 'Reproductions des meilleures peintures rupestres du monde dans des grottes artificielles. Art paléolithique accessible à tous.',
    },
    de: {
      title: 'Prähistorischer Park',
      subtitle: 'Teverga',
      description: 'Reproduktionen der besten Höhlenmalereien der Welt in künstlichen Höhlen. Paläolithische Kunst für alle zugänglich.',
    },
    pt: {
      title: 'Parque da Pré-História',
      subtitle: 'Teverga',
      description: 'Reproduções das melhores pinturas rupestres do mundo em grutas artificiais. Arte paleolítica acessível a todos.',
    },
    ast: {
      title: 'Parque de la Prehistoria',
      subtitle: 'Teverga',
      description: 'Reproducciones de les meyores pintures rupestres del mundu en cueves artificiales. Arte paleolíticu accesible pa toos.',
    },
  },

  'mina-de-arnao': {
    en: {
      title: 'Arnao Mine',
      subtitle: 'Castrillón',
      description: 'Europe\'s first undersea coal mine turned museum. Descend into the depths of industrial history.',
    },
    fr: {
      title: 'Mine d\'Arnao',
      subtitle: 'Castrillón',
      description: 'Première mine de charbon sous-marine d\'Europe transformée en musée. Descente dans les profondeurs de l\'histoire industrielle.',
    },
    de: {
      title: 'Arnao-Mine',
      subtitle: 'Castrillón',
      description: 'Europas erstes Unterwasser-Kohlebergwerk, zum Museum umgewandelt. Abstieg in die Tiefen der Industriegeschichte.',
    },
    pt: {
      title: 'Mina de Arnao',
      subtitle: 'Castrillón',
      description: 'Primeira mina de carvão submarina da Europa convertida em museu. Descida às entranhas da história industrial.',
    },
    ast: {
      title: 'Mina d\'Arnao',
      subtitle: 'Castrillón',
      description: 'La primera mina de carbón submarina d\'Europa convertida en muséu. Baxada a les entrañes de la historia industrial.',
    },
  },

  'tren-minero-de-samuno': {
    en: {
      title: 'Samuño Mining Train',
      subtitle: 'Langreo',
      description: 'Train journey through mining galleries with original shaft and headframe. The memory of Asturian mining.',
    },
    fr: {
      title: 'Train Minier de Samuño',
      subtitle: 'Langreo',
      description: 'Voyage en train à travers les galeries minières avec puits et chevalement d\'origine. La mémoire de la mine asturienne.',
    },
    de: {
      title: 'Bergwerkszug von Samuño',
      subtitle: 'Langreo',
      description: 'Zugfahrt durch Bergwerksstollen mit originalem Schacht und Förderturm. Die Erinnerung an den asturischen Bergbau.',
    },
    pt: {
      title: 'Comboio Mineiro de Samuño',
      subtitle: 'Langreo',
      description: 'Viagem de comboio por galerias mineiras com poço e castelo original. A memória da mineração asturiana.',
    },
    ast: {
      title: 'Tren Mineru de Samúo',
      subtitle: 'Llangréu',
      description: 'Viaxe en tren per galeríes mineres con pozu y castillete orixinales. La memoria de la minería asturiana.',
    },
  },

  'bosque-de-muniellos': {
    en: {
      title: 'Muniellos Forest',
      subtitle: 'Cangas del Narcea',
      description: 'Spain\'s largest oak forest and one of the best preserved in Europe. Natural reserve with limited access.',
    },
    fr: {
      title: 'Forêt de Muniellos',
      subtitle: 'Cangas del Narcea',
      description: 'La plus grande chênaie d\'Espagne et l\'une des mieux préservées d\'Europe. Réserve naturelle à accès limité.',
    },
    de: {
      title: 'Muniellos-Wald',
      subtitle: 'Cangas del Narcea',
      description: 'Spaniens größter Eichenwald und einer der am besten erhaltenen Europas. Naturschutzgebiet mit begrenztem Zugang.',
    },
    pt: {
      title: 'Bosque de Muniellos',
      subtitle: 'Cangas del Narcea',
      description: 'O maior carvalhal de Espanha e um dos mais bem conservados da Europa. Reserva natural com acesso limitado.',
    },
    ast: {
      title: 'Monte de Muniellos',
      subtitle: 'Cangues del Narcea',
      description: 'El mayor carbayal d\'España y ún de los meyor conservaos d\'Europa. Reserva natural con accesu llimitáu.',
    },
  },

  'aventura-en-los-picos': {
    en: {
      title: 'Adventure in the Picos',
      subtitle: 'Cangas de Onís',
      description: 'Canyoning, climbing, via ferratas and bungee jumping in the heart of Picos de Europa. Adrenaline guaranteed.',
    },
    fr: {
      title: 'Aventure dans les Picos',
      subtitle: 'Cangas de Onís',
      description: 'Canyoning, escalade, via ferratas et saut à l\'élastique au cœur des Pics d\'Europe. Adrénaline garantie.',
    },
    de: {
      title: 'Abenteuer in den Picos',
      subtitle: 'Cangas de Onís',
      description: 'Canyoning, Klettern, Klettersteige und Bungee-Jumping im Herzen der Picos de Europa. Adrenalin garantiert.',
    },
    pt: {
      title: 'Aventura nos Picos',
      subtitle: 'Cangas de Onís',
      description: 'Canyoning, escalada, vias ferratas e puenting no coração dos Picos da Europa. Adrenalina garantida.',
    },
    ast: {
      title: 'Aventura nos Picos',
      subtitle: 'Cangues d\'Onís',
      description: 'Barranquismu, escalada, víes ferrates y puentismu nel corazón de los Picos d\'Europa. Adrenalina garantizada.',
    },
  },

  'playa-de-rodiles': {
    en: {
      title: 'Rodiles Beach',
      subtitle: 'Villaviciosa',
      description: 'Extensive beach with dunes, estuary and one of the best surf waves of the Cantabrian. Paradise for families and surfers.',
    },
    fr: {
      title: 'Plage de Rodiles',
      subtitle: 'Villaviciosa',
      description: 'Grande plage avec dunes, estuaire et l\'une des meilleures vagues de surf du Cantabrique. Paradis pour familles et surfeurs.',
    },
    de: {
      title: 'Strand von Rodiles',
      subtitle: 'Villaviciosa',
      description: 'Weitläufiger Strand mit Dünen, Flussmündung und einer der besten Surfwellen des Kantabrischen. Paradies für Familien und Surfer.',
    },
    pt: {
      title: 'Praia de Rodiles',
      subtitle: 'Villaviciosa',
      description: 'Extensa praia com dunas, ria e uma das melhores ondas de surf do Cantábrico. Paraíso para famílias e surfistas.',
    },
    ast: {
      title: 'Playa de Rodiles',
      subtitle: 'Villaviciosa',
      description: 'Estensa playa con dunes, ría y una de les meyores foles de surf del Cantábricu. Paraísu pa families y surfistes.',
    },
  },

  // ============================================
  // CAMINO DE SANTIAGO
  // ============================================

  'camino-camino-primitivo': {
    en: {
      title: 'Primitive Way',
      subtitle: 'From Oviedo to Santiago',
      description: 'The oldest Jacobean route, starting from Oviedo Cathedral. 14 stages through mountains and forests to Santiago de Compostela.',
    },
    fr: {
      title: 'Chemin Primitif',
      subtitle: 'D\'Oviedo à Santiago',
      description: 'La plus ancienne route jacobéenne, partant de la cathédrale d\'Oviedo. 14 étapes à travers montagnes et forêts jusqu\'à Saint-Jacques-de-Compostelle.',
    },
    de: {
      title: 'Primitiver Weg',
      subtitle: 'Von Oviedo nach Santiago',
      description: 'Die älteste Jakobsroute, ausgehend von der Kathedrale von Oviedo. 14 Etappen durch Berge und Wälder nach Santiago de Compostela.',
    },
    pt: {
      title: 'Caminho Primitivo',
      subtitle: 'De Oviedo a Santiago',
      description: 'A rota jacobeia mais antiga, partindo da Catedral de Oviedo. 14 etapas através de montanhas e florestas até Santiago de Compostela.',
    },
    ast: {
      title: 'Camín Primitivu',
      subtitle: 'D\'Uviéu a Santiagu',
      description: 'La ruta xacobea más antigua, partiendo de la Catedral d\'Uviéu. 14 etapes per montes y montes hasta Santiago de Compostela.',
    },
  },

  'camino-camino-del-norte': {
    en: {
      title: 'Northern Way',
      subtitle: 'Cantabrian coast',
      description: 'The coastal path that runs along cliffs, beaches and fishing villages of Asturias. Spectacular views of the Cantabrian.',
    },
    fr: {
      title: 'Chemin du Nord',
      subtitle: 'Côte cantabrique',
      description: 'Le chemin côtier qui longe falaises, plages et villages de pêcheurs des Asturies. Vues spectaculaires sur le Cantabrique.',
    },
    de: {
      title: 'Nordweg',
      subtitle: 'Kantabrische Küste',
      description: 'Der Küstenweg, der entlang von Klippen, Stränden und Fischerdörfern Asturiens verläuft. Spektakuläre Ausblicke auf das Kantabrische.',
    },
    pt: {
      title: 'Caminho do Norte',
      subtitle: 'Costa cantábrica',
      description: 'O caminho costeiro que percorre falésias, praias e vilas piscatórias das Astúrias. Vistas espetaculares do Cantábrico.',
    },
    ast: {
      title: 'Camín del Norte',
      subtitle: 'Costa cantábrica',
      description: 'El camín costeru que percuerre cantiles, playes y villes pesqueres d\'Asturies. Vistes espectaculares del Cantábricu.',
    },
  },

  // ============================================
  // GASTRONOMY ESSENTIALS
  // ============================================

  'gastro-queso-cabrales': {
    en: {
      title: 'Cabrales Cheese',
      subtitle: 'Picos de Europa',
      description: 'The king of Spanish blue cheeses, aged in natural caves of the Picos. Intense and unmistakable flavor.',
    },
    fr: {
      title: 'Fromage Cabrales',
      subtitle: 'Pics d\'Europe',
      description: 'Le roi des fromages bleus espagnols, affiné dans les grottes naturelles des Picos. Saveur intense et inimitable.',
    },
    de: {
      title: 'Cabrales-Käse',
      subtitle: 'Picos de Europa',
      description: 'Der König der spanischen Blauschimmelkäse, in natürlichen Höhlen der Picos gereift. Intensiver und unverwechselbarer Geschmack.',
    },
    pt: {
      title: 'Queijo Cabrales',
      subtitle: 'Picos da Europa',
      description: 'O rei dos queijos azuis espanhóis, maturado em grutas naturais dos Picos. Sabor intenso e inconfundível.',
    },
    ast: {
      title: 'Quesu Cabrales',
      subtitle: 'Picos d\'Europa',
      description: 'El rei de los quesos azules españoles, matizáu en cueves naturales de los Picos. Sabor intensu ya inconfundible.',
    },
  },

  'gastro-cachopo-asturiano': {
    en: {
      title: 'Asturian Cachopo',
      subtitle: 'All of Asturias',
      description: 'Two beef fillets stuffed with ham and cheese, breaded and fried. The hearty dish par excellence.',
    },
    fr: {
      title: 'Cachopo Asturien',
      subtitle: 'Toutes les Asturies',
      description: 'Deux filets de bœuf farcis au jambon et fromage, panés et frits. Le plat copieux par excellence.',
    },
    de: {
      title: 'Asturisches Cachopo',
      subtitle: 'Ganz Asturien',
      description: 'Zwei Rinderfilets gefüllt mit Schinken und Käse, paniert und frittiert. Das deftige Gericht schlechthin.',
    },
    pt: {
      title: 'Cachopo Asturiano',
      subtitle: 'Todas as Astúrias',
      description: 'Dois filetes de vitela recheados de presunto e queijo, panados e fritos. O prato substancial por excelência.',
    },
    ast: {
      title: 'Cachopo Asturianu',
      subtitle: 'Toa Asturies',
      description: 'Dos filetes de xata rellenos de xamón y quesu, empanaos y fritos. El platu contundente por excelencia.',
    },
  },

  'gastro-arroz-con-leche': {
    en: {
      title: 'Rice Pudding',
      subtitle: 'All of Asturias',
      description: 'Creamy dessert with cinnamon and lemon, slowly cooked to achieve the perfect texture. Tradition in every spoonful.',
    },
    fr: {
      title: 'Riz au Lait',
      subtitle: 'Toutes les Asturies',
      description: 'Dessert crémeux à la cannelle et au citron, cuit lentement pour obtenir la texture parfaite. Tradition dans chaque cuillerée.',
    },
    de: {
      title: 'Milchreis',
      subtitle: 'Ganz Asturien',
      description: 'Cremiges Dessert mit Zimt und Zitrone, langsam gegart für die perfekte Textur. Tradition in jedem Löffel.',
    },
    pt: {
      title: 'Arroz Doce',
      subtitle: 'Todas as Astúrias',
      description: 'Sobremesa cremosa com canela e limão, cozinhada lentamente até conseguir a textura perfeita. Tradição em cada colherada.',
    },
    ast: {
      title: 'Arroz con Lleche',
      subtitle: 'Toa Asturies',
      description: 'Postre cremoso con canela y llimón, cocináu a fueu lento pa consiguir la testura perfecta. Tradición en cada cucharada.',
    },
  },

  'gastro-pote-asturiano': {
    en: {
      title: 'Asturian Pote',
      subtitle: 'All of Asturias',
      description: 'Cabbage stew with potatoes, beans and compango. Comforting spoon dish for cold mountain days.',
    },
    fr: {
      title: 'Pote Asturien',
      subtitle: 'Toutes les Asturies',
      description: 'Ragoût de choux avec pommes de terre, haricots et compango. Plat réconfortant à la cuillère pour les jours froids de montagne.',
    },
    de: {
      title: 'Asturischer Pote',
      subtitle: 'Ganz Asturien',
      description: 'Kohleneintopf mit Kartoffeln, Bohnen und Compango. Wärmendes Löffelgericht für kalte Bergtage.',
    },
    pt: {
      title: 'Pote Asturiano',
      subtitle: 'Todas as Astúrias',
      description: 'Guisado de couves com batatas, feijão e compango. Reconfortante prato de colher para os dias frios de montanha.',
    },
    ast: {
      title: 'Pote Asturianu',
      subtitle: 'Toa Asturies',
      description: 'Guisu de berces con pataques, fabes y compango. Platu de cuchara reconfortante pa los díes fríos de monte.',
    },
  },

  'gastro-tortos-con-picadillo': {
    en: {
      title: 'Tortos with Picadillo',
      subtitle: 'All of Asturias',
      description: 'Fried corn cakes accompanied by minced pork. Authentic flavor of rural Asturian cuisine.',
    },
    fr: {
      title: 'Tortos au Picadillo',
      subtitle: 'Toutes les Asturies',
      description: 'Galettes de maïs frites accompagnées de porc haché. Saveur authentique de la cuisine rurale asturienne.',
    },
    de: {
      title: 'Tortos mit Picadillo',
      subtitle: 'Ganz Asturien',
      description: 'Gebratene Maisfladen begleitet von Schweinehackfleisch. Authentischer Geschmack der ländlichen asturischen Küche.',
    },
    pt: {
      title: 'Tortos com Picadillo',
      subtitle: 'Todas as Astúrias',
      description: 'Bolos de milho fritos acompanhados de carne de porco picada. Sabor autêntico da cozinha rural asturiana.',
    },
    ast: {
      title: 'Tortos con Picadillo',
      subtitle: 'Toa Asturies',
      description: 'Tortes de maíz frites acompañaes de carne de gochu picada. Sabor auténticu de la cocina rural asturiana.',
    },
  },

  'gastro-oricios-erizos-de-mar': {
    en: {
      title: 'Oricios (Sea Urchins)',
      subtitle: 'Cantabrian coast',
      description: 'Winter marine delicacy. Fresh sea urchins served in their shell, a treat for connoisseurs.',
    },
    fr: {
      title: 'Oricios (Oursins)',
      subtitle: 'Côte cantabrique',
      description: 'Délicatesse marine d\'hiver. Oursins frais servis dans leur coquille, un régal pour les connaisseurs.',
    },
    de: {
      title: 'Oricios (Seeigel)',
      subtitle: 'Kantabrische Küste',
      description: 'Winterliche Meeresdelikatesse. Frische Seeigel in ihrer Schale serviert, ein Genuss für Kenner.',
    },
    pt: {
      title: 'Oricios (Ouriços-do-Mar)',
      subtitle: 'Costa cantábrica',
      description: 'Iguaria marinha de inverno. Ouriços-do-mar frescos servidos na sua carapaça, manjar dos entendidos.',
    },
    ast: {
      title: 'Oricios (Erizos de Mar)',
      subtitle: 'Costa cantábrica',
      description: 'Delicatesen marina d\'iviernu. Oricios frescos servíos na so concha, un manxar pa los entendíos.',
    },
  },

  // ============================================
  // ADDITIONAL RESTAURANTS (20 stories)
  // ============================================

  'restaurant-el-cenador-del-azul': {
    en: {
      title: 'El Cenador del Azul',
      subtitle: 'Mieres',
      description: 'A reference in the Caudal region with updated traditional recipes and exquisite service.',
    },
    fr: {
      title: 'El Cenador del Azul',
      subtitle: 'Mieres',
      description: 'Référence de la région du Caudal avec recettes traditionnelles revisitées et service raffiné en salle.',
    },
    de: {
      title: 'El Cenador del Azul',
      subtitle: 'Mieres',
      description: 'Referenz in der Region Caudal mit aktualisierten traditionellen Rezepten und exquisitem Service.',
    },
    pt: {
      title: 'El Cenador del Azul',
      subtitle: 'Mieres',
      description: 'Referência da comarca do Caudal com receituário tradicional atualizado e trato requintado em sala.',
    },
    ast: {
      title: 'El Cenador del Azul',
      subtitle: 'Mieres',
      description: 'Referencia na comarca del Caudal con recetes tradicionales actualizaes y serviciu esquisitu.',
    },
  },

  'restaurant-casa-adela': {
    en: {
      title: 'Casa Adela',
      subtitle: 'Lada, Langreo',
      description: 'Home-style restaurant in a charming chalet with traditional stews. The corn tortos and terrace under the hórreo are unmissable.',
    },
    fr: {
      title: 'Casa Adela',
      subtitle: 'Lada, Langreo',
      description: 'Restaurant familial dans un joli chalet avec plats mijotés traditionnels. Incontournables : les tortos de maïs et la terrasse sous le hórreo.',
    },
    de: {
      title: 'Casa Adela',
      subtitle: 'Lada, Langreo',
      description: 'Gasthaus im hübschen Chalet mit traditionellen Eintöpfen. Die Maistortos und die Terrasse unter dem Hórreo sind ein Muss.',
    },
    pt: {
      title: 'Casa Adela',
      subtitle: 'Lada, Langreo',
      description: 'Casa de comidas em bonito chalé com guisados tradicionais. Imperdíveis os tortos de milho e o terraço sob o hórreo.',
    },
    ast: {
      title: 'Casa Adela',
      subtitle: 'Lada, Llangréu',
      description: 'Casa de comíes nun guapu chalé con guisaos tradicionales. Imprescindibles los tortos de maíz y la terraza baxo l\'horru.',
    },
  },

  'restaurant-casa-telva': {
    en: {
      title: 'Casa Telva',
      subtitle: 'Valdesoto, Siero',
      description: 'Mother and daughter prepare finger-licking tripe, roast kid and stuffed onions, away from the hustle and bustle.',
    },
    fr: {
      title: 'Casa Telva',
      subtitle: 'Valdesoto, Siero',
      description: 'Mère et fille préparent tripes, chevreau et oignons farcis à s\'en lécher les doigts, loin du tumulte.',
    },
    de: {
      title: 'Casa Telva',
      subtitle: 'Valdesoto, Siero',
      description: 'Mutter und Tochter bereiten köstliche Kutteln, Zicklein und gefüllte Zwiebeln zu, abseits vom Trubel.',
    },
    pt: {
      title: 'Casa Telva',
      subtitle: 'Valdesoto, Siero',
      description: 'Mãe e filha preparam tripas, cabrito e cebolas recheadas de lamber os dedos, longe do bulício.',
    },
    ast: {
      title: 'Casa Telva',
      subtitle: 'Valdesoto, Sieru',
      description: 'Ma y fía preparen callos, cabritu y cebolles rellenes de chuparse los dedos, lloñe del bullicio.',
    },
  },

  'restaurant-la-ferrada': {
    en: {
      title: 'La Ferrada',
      subtitle: 'Noreña',
      description: 'Former stables converted into a restaurant with four cozy dining rooms, terrace with grills and reasonable prices.',
    },
    fr: {
      title: 'La Ferrada',
      subtitle: 'Noreña',
      description: 'Anciennes écuries transformées en restaurant avec quatre salles chaleureuses, terrasse avec grills et prix contenus.',
    },
    de: {
      title: 'La Ferrada',
      subtitle: 'Noreña',
      description: 'Ehemalige Stallungen, zum Restaurant umgewandelt, mit vier gemütlichen Speisesälen, Grillterrasse und moderaten Preisen.',
    },
    pt: {
      title: 'La Ferrada',
      subtitle: 'Noreña',
      description: 'Antigas cavalariças convertidas em restaurante com quatro acolhedoras salas, esplanada com grelhadores e preços contidos.',
    },
    ast: {
      title: 'La Ferrada',
      subtitle: 'Noreña',
      description: 'Antigües caballerices convertíes en restaurante con cuatro sales acoexedores, terraza con parrilles y precios moderaos.',
    },
  },

  'restaurant-casa-belarmino': {
    en: {
      title: 'Casa Belarmino',
      subtitle: 'Mazaneda, Gozón',
      description: 'Traditional bar-shop with over 90 years of history. Their croquettes are among the best in Spain.',
    },
    fr: {
      title: 'Casa Belarmino',
      subtitle: 'Mazaneda, Gozón',
      description: 'Bar-épicerie traditionnel de plus de 90 ans d\'histoire. Ses croquettes comptent parmi les meilleures d\'Espagne.',
    },
    de: {
      title: 'Casa Belarmino',
      subtitle: 'Mazaneda, Gozón',
      description: 'Traditionelle Bar mit Laden und über 90 Jahren Geschichte. Ihre Kroketten gehören zu den besten Spaniens.',
    },
    pt: {
      title: 'Casa Belarmino',
      subtitle: 'Mazaneda, Gozón',
      description: 'Bar-mercearia tradicional com mais de 90 anos de história. Os seus croquetes estão entre os melhores de Espanha.',
    },
    ast: {
      title: 'Casa Belarmino',
      subtitle: 'Mazaneda, Gozón',
      description: 'Bar-tienda tradicional con más de 90 años d\'historia. Les sos croquetes tán ente les meyores d\'España.',
    },
  },

  'restaurant-abarike': {
    en: {
      title: 'Abarike',
      subtitle: 'Gijón',
      description: 'Contemporary seafood restaurant where sustainability and quality meet chef Lara Roguez\'s playful vision.',
    },
    fr: {
      title: 'Abarike',
      subtitle: 'Gijón',
      description: 'Restaurant de fruits de mer d\'auteur où durabilité et qualité rencontrent la vision décontractée de la chef Lara Roguez.',
    },
    de: {
      title: 'Abarike',
      subtitle: 'Gijón',
      description: 'Kreatives Fischrestaurant, wo Nachhaltigkeit und Qualität auf die unbeschwerte Vision von Köchin Lara Roguez treffen.',
    },
    pt: {
      title: 'Abarike',
      subtitle: 'Gijón',
      description: 'Marisqueira de autor onde sustentabilidade e qualidade se unem à visão descontraída da chef Lara Roguez.',
    },
    ast: {
      title: 'Abarike',
      subtitle: 'Xixón',
      description: 'Marisquería d\'autor onde sostenibilidá y calidá s\'atopen cola visión desenfadada de la chef Lara Roguez.',
    },
  },

  'restaurant-ciudadela': {
    en: {
      title: 'Ciudadela',
      subtitle: 'Gijón',
      description: 'Restaurant with caves on the lower floor, wine bar by the glass and one of the most complete lunch menus in the city.',
    },
    fr: {
      title: 'Ciudadela',
      subtitle: 'Gijón',
      description: 'Restaurant avec caves en sous-sol, bar à vins au verre et l\'un des menus du jour les plus complets de la ville.',
    },
    de: {
      title: 'Ciudadela',
      subtitle: 'Gijón',
      description: 'Restaurant mit Gewölbekellern, Weinbar mit glasweisem Ausschank und eines der vollständigsten Mittagsmenüs der Stadt.',
    },
    pt: {
      title: 'Ciudadela',
      subtitle: 'Gijón',
      description: 'Restaurante com caves no piso inferior, bar de vinhos a copo e um dos menus do dia mais completos da cidade.',
    },
    ast: {
      title: 'Ciudadela',
      subtitle: 'Xixón',
      description: 'Restaurante con cueves nel pisu inferior, bar de vinos a copu y ún de los menús del día más completos de la ciudá.',
    },
  },

  'restaurant-la-pondala': {
    en: {
      title: 'La Pondala',
      subtitle: 'Somió, Gijón',
      description: 'Nearly 130 years of history, a favorite among business people. Roast beef, seasonal vegetables and the most coveted terrace in summer.',
    },
    fr: {
      title: 'La Pondala',
      subtitle: 'Somió, Gijón',
      description: 'Près de 130 ans d\'histoire, favori des hommes d\'affaires. Rosbif, légumes de saison et la terrasse la plus convoitée en été.',
    },
    de: {
      title: 'La Pondala',
      subtitle: 'Somió, Gijón',
      description: 'Fast 130 Jahre Geschichte, Favorit der Geschäftsleute. Roastbeef, Saisongemüse und die begehrteste Sommerterrasse.',
    },
    pt: {
      title: 'La Pondala',
      subtitle: 'Somió, Gijón',
      description: 'Quase 130 anos de história, favorito dos empresários. Rosbife, legumes da época e o terraço mais desejado no verão.',
    },
    ast: {
      title: 'La Pondala',
      subtitle: 'Somió, Xixón',
      description: 'Cuasi 130 años d\'historia, favoritu d\'homes de negocios. Rosbif, verdures de temporada y la terraza más codiciada nel branu.',
    },
  },

  'restaurant-mamaguaja': {
    en: {
      title: 'Mamáguaja',
      subtitle: 'Gijón',
      description: 'A tribute to Asturian forests with high-quality seasonal products, from meats to seafood and rice dishes.',
    },
    fr: {
      title: 'Mamáguaja',
      subtitle: 'Gijón',
      description: 'Hommage aux forêts asturiennes avec des produits de saison de haute qualité, des viandes aux fruits de mer et riz.',
    },
    de: {
      title: 'Mamáguaja',
      subtitle: 'Gijón',
      description: 'Hommage an die asturischen Wälder mit hochwertigen Saisonprodukten, von Fleisch über Meeresfrüchte bis zu Reisgerichten.',
    },
    pt: {
      title: 'Mamáguaja',
      subtitle: 'Gijón',
      description: 'Homenagem aos bosques asturianos com produtos de temporada de alta qualidade, desde carnes a mariscos e arrozes.',
    },
    ast: {
      title: 'Mamáguaja',
      subtitle: 'Xixón',
      description: 'Homenaxe a los montes asturianos con productos de temporada d\'alta calidá, dende carnes a mariscos y arroces.',
    },
  },

  'restaurant-the-green-artiem-asturias': {
    en: {
      title: 'The Green - Artiem Asturias',
      subtitle: 'Quintueles',
      description: 'Healthy and sustainable gastronomy in a privileged natural setting, with its own vegetable garden.',
    },
    fr: {
      title: 'The Green - Artiem Asturias',
      subtitle: 'Quintueles',
      description: 'Gastronomie saine et durable dans un cadre naturel privilégié, avec potager propre.',
    },
    de: {
      title: 'The Green - Artiem Asturias',
      subtitle: 'Quintueles',
      description: 'Gesunde und nachhaltige Gastronomie in privilegierter Naturumgebung mit eigenem Gemüsegarten.',
    },
    pt: {
      title: 'The Green - Artiem Asturias',
      subtitle: 'Quintueles',
      description: 'Proposta gastronómica saudável e sustentável em envolvente natural privilegiada, com horta própria.',
    },
    ast: {
      title: 'The Green - Artiem Asturias',
      subtitle: 'Quintueles',
      description: 'Propuesta gastronómica saludable y sostenible n\'entornu natural privilexáu, con güerta propia.',
    },
  },

  'restaurant-el-balcon-de-torazo': {
    en: {
      title: 'El Balcón de Torazo',
      subtitle: 'Torazo, Cabranes',
      description: 'Traditional Asturian cuisine with spectacular views of the Sierra del Sueve.',
    },
    fr: {
      title: 'El Balcón de Torazo',
      subtitle: 'Torazo, Cabranes',
      description: 'Cuisine traditionnelle asturienne avec vues spectaculaires sur la Sierra del Sueve.',
    },
    de: {
      title: 'El Balcón de Torazo',
      subtitle: 'Torazo, Cabranes',
      description: 'Traditionelle asturische Küche mit spektakulärem Blick auf die Sierra del Sueve.',
    },
    pt: {
      title: 'El Balcón de Torazo',
      subtitle: 'Torazo, Cabranes',
      description: 'Cozinha tradicional asturiana com vistas espetaculares para a Sierra del Sueve.',
    },
    ast: {
      title: 'El Balcón de Torazo',
      subtitle: 'Torazo, Cabranes',
      description: 'Cocina tradicional asturiana con vistes espectaculares a la Sierra del Sueve.',
    },
  },

  'restaurant-eutimio': {
    en: {
      title: 'Eutimio',
      subtitle: 'Lastres',
      description: 'A benchmark for Asturian seafood cuisine with views of the fishing port of Lastres.',
    },
    fr: {
      title: 'Eutimio',
      subtitle: 'Lastres',
      description: 'Référence de la cuisine marine asturienne avec vues sur le port de pêche de Lastres.',
    },
    de: {
      title: 'Eutimio',
      subtitle: 'Lastres',
      description: 'Referenz für asturische Meeresküche mit Blick auf den Fischerhafen von Lastres.',
    },
    pt: {
      title: 'Eutimio',
      subtitle: 'Lastres',
      description: 'Referência da cozinha marineira asturiana com vistas para o porto pesqueiro de Lastres.',
    },
    ast: {
      title: 'Eutimio',
      subtitle: 'Lastres',
      description: 'Referencia de la cocina marinera asturiana con vistes al puertu pesqueru de Lastres.',
    },
  },

  'restaurant-tella': {
    en: {
      title: 'Tella',
      subtitle: 'Nueva de Llanes',
      description: 'Creative cuisine in an intimate setting with local seasonal products.',
    },
    fr: {
      title: 'Tella',
      subtitle: 'Nueva de Llanes',
      description: 'Cuisine d\'auteur dans un cadre intime avec produits locaux de saison.',
    },
    de: {
      title: 'Tella',
      subtitle: 'Nueva de Llanes',
      description: 'Kreative Küche in intimem Ambiente mit lokalen Saisonprodukten.',
    },
    pt: {
      title: 'Tella',
      subtitle: 'Nueva de Llanes',
      description: 'Cozinha de autor em ambiente íntimo com produtos locais da época.',
    },
    ast: {
      title: 'Tella',
      subtitle: 'Nueva de Llanes',
      description: 'Cocina d\'autor n\'ambiente íntimu con productos llocales de temporada.',
    },
  },

  'restaurant-zascandil': {
    en: {
      title: 'Zascandil',
      subtitle: 'Gijón',
      description: 'Mediterranean market cuisine with its own vegetable garden and views of San Lorenzo Bay.',
    },
    fr: {
      title: 'Zascandil',
      subtitle: 'Gijón',
      description: 'Cuisine méditerranéenne de marché avec potager propre et vues sur la baie de San Lorenzo.',
    },
    de: {
      title: 'Zascandil',
      subtitle: 'Gijón',
      description: 'Mediterrane Marktküche mit eigenem Garten und Blick auf die Bucht von San Lorenzo.',
    },
    pt: {
      title: 'Zascandil',
      subtitle: 'Gijón',
      description: 'Cozinha de mercado mediterrânica com horta própria e vistas para a baía de San Lorenzo.',
    },
    ast: {
      title: 'Zascandil',
      subtitle: 'Xixón',
      description: 'Cocina de mercáu mediterranea con güerta propia y vistes a la badea de San Llorienzo.',
    },
  },

  'restaurant-puebloastur': {
    en: {
      title: 'Puebloastur',
      subtitle: 'Cofiño, Parres',
      description: 'Boutique hotel with restaurant offering updated traditional cuisine in a spectacular rural setting.',
    },
    fr: {
      title: 'Puebloastur',
      subtitle: 'Cofiño, Parres',
      description: 'Hôtel boutique avec restaurant proposant une cuisine traditionnelle revisitée dans un cadre rural spectaculaire.',
    },
    de: {
      title: 'Puebloastur',
      subtitle: 'Cofiño, Parres',
      description: 'Boutique-Hotel mit Restaurant, das aktualisierte traditionelle Küche in spektakulärer ländlicher Umgebung bietet.',
    },
    pt: {
      title: 'Puebloastur',
      subtitle: 'Cofiño, Parres',
      description: 'Hotel boutique com restaurante que oferece cozinha tradicional revista em espetacular envolvente rural.',
    },
    ast: {
      title: 'Puebloastur',
      subtitle: 'Cofiño, Parres',
      description: 'Hotel boutique con restaurante qu\'ufierta cocina tradicional revisada n\'espectacular entornu rural.',
    },
  },

  'restaurant-el-corral-del-indianu': {
    en: {
      title: 'El Corral del Indianu',
      subtitle: 'Arriondas',
      description: 'Gastronomic reference of eastern Asturias with José Antonio Campoviejo at the helm.',
    },
    fr: {
      title: 'El Corral del Indianu',
      subtitle: 'Arriondas',
      description: 'Référence gastronomique de l\'est asturien avec José Antonio Campoviejo aux commandes.',
    },
    de: {
      title: 'El Corral del Indianu',
      subtitle: 'Arriondas',
      description: 'Gastronomische Referenz Ostasturiens mit José Antonio Campoviejo am Ruder.',
    },
    pt: {
      title: 'El Corral del Indianu',
      subtitle: 'Arriondas',
      description: 'Referência gastronómica do oriente asturiano com José Antonio Campoviejo à frente.',
    },
    ast: {
      title: 'El Corral del Indianu',
      subtitle: 'Arriondas',
      description: 'Referencia gastronómica d\'Asturies oriental con José Antonio Campoviejo al frente.',
    },
  },

  'restaurant-los-arcos': {
    en: {
      title: 'Los Arcos',
      subtitle: 'Ribadesella',
      description: 'Ribadesella hospitality tradition with products from the sea and local garden.',
    },
    fr: {
      title: 'Los Arcos',
      subtitle: 'Ribadesella',
      description: 'Tradition hôtelière de Ribadesella avec produits de la mer et du potager local.',
    },
    de: {
      title: 'Los Arcos',
      subtitle: 'Ribadesella',
      description: 'Gastronomische Tradition aus Ribadesella mit Produkten aus dem Meer und dem lokalen Garten.',
    },
    pt: {
      title: 'Los Arcos',
      subtitle: 'Ribadesella',
      description: 'Tradição hoteleira de Ribadesella com produtos do mar e da horta local.',
    },
    ast: {
      title: 'Los Arcos',
      subtitle: 'Ribesella',
      description: 'Tradición hostelera de Ribesella con productos del mar y de la güerta llocal.',
    },
  },

  'restaurant-quince-nudos': {
    en: {
      title: 'Quince Nudos',
      subtitle: 'Llanes',
      description: 'Quality seafood cuisine with views of Llanes harbor and the Picos de Europa.',
    },
    fr: {
      title: 'Quince Nudos',
      subtitle: 'Llanes',
      description: 'Cuisine marine de qualité avec vues sur le port de Llanes et les Pics d\'Europe.',
    },
    de: {
      title: 'Quince Nudos',
      subtitle: 'Llanes',
      description: 'Hochwertige Meeresküche mit Blick auf den Hafen von Llanes und die Picos de Europa.',
    },
    pt: {
      title: 'Quince Nudos',
      subtitle: 'Llanes',
      description: 'Cozinha marineira de qualidade com vistas para o porto de Llanes e os Picos da Europa.',
    },
    ast: {
      title: 'Quince Nudos',
      subtitle: 'Llanes',
      description: 'Cocina marinera de calidá con vistes al puertu de Llanes y los Picos d\'Europa.',
    },
  },

  'restaurant-v-crespo': {
    en: {
      title: 'V. Crespo',
      subtitle: 'Gijón',
      description: 'Hospitality tradition with over a century of history offering top-quality Cantabrian products.',
    },
    fr: {
      title: 'V. Crespo',
      subtitle: 'Gijón',
      description: 'Tradition hôtelière de plus d\'un siècle d\'histoire offrant des produits de première qualité du Cantabrique.',
    },
    de: {
      title: 'V. Crespo',
      subtitle: 'Gijón',
      description: 'Gastronomische Tradition mit über einem Jahrhundert Geschichte, die erstklassige kantabrische Produkte bietet.',
    },
    pt: {
      title: 'V. Crespo',
      subtitle: 'Gijón',
      description: 'Tradição hoteleira com mais de um século de história oferecendo produtos de primeira qualidade do Cantábrico.',
    },
    ast: {
      title: 'V. Crespo',
      subtitle: 'Xixón',
      description: 'Tradición hostelera con más d\'un sieglu d\'historia ufiertando productos de primera calidá del Cantábricu.',
    },
  },

  'restaurant-palacio-de-cutre': {
    en: {
      title: 'Palacio de Cutre',
      subtitle: 'Cutre, Piloña',
      description: '17th-century manor house converted into a restaurant with cuisine rooted in Asturian tradition.',
    },
    fr: {
      title: 'Palacio de Cutre',
      subtitle: 'Cutre, Piloña',
      description: 'Maison seigneuriale du XVIIe siècle transformée en restaurant avec cuisine aux racines asturiennes.',
    },
    de: {
      title: 'Palacio de Cutre',
      subtitle: 'Cutre, Piloña',
      description: 'Herrenhaus aus dem 17. Jahrhundert, zum Restaurant umgewandelt, mit Küche aus asturischer Tradition.',
    },
    pt: {
      title: 'Palacio de Cutre',
      subtitle: 'Cutre, Piloña',
      description: 'Casona palaciana do século XVII convertida em restaurante com cozinha de raízes asturianas.',
    },
    ast: {
      title: 'Palaciu de Cutre',
      subtitle: 'Cutre, Piloña',
      description: 'Casona palaciega del sieglu XVII convertida en restaurante con cocina de raigañu asturianu.',
    },
  },

  // ============================================
  // ADDITIONAL CULTURE & CAMINO (5 stories)
  // ============================================

  'museo-de-bellas-artes-de-asturias': {
    en: {
      title: 'Museum of Fine Arts of Asturias',
      subtitle: 'Oviedo',
      description: 'One of the finest art collections in Spain, with works from the 14th century to the present day.',
    },
    fr: {
      title: 'Musée des Beaux-Arts des Asturies',
      subtitle: 'Oviedo',
      description: 'L\'une des plus belles collections d\'art d\'Espagne, avec des œuvres du XIVe siècle à nos jours.',
    },
    de: {
      title: 'Museum der Schönen Künste Asturiens',
      subtitle: 'Oviedo',
      description: 'Eine der besten Kunstsammlungen Spaniens mit Werken vom 14. Jahrhundert bis heute.',
    },
    pt: {
      title: 'Museu de Belas Artes das Astúrias',
      subtitle: 'Oviedo',
      description: 'Uma das melhores coleções de arte de Espanha, com obras desde o século XIV até à atualidade.',
    },
    ast: {
      title: 'Muséu de Belles Artes d\'Asturies',
      subtitle: 'Uviéu',
      description: 'Una de les meyores coleiciones d\'arte d\'España, con obres dende\'l sieglu XIV hasta l\'actualidá.',
    },
  },

  'cueva-del-sidron': {
    en: {
      title: 'El Sidrón Cave',
      subtitle: 'Piloña',
      description: 'Site where 49,000-year-old Neanderthal remains were found. Fascinating interpretation center.',
    },
    fr: {
      title: 'Grotte d\'El Sidrón',
      subtitle: 'Piloña',
      description: 'Site où furent trouvés des restes de néandertaliens de 49 000 ans. Centre d\'interprétation fascinant.',
    },
    de: {
      title: 'Höhle von El Sidrón',
      subtitle: 'Piloña',
      description: 'Fundstätte von 49.000 Jahre alten Neandertaler-Überresten. Faszinierendes Interpretationszentrum.',
    },
    pt: {
      title: 'Gruta de El Sidrón',
      subtitle: 'Piloña',
      description: 'Jazida onde foram encontrados restos de neandertais de 49.000 anos. Centro de interpretação fascinante.',
    },
    ast: {
      title: 'Cueva d\'El Sidrón',
      subtitle: 'Piloña',
      description: 'Xacimientu onde s\'atoparon restos neandertales de 49.000 años. Centru d\'interpretación fascinante.',
    },
  },

  'camino-camara-santa-de-oviedo': {
    en: {
      title: 'Holy Chamber of Oviedo',
      subtitle: 'Oviedo',
      description: 'Essential pilgrimage site on the Camino. Houses the Holy Ark and the Cross of Victory and Cross of the Angels.',
    },
    fr: {
      title: 'Chambre Sainte d\'Oviedo',
      subtitle: 'Oviedo',
      description: 'Lieu de pèlerinage essentiel sur le Chemin. Abrite l\'Arche Sainte et les croix de la Victoire et des Anges.',
    },
    de: {
      title: 'Heilige Kammer von Oviedo',
      subtitle: 'Oviedo',
      description: 'Wesentlicher Wallfahrtsort am Jakobsweg. Beherbergt die Heilige Arche und das Sieges- und Engelskreuz.',
    },
    pt: {
      title: 'Câmara Santa de Oviedo',
      subtitle: 'Oviedo',
      description: 'Local de peregrinação essencial no Caminho. Guarda a Arca Santa e as cruzes da Vitória e dos Anjos.',
    },
    ast: {
      title: 'Cámara Santa d\'Uviéu',
      subtitle: 'Uviéu',
      description: 'Llugar de pelegrinación esencial nel Camín. Guarda l\'Arca Santa y les cruces de la Vitoria y de los Ánxeles.',
    },
  },

  'camino-monasterio-de-san-salvador': {
    en: {
      title: 'Monastery of San Salvador',
      subtitle: 'Cornellana',
      description: 'Mandatory stop on the Primitive Way, with Romanesque cloister and beautiful Baroque altarpiece.',
    },
    fr: {
      title: 'Monastère de San Salvador',
      subtitle: 'Cornellana',
      description: 'Étape obligée sur le Chemin Primitif, avec cloître roman et magnifique retable baroque.',
    },
    de: {
      title: 'Kloster San Salvador',
      subtitle: 'Cornellana',
      description: 'Obligatorische Station auf dem Primitiven Weg mit romanischem Kreuzgang und wunderschönem Barockaltar.',
    },
    pt: {
      title: 'Mosteiro de San Salvador',
      subtitle: 'Cornellana',
      description: 'Paragem obrigatória no Caminho Primitivo, com claustro românico e belo retábulo barroco.',
    },
    ast: {
      title: 'Monesteriu de San Salvador',
      subtitle: 'Cornellana',
      description: 'Parada obligada nel Camín Primitivu, con claustru románicu y guapu retablu barrocu.',
    },
  },

  'camino-puerto-del-palo': {
    en: {
      title: 'Puerto del Palo',
      subtitle: 'Tineo',
      description: 'Mountain pass on the Primitive Way with hermitage and panoramic views. One of the highest points of the route.',
    },
    fr: {
      title: 'Puerto del Palo',
      subtitle: 'Tineo',
      description: 'Col de montagne sur le Chemin Primitif avec ermitage et vues panoramiques. Un des points les plus hauts de la route.',
    },
    de: {
      title: 'Puerto del Palo',
      subtitle: 'Tineo',
      description: 'Bergpass auf dem Primitiven Weg mit Einsiedelei und Panoramablick. Einer der höchsten Punkte der Route.',
    },
    pt: {
      title: 'Puerto del Palo',
      subtitle: 'Tineo',
      description: 'Passo de montanha no Caminho Primitivo com ermida e vistas panorâmicas. Um dos pontos mais altos da rota.',
    },
    ast: {
      title: 'Puertu del Palu',
      subtitle: 'Tinéu',
      description: 'Pasu de monte nel Camín Primitivu con ermita y vistes panorámiques. Ún de los puntos más altos de la ruta.',
    },
  },

  // ============================================
  // NATURE (alternate slugs - 4 stories)
  // ============================================

  'lagos-de-covadonga': {
    en: {
      title: 'Lakes of Covadonga',
      subtitle: 'Picos de Europa',
      description: 'Enol and Ercina, two glacial lakes surrounded by the most imposing peaks of Picos de Europa.',
    },
    fr: {
      title: 'Lacs de Covadonga',
      subtitle: 'Pics d\'Europe',
      description: 'Enol et Ercina, deux lacs d\'origine glaciaire entourés des sommets les plus imposants des Pics d\'Europe.',
    },
    de: {
      title: 'Seen von Covadonga',
      subtitle: 'Picos de Europa',
      description: 'Enol und Ercina, zwei Gletscherseen umgeben von den imposantesten Gipfeln der Picos de Europa.',
    },
    pt: {
      title: 'Lagos de Covadonga',
      subtitle: 'Picos da Europa',
      description: 'Enol e Ercina, dois lagos de origem glaciar rodeados dos picos mais imponentes dos Picos da Europa.',
    },
    ast: {
      title: 'Llagos de Cuadonga',
      subtitle: 'Picos d\'Europa',
      description: 'Enol y Ercina, dos llagos d\'orixe glaciar arrodiaos polos picos más imponentes de los Picos d\'Europa.',
    },
  },

  'ruta-del-cares': {
    en: {
      title: 'Cares Route',
      subtitle: 'Picos de Europa',
      description: '12 kilometers of trail carved into the rock between León and Asturias, the most famous hiking route in Spain.',
    },
    fr: {
      title: 'Route du Cares',
      subtitle: 'Pics d\'Europe',
      description: '12 kilomètres de sentier creusé dans la roche entre León et les Asturies, la randonnée la plus célèbre d\'Espagne.',
    },
    de: {
      title: 'Cares-Route',
      subtitle: 'Picos de Europa',
      description: '12 Kilometer Wanderweg in den Felsen gehauen zwischen León und Asturien, Spaniens berühmtester Wanderweg.',
    },
    pt: {
      title: 'Rota do Cares',
      subtitle: 'Picos da Europa',
      description: '12 quilómetros de trilho talhado na rocha entre Leão e Astúrias, a rota de caminhada mais famosa de Espanha.',
    },
    ast: {
      title: 'Ruta\'l Cares',
      subtitle: 'Picos d\'Europa',
      description: '12 quilómetros de sienda escavada na roca ente Lleón y Asturies, la ruta de senderismu más famosa d\'España.',
    },
  },

  'playa-del-silencio': {
    en: {
      title: 'Beach of Silence',
      subtitle: 'Cudillero',
      description: 'Pristine beach surrounded by cliffs, accessible only on foot, considered one of the most beautiful in Asturias.',
    },
    fr: {
      title: 'Plage du Silence',
      subtitle: 'Cudillero',
      description: 'Plage vierge entourée de falaises, accessible uniquement à pied, considérée comme l\'une des plus belles des Asturies.',
    },
    de: {
      title: 'Strand der Stille',
      subtitle: 'Cudillero',
      description: 'Unberührter Strand umgeben von Klippen, nur zu Fuß erreichbar, gilt als einer der schönsten Asturiens.',
    },
    pt: {
      title: 'Praia do Silêncio',
      subtitle: 'Cudillero',
      description: 'Praia virgem rodeada de falésias, acessível apenas a pé, considerada uma das mais bonitas das Astúrias.',
    },
    ast: {
      title: 'Playa\'l Silenciu',
      subtitle: 'Paraísu escondíu',
      description: 'Una de les playes más espectaculares d\'Asturies, arrodiada de cantiles verdes y agües cristalinas.',
    },
  },

  'senda-del-oso': {
    en: {
      title: 'Bear Trail',
      subtitle: 'Teverga-Quirós',
      description: '36 kilometers of greenway perfect for cycling, with a bear enclosure and spectacular mountain landscapes.',
    },
    fr: {
      title: 'Sentier de l\'Ours',
      subtitle: 'Teverga-Quirós',
      description: '36 kilomètres de voie verte parfaite pour le vélo, avec enclos d\'ours et paysages de montagne spectaculaires.',
    },
    de: {
      title: 'Bärenpfad',
      subtitle: 'Teverga-Quirós',
      description: '36 Kilometer Grüner Weg perfekt zum Radfahren, mit Bärengehege und spektakulären Berglandschaften.',
    },
    pt: {
      title: 'Senda do Urso',
      subtitle: 'Teverga-Quirós',
      description: '36 quilómetros de via verde perfeita para bicicleta, com cercado de ursos e paisagens de montanha espetaculares.',
    },
    ast: {
      title: 'Sienda l\'Osu',
      subtitle: 'Ruta familiar',
      description: 'Una vía verde perfecta pa percorrer en familia, al traviés de paisaxes de monte y cola posibilidá de ver osos nel cercáu.',
    },
  },
};
