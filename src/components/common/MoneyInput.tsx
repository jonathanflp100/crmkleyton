import React from 'react';
import { CURRENCY, groupThousands } from '../../utils/formatters';

interface MoneyInputProps {
  value: string;
  onChange: (formatted: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
  showSymbol?: boolean;
}

/**
 * Campo de valor em Guaraní: aceita só números e já formata com ponto de milhar
 * enquanto a pessoa digita (1250000 -> 1.250.000). Use parseMoney() para ler o valor.
 */
export function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
  required,
  autoFocus,
  id,
  showSymbol = true,
}: MoneyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    onChange(digits ? groupThousands(parseInt(digits, 10)) : '');
  };

  return (
    <div className="relative w-full">
      {showSymbol && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
          {CURRENCY.symbol}
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={`${className} ${showSymbol ? '!pl-10' : ''}`}
      />
    </div>
  );
}
