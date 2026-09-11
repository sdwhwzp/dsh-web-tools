import { type Source } from "./types.ts";
/** A JSON object received from a search service. */
export type SearchRecord = Record<string, unknown>;
/** Require an object at a provider JSON boundary. */
export declare function record(value: unknown): SearchRecord;
/** Require an array of objects at a provider JSON boundary. */
export declare function records(value: unknown): SearchRecord[];
/** Read an optional text field without coercing objects into model-visible text. */
export declare function string(value: unknown): string;
/** Decode text and strip markup without executing page scripts. */
export declare function plainText(value: unknown): string;
/** Deduplicate HTTP(S) sources, rejecting executable URLs from remote results. */
export declare function normalizeSources(sources: Source[], limit: number): Source[];
/** Read a bounded response; the two-megabyte ceiling contains untrusted search payloads. */
export declare function searchText(response: Response): Promise<string>;
/** Fetch provider JSON through the shared proxy with the caller's cancellation signal. */
export declare function searchJson(url: string, init?: RequestInit): Promise<unknown>;
/** Call a public MCP search tool, accepting JSON or a matching SSE JSON-RPC response. */
export declare function searchMcp(url: string, tool: string, args: SearchRecord, signal?: AbortSignal): Promise<SearchRecord>;
/** Extract text blocks from an MCP tool result. */
export declare function mcpText(result: SearchRecord): string;
