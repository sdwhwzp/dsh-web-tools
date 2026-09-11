import type { BrowserPlatform } from "./types.ts";
import type { CdpClient } from "./cdp/client.ts";
import type { RemoteLoginInput, RemoteLoginOptions, RemoteLoginView } from "../../shared/remote-login.ts";
/** Browser startup and remote display settings; resolved by the settings provider. */
export declare const DEFAULT_BROWSER_SETTINGS: {
    browserExecutable: string;
    browserDisplay: string;
    browserXauthority: string;
    remoteLoginWidth: number;
    remoteLoginHeight: number;
    remoteLoginTimeoutMs: number;
    remoteLoginIdleTimeoutMs: number;
    remoteLoginPollIntervalMs: number;
    remoteLoginQuality: number;
};
export type BrowserSettings = typeof DEFAULT_BROWSER_SETTINGS;
/** Resolve settings into the immutable dimensions and deadlines of a login. */
export declare function remoteLoginOptions(settings: BrowserSettings): RemoteLoginOptions;
/** Validate an HTTP input message without accepting arbitrary browser commands. */
export declare function parseRemoteLoginInput(value: unknown, options: Pick<RemoteLoginOptions, "width" | "height">): RemoteLoginInput;
/** One expiring capability, scoped to the platform's existing login tab. */
export declare class RemoteLoginSession {
    readonly platform: BrowserPlatform;
    readonly options: RemoteLoginOptions;
    private readonly now;
    readonly id: `${string}-${string}-${string}-${string}-${string}`;
    readonly expiresAt: number;
    private state;
    private error?;
    private page?;
    private lastSeen;
    private pointerDown;
    private queue;
    private queued;
    private frameTask?;
    private lastFrameAt;
    private lastFrame?;
    constructor(platform: BrowserPlatform, options: RemoteLoginOptions, now?: () => number);
    expired(): boolean;
    active(): boolean;
    touch(): void;
    view(): RemoteLoginView;
    attach(cdp: CdpClient, targetId: string, sessionId: string): Promise<void>;
    finish(authenticated: boolean, error?: string): void;
    private allowedPage;
    frame(): Promise<RemoteLoginView>;
    input(value: unknown): Promise<void>;
    /** Revoke input first, then await already issued commands before browser teardown. */
    close(): Promise<void>;
}
