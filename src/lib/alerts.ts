import { GoogleGenAI, Type } from "@google/genai";
import { db, collection, addDoc, Timestamp } from "./storage";
import { User, Transaction, Account, Alert } from "../types";
import { formatCurrency } from "./utils";

export const generateProactiveAlerts = async (
  user: User,
  accounts: Account[],
  transactions: Transaction[],
  existingAlerts: Alert[]
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const model = ai.models.get({ model: "gemini-3-flash-preview" });

    const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
    const monthlyIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const monthlyExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, curr) => acc + curr.amount, 0);

    const categoryTotals = transactions.reduce((acc, t) => {
      if (t.type === "expense") {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const prompt = `
      Analise os seguintes dados financeiros do usuário ${user.username} e gere de 2 a 4 alertas proativos e úteis.
      
      DADOS:
      - Saldo Total: ${formatCurrency(totalBalance)}
      - Entradas (Mês): ${formatCurrency(monthlyIncome)}
      - Saídas (Mês): ${formatCurrency(monthlyExpenses)}
      - Gastos por Categoria: ${JSON.stringify(categoryTotals)}
      - Transações Recentes: ${JSON.stringify(transactions.slice(0, 20))}
      
      REGRAS PARA OS ALERTAS:
      1. Identifique padrões de gastos excessivos.
      2. Sugira oportunidades de economia.
      3. Alerte sobre contas que parecem recorrentes e podem estar vencendo (baseado no histórico).
      4. Dê dicas de investimento se houver saldo sobrando.
      5. Use um tom profissional e motivador.

      Retorne os alertas no formato JSON seguindo este schema:
      Array<{
        type: "info" | "warning" | "error" | "success",
        title: string,
        message: string,
        severity: "low" | "medium" | "high"
      }>
    `;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["info", "warning", "error", "success"],
              },
              title: { type: Type.STRING },
              message: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
            },
            required: ["type", "title", "message", "severity"],
          },
        },
      },
    });

    const generatedAlerts = JSON.parse(result.text);

    for (const alert of generatedAlerts) {
      // Check if a similar alert already exists to avoid duplicates (simple check)
      const exists = existingAlerts.some(
        (a) => a.title === alert.title && !a.read
      );
      if (!exists) {
        await addDoc(collection(db, `users/${user.uid}/alerts`), {
          ...alert,
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }
  } catch (error) {
    console.error("Error generating proactive alerts:", error);
  }
};
