import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDFReport = (payload: any) => {
  const doc = new jsPDF();
  
  const VORIX_ORANGE: [number, number, number] = [255, 77, 0];
  const VORIX_BLACK: [number, number, number] = [0, 0, 0];
  const VORIX_WHITE: [number, number, number] = [255, 255, 255];
  
  // Header Background
  doc.setFillColor(...VORIX_BLACK);
  doc.rect(0, 0, 210, 40, "F");
  
  // Logo & Title
  doc.setTextColor(...VORIX_ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("VORIX", 15, 20);
  
  doc.setTextColor(...VORIX_WHITE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("CENTRO DE COMANDO FINANCEIRO", 15, 28);
  
  // Report Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE MOVIMENTAÇÕES", 195, 20, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 195, 28, { align: "right" });
  
  // User Info & Period
  doc.setTextColor(...VORIX_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(payload.user.username ? payload.user.username.toUpperCase() : "CLIENTE", 15, 55);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período de Análise: ${payload.dateRange}`, 15, 62);
  
  // Decorative line
  doc.setDrawColor(...VORIX_BLACK);
  doc.setLineWidth(0.5);
  doc.line(15, 66, 195, 66);
  
  // Summary Cards (using texts)
  const cardY = 80;
  
  // Card 1
  doc.setDrawColor(...VORIX_BLACK);
  doc.rect(15, cardY, 55, 20);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SALDO TOTAL ATUAL", 20, cardY + 7);
  doc.setFontSize(11);
  doc.text(payload.totalBalance || "R$ 0,00", 20, cardY + 14);

  // Card 2
  doc.rect(75, cardY, 55, 20);
  doc.setFontSize(7);
  doc.text("ENTRADAS NO PERÍODO", 80, cardY + 7);
  doc.setTextColor(...VORIX_ORANGE);
  doc.setFontSize(11);
  doc.text(payload.periodIncome || "R$ 0,00", 80, cardY + 14);

  // Card 3
  doc.setTextColor(...VORIX_BLACK);
  doc.rect(135, cardY, 60, 20);
  doc.setFontSize(7);
  doc.text("SAÍDAS NO PERÍODO", 140, cardY + 7);
  doc.setFontSize(11);
  doc.text(payload.periodExpenses || "R$ 0,00", 140, cardY + 14);

  // Net Result Banner
  const bannerY = 110;
  doc.setFillColor(...VORIX_BLACK);
  doc.rect(15, bannerY, 180, 15, "F");
  
  doc.setTextColor(...VORIX_WHITE);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RESULTADO LÍQUIDO DO PERÍODO:", 25, bannerY + 10);
  
  doc.setTextColor(...VORIX_ORANGE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(payload.netChange || "R$ 0,00", 100, bannerY + 10);

  // Transactions Table
  if (payload.transactions && payload.transactions.length > 0) {
    const tableData = payload.transactions.map((t: any) => [
      t.dateFormatted,
      t.description,
      t.accountName,
      t.category,
      t.type === "income" ? "ENTRADA" : "SAÍDA",
      `${t.type === "income" ? "+" : "-"} R$ ${t.amountFormatted}`
    ]);

    autoTable(doc, {
      startY: 135,
      head: [["DATA", "DESCRIÇÃO", "CONTA", "CATEGORIA", "TIPO", "VALOR"]],
      body: tableData,
      theme: "plain",
      headStyles: {
        fillColor: VORIX_BLACK,
        textColor: VORIX_WHITE,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: VORIX_BLACK,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const isIncome = (data.row.raw as string[])[4] === "ENTRADA";
          data.cell.styles.textColor = isIncome ? VORIX_ORANGE : VORIX_BLACK;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 15, right: 15 },
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...VORIX_BLACK);
    doc.setFontSize(10);
    doc.text("Nenhuma transação encontrada no período selecionado.", 15, 140);
  }
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...VORIX_BLACK);
    doc.setLineWidth(0.5);
    doc.line(15, 280, 195, 280);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...VORIX_BLACK);
    doc.text(
      `PÁGINA ${i} DE ${pageCount}  |  VORIX FINANCIAL COMMAND CENTER  |  RELATÓRIO CONFIDENCIAL`,
      105,
      287,
      { align: "center" }
    );
  }

  // Save PDF - Robust Mobile Support
  const username = payload.user?.username || 'cliente';
  const filename = `relatorio-vorix-${username.replace(/\\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  
  // Try Web Share API for Mobile Devices
  try {
    const pdfBlob = doc.output('blob');
    
    // Feature detect Web Share API with files
    if (navigator.share && navigator.canShare) {
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({
          title: 'Relatório Financeiro Vorix',
          text: 'Aqui está seu relatório financeiro.',
          files: [file]
        }).catch((err) => {
          console.log('Share was cancelled or failed', err);
          // Fallback to normal download if share fails
          doc.save(filename);
        });
        return; // Exit if share is invoked
      }
    }
    
    // Fallback for when Web Share API is missing (e.g. desktop or unsupported browers)
    // For iOS devices specifically, sometimes window.open is better if doc.save is blocked
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      const fileURL = URL.createObjectURL(pdfBlob);
      window.open(fileURL, '_blank');
      // Revoke the object URL after a delay to ensure it had time to load
      setTimeout(() => URL.revokeObjectURL(fileURL), 3000);
    } else {
      doc.save(filename);
    }
  } catch (error) {
    console.error('Error saving PDF:', error);
    doc.save(filename); // Ultimate fallback
  }
};
