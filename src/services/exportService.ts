import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate, numberToWordsBRL, formatDocument } from '../utils/formatters';
import type { Transaction, Proposal, Client, Supplier, CompanyProfile } from '../types';

export class ExportService {
  /**
   * Export array of objects to CSV with Brazilian Excel UTF-8 BOM
   */
  static exportToCSV(filename: string, rows: Record<string, any>[]): void {
    if (!rows || !rows.length) return;

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map((row) =>
        headers
          .map((fieldName) => {
            let val = row[fieldName];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(';')
      ),
    ].join('\r\n');

    // Add BOM for Excel Portuguese encoding
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export JSON backup
   */
  static exportToJSON(filename: string, data: any): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate PDF proposal/budget document
   */
  static generateProposalPDF(proposal: Proposal, company?: CompanyProfile | null): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Company Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(company?.name || 'GESTOR PRO - SOLUÇÕES EMPRESARIAIS', 14, 13);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${company?.document || '-'} | Tel: ${company?.phone || '-'} | ${company?.email || ''}`, 14, 20);

    // Title & Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORÇAMENTO COMERCIAL #${proposal.number || proposal.id.slice(0, 8)}`, 14, 38);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: ${formatDate(proposal.date)}`, 14, 45);
    doc.text(`Validade da Proposta: ${formatDate(proposal.validUntil)}`, 80, 45);
    doc.text(`Status: ${proposal.status.toUpperCase()}`, 150, 45);

    // Client box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 50, pageW - 28, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', 18, 56);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${proposal.clientName || '-'}`, 18, 62);
    doc.text(`Documento: ${formatDocument(proposal.clientDocument || '') || '-'}`, 18, 68);
    doc.text(`Telefone: ${proposal.clientPhone || '-'}`, 120, 62);
    doc.text(`E-mail: ${proposal.clientEmail || '-'}`, 120, 68);

    // Table Header
    let y = 80;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageW - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Item / Descrição', 18, y + 5.5);
    doc.text('Qtd', 110, y + 5.5);
    doc.text('Preço Unit.', 130, y + 5.5);
    doc.text('Desc.', 155, y + 5.5);
    doc.text('Total', 178, y + 5.5);

    y += 10;
    doc.setFont('helvetica', 'normal');
    for (const item of proposal.items) {
      doc.text(item.productName.slice(0, 50), 18, y);
      doc.text(String(item.quantity), 112, y);
      doc.text(formatCurrency(item.unitPrice), 130, y);
      doc.text(item.discount ? formatCurrency(item.discount) : '-', 155, y);
      doc.text(formatCurrency(item.totalPrice), 178, y);

      y += 7;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    }

    // Totals Box
    y += 4;
    doc.line(14, y, pageW - 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Subtotal:`, 140, y);
    doc.text(formatCurrency(proposal.subtotal), 178, y);

    if (proposal.discount > 0) {
      y += 6;
      doc.text(`Desconto:`, 140, y);
      doc.text(`- ${formatCurrency(proposal.discount)}`, 178, y);
    }
    if (proposal.shipping > 0) {
      y += 6;
      doc.text(`Frete:`, 140, y);
      doc.text(formatCurrency(proposal.shipping), 178, y);
    }

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`TOTAL GERAL:`, 130, y);
    doc.text(formatCurrency(proposal.total), 178, y);

    // Payment conditions & Notes
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(proposal.paymentConditions || 'À vista ou conforme negociação', 14, y + 5);

    if (proposal.notes) {
      y += 15;
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(proposal.notes.slice(0, 180), 14, y + 5);
    }

    // Signatures
    y = 260;
    doc.line(20, y, 80, y);
    doc.line(120, y, 180, y);
    doc.setFontSize(8);
    doc.text('Assinatura da Empresa', 32, y + 4);
    doc.text('De acordo do Cliente', 135, y + 4);

    doc.save(`Orcamento_${proposal.number || proposal.id}.pdf`);
  }

  /**
   * Generate Printable / Downloadable Payment Receipt (Recibo de Pagamento com valor por extenso)
   */
  static generateReceiptPDF(transaction: Transaction, company?: CompanyProfile | null): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Border Frame
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.rect(12, 12, pageW - 24, 120);

    // Inner frame
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(14, 14, pageW - 28, 116);

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE PAGAMENTO', pageW / 2, 24, { align: 'center' });

    // Amount box on top right
    doc.setFillColor(241, 245, 249);
    doc.rect(pageW - 65, 18, 48, 10, 'F');
    doc.setDrawColor(148, 163, 184);
    doc.rect(pageW - 65, 18, 48, 10, 'S');
    doc.setFontSize(11);
    doc.text(`VALOR: ${formatCurrency(transaction.amount)}`, pageW - 63, 25);

    // Number & Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nº do Documento: ${transaction.id.slice(0, 10).toUpperCase()}`, 18, 34);
    doc.text(`Data: ${formatDate(transaction.paymentDate || transaction.date)}`, pageW - 55, 34);

    // Body
    const valorExtenso = numberToWordsBRL(transaction.amount);
    const pagador = transaction.entityName || 'Cliente / Não identificado';
    const empresaNome = company?.name || 'Gestor Pro Soluções';

    doc.setFontSize(10);
    const bodyText = `Recebemos de ${pagador}, a quantia de ${formatCurrency(transaction.amount)} (${valorExtenso}), referente a: ${transaction.description}.`;
    const splitBody = doc.splitTextToSize(bodyText, pageW - 36);
    doc.text(splitBody, 18, 46);

    // Payment details
    doc.setFontSize(9);
    doc.text(`Forma de Pagamento: ${transaction.paymentMethod.toUpperCase()}`, 18, 70);
    doc.text(`Categoria: ${transaction.categoryName || '-'}`, 18, 76);

    // Bottom declaration & signature
    const city = company?.city || 'São Paulo';
    const state = company?.state || 'SP';
    doc.text(`${city} - ${state}, ${formatDate(new Date())}.`, 18, 92);

    doc.line(pageW - 90, 105, pageW - 20, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(empresaNome, pageW - 55, 110, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${company?.document || '-'}`, pageW - 55, 114, { align: 'center' });

    doc.save(`Recibo_${transaction.id}.pdf`);
  }
}
