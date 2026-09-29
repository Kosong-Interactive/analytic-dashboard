"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  matchPages,
  SEARCH_MIN_LENGTH,
  searchResponseSchema,
  type SearchGroup,
  type SearchItem,
} from "@/lib/search/results";
import { cn } from "@/lib/utils";

import { GameIcon } from "../games/game-icon";

type RemoteState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; groups: SearchGroup[] }
  | { status: "error"; query: string; message: string };

const DEBOUNCE_MS = 200;

/** Pages match instantly on the client; stored games, developers, and labels come from /api/search. */
function useCatalogSearch(text: string): RemoteState {
  const [state, setState] = useState<RemoteState>({ status: "idle" });
  const query = text.trim();

  useEffect(() => {
    if (query.length < SEARCH_MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading", query });
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof body === "object" && body && "error" in body && typeof body.error === "string"
              ? body.error
              : "Search failed.";
          setState({ status: "error", query, message });
          return;
        }
        const parsed = searchResponseSchema.safeParse(body);
        setState(
          parsed.success
            ? { status: "done", query, groups: parsed.data.groups }
            : { status: "error", query, message: "Search returned an unexpected response." },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", query, message: "Search is unavailable. Check your connection." });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return query.length < SEARCH_MIN_LENGTH ? { status: "idle" } : state;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const remote = useCatalogSearch(text);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = useMemo<SearchGroup[]>(() => {
    // Server results already include matching pages; before they arrive, pages still show.
    if (remote.status === "done" && remote.query === text.trim()) return remote.groups;
    const pages = matchPages(text);
    return pages.length > 0 ? [{ kind: "page", label: "Pages", items: pages }] : [];
  }, [remote, text]);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const active = items[Math.min(activeIndex, items.length - 1)];
  const query = text.trim();

  function close() {
    setOpen(false);
    setText("");
    setActiveIndex(0);
  }

  function go(item: SearchItem) {
    close();
    router.push(item.href);
  }

  function seeAll() {
    close();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) go(active);
      else if (query.length >= SEARCH_MIN_LENGTH) seeAll();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Dialog.Trigger className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-dim hover:text-ink focus-visible:outline-2 focus-visible:outline-accent sm:w-56">
        <Search aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Search games, developers, labels</span>
        <kbd className="hidden rounded border border-line-strong px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-alt text-ink shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search stored games, developers, and labels. Use the arrow keys to choose a result and Enter to open it.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search aria-hidden className="size-4 text-dim" />
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              maxLength={80}
              placeholder="Search games, developers, genres, mechanics…"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
              aria-autocomplete="list"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
            />
            <Dialog.Close className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-dim hover:text-ink">
              Esc
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto" aria-live="polite">
            <ul id={listId} role="listbox" aria-label="Search results" className="py-1">
              {groups.map((group) => (
                <li key={group.kind} role="presentation">
                  <p className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-dim">{group.label}</p>
                  <ul role="presentation">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        id={`${listId}-${item.id}`}
                        role="option"
                        aria-selected={item === active}
                        onMouseEnter={() => setActiveIndex(items.indexOf(item))}
                        onClick={() => go(item)}
                        className={cn(
                          "mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2",
                          item === active && "bg-line",
                        )}
                      >
                        {item.kind === "game" ? <GameIcon title={item.title} iconUrl={item.iconUrl ?? null} size={24} /> : null}
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px]">{item.title}</span>
                          <span className="truncate text-[11.5px] text-dim">{item.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <StatusLine remote={remote} query={query} hasItems={items.length > 0} onSeeAll={seeAll} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusLine({
  remote,
  query,
  hasItems,
  onSeeAll,
}: {
  remote: RemoteState;
  query: string;
  hasItems: boolean;
  onSeeAll: () => void;
}) {
  let message: string | null = null;
  if (query.length === 0) message = "Type to search tracked games, developers, and taxonomy labels.";
  else if (query.length < SEARCH_MIN_LENGTH) message = `Type at least ${SEARCH_MIN_LENGTH} characters.`;
  else if (remote.status === "error") message = remote.message;
  else if (remote.status === "done" && !hasItems) message = `Nothing stored matches “${query}”.`;
  else if (remote.status === "loading" || remote.status === "idle") message = "Searching…";
  if (!message) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-[11px] text-dim">
        <span>Enter opens the highlighted result. Only stored data is searched.</span>
        <button type="button" onClick={onSeeAll} className="shrink-0 text-ink-soft underline-offset-2 hover:underline">
          See all results
        </button>
      </div>
    );
  }
  return (
    <p role={remote.status === "error" ? "alert" : undefined} className="px-3 py-4 text-center text-xs text-dim">
      {message}
    </p>
  );
}
