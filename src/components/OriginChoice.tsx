import { useState } from "react";
import type { RuleEntry } from "../creation-reference";
import { RuleHelp } from "./RuleHelp";

export function OriginChoice({
  label,
  options,
  value,
  onChange,
  help,
  required = false,
}: {
  label: string;
  options: RuleEntry[];
  value: string;
  onChange: (s: string) => void;
  help: RuleEntry;
  required?: boolean;
}) {
  const current = options.find((e) => e.name === value);
  const [custom, setCustom] = useState(Boolean(value && !current));
  return (
    <div>
      <label>
        {label}
        <select
          required={required}
          value={custom ? "custom" : value}
          onChange={(e) => {
            const other = e.target.value === "custom";
            setCustom(other);
            onChange(other ? "" : e.target.value);
          }}
        >
          <option value="">
            {required ? "Выберите из списка" : "Выбрать позже"}
          </option>
          {options.map((e) => (
            <option key={e.name}>{e.name}</option>
          ))}
          <option value="custom">Свой вариант…</option>
        </select>
      </label>
      {custom && (
        <label>
          Свой вариант · {label.toLowerCase()}
          <input
            required={required}
            pattern={required ? ".*\\S.*" : undefined}
            maxLength={80}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
      <RuleHelp
        entry={current ?? help}
        label={required ? "Особенности расы" : "О предыстории"}
      />
    </div>
  );
}
