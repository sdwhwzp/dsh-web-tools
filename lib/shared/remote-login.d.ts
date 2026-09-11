/** HTTP messages for an administrator's temporary platform login view. */
export type RemoteLoginState = "starting" | "pending" | "authenticated" | "failed";
/** Display settings captured once when a remote login starts. */
export interface RemoteLoginOptions {
    width: number;
    height: number;
    timeoutMs: number;
    idleTimeoutMs: number;
    pollIntervalMs: number;
    quality: number;
}
/** One view update; image data is present only while manual login is active. */
export interface RemoteLoginView {
    id: string;
    state: RemoteLoginState;
    width: number;
    height: number;
    pollIntervalMs: number;
    expiresAt: number;
    image?: string;
    error?: string;
}
/** Allowed input operations; no URL, JavaScript, file, cookie or CDP commands. */
export type RemoteLoginInput = {
    type: "pointer";
    action: "down" | "move" | "up";
    x: number;
    y: number;
} | {
    type: "wheel";
    x: number;
    y: number;
    deltaY: number;
} | {
    type: "text";
    text: string;
} | {
    type: "key";
    key: "Enter" | "Tab" | "Backspace" | "Delete" | "Escape" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
    shift?: boolean;
};
