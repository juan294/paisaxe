import { StoryProgressBar } from "paisaxe";

const ES: Record<string, string> = {
  "accessibility.story_counter": "Historia {current} de {total}",
  "accessibility.story_progress": "Progreso de historias",
  "accessibility.go_to_story": "Ir a la historia {current} de {total}",
};
const t = (key: string) => ES[key] ?? key;

const backdrop = { backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent), linear-gradient(160deg, #6b8f71, #2a3a44)" };

export const Early = () => (
  <div className="relative" style={{ width: 720, height: 80, ...backdrop }}>
    <StoryProgressBar storiesLength={12} currentIndex={2} onIndexChange={() => {}} t={t} />
  </div>
);

export const Paged = () => (
  <div className="relative" style={{ width: 720, height: 80, ...backdrop }}>
    <StoryProgressBar storiesLength={105} currentIndex={33} onIndexChange={() => {}} t={t} />
  </div>
);
