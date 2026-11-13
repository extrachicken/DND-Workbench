import { useEffect, useRef, useState } from "react";
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
        !confirm(
          "В черновике есть несохранённые изменения. Перейти без сохранения?",
        )
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
