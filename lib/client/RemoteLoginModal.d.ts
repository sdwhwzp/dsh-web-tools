import type { BrowserPlatform } from "../shared/platform-types.ts";
import type { TFunc } from "./WebToolsSection.tsx";
/** The dialog owns its temporary view; closing never deletes the platform profile. */
export declare function RemoteLoginModal({ platform, t, onClose }: {
    platform: BrowserPlatform;
    t: TFunc;
    onClose: () => void;
}): import("react").JSX.Element;
