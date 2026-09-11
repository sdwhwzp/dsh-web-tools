import { searchAuthentication } from "./providers/types.js";
/** Only configured-chain providers participate; free-only never creates account attempts. */
export function searchAttempts(chain, mode, providers) {
    const anonymous = [];
    const account = [];
    for (const provider of chain) {
        const meta = providers[provider];
        if (!meta)
            throw new Error(`Unknown search provider: ${provider}`);
        const auth = searchAuthentication(meta);
        if (auth !== "required")
            anonymous.push({ provider, anonymous: true });
        if (auth !== "none" && mode !== "free-only")
            account.push({ provider, anonymous: false });
    }
    return mode === "api-first" ? [...account, ...anonymous] : [...anonymous, ...account];
}
