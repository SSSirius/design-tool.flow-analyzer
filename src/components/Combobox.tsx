import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label?: string;
}

interface ComboboxProps {
  value: string;
  options: Array<string | ComboboxOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  allowCustom?: boolean;
}

export function Combobox({ value, options, onChange, placeholder, editable = true, allowCustom = true }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [hasTyped, setHasTyped] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: ComboboxOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt } : opt,
  );

  const selectedLabel = normalizedOptions.find((o) => o.value === value)?.label ?? value;
  const query = hasTyped ? inputValue.trim().toLowerCase() : '';
  const filteredOptions = normalizedOptions.filter((opt) => {
    const text = `${opt.label ?? ''} ${opt.value}`.toLowerCase();
    return text.includes(query);
  });

  const openMenu = () => {
    setInputValue(selectedLabel);
    setHasTyped(false);
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.select());
  };

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setInputValue(selectedLabel);
    setHasTyped(false);
  }, [open, selectedLabel]);

  return (
    <div ref={wrapperRef} className="combobox">
      <input
        ref={inputRef}
        className="combobox-input glass-input"
        value={open ? inputValue : selectedLabel}
        readOnly={!editable}
        placeholder={placeholder}
        onChange={(e) => {
          if (!editable) return;
          setInputValue(e.target.value);
          setHasTyped(true);
          if (allowCustom) onChange(e.target.value);
        }}
        onFocus={openMenu}
        onClick={() => {
          if (!open) openMenu();
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Toggle options"
        className="combobox-toggle"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((prev) => {
            if (prev) return false;
            inputRef.current?.focus();
            setInputValue(selectedLabel);
            setHasTyped(false);
            return true;
          });
        }}
      >
        <ChevronDown size={14} className={open ? 'combobox-toggle-icon combobox-toggle-icon--open' : 'combobox-toggle-icon'} />
      </button>

      {open && filteredOptions.length > 0 && (
        <ul className="combobox-list" role="listbox">
          {filteredOptions.map((opt) => {
            const selected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={selected}
                className={selected ? 'combobox-option combobox-option--selected' : 'combobox-option'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setInputValue(opt.label ?? opt.value);
                  setHasTyped(false);
                  setOpen(false);
                }}
              >
                {opt.label ?? opt.value}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
