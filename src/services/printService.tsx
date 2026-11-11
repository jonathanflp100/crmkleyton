import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CompanyProfile } from '../types';
import { formatAddress, formatDateTime, formatDocument, formatPhone } from '../utils/formatters';

/**
 * Impressão: abre uma janela com o documento em A4 (fundo branco, sem menus)
 * e chama a impressão do navegador. Dali a pessoa imprime ou "Salvar como PDF".
 */
export class PrintService {
  static print(title: string, element: React.ReactElement) {
    const body = renderToStaticMarkup(element);

    // Reaproveita o CSS do app (Tailwind) para o documento ficar igual ao da tela
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => {
        if (el.tagName === 'LINK') {
          const href = (el as HTMLLinkElement).href;
          return `<link rel="stylesheet" href="${href}">`;
        }
        return el.outerHTML;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
${styles}
<style>
  html, body { background: #fff !important; color: #0f172a; }
  body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; padding: 28px 32px; font-size: 12px; }
  .doc table { width: 100%; border-collapse: collapse; }
  .doc th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; background: #f8fafc; }
  .doc th, .doc td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .doc .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .toolbar { position: sticky; top: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; gap: 8px; justify-content: center; z-index: 10; }
  .toolbar button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .toolbar button.sec { background: #334155; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  @media print {
    @page { size: A4 portrait; margin: 12mm; }
    .toolbar { display: none !important; }
    .doc { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button><button class="sec" onclick="window.close()">Fechar</button></div>
<div class="doc">${body}</div>
<script>
  window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 400); });
</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }

    // Pop-up bloqueado: imprime por um iframe invisível
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow?.document;
    if (!idoc) return;
    idoc.open();
    idoc.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
    idoc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 600);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/* ================= BLOCOS DE LAYOUT ================= */

export function PrintHeader({
  company,
  title,
  subtitle,
  right,
}: {
  company?: CompanyProfile | null;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const address = company ? formatAddress(company) : '';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {company?.logoUrl && (
            <img src={company.logoUrl} alt="" style={{ maxHeight: 56, maxWidth: 140, objectFit: 'contain' }} />
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{company?.tradingName || company?.name || 'Minha Empresa'}</div>
            {company?.tradingName && company?.name && company.name !== company.tradingName && (
              <div style={{ fontSize: 11, color: '#475569' }}>{company.name}</div>
            )}
            <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
              {[company?.document ? `RUC: ${formatDocument(company.document)}` : '', company?.phone ? `Tel: ${formatPhone(company.phone)}` : '', company?.email || '']
                .filter(Boolean)
                .join('  •  ')}
            </div>
            {address && <div style={{ fontSize: 10.5, color: '#475569' }}>{address}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10.5, color: '#475569', whiteSpace: 'nowrap' }}>
          {right}
          <div>Emitido em {formatDateTime(new Date())}</div>
        </div>
      </div>
      <div style={{ margin: '16px 0 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.02em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="avoid-break" style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function PrintFields({ fields }: { fields: [string, React.ReactNode][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
      {fields
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => (
          <div key={k} style={{ fontSize: 11.5 }}>
            <span style={{ color: '#64748b' }}>{k}: </span>
            <strong>{v}</strong>
          </div>
        ))}
    </div>
  );
}

export function PrintKpis({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, gap: 8, margin: '8px 0' }}>
      {items.map((i) => (
        <div key={i.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>{i.label}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: i.color || '#0f172a', marginTop: 2 }}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

export function PrintSignature({ label }: { label: string }) {
  return (
    <div className="avoid-break" style={{ marginTop: 48, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 280, borderTop: '1px solid #0f172a', textAlign: 'center', paddingTop: 4, fontSize: 11 }}>{label}</div>
    </div>
  );
}
