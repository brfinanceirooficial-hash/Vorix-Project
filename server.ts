import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit-table";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // PDF Export Endpoint
  app.post("/api/export-pdf", async (req, res) => {
    try {
      const { user, transactions, dateRange, totalBalance, monthlyIncome, monthlyExpenses, periodIncome, periodExpenses, netChange } = req.body;

      const doc = new PDFDocument({ 
        margin: 40, 
        size: "A4",
        bufferPages: true
      });
      
      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 80; // 40 margin on each side = 515.28
      
      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=relatorio-vorix-${new Date().getTime()}.pdf`);
      
      doc.pipe(res);

      // --- Colors & Branding (STRICT: Orange, White, Black) ---
      const VORIX_ORANGE = "#ff4d00";
      const VORIX_BLACK = "#000000";
      const VORIX_WHITE = "#ffffff";
      const VORIX_GRAY = "#f4f4f5";

      // --- Header Background ---
      doc.rect(0, 0, pageWidth, 120).fill(VORIX_BLACK);
      
      // Logo
      doc.fillColor(VORIX_ORANGE)
         .fontSize(32)
         .font("Helvetica-Bold")
         .text("VORIX", 40, 40);
      
      doc.fillColor(VORIX_WHITE)
         .fontSize(10)
         .font("Helvetica")
         .text("CENTRO DE COMANDO FINANCEIRO", 40, 78, { characterSpacing: 1.5 });

      // Report Info (Top Right)
      doc.fillColor(VORIX_WHITE)
         .fontSize(8)
         .font("Helvetica-Bold")
         .text("RELATÓRIO DE MOVIMENTAÇÕES", 300, 45, { align: "right", width: pageWidth - 340 });
      
      doc.font("Helvetica")
         .fillColor(VORIX_WHITE)
         .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 300, 60, { align: "right", width: pageWidth - 340 });
      
      doc.moveDown(6);

      // --- Client & Period Info ---
      const infoY = 150;
      doc.fillColor(VORIX_BLACK)
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(user.username.toUpperCase(), 40, infoY);
      
      doc.fontSize(10)
         .font("Helvetica")
         .fillColor(VORIX_BLACK)
         .text(`Período de Análise: ${dateRange}`, 40, infoY + 22);
      
      // Decorative line (Black)
      doc.strokeColor(VORIX_BLACK)
         .lineWidth(1.5)
         .moveTo(40, infoY + 45)
         .lineTo(pageWidth - 40, infoY + 45)
         .stroke();

      // --- Summary Cards (Minimalist Style) ---
      const summaryY = 220;
      const cardWidth = (contentWidth - 20) / 3;
      const cardHeight = 65;
      const cardSpacing = 10;

      // Card 1: Saldo Total
      doc.rect(40, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
      doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("SALDO TOTAL ATUAL", 50, summaryY + 15);
      doc.fillColor(VORIX_BLACK).fontSize(14).font("Helvetica-Bold").text(totalBalance, 50, summaryY + 35);

      // Card 2: Entradas
      doc.rect(40 + cardWidth + cardSpacing, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
      doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("ENTRADAS NO PERÍODO", 40 + cardWidth + cardSpacing + 10, summaryY + 15);
      doc.fillColor(VORIX_ORANGE).fontSize(14).font("Helvetica-Bold").text(periodIncome, 40 + cardWidth + cardSpacing + 10, summaryY + 35);

      // Card 3: Saídas
      doc.rect(40 + (cardWidth + cardSpacing) * 2, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
      doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("SAÍDAS NO PERÍODO", 40 + (cardWidth + cardSpacing) * 2 + 10, summaryY + 15);
      doc.fillColor(VORIX_BLACK).fontSize(14).font("Helvetica-Bold").text(periodExpenses, 40 + (cardWidth + cardSpacing) * 2 + 10, summaryY + 35);

      // --- Net Result Banner ---
      const bannerY = 310;
      doc.rect(40, bannerY, contentWidth, 40).fill(VORIX_BLACK);
      doc.fillColor(VORIX_WHITE).fontSize(9).font("Helvetica").text("RESULTADO LÍQUIDO DO PERÍODO:", 60, bannerY + 15);
      doc.fillColor(VORIX_ORANGE).fontSize(12).font("Helvetica-Bold").text(netChange, 230, bannerY + 14);

      doc.moveDown(5);

      // --- Transactions Table ---
      const table = {
        title: "HISTÓRICO DETALHADO",
        subtitle: "Listagem cronológica de todas as movimentações identificadas no período.",
        headers: [
          { label: "DATA", property: "date", width: 65, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "DESCRIÇÃO", property: "description", width: 160, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "CONTA", property: "accountName", width: 80, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "CATEGORIA", property: "category", width: 80, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "TIPO", property: "type", width: 55, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "VALOR", property: "amount", width: 75, headerColor: VORIX_BLACK, headerOpacity: 1 },
        ],
        datas: transactions.map((t: any) => ({
          date: t.dateFormatted,
          description: t.description,
          accountName: t.accountName,
          category: t.category,
          type: t.type === "income" ? "ENTRADA" : "SAÍDA",
          amount: `${t.type === "income" ? "+" : "-"} ${t.amountFormatted}`,
        })),
      };

      await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7).fillColor(VORIX_WHITE),
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          doc.font("Helvetica").fontSize(7).fillColor(VORIX_BLACK);
          
          if (indexColumn === 5) {
            if (row.type === "ENTRADA") {
              doc.fillColor(VORIX_ORANGE).font("Helvetica-Bold");
            } else {
              doc.fillColor(VORIX_BLACK).font("Helvetica-Bold");
            }
          }
          
          return doc;
        },
        padding: [8, 8, 8, 8],
        columnSpacing: 5,
        hideHeader: false,
        minRowHeight: 20,
        width: contentWidth,
        x: 40,
        divider: {
          header: { disabled: false, width: 2, opacity: 1 },
          horizontal: { disabled: false, width: 0.5, opacity: 0.1 },
        }
      });

      // --- Footer ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Bottom line
        doc.strokeColor(VORIX_BLACK)
           .lineWidth(1)
           .moveTo(40, doc.page.height - 60)
           .lineTo(pageWidth - 40, doc.page.height - 60)
           .stroke();

        doc.fillColor(VORIX_BLACK)
           .fontSize(7)
           .font("Helvetica-Bold")
           .text(
             `PÁGINA ${i + 1} DE ${range.count}  |  VORIX FINANCIAL COMMAND CENTER  |  RELATÓRIO CONFIDENCIAL`,
             40,
             doc.page.height - 45,
             { align: "center", characterSpacing: 1, width: contentWidth }
           );
      }

      doc.end();
    } catch (error) {
      console.error("PDF Export Error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Mercado Pago Webhook
  app.post("/api/mercadopago/webhook", (req, res) => {
    const { body, query } = req;
    console.log("Mercado Pago Webhook received:", { body, query });
    // In a real app, we would verify the payment and update the user's isPaid status in Firestore
    res.status(200).send("OK");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      envDir: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
