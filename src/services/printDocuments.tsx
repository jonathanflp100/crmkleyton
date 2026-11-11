import React from 'react';
import type { Client, CompanyProfile, Deal, Proposal, Supplier, Task, Transaction } from '../types';
import {
  formatAddress,
  formatCurrency,
  formatDate,
  formatDocument,
  formatPhone,
  numberToWords,
  paymentMethodLabel,
} from '../utils/formatters';
import { PrintFields, PrintHeader, PrintKpis, PrintSection, PrintService, PrintSignature } from './printService';

const statusLabel = (t: Transaction) =>
  t.status === 'paid' ? (t.type === 'income' ? 'Recebido' : 'Pago') : t.status === 'overdue' ? 'Vencido' : 'Pendente';

export function TransactionsTable({ items, showBalance }: { items: Transaction[]; showBalance?: boolean }) {
  let running = 0;
  const th = 'py-2 px-3 text-left font-semibold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-800/60';
  const td = 'py-2 px-3 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className={th}>Data</th>
            <th className={th}>Descrição</th>
            <th className={th}>Categoria</th>
            <th className={th}>Cliente / Fornecedor</th>
            <th className={th}>Situação</th>
            <th className={`${th} num text-right`}>Valor</th>
            {showBalance && <th className={`${th} num text-right`}>Saldo</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const signed = t.type === 'income' ? t.amount : -t.amount;
            running += signed;
            return (
              <tr key={t.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDate(t.status === 'paid' ? t.paymentDate || t.date : t.dueDate)}</td>
                <td className={td}>{t.description}</td>
                <td className={td}>{t.categoryName || '-'}</td>
                <td className={td}>{t.entityName || '-'}</td>
                <td className={td}>{statusLabel(t)}</td>
                <td className={`${td} num text-right font-mono whitespace-nowrap`} style={{ color: t.type === 'income' ? '#059669' : '#e11d48', fontWeight: 700 }}>
                  {t.type === 'income' ? '+ ' : '- '}
                  {formatCurrency(t.amount)}
                </td>
                {showBalance && <td className={`${td} num text-right font-mono`}>{formatCurrency(running)}</td>}
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={showBalance ? 7 : 6} className="py-6 text-center text-slate-400">
                Nenhum lançamento no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ================= RECIBO ================= */
export function printReceipt(t: Transaction, company?: CompanyProfile | null) {
  const isIncome = t.type === 'income';
  const number = t.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  const date = formatDate(t.paymentDate || t.date);
  const companyName = company?.name || company?.tradingName || 'a empresa';

  const Receipt = ({ via }: { via: string }) => (
    <div className="avoid-break" style={{ border: '1.5px solid #0f172a', borderRadius: 10, padding: 20, marginBottom: 18 }}>
      <PrintHeader
        company={company}
        title={isIncome ? 'Recibo' : 'Comprovante de pagamento'}
        right={
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Nº {number}</div>
            <div>{via}</div>
          </>
        }
      />
      <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '10px 14px', fontSize: 18, fontWeight: 800, display: 'inline-block' }}>
        {formatCurrency(t.amount)}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 14 }}>
        {isIncome ? (
          <>
            Recebemos de <strong>{t.entityName || '______________________________'}</strong> a quantia de{' '}
            <strong>{formatCurrency(t.amount)}</strong> (<em>{numberToWords(t.amount)}</em>), referente a{' '}
            <strong>{t.description}</strong>.
          </>
        ) : (
          <>
            Declaro que recebi de <strong>{companyName}</strong> a quantia de <strong>{formatCurrency(t.amount)}</strong> (
            <em>{numberToWords(t.amount)}</em>), referente a <strong>{t.description}</strong>
            {t.entityName ? (
              <>
                , pago a <strong>{t.entityName}</strong>
              </>
            ) : null}
            .
          </>
        )}
      </p>
      <PrintFields
        fields={[
          ['Data', date],
          ['Forma de pagamento', paymentMethodLabel(t.paymentMethod)],
          ['Categoria', t.categoryName],
          ['Situação', statusLabel(t)],
        ]}
      />
      {company?.receiptNotes && <p style={{ fontSize: 10.5, color: '#64748b', marginTop: 10 }}>{company.receiptNotes}</p>}
      <PrintSignature label={isIncome ? companyName : t.entityName || 'Assinatura de quem recebeu'} />
    </div>
  );

  PrintService.print(
    `Recibo ${number}`,
    <div>
      <Receipt via="1ª via" />
      <div style={{ borderTop: '1px dashed #94a3b8', margin: '4px 0 18px' }} />
      <Receipt via="2ª via" />
    </div>
  );
}

/* ================= ORÇAMENTO / PEDIDO ================= */
export function printProposal(p: Proposal, company?: CompanyProfile | null, client?: Client | null) {
  const isSale = p.status === 'approved';
  PrintService.print(
    `${isSale ? 'Pedido' : 'Orçamento'} ${p.number}`,
    <div>
      <PrintHeader
        company={company}
        title={isSale ? `Pedido de venda Nº ${p.number}` : `Orçamento Nº ${p.number}`}
        subtitle={`Data: ${formatDate(p.date)}  •  Válido até: ${formatDate(p.validUntil)}`}
      />
      <PrintSection title="Cliente">
        <PrintFields
          fields={[
            ['Nome / Razão social', p.clientName],
            ['CI / RUC', formatDocument(p.clientDocument || client?.document || '')],
            ['Telefone', formatPhone(p.clientPhone || client?.whatsapp || client?.phone || '')],
            ['E-mail', p.clientEmail || client?.email],
            ['Endereço', client ? formatAddress(client) : p.clientAddress],
          ]}
        />
      </PrintSection>
      <PrintSection title="Itens">
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Descrição</th>
              <th className="num">Qtd.</th>
              <th className="num">Preço unit.</th>
              <th className="num">Desconto</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.productName}</td>
                <td className="num">{it.quantity}</td>
                <td className="num">{formatCurrency(it.unitPrice)}</td>
                <td className="num">{it.discount ? formatCurrency(it.discount) : '-'}</td>
                <td className="num" style={{ fontWeight: 700 }}>{formatCurrency(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <table style={{ width: 280 }}>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="num">{formatCurrency(p.subtotal)}</td>
              </tr>
              {p.discount > 0 && (
                <tr>
                  <td>Desconto</td>
                  <td className="num">- {formatCurrency(p.discount)}</td>
                </tr>
              )}
              {p.shipping > 0 && (
                <tr>
                  <td>Frete / entrega</td>
                  <td className="num">{formatCurrency(p.shipping)}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 800, fontSize: 13 }}>TOTAL</td>
                <td className="num" style={{ fontWeight: 800, fontSize: 14 }}>{formatCurrency(p.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10.5, color: '#64748b', textAlign: 'right', marginTop: 4 }}>({numberToWords(p.total)})</div>
      </PrintSection>
      {(p.paymentConditions || p.notes) && (
        <PrintSection title="Condições">
          {p.paymentConditions && (
            <p style={{ fontSize: 11.5 }}>
              <strong>Pagamento:</strong> {p.paymentConditions}
            </p>
          )}
          {p.notes && <p style={{ fontSize: 11.5, whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
        </PrintSection>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <PrintSignature label={company?.tradingName || company?.name || 'Empresa'} />
        <PrintSignature label={`De acordo — ${p.clientName}`} />
      </div>
    </div>
  );
}

/* ================= FICHA DO CLIENTE ================= */
export function printClientSheet(
  client: Client,
  data: { transactions: Transaction[]; deals: Deal[]; tasks: Task[] },
  company?: CompanyProfile | null
) {
  const paid = data.transactions.filter((t) => t.type === 'income' && t.status === 'paid');
  const open = data.transactions.filter((t) => t.type === 'income' && t.status !== 'paid');
  const total = paid.reduce((s, t) => s + t.amount, 0);
  const openTotal = open.reduce((s, t) => s + t.amount, 0);
  const sorted = [...data.transactions].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

  PrintService.print(
    `Ficha — ${client.name}`,
    <div>
      <PrintHeader company={company} title="Ficha do cliente" subtitle={client.name} />
      <PrintSection title="Dados cadastrais">
        <PrintFields
          fields={[
            ['Nome / Razão social', client.name],
            ['Tipo', client.type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'],
            [client.type === 'PJ' ? 'RUC' : 'CI / RUC', formatDocument(client.document)],
            ['Telefone', formatPhone(client.phone || '')],
            ['WhatsApp', formatPhone(client.whatsapp || '')],
            ['E-mail', client.email],
            ['Endereço', formatAddress(client)],
            ['Aniversário', client.birthDate ? formatDate(client.birthDate, 'dd/MM') : ''],
            ['Origem', client.source],
            ['Etiquetas', client.tags?.join(', ')],
            ['Cliente desde', formatDate(client.createdAt)],
          ]}
        />
        {client.notes && <p style={{ fontSize: 11.5, marginTop: 8, whiteSpace: 'pre-wrap' }}><strong>Observações:</strong> {client.notes}</p>}
      </PrintSection>
      <PrintSection title="Resumo financeiro">
        <PrintKpis
          items={[
            { label: 'Total comprado', value: formatCurrency(total), color: '#059669' },
            { label: 'Em aberto', value: formatCurrency(openTotal), color: openTotal ? '#e11d48' : undefined },
            { label: 'Ticket médio', value: formatCurrency(paid.length ? total / paid.length : 0) },
            { label: 'Compras', value: String(paid.length) },
          ]}
        />
      </PrintSection>
      <PrintSection title="Movimentações">
        <TransactionsTable items={sorted} />
      </PrintSection>
      {data.deals.length > 0 && (
        <PrintSection title="Negócios">
          <table>
            <thead>
              <tr>
                <th>Negócio</th>
                <th>Etapa</th>
                <th>Previsão</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.stageName || d.stageId}</td>
                  <td>{formatDate(d.expectedCloseDate)}</td>
                  <td className="num">{formatCurrency(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}
      {data.tasks.length > 0 && (
        <PrintSection title="Tarefas">
          <table>
            <tbody>
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.dueDate)} {t.dueTime || ''}</td>
                  <td>{t.title}</td>
                  <td>{t.status === 'completed' ? 'Concluída' : 'Pendente'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}
    </div>
  );
}

/* ================= FICHA DO FORNECEDOR ================= */
export function printSupplierSheet(supplier: Supplier, transactions: Transaction[], company?: CompanyProfile | null) {
  const paid = transactions.filter((t) => t.status === 'paid');
  const open = transactions.filter((t) => t.status !== 'paid');
  const sorted = [...transactions].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
  PrintService.print(
    `Ficha — ${supplier.name}`,
    <div>
      <PrintHeader company={company} title="Ficha do fornecedor" subtitle={supplier.name} />
      <PrintSection title="Dados cadastrais">
        <PrintFields
          fields={[
            ['Nome / Razão social', supplier.name],
            ['RUC / CI', formatDocument(supplier.document)],
            ['Contato', supplier.contactPerson],
            ['Telefone', formatPhone(supplier.phone || '')],
            ['WhatsApp', formatPhone(supplier.whatsapp || '')],
            ['E-mail', supplier.email],
            ['Endereço', formatAddress(supplier)],
            ['Dados bancários', supplier.bankInfo],
          ]}
        />
        {supplier.notes && <p style={{ fontSize: 11.5, marginTop: 8 }}><strong>Observações:</strong> {supplier.notes}</p>}
      </PrintSection>
      <PrintSection title="Resumo">
        <PrintKpis
          items={[
            { label: 'Total pago', value: formatCurrency(paid.reduce((s, t) => s + t.amount, 0)) },
            { label: 'A pagar', value: formatCurrency(open.reduce((s, t) => s + t.amount, 0)), color: '#e11d48' },
            { label: 'Lançamentos', value: String(transactions.length) },
          ]}
        />
      </PrintSection>
      <PrintSection title="Histórico de pagamentos">
        <TransactionsTable items={sorted} />
      </PrintSection>
    </div>
  );
}

/* ================= LISTA DE LANÇAMENTOS ================= */
export function printTransactionList(title: string, subtitle: string, items: Transaction[], company?: CompanyProfile | null) {
  const inc = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  PrintService.print(
    title,
    <div>
      <PrintHeader company={company} title={title} subtitle={subtitle} />
      <PrintKpis
        items={[
          { label: 'Entradas', value: formatCurrency(inc), color: '#059669' },
          { label: 'Saídas', value: formatCurrency(exp), color: '#e11d48' },
          { label: 'Resultado', value: formatCurrency(inc - exp), color: inc - exp >= 0 ? '#2563eb' : '#e11d48' },
          { label: 'Lançamentos', value: String(items.length) },
        ]}
      />
      <TransactionsTable items={items} />
    </div>
  );
}
