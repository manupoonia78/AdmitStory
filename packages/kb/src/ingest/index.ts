// Source ingestion (spec §9.3): extract text, fetch allowlisted URLs safely, chunk for retrieval.
// Server-only. Kept off the main `@admitstory/kb` barrel so importing pack types or the compiler
// never loads node:https or the document parsers.

export {
  SOURCE_FORMATS,
  UnsupportedSourceError,
  extractText,
  htmlToText,
  sourceFormatFor,
  tidyText,
  type ExtractedText,
  type SourceFormat,
  type Transcriber,
} from "./extract";
export {
  FETCH_DEFAULTS,
  UrlFetchError,
  fetchUrl,
  hostAllowed,
  isPublicAddress,
  type FetchUrlOptions,
  type FetchedUrl,
  type PinnedRequest,
  type ResolvedAddress,
  type Resolver,
  type Transport,
  type TransportResponse,
  type UrlFetchErrorCode,
} from "./fetch-url";
export { CHUNK_DEFAULTS, chunkText, type Chunk, type ChunkOptions } from "./chunker";
