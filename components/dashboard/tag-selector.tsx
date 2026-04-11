"use client";

import { useDeferredValue, useMemo, useState } from "react";

export type TagSelectorOption = {
  value: string;
  label: string;
  hint?: string | null;
};

type Props = {
  placeholder: string;
  options: TagSelectorOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  emptyText?: string;
};

function toggle(selected: string[], value: string) {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

export function TagSelector({
  placeholder,
  options,
  selected,
  onChange,
  searchPlaceholder = "Поиск",
  emptyText = "Ничего не найдено.",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const selectedOptions = useMemo(
    () => options.filter((option) => selected.includes(option.value)),
    [options, selected],
  );

  const filteredOptions = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.hint || ""} ${option.value}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [deferredQuery, options]);

  return (
    <div className={`tag-selector ${open ? "tag-selector-open" : ""}`}>
      <button
        className="tag-selector-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{placeholder}</span>
        <strong>{selected.length > 0 ? `${selected.length} выбрано` : "Выбрать"}</strong>
      </button>

      {selectedOptions.length > 0 ? (
        <div className="tag-selector-picked">
          {selectedOptions.map((option) => (
            <button
              className="tag-pill"
              key={option.value}
              onClick={() => onChange(selected.filter((item) => item !== option.value))}
              type="button"
            >
              <span>{option.label}</span>
              <span className="tag-pill-remove">×</span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="tag-selector-panel">
          <div className="field">
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>

          <div className="tag-selector-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const checked = selected.includes(option.value);

                return (
                  <label
                    className={`tag-selector-option ${checked ? "tag-selector-option-active" : ""}`}
                    key={option.value}
                  >
                    <input
                      checked={checked}
                      onChange={() => onChange(toggle(selected, option.value))}
                      type="checkbox"
                    />
                    <div>
                      <strong>{option.label}</strong>
                      <span>{option.hint || option.value}</span>
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="tag-selector-empty">{emptyText}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
