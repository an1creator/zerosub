import { useSyncExternalStore } from "react";
import { getLanguage, subscribeAppLanguage } from "./language-source";

export function useLanguage() {
  return useSyncExternalStore(subscribeAppLanguage, getLanguage, getLanguage);
}
