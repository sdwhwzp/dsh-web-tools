/** Build anonymous and account search attempts while preserving order inside each group. */
import type { SearchAccessMode } from "../shared/search-policy.ts";
import { searchAuthentication, type ProviderMeta } from "./providers/types.ts";

/** One search source and the authentication path to use. */
export interface SearchAttempt {
  provider: string;
  anonymous: boolean;
}

/** Only configured-chain providers participate; free-only never creates account attempts. */
export function searchAttempts(
  chain: string[],
  mode: SearchAccessMode,
  providers: Record<string, Pick<ProviderMeta, "authentication" | "needsBaseUrl" | "fetchCapable">>,
): SearchAttempt[] {
  const anonymous: SearchAttempt[] = [];
  const account: SearchAttempt[] = [];
  for (const provider of chain) {
    const meta = providers[provider];
    if (!meta) throw new Error(`Unknown search provider: ${provider}`);
    const auth = searchAuthentication(meta);
    if (auth !== "required") anonymous.push({ provider, anonymous: true });
    if (auth !== "none" && mode !== "free-only") account.push({ provider, anonymous: false });
  }
  return mode === "api-first" ? [...account, ...anonymous] : [...anonymous, ...account];
}
