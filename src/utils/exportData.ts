import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryType, Order, OrderOrigin, OrderStatus, Product } from '../types';
import {
  calculateProfitMargin,
  formatCurrency,
  formatWeight,
  slugify,
} from './format';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDENTE]: 'Pendente',
  [OrderStatus.PAGO]: 'Pago',
  [OrderStatus.EM_PRODUCAO]: 'Em Produção',
  [OrderStatus.PRONTO]: 'Pronto',
  [OrderStatus.ENTREGUE]: 'Entregue',
};

const ORDER_ORIGIN_LABEL: Record<OrderOrigin, string> = {
  [OrderOrigin.WHATSAPP_IA]: 'WhatsApp IA',
  [OrderOrigin.CARDAPIO_WEB]: 'Cardápio Web',
  [OrderOrigin.MANUAL]: 'Manual',
};

function getDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getFormattedTimestamp(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  if (str.includes(';') || str.includes('"') || str.includes(',')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDecimalPtBr(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildCsvContent(headers: string[], rows: Array<Array<string | number>>): string {
  const headerLine = headers.map(escapeCsvCell).join(';');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(';'));
  // UTF-8 BOM ensures accented characters open cleanly in Excel PT-BR
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

function drawPdfHeader(
  doc: jsPDF,
  storeName: string,
  reportTitle: string,
  subtitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(250, 247, 242);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.7);
  doc.line(14, 28, pageWidth - 14, 28);

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`PUDIMFLOW · ${storeName.toUpperCase()}`, 14, 11);

  doc.setTextColor(41, 29, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(reportTitle, 14, 19);

  doc.setTextColor(107, 87, 74);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitle, 14, 24.5);

  doc.text(`Gerado em ${getFormattedTimestamp()}`, pageWidth - 14, 19, {
    align: 'right',
  });

  return 34;
}

function drawPdfFooter(doc: jsPDF, storeName: string): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(232, 223, 211);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(122, 102, 88);
    doc.text(
      `${storeName} · Registro gerado pelo PudimFlow`,
      14,
      pageHeight - 7
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, {
      align: 'right',
    });
  }
}

export function exportOrdersCsv(orders: Order[], storeName: string): string {
  const headers = [
    'Código',
    'Cliente',
    'WhatsApp',
    'Horário Entrega',
    'Origem',
    'Modalidade',
    'Status',
    'Itens',
    'Subtotal (R$)',
    'Taxa Entrega (R$)',
    'Valor Total (R$)',
    'Endereço',
    'Observações',
  ];

  const rows = orders.map((order) => [
    order.codigo,
    order.clienteNome,
    order.clienteWhatsapp,
    order.horarioEntrega,
    ORDER_ORIGIN_LABEL[order.origem],
    order.tipoEntrega === DeliveryType.ENTREGA ? 'Entrega' : 'Retirada',
    ORDER_STATUS_LABEL[order.status],
    order.itens
      .map((i) => `${i.quantidade}x ${i.nomeProduto} (${formatWeight(i.pesoGramas)})`)
      .join(' | '),
    formatDecimalPtBr(order.subtotal),
    formatDecimalPtBr(order.taxaEntrega),
    formatDecimalPtBr(order.valorTotal),
    order.endereco || '',
    order.observacoes || '',
  ]);

  const csv = buildCsvContent(headers, rows);
  const filename = `pedidos-${slugify(storeName) || 'pudimflow'}-${getDateStamp()}.csv`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
  return filename;
}

export function exportOrdersPdf(orders: Order[], storeName: string): string {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = drawPdfHeader(
    doc,
    storeName,
    'Relatório Contábil de Pedidos',
    `Arquivo operacional e financeiro com ${orders.length} ${orders.length === 1 ? 'pedido registrado' : 'pedidos registrados'}`
  );

  const totalRevenue = orders.reduce((sum, o) => sum + o.valorTotal, 0);
  const totalDeliveryFees = orders.reduce((sum, o) => sum + o.taxaEntrega, 0);
  const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;
  const whatsappCount = orders.filter((o) => o.origem === OrderOrigin.WHATSAPP_IA).length;

  const summaryItems = [
    { label: 'Pedidos', value: String(orders.length) },
    { label: 'Receita Bruta', value: formatCurrency(totalRevenue) },
    { label: 'Taxas de Entrega', value: formatCurrency(totalDeliveryFees) },
    { label: 'Ticket Médio', value: formatCurrency(avgTicket) },
    { label: 'Origem WhatsApp IA', value: `${whatsappCount} pedidos` },
  ];

  const boxWidth = (doc.internal.pageSize.getWidth() - 28 - 12) / summaryItems.length;
  summaryItems.forEach((metric, index) => {
    const x = 14 + index * (boxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(232, 223, 211);
    doc.roundedRect(x, startY, boxWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(122, 102, 88);
    doc.text(metric.label, x + 3, startY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(41, 29, 22);
    doc.text(metric.value, x + 3, startY + 11);
  });

  autoTable(doc, {
    startY: startY + 19,
    head: [
      [
        'Código',
        'Cliente',
        'Horário',
        'Origem',
        'Tipo',
        'Status',
        'Itens',
        'Subtotal',
        'Taxa',
        'Total',
      ],
    ],
    body: orders.map((order) => [
      order.codigo,
      `${order.clienteNome}\n${order.clienteWhatsapp}`,
      order.horarioEntrega,
      ORDER_ORIGIN_LABEL[order.origem],
      order.tipoEntrega === DeliveryType.ENTREGA ? 'Entrega' : 'Retirada',
      ORDER_STATUS_LABEL[order.status],
      order.itens
        .map((i) => `${i.quantidade}x ${i.nomeProduto} (${formatWeight(i.pesoGramas)})`)
        .join('\n'),
      formatCurrency(order.subtotal),
      order.taxaEntrega > 0 ? formatCurrency(order.taxaEntrega) : 'Grátis',
      formatCurrency(order.valorTotal),
    ]),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [41, 29, 22],
      lineColor: [232, 223, 211],
      lineWidth: 0.2,
      valign: 'top',
    },
    headStyles: {
      fillColor: [41, 29, 22],
      textColor: [250, 247, 242],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [252, 249, 244],
    },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: 'bold' },
      1: { cellWidth: 34 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 17 },
      5: { cellWidth: 22 },
      6: { cellWidth: 74 },
      7: { halign: 'right', cellWidth: 21 },
      8: { halign: 'right', cellWidth: 19 },
      9: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooter(doc, storeName);

  const filename = `relatorio-pedidos-${slugify(storeName) || 'pudimflow'}-${getDateStamp()}.pdf`;
  doc.save(filename);
  return filename;
}

export function exportProductsCsv(products: Product[], storeName: string): string {
  const headers = [
    'Produto',
    'Peso (g)',
    'Preço de Venda (R$)',
    'Custo Estimado (R$)',
    'Lucro Unitário (R$)',
    'Margem (%)',
    'Estoque Atual',
    'Custo em Estoque (R$)',
    'Potencial Venda (R$)',
    'Status Cardápio',
    'Situação Estoque',
  ];

  const rows = products.map((product) => {
    const margin = calculateProfitMargin(product.precoVenda, product.custoEstimado);
    const unitProfit = product.precoVenda - product.custoEstimado;
    const stockSituation =
      product.estoqueAtual === 0
        ? 'Esgotado'
        : product.estoqueAtual < 3
          ? 'Estoque baixo'
          : 'Normal';

    return [
      product.nome,
      product.pesoGramas,
      formatDecimalPtBr(product.precoVenda),
      formatDecimalPtBr(product.custoEstimado),
      formatDecimalPtBr(unitProfit),
      margin.toFixed(1).replace('.', ','),
      product.estoqueAtual,
      formatDecimalPtBr(product.custoEstimado * product.estoqueAtual),
      formatDecimalPtBr(product.precoVenda * product.estoqueAtual),
      product.ativo ? 'Ativo' : 'Pausado',
      stockSituation,
    ];
  });

  const csv = buildCsvContent(headers, rows);
  const filename = `estoque-produtos-${slugify(storeName) || 'pudimflow'}-${getDateStamp()}.csv`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
  return filename;
}

export function exportProductsPdf(products: Product[], storeName: string): string {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = drawPdfHeader(
    doc,
    storeName,
    'Relatório de Produtos, Margens e Estoque',
    `Posição de inventário e precificação com ${products.length} ${products.length === 1 ? 'sabor listado' : 'sabores listados'}`
  );

  const totalUnits = products.reduce((sum, p) => sum + p.estoqueAtual, 0);
  const totalCostValue = products.reduce(
    (sum, p) => sum + p.custoEstimado * p.estoqueAtual,
    0
  );
  const totalSalePotential = products.reduce(
    (sum, p) => sum + p.precoVenda * p.estoqueAtual,
    0
  );
  const avgMargin =
    products.length > 0
      ? products.reduce(
          (sum, p) => sum + calculateProfitMargin(p.precoVenda, p.custoEstimado),
          0
        ) / products.length
      : 0;
  const lowStockCount = products.filter((p) => p.estoqueAtual < 3).length;

  const summaryItems = [
    { label: 'Unidades em Estoque', value: `${totalUnits} un.` },
    { label: 'Margem Média', value: `${avgMargin.toFixed(1).replace('.', ',')}%` },
    { label: 'Custo Imobilizado', value: formatCurrency(totalCostValue) },
    { label: 'Potencial de Venda', value: formatCurrency(totalSalePotential) },
    { label: 'Alertas (< 3 un.)', value: `${lowStockCount} sabores` },
  ];

  const boxWidth = (doc.internal.pageSize.getWidth() - 28 - 12) / summaryItems.length;
  summaryItems.forEach((metric, index) => {
    const x = 14 + index * (boxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(232, 223, 211);
    doc.roundedRect(x, startY, boxWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(122, 102, 88);
    doc.text(metric.label, x + 3, startY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(41, 29, 22);
    doc.text(metric.value, x + 3, startY + 11);
  });

  autoTable(doc, {
    startY: startY + 19,
    head: [
      [
        'Sabor',
        'Peso',
        'Preço Venda',
        'Custo Est.',
        'Lucro Unit.',
        'Margem',
        'Estoque',
        'Valor Estoque',
        'Status',
        'Alerta',
      ],
    ],
    body: products.map((product) => {
      const margin = calculateProfitMargin(product.precoVenda, product.custoEstimado);
      const alertLabel =
        product.estoqueAtual === 0
          ? 'Esgotado'
          : product.estoqueAtual < 3
            ? 'Baixo'
            : 'Normal';
      return [
        product.nome,
        formatWeight(product.pesoGramas),
        formatCurrency(product.precoVenda),
        formatCurrency(product.custoEstimado),
        formatCurrency(product.precoVenda - product.custoEstimado),
        `${margin.toFixed(1).replace('.', ',')}%`,
        `${product.estoqueAtual} un.`,
        formatCurrency(product.precoVenda * product.estoqueAtual),
        product.ativo ? 'Ativo' : 'Pausado',
        alertLabel,
      ];
    }),
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      textColor: [41, 29, 22],
      lineColor: [232, 223, 211],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [41, 29, 22],
      textColor: [250, 247, 242],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [252, 249, 244],
    },
    columnStyles: {
      0: { cellWidth: 64, fontStyle: 'bold' },
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'right', cellWidth: 27 },
      8: { halign: 'center', cellWidth: 22 },
      9: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 9) {
        const text = String(data.cell.raw || '');
        if (text === 'Esgotado' || text === 'Baixo') {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [6, 95, 70];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooter(doc, storeName);

  const filename = `relatorio-estoque-${slugify(storeName) || 'pudimflow'}-${getDateStamp()}.pdf`;
  doc.save(filename);
  return filename;
}
