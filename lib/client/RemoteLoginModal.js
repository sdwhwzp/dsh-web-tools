import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/** Administrator-only remote platform login over the authenticated HTTP gateway. */
import { useEffect, useRef, useState } from "react";
import { Modal, Button } from "@deepseek-ai/dsh-client-ui-primitives";
import { api } from "./api.js";
import { remoteLoginStatusKey } from "./platform-login.js";
import { text, surface, state as stateColor } from "./theme.js";
/** The dialog owns its temporary view; closing never deletes the platform profile. */
export function RemoteLoginModal({ platform, t, onClose }) {
    const [view, setView] = useState();
    const [error, setError] = useState("");
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const session = useRef();
    const opening = useRef();
    const queue = useRef(Promise.resolve());
    const active = useRef(true);
    const dragging = useRef(false);
    const moving = useRef(false);
    const nextMove = useRef();
    const message = (e) => {
        const value = e instanceof Error ? e.message : String(e);
        return value === "browser-missing" ? t("platformBrowserMissing") : value === "display-missing" ? t("platformDisplayMissing") : value;
    };
    useEffect(() => {
        let cancelled = false;
        let timer;
        let owned;
        active.current = true;
        const poll = async () => {
            if (cancelled || !owned)
                return;
            try {
                const next = await api.remoteLoginFrame(platform, owned.id);
                if (cancelled)
                    return;
                session.current = next;
                setView(next);
                if (next.state === "starting" || next.state === "pending")
                    timer = setTimeout(() => void poll(), next.pollIntervalMs);
            }
            catch (e) {
                if (!cancelled)
                    setError(message(e));
            }
        };
        opening.current ??= api.remoteLoginStart(platform);
        void opening.current.then(async (created) => {
            owned = created;
            if (cancelled) {
                if (!active.current)
                    await api.remoteLoginClose(platform, created.id);
                return;
            }
            session.current = created;
            setView(created);
            await poll();
        }).catch((e) => { if (!cancelled)
            setError(message(e)); });
        return () => {
            cancelled = true;
            active.current = false;
            if (timer)
                clearTimeout(timer);
            // The server deadline covers a tab whose close request cannot be delivered.
            queueMicrotask(() => { if (owned && !active.current)
                void api.remoteLoginClose(platform, owned.id).catch(() => { }); });
        };
    }, [platform]);
    const send = (input) => {
        const current = session.current;
        if (!current || current.state !== "pending" || !active.current)
            return Promise.resolve();
        const task = queue.current.then(async () => {
            if (active.current)
                await api.remoteLoginInput(platform, current.id, input);
        });
        queue.current = task.catch((e) => { if (active.current)
            setError(message(e)); });
        return task;
    };
    const point = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: Math.max(0, Math.min((view?.width ?? 1) - 1, (event.clientX - rect.left) * (view?.width ?? 1) / rect.width)),
            y: Math.max(0, Math.min((view?.height ?? 1) - 1, (event.clientY - rect.top) * (view?.height ?? 1) / rect.height)) };
    };
    const move = async () => {
        if (moving.current)
            return;
        moving.current = true;
        try {
            while (nextMove.current && dragging.current && active.current) {
                const input = nextMove.current;
                nextMove.current = undefined;
                await send(input);
            }
        }
        catch { /* send already displays the request error. */ }
        finally {
            moving.current = false;
        }
    };
    const pointer = (event, action) => {
        event.preventDefault();
        if (action === "down") {
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        dragging.current = action === "down";
        nextMove.current = undefined;
        void send({ type: "pointer", action, ...point(event) }).catch(() => { });
    };
    const key = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing)
            return;
        const keys = ["Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
        if (keys.includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            void send({ type: "key", key: event.key, shift: event.shiftKey }).catch(() => { });
        }
        else if (event.key.length === 1) {
            event.preventDefault();
            void send({ type: "text", text: event.key }).catch(() => { });
        }
    };
    const sendDraft = async () => {
        if (!draft || sending)
            return;
        setSending(true);
        try {
            await send({ type: "text", text: draft });
            setDraft("");
        }
        catch { /* send already displays the request error. */ }
        finally {
            setSending(false);
        }
    };
    const pending = view?.state === "pending";
    return _jsx(Modal, { open: true, onClose: onClose, title: `${t("remoteLoginTitle")} · ${t(platform === "x" ? "xTitle" : "xiaohongshuTitle")}`, headless: true, className: "dswt-remote-login-dialog", children: _jsxs("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: "90vh", overflowY: "auto", color: text.primary }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [_jsxs("strong", { children: [t("remoteLoginTitle"), " \u00B7 ", t(platform === "x" ? "xTitle" : "xiaohongshuTitle")] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: onClose, children: t("remoteLoginClose") })] }), _jsx("p", { style: { margin: 0, fontSize: 13, color: text.secondary }, children: t("remoteLoginHint") }), _jsx("div", { role: "status", style: { fontSize: 13 }, children: t(remoteLoginStatusKey(view?.state)) }), (error || view?.error) && _jsx("div", { role: "alert", style: { color: stateColor.danger, fontSize: 13 }, children: error || view?.error }), view?.image && pending && _jsx("img", { src: view.image, alt: t("remoteLoginScreen"), tabIndex: 0, draggable: false, onKeyDown: key, onPointerDown: (e) => pointer(e, "down"), onPointerUp: (e) => pointer(e, "up"), onPointerCancel: (e) => pointer(e, "up"), onPointerMove: (event) => { if (dragging.current) {
                        nextMove.current = { type: "pointer", action: "move", ...point(event) };
                        void move();
                    } }, onWheel: (event) => { event.preventDefault(); void send({ type: "wheel", ...point(event), deltaY: Math.max(-2000, Math.min(2000, event.deltaY)) }).catch(() => { }); }, style: { width: "100%", height: "auto", display: "block", touchAction: "none", borderRadius: 8, border: `1px solid ${surface.border}`, background: "#fff" } }), pending && _jsxs("form", { onSubmit: (event) => { event.preventDefault(); void sendDraft(); }, style: { display: "flex", flexWrap: "wrap", gap: 8, position: "sticky", bottom: 0, zIndex: 2, padding: "8px 0", background: surface.layer1 }, children: [_jsx("input", { type: "password", autoComplete: "off", value: draft, maxLength: 4096, onChange: (event) => setDraft(event.target.value), "aria-label": t("remoteLoginText"), placeholder: t("remoteLoginText"), style: { flex: "1 1 240px", padding: "8px 10px", color: text.primary, background: surface.layer2, border: `1px solid ${surface.border}`, borderRadius: 6 } }), _jsx(Button, { type: "button", disabled: !draft || sending, onClick: () => void sendDraft(), children: t("remoteLoginSendText") }), ["Backspace", "Tab", "Enter"].map((name) => _jsx(Button, { type: "button", variant: "outline", onClick: () => void send({ type: "key", key: name }).catch(() => { }), children: t(`remoteLoginKey${name}`) }, name))] })] }) });
}
