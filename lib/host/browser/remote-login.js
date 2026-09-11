/** Restricted screenshot and input bridge for one platform login page. */
import { randomUUID } from "node:crypto";
import { validatePlatformUrl } from "./paths.js";
/** Browser startup and remote display settings; resolved by the settings provider. */
export const DEFAULT_BROWSER_SETTINGS = {
    browserExecutable: "auto",
    browserDisplay: "",
    browserXauthority: "",
    remoteLoginWidth: 1100,
    remoteLoginHeight: 760,
    remoteLoginTimeoutMs: 300000,
    remoteLoginIdleTimeoutMs: 120000,
    remoteLoginPollIntervalMs: 1000,
    remoteLoginQuality: 75,
};
/** Resolve settings into the immutable dimensions and deadlines of a login. */
export function remoteLoginOptions(settings) {
    return { width: settings.remoteLoginWidth, height: settings.remoteLoginHeight,
        timeoutMs: settings.remoteLoginTimeoutMs, idleTimeoutMs: settings.remoteLoginIdleTimeoutMs,
        pollIntervalMs: settings.remoteLoginPollIntervalMs, quality: settings.remoteLoginQuality };
}
/** Validate an HTTP input message without accepting arbitrary browser commands. */
export function parseRemoteLoginInput(value, options) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid remote login input");
    const v = value;
    if (v.type === "text" && typeof v.text === "string" && v.text.length > 0 && v.text.length <= 4096)
        return { type: "text", text: v.text };
    const keys = ["Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (v.type === "key" && typeof v.key === "string" && keys.includes(v.key) && (v.shift === undefined || typeof v.shift === "boolean")) {
        return { type: "key", key: v.key, shift: v.shift === true };
    }
    if (typeof v.x !== "number" || typeof v.y !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y)
        || v.x < 0 || v.y < 0 || v.x >= options.width || v.y >= options.height)
        throw new Error("Invalid remote login coordinates");
    if (v.type === "pointer" && (v.action === "down" || v.action === "move" || v.action === "up"))
        return { type: "pointer", action: v.action, x: v.x, y: v.y };
    if (v.type === "wheel" && typeof v.deltaY === "number" && Number.isFinite(v.deltaY) && Math.abs(v.deltaY) <= 2000)
        return { type: "wheel", x: v.x, y: v.y, deltaY: v.deltaY };
    throw new Error("Invalid remote login input");
}
/** One expiring capability, scoped to the platform's existing login tab. */
export class RemoteLoginSession {
    platform;
    options;
    now;
    id = randomUUID();
    expiresAt;
    state = "starting";
    error;
    page;
    lastSeen;
    pointerDown = false;
    queue = Promise.resolve();
    queued = 0;
    frameTask;
    lastFrameAt = 0;
    lastFrame;
    constructor(platform, options, now = Date.now) {
        this.platform = platform;
        this.options = options;
        this.now = now;
        this.lastSeen = now();
        this.expiresAt = this.lastSeen + options.timeoutMs;
    }
    expired() { return this.now() >= this.expiresAt || this.now() - this.lastSeen >= this.options.idleTimeoutMs; }
    active() { return this.state === "starting" || this.state === "pending"; }
    touch() { this.lastSeen = this.now(); }
    view() {
        return { id: this.id, state: this.state, width: this.options.width, height: this.options.height,
            pollIntervalMs: this.options.pollIntervalMs, expiresAt: this.expiresAt, ...(this.error ? { error: this.error } : {}) };
    }
    async attach(cdp, targetId, sessionId) {
        if (!this.active())
            return;
        this.page = { cdp, targetId, sessionId };
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: this.options.width, height: this.options.height, deviceScaleFactor: 1, mobile: false }, sessionId);
        await cdp.send("Browser.setDownloadBehavior", { behavior: "deny" });
        if (this.active())
            this.state = "pending";
    }
    finish(authenticated, error) {
        this.state = authenticated ? "authenticated" : "failed";
        this.error = error;
        this.page = undefined;
        this.lastFrame = undefined;
    }
    async allowedPage() {
        const page = this.page;
        if (!page || !this.active() || this.expired())
            throw new Error("Remote login session is not active");
        const { targetInfo } = await page.cdp.send("Target.getTargetInfo", { targetId: page.targetId });
        if (this.page !== page || !this.active() || this.expired())
            throw new Error("Remote login session is not active");
        if (!validatePlatformUrl(targetInfo.url, this.platform))
            throw new Error("Login page left the selected platform");
        return page;
    }
    async frame() {
        if (this.expired())
            throw new Error("Remote login expired");
        this.touch();
        if (this.state !== "pending")
            return this.view();
        if (this.frameTask)
            return this.frameTask;
        if (this.lastFrame && this.now() - this.lastFrameAt < this.options.pollIntervalMs)
            return this.lastFrame;
        this.frameTask = (async () => {
            const page = await this.allowedPage();
            const screenshot = await page.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: this.options.quality, captureBeyondViewport: false }, page.sessionId);
            // Navigation and login completion can race capture; never publish that frame.
            await this.allowedPage();
            const view = { ...this.view(), image: `data:image/jpeg;base64,${screenshot.data}` };
            this.lastFrame = view;
            this.lastFrameAt = this.now();
            return view;
        })().finally(() => { this.frameTask = undefined; });
        return this.frameTask;
    }
    async input(value) {
        const input = parseRemoteLoginInput(value, this.options);
        if (this.queued >= 32)
            throw new Error("Remote login input queue is full");
        this.queued++;
        const task = this.queue.then(async () => {
            const page = await this.allowedPage();
            this.touch();
            const send = (method, params) => page.cdp.send(method, params, page.sessionId);
            if (input.type === "text")
                await send("Input.insertText", { text: input.text });
            else if (input.type === "key") {
                const codes = { Enter: 13, Tab: 9, Backspace: 8, Delete: 46, Escape: 27, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
                const params = { key: input.key, code: input.key, windowsVirtualKeyCode: codes[input.key], modifiers: input.shift ? 8 : 0 };
                await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
                await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
            }
            else if (input.type === "wheel")
                await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: input.x, y: input.y, deltaX: 0, deltaY: input.deltaY });
            else {
                if (input.action === "down")
                    this.pointerDown = true;
                if (input.action === "up")
                    this.pointerDown = false;
                await send("Input.dispatchMouseEvent", { type: input.action === "down" ? "mousePressed" : input.action === "up" ? "mouseReleased" : "mouseMoved",
                    x: input.x, y: input.y, button: input.action === "move" && !this.pointerDown ? "none" : "left", buttons: this.pointerDown ? 1 : 0, clickCount: input.action === "move" ? 0 : 1 });
            }
            this.lastFrame = undefined;
        }).finally(() => { this.queued--; });
        this.queue = task.catch(() => { }); // Each caller receives its own input failure.
        return task;
    }
    /** Revoke input first, then await already issued commands before browser teardown. */
    async close() {
        this.finish(false, "Remote login closed");
        await Promise.allSettled([this.queue, this.frameTask]);
    }
}
