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
  context?: string;
}

export interface ChatResponse {
  message: string;
  sources?: Source[];
  images?: ImageResult[];
}

export type { ChatDoneEvent, ChatErrorEvent, ChatStreamEvent, ChatTextEvent } from "./sse";
export { encodeSseEvent, parseSseEvent } from "./sse";
