import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ============================================================
 * MOEDA — Guaraní paraguaio (PYG). Não tem centavos.
 * Formato local: "Gs. 1.250.000"
 * ============================================================ */

export const CURRENCY = {
  code: 'PYG',
  symbol: 'Gs.',
  name: 'guaranis',
  nameSingular: 'guarani',
  decimals: 0,
};

/** Agrupa milhares com ponto: 1250000 -> "1.250.000" */
export function groupThousands(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return `${CURRENCY.symbol} 0`;
  }
  const sign = Math.round(value) < 0 ? '-' : '';
  return `${sign}${CURRENCY.symbol} ${groupThousands(value)}`;
}

/** Formato curto para eixos de gráfico: Gs. 850 mil / Gs. 12,5 mi / Gs. 1,2 bi */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { maximumFractionDigits: n >= 100 ? 0 : 1 });
  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)} mil`;
  return `${sign}${Math.round(abs)}`;
}

/** Converte o texto digitado ("1.250.000", "1250000", "Gs. 1.250.000") em número inteiro */
export function parseMoney(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Math.round(value);
  const negative = value.trim().startsWith('-');
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return negative ? -n : n;
}

/** Valor numérico -> texto para preencher um campo de valor ("1.250.000") */
export function formatMoneyInput(value: number | undefined | null): string {
  if (!value) return '';
  return groupThousands(value);
}

/* ============================================================
 * DATAS
 * ============================================================ */

export function formatDate(date: string | Date | undefined | null, pattern = 'dd/MM/yyyy'): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    if (!isValid(d)) return String(date);
    return format(d, pattern, { locale: ptBR });
  } catch {
    return String(date);
  }
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!isValid(d)) return String(date);
    return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return String(date);
  }
}

/* ============================================================
 * DOCUMENTOS — Paraguai
 * CI (Cédula de Identidade): só números, ex. 4.512.345
 * RUC: base + dígito verificador, ex. 80012345-6 ou 4512345-0
 * ============================================================ */

export function cleanDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** Calcula o dígito verificador do RUC (módulo 11, base máxima 11 — algoritmo da DNIT/SET) */
export function rucCheckDigit(base: string): number {
  const digits = cleanDigits(base);
  let total = 0;
  let k = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    total += parseInt(digits[i], 10) * k;
    k = k === 11 ? 2 : k + 1;
  }
  const rest = total % 11;
  return rest > 1 ? 11 - rest : 0;
}

export function validateRUC(ruc: string): boolean {
  const value = (ruc || '').trim();
  const match = value.match(/^(\d{1,9})-?(\d)$/);
  if (!match || !value.includes('-')) return false;
  return rucCheckDigit(match[1]) === parseInt(match[2], 10);
}

/** Máscara de digitação: aceita números e um único hífen (RUC) */
export function maskDocumentInput(value: string): string {
  const cleaned = (value || '').replace(/[^\d-]/g, '');
  const firstDash = cleaned.indexOf('-');
  if (firstDash === -1) return cleaned.slice(0, 12);
  const base = cleaned.slice(0, firstDash).slice(0, 10);
  const dv = cleaned.slice(firstDash + 1).replace(/-/g, '').slice(0, 1);
  return `${base}-${dv}`;
}

/** Exibição: RUC fica "80012345-6"; CI fica "4.512.345" */
export function formatDocument(value: string): string {
  if (!value) return '';
  const v = value.trim();
  if (v.includes('-')) return maskDocumentInput(v);
  const digits = cleanDigits(v);
  if (!digits) return v;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ============================================================
 * TELEFONE — Paraguai (+595)
 * Celular: 0981 123 456  |  Internacional: +595 981 123 456
 * ============================================================ */

export function formatPhone(value: string): string {
  if (!value) return '';
  const digits = cleanDigits(value);
  if (digits.startsWith('595') && digits.length >= 11) {
    const rest = digits.slice(3);
    return `+595 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim();
  }
  if (digits.startsWith('55') && digits.length >= 12) {
    // número brasileiro
    const rest = digits.slice(2);
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, rest.length - 4)}-${rest.slice(-4)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith('0') && digits.length >= 7) {
    // fixo de Assunção: 021 123 456
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`.trim();
  }
  return value;
}

/** Monta o número para o link wa.me (padrão Paraguai quando não tem código do país) */
export function toWhatsAppNumber(value: string | undefined | null): string {
  const digits = cleanDigits(value || '');
  if (!digits) return '';
  if (digits.startsWith('595') || (digits.startsWith('55') && digits.length >= 12)) return digits;
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  if (digits.length === 9) return `595${digits}`;
  return digits;
}

export function whatsappLink(phone: string | undefined | null, text?: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Departamentos do Paraguai (+ Capital) */
export const PY_DEPARTMENTS = [
  'Asunción (Capital)',
  'Alto Paraguay',
  'Alto Paraná',
  'Amambay',
  'Boquerón',
  'Caaguazú',
  'Caazapá',
  'Canindeyú',
  'Central',
  'Concepción',
  'Cordillera',
  'Guairá',
  'Itapúa',
  'Misiones',
  'Ñeembucú',
  'Paraguarí',
  'Presidente Hayes',
  'San Pedro',
];

/** Endereço em uma linha */
export function formatAddress(entity: {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}): string {
  const parts: string[] = [];
  const line1 = [entity.street, entity.number].filter(Boolean).join(' Nº ');
  if (line1) parts.push(line1);
  if (entity.complement) parts.push(entity.complement);
  if (entity.neighborhood) parts.push(`Barrio ${entity.neighborhood}`);
  const cityState = [entity.city, entity.state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);
  return parts.join(', ');
}

/* ============================================================
 * VALOR POR EXTENSO (para recibos) — em guaranis, sem centavos
 * ============================================================ */

function trioParaExtenso(num: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  if (num === 100) return 'cem';
  const c = Math.floor(num / 100);
  const d = Math.floor((num % 100) / 10);
  const u = num % 10;
  const partes: string[] = [];
  if (c > 0) partes.push(centenas[c]);
  if (d === 1) {
    partes.push(especiais[u]);
  } else {
    if (d > 1) partes.push(dezenas[d]);
    if (u > 0) partes.push(unidades[u]);
  }
  return partes.join(' e ');
}

export function numberToWords(valor: number): string {
  const inteiro = Math.round(Math.abs(valor || 0));
  if (inteiro === 0) return `zero ${CURRENCY.name}`;

  const grupos: { valor: number; singular: string; plural: string }[] = [
    { valor: Math.floor(inteiro / 1_000_000_000) % 1000, singular: 'bilhão', plural: 'bilhões' },
    { valor: Math.floor(inteiro / 1_000_000) % 1000, singular: 'milhão', plural: 'milhões' },
    { valor: Math.floor(inteiro / 1_000) % 1000, singular: 'mil', plural: 'mil' },
    { valor: inteiro % 1000, singular: '', plural: '' },
  ];

  const partes: string[] = [];
  grupos.forEach((g) => {
    if (g.valor === 0) return;
    if (g.singular === 'mil') {
      partes.push(g.valor === 1 ? 'mil' : `${trioParaExtenso(g.valor)} mil`);
    } else if (g.singular) {
      partes.push(`${trioParaExtenso(g.valor)} ${g.valor === 1 ? g.singular : g.plural}`);
    } else {
      partes.push(trioParaExtenso(g.valor));
    }
  });

  // "e" só antes do último grupo quando ele é < 100 ou centena redonda (ex.: mil e quinhentos)
  let texto = partes[0];
  for (let i = 1; i < partes.length; i++) {
    const ultimo = i === partes.length - 1;
    const resto = inteiro % 1000;
    const usaE = ultimo && (resto < 100 || resto % 100 === 0);
    texto += usaE ? ` e ${partes[i]}` : ` ${partes[i]}`;
  }

  const milhoesRedondos = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0;
  const moeda = inteiro === 1 ? CURRENCY.nameSingular : CURRENCY.name;
  return `${texto}${milhoesRedondos ? ' de' : ''} ${moeda}`;
}

/* ============================================================
 * FORMAS DE PAGAMENTO
 * ============================================================ */

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Dinheiro (efetivo)' },
  { value: 'bank_transfer', label: 'Transferência bancária' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'qr', label: 'QR / Pagamento por app' },
  { value: 'wallet', label: 'Carteira digital (Tigo Money, Personal...)' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Outros' },
];

export function paymentMethodLabel(value?: string): string {
  if (!value) return '-';
  if (value === 'pix') return 'QR / Pagamento por app';
  if (value === 'bank_slip') return 'Boleto';
  return PAYMENT_METHODS.find((p) => p.value === value)?.label || value;
}
