"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Filters } from "@/lib/search-contract";
type Draft = { scope: string; value: Filters } | null;
const Context = createContext<{
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
} | null>(null);
export function SearchDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Draft>(null);
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSearchDraft(
  initial: Filters,
  scope: string,
): [Filters, Dispatch<SetStateAction<Filters>>] {
  const context = useContext(Context);
  if (!context) throw new Error("Search controls require SearchDraftProvider.");
  const { draft, setDraft } = context;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  // URL navigation/back resets pending changes; both controls then share one draft.
  useEffect(() => {
    setDraft({ scope, value: initialRef.current });
  }, [scope, setDraft]);
  const change = useCallback<Dispatch<SetStateAction<Filters>>>(
    (value) =>
      setDraft((old) => {
        const previous = old?.scope === scope ? old.value : initialRef.current;
        return {
          scope,
          value: typeof value === "function" ? value(previous) : value,
        };
      }),
    [scope, setDraft],
  );
  return [draft?.scope === scope ? draft.value : initial, change];
}
