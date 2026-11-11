import React from 'react';
import { PY_DEPARTMENTS } from '../../utils/formatters';

export interface AddressValue {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const cls =
  'w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500';

/** Endereço no padrão paraguaio: calle/avenida, número, barrio, cidade e departamento */
export function AddressFields({
  value,
  onChange,
  title = 'Endereço',
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  title?: string;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
      <span className="font-bold text-slate-700 dark:text-slate-300">{title}</span>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div className="sm:col-span-3 space-y-1">
          <label className="text-slate-500">Rua / Avenida (calle)</label>
          <input type="text" placeholder="Ex.: Avda. Mariscal López" value={value.street} onChange={(e) => onChange({ street: e.target.value })} className={cls} />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500">Número</label>
          <input type="text" placeholder="Nº" value={value.number} onChange={(e) => onChange({ number: e.target.value })} className={cls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-slate-500">Complemento / referência</label>
          <input type="text" placeholder="Ex.: esq. Brasilia, frente ao mercado" value={value.complement} onChange={(e) => onChange({ complement: e.target.value })} className={cls} />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500">Bairro (barrio)</label>
          <input type="text" value={value.neighborhood} onChange={(e) => onChange({ neighborhood: e.target.value })} className={cls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-slate-500">Cidade</label>
          <input type="text" placeholder="Ex.: Asunción, Ciudad del Este" value={value.city} onChange={(e) => onChange({ city: e.target.value })} className={cls} list="py-cities" />
          <datalist id="py-cities">
            {['Asunción', 'Ciudad del Este', 'Encarnación', 'San Lorenzo', 'Luque', 'Capiatá', 'Lambaré', 'Fernando de la Mora', 'Pedro Juan Caballero', 'Coronel Oviedo', 'Concepción', 'Villarrica', 'Caaguazú', 'Hernandarias', 'Presidente Franco', 'Salto del Guairá', 'Katueté', 'Santa Rita', 'Itauguá', 'Mariano Roque Alonso'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <label className="text-slate-500">Departamento</label>
          <select value={value.state} onChange={(e) => onChange({ state: e.target.value })} className={cls}>
            <option value="">Selecione</option>
            {value.state && !PY_DEPARTMENTS.includes(value.state) && <option value={value.state}>{value.state}</option>}
            {PY_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
