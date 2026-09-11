/** Authentication and spending choices shared by adapters, routing and settings. */
export type SearchAccessMode = "free-only" | "free-first" | "api-first";

/** Whether search accepts anonymous requests; extraction can still require a key. */
export type SearchAuthentication = "none" | "optional" | "required";

/** Public platform prefixes select platform APIs through web_search. */
export const PUBLIC_PLATFORMS = {
  github: "GitHub",
  v2ex: "V2EX",
  bilibili: "Bilibili",
  reddit: "Reddit",
  hn: "Hacker News",
  stackoverflow: "Stack Overflow",
  wikipedia: "Wikipedia",
  npm: "npm",
} as const;

/** Supported public platform identifier. */
export type PublicPlatform = keyof typeof PUBLIC_PLATFORMS;
