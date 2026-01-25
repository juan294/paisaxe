export interface Story {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: StoryCategory;
  sourcePdf: string;
}

export type StoryCategory =
  | "nature"
  | "cities"
  | "food"
  | "culture"
  | "activities";

export const CATEGORY_LABELS: Record<StoryCategory, string> = {
  nature: "Naturaleza",
  cities: "Ciudades",
  food: "Gastronomía",
  culture: "Cultura",
  activities: "Actividades",
};
