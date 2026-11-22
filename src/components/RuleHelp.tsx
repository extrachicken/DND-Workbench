import { BookOpen, X } from "lucide-react";
import { useId, useRef } from "react";
import type { RuleEntry } from "../creation-reference";

export function RuleHelp({
  entry,
  label = entry.name,
  compact = false,
}: {
  entry: RuleEntry;
  label?: string;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return (
    <>
      <button
        type="button"
        className={compact ? "rule-link compact" : "rule-link"}
        aria-label={compact ? label : undefined}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <BookOpen size={15} aria-hidden="true" />
        {!compact && label}
      </button>
      <dialog
        ref={dialog}
        className="rule-dialog"
        aria-labelledby={title}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <article>
          <button
            type="button"
            className="dialog-close"
            aria-label="Закрыть справку"
            onClick={() => dialog.current?.close()}
          >
            <X size={19} />
          </button>
          <h2 id={title}>{entry.name}</h2>
          <small>{entry.english} · D&D 2014</small>
          <p>{entry.text}</p>
          <a href={entry.source} target="_blank" rel="noreferrer">
            Источник · Basic Rules 2014
          </a>
        </article>
      </dialog>
    </>
  );
}
