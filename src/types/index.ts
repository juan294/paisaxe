export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  images?: ImageResult[];
  timestamp: Date;
}

export interface Source {
  id: string;
  title: string;
  sourcePdf: string;
  pageNumber?: number;
  snippet: string;
}

export interface ImageResult {
  id: string;
  path: string;
  caption?: string;
  sourcePdf: string;
}

export interface Chunk {
  id: string;
  content: string;
  sourcePdf: string;
  pageNumber?: number;
  sectionTitle?: string;
  imageRefs?: string[];
  similarity?: number;
}

export interface SearchResult {
  chunks: Chunk[];
  images: ImageResult[];
}

export interface ChatRequest {
  message: string;
  conversationHistory?: Pick<Message, "role" | "content">[];
}

export interface ChatResponse {
  message: string;
  sources: Source[];
  images: ImageResult[];
}

export type Locale = "es" | "en";

export interface SuggestionChip {
  label: string;
  query: string;
  icon?: string;
}
