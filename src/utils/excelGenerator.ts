import ExcelJS from 'exceljs';

interface TransactionPayload {
  description: string;
  category: string;
  type: 'income' | 'expense';
  accountName: string;
  amountFormatted: string;
  dateFormatted: string;
  amount: number;
}

interface ExportPayload {
  exportType: 'geral' | 'receitas' | 'despesas';
  reportTitle: string;
  user: { username: string };
  transactions: TransactionPayload[];
  dateRange: string;
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  periodIncome: string;
  periodExpenses: string;
  netChange: string;
}

// Helper to style a range of cells (useful for merged ranges)
const styleRange = (
  sheet: ExcelJS.Worksheet,
  startCell: string,
  endCell: string,
  style: {
    fill?: ExcelJS.Fill;
    font?: Partial<ExcelJS.Font>;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
  }
) => {
  const start = sheet.getCell(startCell);
  const end = sheet.getCell(endCell);

  const startRow = Math.min(Number(start.row), Number(end.row));
  const endRow = Math.max(Number(start.row), Number(end.row));
  const startCol = Math.min(Number(start.col), Number(end.col));
  const endCol = Math.max(Number(start.col), Number(end.col));

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      if (style.fill) cell.fill = style.fill;
      if (style.font) cell.font = { ...cell.font, ...style.font } as ExcelJS.Font;
      if (style.alignment) cell.alignment = { ...cell.alignment, ...style.alignment } as ExcelJS.Alignment;
      if (style.border) cell.border = { ...cell.border, ...style.border } as ExcelJS.Borders;
    }
  }
};

export const generateExcelReport = async (payload: ExportPayload) => {
  const workbook = new ExcelJS.Workbook();
  
  // Sheet tab name
  const sheetName = payload.reportTitle.slice(0, 31); // Excel sheet names must be <= 31 chars
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Set column configurations
  sheet.columns = [
    { key: 'date', width: 16 },
    { key: 'description', width: 32 },
    { key: 'account', width: 22 },
    { key: 'category', width: 22 },
    { key: 'type', width: 16 },
    { key: 'amount', width: 22 }
  ];

  // 1. Title Block
  sheet.getCell('A1').value = 'VORIX - CENTRO DE COMANDO FINANCEIRO';
  sheet.getCell('A1').font = {
    name: 'Segoe UI',
    bold: true,
    size: 16,
    color: { argb: 'FFFF4D00' } // Vorix Orange
  };

  sheet.getCell('A2').value = payload.reportTitle.toUpperCase();
  sheet.getCell('A2').font = {
    name: 'Segoe UI',
    bold: true,
    size: 12,
    color: { argb: 'FF1B365D' } // Navy Blue
  };

  sheet.getCell('A3').value = `Período: ${payload.dateRange}  |  Cliente: ${payload.user.username.toUpperCase()}`;
  sheet.getCell('A3').font = {
    name: 'Segoe UI',
    italic: true,
    size: 9.5,
    color: { argb: 'FF555555' }
  };

  // Common styles
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const cardLabelFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  };

  // 2. Summary Cards (Rows 5 & 6)
  if (payload.exportType === 'receitas') {
    // Only Income Card
    sheet.mergeCells('A5:C5');
    sheet.mergeCells('A6:C6');
    sheet.getCell('A5').value = 'ENTRADAS NO PERÍODO';
    sheet.getCell('A6').value = payload.periodIncome;
    
    styleRange(sheet, 'A5', 'C5', {
      fill: cardLabelFill,
      font: { name: 'Segoe UI', bold: true, size: 8, color: { argb: 'FF475569' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    styleRange(sheet, 'A6', 'C6', {
      font: { name: 'Segoe UI', bold: true, size: 13, color: { argb: 'FFFF4D00' } }, // Orange
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    sheet.getRow(5).height = 18;
    sheet.getRow(6).height = 24;
  } else if (payload.exportType === 'despesas') {
    // Only Expenses Card
    sheet.mergeCells('A5:C5');
    sheet.mergeCells('A6:C6');
    sheet.getCell('A5').value = 'SAÍDAS NO PERÍODO';
    sheet.getCell('A6').value = payload.periodExpenses;

    styleRange(sheet, 'A5', 'C5', {
      fill: cardLabelFill,
      font: { name: 'Segoe UI', bold: true, size: 8, color: { argb: 'FF475569' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    styleRange(sheet, 'A6', 'C6', {
      font: { name: 'Segoe UI', bold: true, size: 13, color: { argb: 'FF0F172A' } }, // Dark Slate
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    sheet.getRow(5).height = 18;
    sheet.getRow(6).height = 24;
  } else {
    // General Report: Three Cards + Net Result Banner
    // Card 1: Saldo Total
    sheet.mergeCells('A5:B5');
    sheet.mergeCells('A6:B6');
    sheet.getCell('A5').value = 'SALDO TOTAL ATUAL';
    sheet.getCell('A6').value = payload.totalBalance;

    styleRange(sheet, 'A5', 'B5', {
      fill: cardLabelFill,
      font: { name: 'Segoe UI', bold: true, size: 8, color: { argb: 'FF475569' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    styleRange(sheet, 'A6', 'B6', {
      font: { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FF0F172A' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });

    // Card 2: Entradas
    sheet.mergeCells('C5:D5');
    sheet.mergeCells('C6:D6');
    sheet.getCell('C5').value = 'ENTRADAS NO PERÍODO';
    sheet.getCell('C6').value = payload.periodIncome;

    styleRange(sheet, 'C5', 'D5', {
      fill: cardLabelFill,
      font: { name: 'Segoe UI', bold: true, size: 8, color: { argb: 'FF475569' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    styleRange(sheet, 'C6', 'D6', {
      font: { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FFFF4D00' } }, // Orange
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });

    // Card 3: Saídas
    sheet.mergeCells('E5:F5');
    sheet.mergeCells('E6:F6');
    sheet.getCell('E5').value = 'SAÍDAS NO PERÍODO';
    sheet.getCell('E6').value = payload.periodExpenses;

    styleRange(sheet, 'E5', 'F5', {
      fill: cardLabelFill,
      font: { name: 'Segoe UI', bold: true, size: 8, color: { argb: 'FF475569' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    styleRange(sheet, 'E6', 'F6', {
      font: { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FF0F172A' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });

    sheet.getRow(5).height = 18;
    sheet.getRow(6).height = 22;

    // Net Result Banner (Row 8)
    sheet.mergeCells('A8:F8');
    sheet.getCell('A8').value = `RESULTADO LÍQUIDO DO PERÍODO:   ${payload.netChange}`;
    
    styleRange(sheet, 'A8', 'F8', {
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B365D' } // Navy blue
      },
      font: { name: 'Segoe UI', bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    sheet.getRow(8).height = 24;
  }

  // 3. Transactions Table (Starts at row 10)
  const tableHeaderRowIndex = 10;
  const headerRow = sheet.getRow(tableHeaderRowIndex);
  headerRow.height = 26;

  const headers = ['DATA', 'DESCRIÇÃO', 'CONTA', 'CATEGORIA', 'TIPO', 'VALOR'];
  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = h;
  });

  styleRange(sheet, `A${tableHeaderRowIndex}`, `F${tableHeaderRowIndex}`, {
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' } // Very dark slate/black
    },
    font: {
      name: 'Segoe UI',
      bold: true,
      size: 10,
      color: { argb: 'FFFFFFFF' }
    },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: 'FF374151' } },
      bottom: { style: 'medium', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF374151' } },
      right: { style: 'thin', color: { argb: 'FF374151' } }
    }
  });

  const startDataRow = 11;
  let currentExcelRow = startDataRow;

  if (payload.transactions && payload.transactions.length > 0) {
    payload.transactions.forEach((tx) => {
      const row = sheet.getRow(currentExcelRow);
      row.height = 20;

      // Map values
      row.getCell(1).value = tx.dateFormatted;
      row.getCell(2).value = tx.description;
      row.getCell(3).value = tx.accountName;
      row.getCell(4).value = tx.category;
      row.getCell(5).value = tx.type === 'income' ? 'ENTRADA' : 'SAÍDA';
      
      // Store actual number for formulas and styling
      row.getCell(6).value = Number(tx.amount);

      // Alignments & formats
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

      // Number formatting for amount
      row.getCell(6).numFmt = '"R$ " #,##0.00;("R$ " #,##0.00);"-"';

      // Style fonts & colors
      const isEven = currentExcelRow % 2 === 0;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF'; // Sleek zebra striping
      const typeColor = tx.type === 'income' ? 'FFFF4D00' : 'FF334155'; // Orange for income, slate for expense

      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        cell.border = thinBorder;
        
        // Font
        if (c === 5 || c === 6) {
          // Bold for type and amount
          cell.font = {
            name: 'Segoe UI',
            size: 9.5,
            bold: true,
            color: { argb: typeColor }
          };
        } else {
          cell.font = {
            name: 'Segoe UI',
            size: 9.5,
            color: { argb: 'FF334155' }
          };
        }
      }

      currentExcelRow++;
    });

    // 4. Sum/Total Row
    const totalRowIndex = currentExcelRow;
    const totalRow = sheet.getRow(totalRowIndex);
    totalRow.height = 22;

    sheet.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
    sheet.getCell(`A${totalRowIndex}`).value = 'TOTAL DO PERÍODO';
    
    // Formula for sum
    const formulaRange = `F${startDataRow}:F${totalRowIndex - 1}`;
    let formula = `=SUM(${formulaRange})`;
    if (payload.exportType === 'geral') {
      const typeRange = `E${startDataRow}:E${totalRowIndex - 1}`;
      formula = `=SUMIF(${typeRange}, "ENTRADA", ${formulaRange}) - SUMIF(${typeRange}, "SAÍDA", ${formulaRange})`;
    }
    sheet.getCell(`F${totalRowIndex}`).value = { formula };
    sheet.getCell(`F${totalRowIndex}`).numFmt = '"R$ " #,##0.00;("R$ " #,##0.00);"-"';

    // Style the Total Row
    const totalFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // light slate highlight
    };

    const totalBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF1B365D' } }, // Classic accounting double line
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    styleRange(sheet, `A${totalRowIndex}`, `E${totalRowIndex}`, {
      fill: totalFill,
      font: { name: 'Segoe UI', bold: true, size: 10, color: { argb: 'FF1E293B' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: totalBorder
    });

    styleRange(sheet, `F${totalRowIndex}`, `F${totalRowIndex}`, {
      fill: totalFill,
      font: { name: 'Segoe UI', bold: true, size: 10.5, color: { argb: 'FF1B365D' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: totalBorder
    });

  } else {
    // Empty state
    sheet.mergeCells(`A${currentExcelRow}:F${currentExcelRow}`);
    sheet.getCell(`A${currentExcelRow}`).value = 'Nenhuma transação encontrada no período selecionado.';
    styleRange(sheet, `A${currentExcelRow}`, `F${currentExcelRow}`, {
      font: { name: 'Segoe UI', italic: true, size: 10, color: { argb: 'FF64748B' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
    sheet.getRow(currentExcelRow).height = 30;
  }

  // 5. Generate and save the file
  const username = payload.user?.username || 'cliente';
  const filename = `relatorio-vorix-${username.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;

  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const xlsxBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    let sharedSuccessfully = false;
    // Feature detect Web Share API with files (for Mobile/OS integration)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([xlsxBlob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Relatório Financeiro Vorix',
            text: 'Aqui está seu relatório financeiro em Excel.',
            files: [file]
          });
          sharedSuccessfully = true;
        }
      } catch (shareError) {
        console.log('Share was cancelled or failed, falling back to download:', shareError);
      }
    }

    if (!sharedSuccessfully) {
      // Standard Download fallback (Desktop)
      const fileURL = URL.createObjectURL(xlsxBlob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(fileURL), 3000);
    }
  } catch (error) {
    console.error('Error saving Excel:', error);
    throw error;
  }
};
