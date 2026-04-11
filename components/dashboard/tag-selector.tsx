"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(query);

  const selectedOptions = useMemo(
    () => options.filter((option) => selected.includes(option.value)),
    [options, selected],
  );
  const selectedPreview = useMemo(() => {
    if (selectedOptions.length === 0) return "Пока ничего не выбрано";
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    if (selectedOptions.length === 2) return `${selectedOptions[0].label}, ${selectedOptions[1].label}`;
    return `${selectedOptions[0].label}, ${selectedOptions[1].label} и ещё ${selectedOptions.length - 2}`;
  }, [selectedOptions]);

  const filteredOptions = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.hint || ""} ${option.value}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [deferredQuery, options]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className={`tag-selector ${open ? "tag-selector-open" : ""}`} ref={rootRef}>
      <button
        aria-expanded={open}
        className="tag-selector-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div className="tag-selector-trigger-copy">
          <span className="tag-selector-trigger-title">{placeholder}</span>
          <small className="tag-selector-trigger-summary">{selectedPreview}</small>
        </div>
        <div className="tag-selector-trigger-meta">
          <strong>{selected.length > 0 ? `${selected.length} выбрано` : "Открыть"}</strong>
          <span className={`tag-selector-chevron ${open ? "tag-selector-chevron-open" : ""}`}>⌄</span>
        </div>
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
