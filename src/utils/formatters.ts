import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatDocument(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return formatCPF(digits);
  }
  return formatCNPJ(digits);
}

export function formatPhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function formatCEP(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateCPF(cpf: string): boolean {
  const clean = cleanDigits(cpf);
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const clean = cleanDigits(cnpj);
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

// Convert monetary number into Portuguese text ("dois mil e quinhentos reais")
export function numberToWordsBRL(valor: number): string {
  if (valor === 0) return 'zero reais';
  if (!valor || isNaN(valor)) return '';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function trioParaExtenso(num: number): string {
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

  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);

  const milhoes = Math.floor(inteiro / 1000000);
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  const resto = inteiro % 1000;

  const resultado: string[] = [];

  if (milhoes > 0) {
    resultado.push(trioParaExtenso(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
  }
  if (milhares > 0) {
    if (milhares === 1) {
      resultado.push('mil');
    } else {
      resultado.push(trioParaExtenso(milhares) + ' mil');
    }
  }
  if (resto > 0) {
    resultado.push(trioParaExtenso(resto));
  }

  let textoReais = '';
  if (inteiro === 1) {
    textoReais = resultado.join(' e ') + ' real';
  } else if (inteiro > 1) {
    textoReais = resultado.join(' e ') + ' reais';
  }

  let textoCentavos = '';
  if (centavos > 0) {
    textoCentavos = trioParaExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }

  if (textoReais && textoCentavos) {
    return `${textoReais} e ${textoCentavos}`;
  }
  return textoReais || textoCentavos || 'zero reais';
}
