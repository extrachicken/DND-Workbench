import { useEffect, useRef, useState } from "react";
// Imported IDs are arbitrary JSON strings. JSON escaping preserves even isolated
// UTF-16 code units before the value is encoded for the URL fragment.
export function characterRoute(id: string) {
  const escaped = JSON.stringify(id).slice(1, -1);
  return "character/" + encodeURIComponent(escaped);
}

export function usePage(dirty: boolean) {
  const read = () => location.hash.slice(1) || "characters";
  const [page, setPage] = useState(read);
  const current = useRef(page);
  const isDirty = useRef(dirty);
  isDirty.current = dirty;
  useEffect(() => {
    function navigate() {
      const next = read();
      if (next === current.current) return;
      if (
        isDirty.current &&
        !confirm("Есть несохранённые изменения. Перейти без сохранения?")
      ) {
        history.replaceState(null, "", `#${current.current}`);
        return;
      }
      current.current = next;
      setPage(next);
      window.scrollTo(0, 0);
    }
    const unload = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("hashchange", navigate);
    addEventListener("beforeunload", unload);
    return () => {
      removeEventListener("hashchange", navigate);
      removeEventListener("beforeunload", unload);
    };
  }, []);
  return page;
}
