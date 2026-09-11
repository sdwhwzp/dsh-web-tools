/** Authentication and spending choices shared by adapters, routing and settings. */
export type SearchAccessMode = "free-only" | "free-first" | "api-first";
/** Whether search accepts anonymous requests; extraction can still require a key. */
export type SearchAuthentication = "none" | "optional" | "required";
/** Public platform prefixes select platform APIs through web_search. */
export declare const PUBLIC_PLATFORMS: {
    readonly github: "GitHub";
    readonly v2ex: "V2EX";
    readonly bilibili: "Bilibili";
    readonly reddit: "Reddit";
    readonly hn: "Hacker News";
    readonly stackoverflow: "Stack Overflow";
    readonly wikipedia: "Wikipedia";
    readonly npm: "npm";
};
/** Supported public platform identifier. */
export type PublicPlatform = keyof typeof PUBLIC_PLATFORMS;
