import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { getLanguage, resolveLanguage, setLanguage, subscribeLanguage } from "../shared/i18n";

// Paseo 0.12 owns this query. Read only the language; never persist or change host settings.
// Isolated here because the plugin SDK does not yet expose a dedicated locale hook.
export const APP_LANGUAGE_QUERY = ["app-settings"] as const;
export function useLanguage() {
  const queryClient = useQueryClient();
  const read = useCallback(() => {
    const settings = queryClient.getQueryData<{ language?: string }>(APP_LANGUAGE_QUERY);
    return resolveLanguage(settings?.language, Intl.DateTimeFormat().resolvedOptions().locale);
  }, [queryClient]);
  const subscribe = useCallback((listener: () => void) => queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] === APP_LANGUAGE_QUERY[0]) listener();
  }), [queryClient]);
  const requested = useSyncExternalStore(subscribe, read, read);
  const current = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  useLayoutEffect(() => setLanguage(requested), [requested]);
  return current;
}
