import { StoryInfoPanel } from "paisaxe";

const ES: Record<string, string> = {
  "accessibility.hide_info": "Ocultar información de la historia",
  "stories.ask_about": "Descúbrelo",
  "favorites.bookmarks": "Guardados",
};
const t = (key: string) => ES[key] ?? key;
const noop = () => {};

// Stands in for the story photo + the viewer's own bottom-up darkening gradient.
const backdrop = {
  backgroundImage:
    "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.4)), linear-gradient(160deg, #6b8f71 0%, #3f5a48 45%, #2a3a44 100%)",
};

const story = {
  id: "lagos-de-covadonga",
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa · Cangas de Onís",
  description: "",
  image: "",
  imageSource: "Turismo Asturias",
  category: "nature" as const,
  sourcePdf: "",
  createdAt: new Date().toISOString(),
  sourceType: "user_submitted" as const,
};

const localizedStory = {
  title: story.title,
  subtitle: story.subtitle,
  description:
    "El Enol y la Ercina, a más de mil metros, entre pastos y vacas casinas. Sube temprano: en verano la carretera se cierra al tráfico y se llega en autobús.",
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative overflow-hidden" style={{ width: 760, height: 560, ...backdrop }}>
    {children}
  </div>
);

export const Default = () => (
  <Frame>
    <StoryInfoPanel
      story={story}
      localizedStory={localizedStory}
      showInfo
      t={t}
      onAskAbout={noop}
      onToggleInfo={noop}
      ast={false}
      locale="es"
      isEnabled={() => true}
      questionPrompts={["¿Cuándo cierra la carretera?", "¿Hay rutas fáciles alrededor de los lagos?", "¿Dónde aparco?"]}
      requiresAuth={false}
      onAuthRequired={noop}
      onFavoritesNav={noop}
      isFavorite={false}
    />
  </Frame>
);

export const Minimal = () => (
  <Frame>
    <StoryInfoPanel
      story={{ ...story, sourceType: undefined, imageSource: undefined, createdAt: "2025-01-01T00:00:00.000Z" }}
      localizedStory={localizedStory}
      showInfo
      t={t}
      onAskAbout={noop}
      onToggleInfo={undefined}
      ast={false}
      locale="es"
      isEnabled={() => false}
      questionPrompts={[]}
      requiresAuth
      onAuthRequired={noop}
      onFavoritesNav={noop}
      isFavorite={false}
    />
  </Frame>
);
