export interface AuthoredCitation {
  title: string;
  url: string;
  license: string;
  revision: string;
  attribution: string;
}

export interface Source {
  id: string;
  title: string;
  sourcePdf?: string;
  citation?: AuthoredCitation;
  pageNumber?: number;
  snippet: string;
}

export interface ImageResult {
  id: string;
  path: string;
  caption?: string;
  sourcePdf: string;
  provenance?: string;
}

export interface Chunk {
  id: string;
  content: string;
  sourcePdf?: string;
  citation?: AuthoredCitation;
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
