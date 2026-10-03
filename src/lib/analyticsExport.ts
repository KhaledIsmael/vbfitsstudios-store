import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type BestSellingSilhouette, type AnalyticsTimeRange } from './adminAnalytics';

export function exportAnalyticsToExcel(
  bestSellers: BestSellingSilhouette[],
  range: AnalyticsTimeRange,
  grossRevenue: number
) {
  const BOM = '\uFEFF';
  const headers = ['Product Name', 'Variant', 'Units Sold', 'Revenue (EGP)'];
  const rows = bestSellers.map((item) => [
    `"${item.product_name.replace(/"/g, '""')}"`,
    `"${item.top_color} - ${item.top_size}"`,
    item.units_sold,
    item.total_revenue.toFixed(2),
  ]);

  const csvContent =
    BOM +
    `Analytics Report (${range})\n` +
    `Generated on: ${new Date().toLocaleString()}\n` +
    `Total Gross Revenue: ${grossRevenue.toFixed(2)} EGP\n\n` +
    headers.join(',') +
    '\n' +
    rows.map((row) => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `vb_fits_analytics_${range}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportAnalyticsToPDF(
  bestSellers: BestSellingSilhouette[],
  range: AnalyticsTimeRange,
  grossRevenue: number
) {
  const doc = new jsPDF();
  
  // Header configuration
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('VB FITS STUDIOS', 14, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sales Analytics Report`, 14, 28);
  
  doc.setFontSize(10);
  doc.text(`Date Range: ${range}`, 14, 34);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);
  doc.text(`Total Gross Revenue: ${grossRevenue.toFixed(2)} EGP`, 14, 46);

  // Table
  const tableData = bestSellers.map((item) => [
    item.product_name,
    `${item.top_color} - ${item.top_size}`,
    item.units_sold.toString(),
    `${item.total_revenue.toFixed(2)} EGP`
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Product Name', 'Top Variant', 'Units Sold', 'Revenue']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
    styles: { font: 'helvetica', fontSize: 9 },
  });

  doc.save(`vb_fits_analytics_${range}_${Date.now()}.pdf`);
}
