import express from "express";
import dotenv from "dotenv";
dotenv.config();
import PDFDocument from "pdfkit-table";
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

const app = express();

// Precisamos do rawBody para validar a assinatura do webhook do MP
app.use('/api/mercadopago/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: "10mb" }));

// ============================================================
// CLIENTS
// ============================================================

// Supabase Admin Client (usa service_role key se disponível, senão usa anon key)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Mercado Pago Client
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

// ============================================================
// HELPERS
// ============================================================

const PLANS: Record<string, { title: string; price: number }> = {
  pro:     { title: 'Vorix Finance — Plano Pro',     price: 10.99 },
  premium: { title: 'Vorix Finance — Plano Premium', price: 17.99 },
};

async function activatePlan(userId: string, planId: string, mpSubscriptionId?: string, mpPayerId?: string) {
  const updateData: Record<string, any> = {
    plan: planId,
    is_paid: true,
    subscription_status: 'active',
    trial_ends_at: null, // Zerar trial ao assinar
  };
  if (mpSubscriptionId) updateData.mp_subscription_id = mpSubscriptionId;
  if (mpPayerId)        updateData.mp_payer_id = mpPayerId;

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) throw error;
  console.log(`✅ Plano "${planId}" ativado para usuário ${userId}`);
}

async function logPaymentEvent(data: {
  userId?: string;
  mpPaymentId?: string;
  mpSubscriptionId?: string;
  eventType: string;
  status: string;
  plan?: string;
  amount?: number;
  paymentMethod?: string;
  rawPayload?: any;
}) {
  try {
    await supabase.from('payment_logs').insert({
      user_id: data.userId || null,
      mp_payment_id: data.mpPaymentId,
      mp_subscription_id: data.mpSubscriptionId,
      event_type: data.eventType,
      status: data.status,
      plan: data.plan,
      amount: data.amount,
      payment_method: data.paymentMethod,
      raw_payload: data.rawPayload,
    });
  } catch (err) {
    console.error('Erro ao gravar payment_log:', err);
  }
}

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ============================================================
// CHECKOUT — CARTÃO (Assinatura Recorrente Mensal)
// ============================================================
/*
  O frontend tokeniza o cartão via MercadoPago.js v2 e envia o token aqui.
  Criamos uma assinatura recorrente via PreApproval Plan + PreApproval.
*/
app.post("/api/checkout/card-payment", async (req, res) => {
  try {
    const { cardToken, planId, userId, userEmail, payerName, identificationNumber, identificationType } = req.body;

    if (!cardToken || !planId || !userId || !userEmail) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: "Plano inválido" });
    }

    console.log(`[card-payment] Criando assinatura recorrente | user:${userId} | plan:${planId}`);

    // Usar PreApproval para assinatura recorrente mensal com cartão
    const preApproval = new PreApproval(mpClient);
    const subscription = await preApproval.create({
      body: {
        reason: plan.title,
        payer_email: userEmail,
        external_reference: userId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.price,
          currency_id: 'BRL',
        },
        card_token_id: cardToken,
        status: 'authorized',
      },
    });

    console.log(`[card-payment] Assinatura criada: ${subscription.id} | status: ${subscription.status}`);

    await logPaymentEvent({
      userId,
      mpSubscriptionId: subscription.id,
      eventType: 'subscription_created',
      status: subscription.status || 'unknown',
      plan: planId,
      amount: plan.price,
      paymentMethod: 'card',
      rawPayload: subscription,
    });

    // Ativar o plano imediatamente se status for authorized
    if (subscription.status === 'authorized') {
      await activatePlan(userId, planId, subscription.id || undefined, String(subscription.payer_id || ''));
      return res.json({ success: true, status: 'authorized', subscriptionId: subscription.id });
    }

    return res.json({ success: true, status: subscription.status, subscriptionId: subscription.id });
  } catch (error: any) {
    console.error("[card-payment] Erro:", error);
    const mpDetails = error.cause ? JSON.stringify(error.cause) : error.message;
    return res.status(500).json({ error: "Falha ao processar pagamento", details: mpDetails });
  }
});

// ============================================================
// CHECKOUT — PIX (Pagamento Único com QR Code)
// ============================================================
app.post("/api/checkout/pix-payment", async (req, res) => {
  try {
    const { planId, userId, userEmail, payerFirstName, payerLastName, identificationNumber, identificationType } = req.body;

    if (!planId || !userId || !userEmail) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: "Plano inválido" });
    }

    console.log(`[pix-payment] Gerando PIX | user:${userId} | plan:${planId}`);

    const payment = new Payment(mpClient);
    const result = await payment.create({
      body: {
        transaction_amount: plan.price,
        description: plan.title,
        payment_method_id: 'pix',
        external_reference: userId, // usado no webhook para identificar o user
        payer: {
          email: userEmail,
          first_name: payerFirstName || 'Cliente',
          last_name:  payerLastName  || 'Vorix',
          identification: {
            type:   identificationType || 'CPF',
            number: identificationNumber || '00000000000',
          },
        },
        // Metadado extra para o webhook identificar o plano
        metadata: {
          user_id: userId,
          plan_id: planId,
        },
      },
    });

    console.log(`[pix-payment] Pagamento criado: ${result.id} | status: ${result.status}`);

    await logPaymentEvent({
      userId,
      mpPaymentId: String(result.id),
      eventType: 'pix_created',
      status: result.status || 'pending',
      plan: planId,
      amount: plan.price,
      paymentMethod: 'pix',
      rawPayload: result,
    });

    // Retorna QR code para o frontend exibir
    const qrData = result.point_of_interaction?.transaction_data;
    return res.json({
      success: true,
      paymentId: result.id,
      status: result.status,
      qrCodeBase64: qrData?.qr_code_base64,
      qrCode: qrData?.qr_code, // copia e cola
    });
  } catch (error: any) {
    console.error("[pix-payment] Erro:", error);
    const mpDetails = error.cause ? JSON.stringify(error.cause) : error.message;
    return res.status(500).json({ error: "Falha ao gerar PIX", details: mpDetails });
  }
});

// ============================================================
// CHECKOUT — STATUS DO PIX (Polling)
// ============================================================
app.get("/api/checkout/pix-status/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = new Payment(mpClient);
    const result = await payment.get({ id: Number(paymentId) });

    return res.json({
      status: result.status,
      statusDetail: result.status_detail,
    });
  } catch (error: any) {
    console.error("[pix-status] Erro:", error);
    return res.status(500).json({ error: "Falha ao verificar status" });
  }
});

// ============================================================
// WEBHOOK — Mercado Pago
// ============================================================
app.post("/api/mercadopago/webhook", async (req, res) => {
  try {
    const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    console.log('🚀 [webhook] Recebido:', JSON.stringify(body, null, 2));

    // Validação da assinatura HMAC (segurança) — Desabilitada se não houver segredo ou em desenvolvimento
    const isDev = process.env.NODE_ENV === 'development';
    const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';
    const signature     = req.headers['x-signature'] as string;
    const requestId     = req.headers['x-request-id'] as string;

    if (webhookSecret && signature && !isDev) {
      try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        const bodyStr = rawBody.toString('utf-8');
        // MP envia: ts=<timestamp>,v1=<hash>
        const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
        const ts = parts['ts'];
        const v1 = parts['v1'];

        if (ts && v1) {
          const signedData = `id:${(body.data?.id || '')};request-id:${requestId || ''};ts:${ts};`;
          const expectedHash = crypto.createHmac('sha256', webhookSecret).update(signedData).digest('hex');
          if (expectedHash !== v1) {
            console.warn('❌ [webhook] Assinatura inválida — ignorando');
            return res.status(200).send('OK');
          }
        }
      } catch (err) {
        console.error('⚠️ [webhook] Falha ao validar HMAC:', err);
      }
    } else if (isDev) {
      console.log('⚠️ [webhook] Pulando validação HMAC (Ambiente de Teste)');
    }

    const { type, action, data } = body;
    const resourceId = data?.id;

    if (!resourceId) {
      console.log('[webhook] Sem resourceId no payload');
      return res.status(200).send('OK');
    }

    // ── Pagamento (PIX, Boleto, Cartão único) ──
    if (type === 'payment') {
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: Number(resourceId) });

      const userId = paymentData.metadata?.user_id || paymentData.external_reference;
      const planId = paymentData.metadata?.plan_id || (paymentData.transaction_amount === PLANS.premium.price ? 'premium' : 'pro');
      const status = paymentData.status;

      console.log(`🔍 [webhook] Pagamento ${resourceId} | status: ${status} | user: ${userId} | plan: ${planId}`);

      await logPaymentEvent({
        userId,
        mpPaymentId: String(resourceId),
        eventType: 'payment_notification',
        status: status || 'unknown',
        plan: planId,
        amount: paymentData.transaction_amount || undefined,
        paymentMethod: paymentData.payment_method_id || undefined,
        rawPayload: paymentData,
      });

      if ((status === 'approved' || status === 'authorized') && userId && planId) {
        console.log(`✅ [webhook] Ativando plano ${planId} para user: ${userId}`);
        await activatePlan(userId, planId, undefined, String(paymentData.payer?.id || ''));
      } else {
        console.log(`⚠️ [webhook] Pagamento não aprovado ou dados incompletos: status=${status}, user=${userId}, plan=${planId}`);
      }
    }

    // ── Assinatura Recorrente (Cartão) ──
    if (type === 'subscription_preapproval' || (type === 'preapproval' && action)) {
      const preApproval = new PreApproval(mpClient);
      const subscription = await preApproval.get({ id: String(resourceId) });

      const userId = subscription.external_reference;
      const status = subscription.status;

      console.log(`[webhook] Assinatura ${resourceId} | status: ${status} | user: ${userId}`);

      await logPaymentEvent({
        userId,
        mpSubscriptionId: String(resourceId),
        eventType: 'subscription_notification',
        status: status || 'unknown',
        rawPayload: subscription,
      });

      if (status === 'authorized' && userId) {
        // Descobre qual plano pelo valor
        const amount = subscription.auto_recurring?.transaction_amount;
        const planId = amount === PLANS.premium.price ? 'premium' : 'pro';
        await activatePlan(userId, planId, String(resourceId), String(subscription.payer_id || ''));
      }

      // Assinatura cancelada
      if ((status === 'cancelled' || status === 'paused') && userId) {
        await supabase.from('users').update({
          is_paid: false,
          subscription_status: status === 'cancelled' ? 'expired' : 'trialing',
          plan: 'trial',
        }).eq('id', userId);
        console.log(`[webhook] Assinatura ${status} para user:${userId}`);
      }
    }

  } catch (error) {
    console.error('[webhook] Erro interno:', error);
  }

  return res.status(200).send('OK');
});

// ============================================================
// CANCELAMENTO — Assinatura (Mercado Pago)
// ============================================================
app.post("/api/checkout/cancel-subscription", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "UserID não informado" });
    }

    // 1. Busca o usuário para pegar a subscription_id do Mercado Pago
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('mp_subscription_id, plan')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const subscriptionId = user.mp_subscription_id;

    // 2. Tenta cancelar no Mercado Pago se houver ID de assinatura
    if (subscriptionId) {
      try {
        const preApproval = new PreApproval(mpClient);
        await preApproval.update({
          id: subscriptionId,
          body: {
            status: 'cancelled',
          },
        });
        console.log(`[cancel] Assinatura ${subscriptionId} cancelada no MP`);
      } catch (mpErr: any) {
        console.error(`[cancel] Erro ao cancelar no MP (id:${subscriptionId}):`, mpErr.message);
        // Mesmo se falhar no MP (ex: já cancelada), seguimos para limpar no DB
      }
    }

    // 3. Atualiza o status do usuário no Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_paid: false,
        subscription_status: 'expired',
        plan: 'trial',
        cancellation_reason: reason || 'Não informado',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 4. Log do evento de cancelamento
    await logPaymentEvent({
      userId,
      mpSubscriptionId: subscriptionId,
      eventType: 'subscription_cancelled_by_user',
      status: 'cancelled',
      plan: user.plan,
      rawPayload: { reason },
    });

    return res.json({ success: true, message: "Assinatura cancelada com sucesso" });
  } catch (error: any) {
    console.error("[cancel-subscription] Erro:", error);
    return res.status(500).json({ error: "Falha ao cancelar assinatura", details: error.message });
  }
});

// ============================================================
// SUCESSO — Redirect após checkout externo (legado)
// ============================================================
app.get("/api/payment-success", async (req, res) => {
  const { preapproval_id, userId, planId } = req.query;
  try {
    if (!preapproval_id || !userId || !planId) {
      return res.redirect(`/?status=error&message=InvalidRequest`);
    }
    const preApproval = new PreApproval(mpClient);
    const subscription = await preApproval.get({ id: String(preapproval_id) });

    if (subscription.status === 'authorized' || subscription.status === 'pending') {
      await activatePlan(String(userId), String(planId), String(preapproval_id));
      return res.redirect(`/?status=success&plan=${planId}`);
    }
    return res.redirect(`/?status=error&message=NotAuthorized`);
  } catch (error) {
    console.error('[payment-success] Erro:', error);
    return res.redirect(`/?status=error&message=VerificationFailed`);
  }
});

// ============================================================
// ATIVAÇÃO MANUAL (Failsafe)
// ============================================================
app.post("/api/activate-plan", async (req, res) => {
  try {
    const { userId, planId, secret } = req.body;

    // Proteção básica para o endpoint manual
    const systemSecret = process.env.ADMIN_SECRET || 'vorix-admin-2024';
    if (secret !== systemSecret) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    if (!userId || !planId) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    await activatePlan(userId, planId);
    
    await logPaymentEvent({
      userId,
      eventType: 'manual_activation',
      status: 'active',
      plan: planId,
      rawPayload: { method: 'manual_api' }
    });

    return res.json({ success: true, message: `Plano ${planId} ativado para ${userId}` });
  } catch (error: any) {
    console.error("[activate-plan] Erro:", error);
    return res.status(500).json({ error: "Falha ao ativar plano", details: error.message });
  }
});

// ============================================================
// PDF EXPORT (mantido igual)
// ============================================================
app.post("/api/export-pdf", async (req, res) => {
  try {
    const { user, transactions, dateRange, totalBalance, monthlyIncome, monthlyExpenses, periodIncome, periodExpenses, netChange } = req.body;

    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      bufferPages: true
    });

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio-vorix-${new Date().getTime()}.pdf`);

    doc.pipe(res);

    const VORIX_ORANGE = "#ff4d00";
    const VORIX_BLACK  = "#000000";
    const VORIX_WHITE  = "#ffffff";

    doc.rect(0, 0, pageWidth, 120).fill(VORIX_BLACK);
    doc.fillColor(VORIX_ORANGE).fontSize(32).font("Helvetica-Bold").text("VORIX", 40, 40);
    doc.fillColor(VORIX_WHITE).fontSize(10).font("Helvetica").text("CENTRO DE COMANDO FINANCEIRO", 40, 78, { characterSpacing: 1.5 });

    doc.fillColor(VORIX_WHITE).fontSize(8).font("Helvetica-Bold").text("RELATÓRIO DE MOVIMENTAÇÕES", 300, 45, { align: "right", width: pageWidth - 340 });
    doc.font("Helvetica").fillColor(VORIX_WHITE).text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 300, 60, { align: "right", width: pageWidth - 340 });
    doc.moveDown(6);

    const infoY = 150;
    doc.fillColor(VORIX_BLACK).fontSize(18).font("Helvetica-Bold").text(user?.username ? user.username.toUpperCase() : "CLIENTE", 40, infoY);
    doc.fontSize(10).font("Helvetica").fillColor(VORIX_BLACK).text(`Período de Análise: ${dateRange}`, 40, infoY + 22);
    doc.strokeColor(VORIX_BLACK).lineWidth(1.5).moveTo(40, infoY + 45).lineTo(pageWidth - 40, infoY + 45).stroke();

    const summaryY = 220;
    const cardWidth = (contentWidth - 20) / 3;
    const cardHeight = 65;
    const cardSpacing = 10;

    doc.rect(40, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
    doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("SALDO TOTAL ATUAL", 50, summaryY + 15);
    doc.fillColor(VORIX_BLACK).fontSize(14).font("Helvetica-Bold").text(totalBalance || "R$ 0,00", 50, summaryY + 35);

    doc.rect(40 + cardWidth + cardSpacing, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
    doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("ENTRADAS NO PERÍODO", 40 + cardWidth + cardSpacing + 10, summaryY + 15);
    doc.fillColor(VORIX_ORANGE).fontSize(14).font("Helvetica-Bold").text(periodIncome || "R$ 0,00", 40 + cardWidth + cardSpacing + 10, summaryY + 35);

    doc.rect(40 + (cardWidth + cardSpacing) * 2, summaryY, cardWidth, cardHeight).stroke(VORIX_BLACK);
    doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold").text("SAÍDAS NO PERÍODO", 40 + (cardWidth + cardSpacing) * 2 + 10, summaryY + 15);
    doc.fillColor(VORIX_BLACK).fontSize(14).font("Helvetica-Bold").text(periodExpenses || "R$ 0,00", 40 + (cardWidth + cardSpacing) * 2 + 10, summaryY + 35);

    const bannerY = 310;
    doc.rect(40, bannerY, contentWidth, 40).fill(VORIX_BLACK);
    doc.fillColor(VORIX_WHITE).fontSize(9).font("Helvetica").text("RESULTADO LÍQUIDO DO PERÍODO:", 60, bannerY + 15);
    doc.fillColor(VORIX_ORANGE).fontSize(12).font("Helvetica-Bold").text(netChange || "R$ 0,00", 230, bannerY + 14);
    doc.moveDown(5);

    if (transactions && transactions.length > 0) {
      const table = {
        title: "HISTÓRICO DETALHADO",
        subtitle: "Listagem cronológica de todas as movimentações identificadas no período.",
        headers: [
          { label: "DATA",       property: "date",        width: 65,  headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "DESCRIÇÃO",  property: "description", width: 160, headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "CONTA",      property: "accountName", width: 80,  headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "CATEGORIA",  property: "category",    width: 80,  headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "TIPO",       property: "type",        width: 55,  headerColor: VORIX_BLACK, headerOpacity: 1 },
          { label: "VALOR",      property: "amount",      width: 75,  headerColor: VORIX_BLACK, headerOpacity: 1 },
        ],
        datas: transactions.map((t: any) => ({
          date:        t.dateFormatted,
          description: t.description,
          accountName: t.accountName,
          category:    t.category,
          type:        t.type === "income" ? "ENTRADA" : "SAÍDA",
          amount:      `${t.type === "income" ? "+" : "-"} ${t.amountFormatted}`,
        })),
      };

      await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7).fillColor(VORIX_WHITE),
        prepareRow: (_row, indexColumn) => {
          doc.font("Helvetica").fontSize(7).fillColor(VORIX_BLACK);
          if (indexColumn === 5) {
            if (_row.type === "ENTRADA") doc.fillColor(VORIX_ORANGE).font("Helvetica-Bold");
            else doc.fillColor(VORIX_BLACK).font("Helvetica-Bold");
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
          header:     { disabled: false, width: 2,   opacity: 1   },
          horizontal: { disabled: false, width: 0.5, opacity: 0.1 },
        },
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor(VORIX_BLACK).lineWidth(1)
        .moveTo(40, doc.page.height - 60)
        .lineTo(pageWidth - 40, doc.page.height - 60)
        .stroke();

      doc.fillColor(VORIX_BLACK).fontSize(7).font("Helvetica-Bold")
        .text(
          `PÁGINA ${i + 1} DE ${range.count}  |  VORIX FINANCIAL COMMAND CENTER  |  RELATÓRIO CONFIDENCIAL`,
          40, doc.page.height - 45,
          { align: "center", characterSpacing: 1, width: contentWidth }
        );
    }

    doc.end();
  } catch (error) {
    console.error("PDF Export Error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ============================================================
// RADAR — Dados de Mercado em tempo real
// ============================================================

// Cache em memória (60 min)
let radarCache: { data: any; ts: number } | null = null;
const RADAR_TTL = 60 * 60 * 1000; // 60 minutos

app.get('/api/radar-data', async (_req, res) => {
  try {
    const now = Date.now();
    if (radarCache && now - radarCache.ts < RADAR_TTL) {
      return res.json({ success: true, cached: true, ...radarCache.data });
    }

    // 1. AwesomeAPI: USD + BTC
    const awesomeRes = await fetch(
      `https://economia.awesomeapi.com.br/json/last/USD-BRL,BTC-BRL?t=${now}`
    );
    const awesomeData: any = await awesomeRes.json();

    // 2. Yahoo Finance server-side: PETR4 + IBOV
    const fetchYahoo = async (ticker: string) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`;
        const yRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!yRes.ok) throw new Error(`Yahoo status: ${yRes.status}`);
        const yData: any = await yRes.json();
        const meta = yData?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No meta');
        const price = meta.regularMarketPrice ?? 0;
        const prev  = meta.previousClose ?? meta.chartPreviousClose ?? price;
        return { price, prev };
      } catch (e) {
        console.warn(`Yahoo fetch failed for ${ticker}:`, e);
        return null;
      }
    };

    const [petrRaw] = await Promise.all([
      fetchYahoo('PETR4.SA'),
    ]);

    const pct = (price: number, prev: number) =>
      prev > 0 ? (((price - prev) / prev) * 100).toFixed(2) : '0.00';

    const payload = {
      usd: {
        bid:       Number(awesomeData.USDBRL?.high || awesomeData.USDBRL?.bid || 0).toFixed(2),
        pctChange: Number(awesomeData.USDBRL?.pctChange || 0).toFixed(2),
        name: 'Dólar Comercial',
      },
      btc: {
        bid:       Number(awesomeData.BTCBRL?.high || awesomeData.BTCBRL?.bid || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
        pctChange: Number(awesomeData.BTCBRL?.pctChange || 0).toFixed(2),
        name: 'Bitcoin',
      },
      stock: {
        bid:       petrRaw ? petrRaw.price.toFixed(2) : '—',
        pctChange: petrRaw ? pct(petrRaw.price, petrRaw.prev) : '0.00',
        name: 'Petrobras PN',
        symbol: 'PETR4',
      },
      updatedAt: new Date().toISOString(),
    };

    radarCache = { data: payload, ts: now };
    return res.json({ success: true, cached: false, ...payload });
  } catch (error: any) {
    console.error('Radar data error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// RADAR — Notícias Reais de Mercado  (cache diário)
// ============================================================

interface RadarNews {
  headline: string;
  source:   string;
  url:      string;
  pubDate:  string;
  tag:      string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

let newsCache: { data: RadarNews[]; date: string } | null = null;

function detectTag(text: string): string {
  const t = text.toLowerCase();
  if (/dólar|câmbio|real|usdbrl/.test(t))                           return 'Câmbio';
  if (/ibovespa|bolsa|\bação\b|ações|b3/.test(t))                   return 'Bolsa';
  if (/selic|copom|juro|inflação|ipca/.test(t))                     return 'Juros';
  if (/bitcoin|cripto|crypto|btc|ethereum/.test(t))                 return 'Cripto';
  if (/petro|valeria3|vale|itub|wege|hapv/.test(t))                 return 'Ações';
  if (/tesouro|fii|fundo imobiliário|cdb|renda fixa/.test(t))       return 'Investimento';
  return 'Mercado';
}

function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const t = text.toLowerCase();
  const pos = /sobe|alta|cresce|avança|lucro|recorde|recupera|positivo|ganho|valoriza/.test(t);
  const neg = /\bcai\b|queda|baixa|recuo|perde|negativo|crise|desacelera|pressão|risco|tensão/.test(t);
  if (pos && !neg) return 'positive';
  if (neg && !pos) return 'negative';
  return 'neutral';
}

app.get('/api/radar-news', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Cache diário
    if (newsCache && newsCache.date === today) {
      return res.json({ success: true, news: newsCache.data, cached: true });
    }

    // ── 1. Tenta Google News RSS (PT-BR Brasil, foco em finanças) ──
    const queries = [
      'mercado+financeiro+bolsa+brasil',
      'ibovespa+dólar+investimentos+brasil',
    ];

    let parsed: RadarNews[] = [];

    for (const q of queries) {
      if (parsed.length >= 2) break;
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const rssRes = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vorix/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!rssRes.ok) continue;

        const xml  = await rssRes.text();
        const rawItems = xml.split('<item>').slice(1, 8);

        for (const item of rawItems) {
          if (parsed.length >= 3) break;

          // Title (CDATA ou texto normal)
          const titleM = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
          const rawTitle = titleM ? titleM[1].replace(/<[^>]*>/g, '').trim() : '';
          if (!rawTitle || rawTitle.length < 10) continue;

          // Remove " - Fonte" do final
          const parts    = rawTitle.split(' - ');
          const headline = parts.slice(0, -1).join(' - ').trim() || rawTitle;
          const source   = parts.at(-1)?.trim() || 'Notícia';

          // Link
          const linkM = item.match(/<link>([\s\S]*?)<\/link>/);
          const url   = linkM ? linkM[1].trim() : '';

          // Data
          const dateM   = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
          const dateStr = dateM
            ? new Date(dateM[1]).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
            : new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

          if (headline.length < 15) continue;

          parsed.push({
            headline,
            source,
            url,
            pubDate:   dateStr,
            tag:       detectTag(headline),
            sentiment: detectSentiment(headline),
          });
        }
      } catch (e) {
        console.warn('RSS query failed:', q, e);
      }
    }

    // ── 2. Fallback: dados estáticos atualizados diariamente ──
    if (parsed.length < 2) {
      const fallback: RadarNews[] = [
        {
          headline:  'Ibovespa opera em recuperação com suporte de blue chips',
          source:    'Vorix Finance',
          url:       'https://www.infomoney.com.br',
          pubDate:   new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          tag:       'Bolsa',
          sentiment: 'positive',
        },
        {
          headline:  'Dólar oscila com agenda de dados econômicos nos EUA',
          source:    'Vorix Finance',
          url:       'https://www.infomoney.com.br',
          pubDate:   new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          tag:       'Câmbio',
          sentiment: 'neutral',
        },
      ];
      parsed = [...parsed, ...fallback].slice(0, 2);
    }

    const news = parsed.slice(0, 2);
    newsCache = { data: news, date: today };
    return res.json({ success: true, news, cached: false });
  } catch (error: any) {
    console.error('Radar news error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// WHATSAPP — Notificações e Alertas Criativos via IA
// ============================================================

async function sendWhatsAppMessage(phone: string, text: string) {
  // Integre o provedor do WhatsApp desejado aqui (Evolution API, Twilio, Z-API, etc.)
  const apiUrl = process.env.WHATSAPP_API_URL; 
  const apiKey = process.env.WHATSAPP_API_KEY; 
  const instance = process.env.WHATSAPP_INSTANCE || 'vorix';

  if (!apiUrl || !apiKey) {
    // Modo de mock para teste local ou quando não configurado
    console.log(`\n=========================================\n📲 [WhatsApp para ${phone}]: \n\n${text}\n=========================================\n(Configure as variáveis WHATSAPP_API_URL e WHATSAPP_API_KEY no .env para envios reais)\n`);
    return { success: true, mock: true }; 
  }

  try {
    // Exemplo de Payload para Evolution API (muito usada no BR)
    const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: phone,
        text: text
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error(`Erro ao enviar WhatsApp:`, err);
      return { success: false, error: err };
    }
    return { success: true, mock: false };
  } catch (error: any) {
    console.error(`Falha no fetch do WhatsApp:`, error.message);
    return { success: false, error: error.message };
  }
}

app.post('/api/whatsapp/notify', async (req, res) => {
  try {
    const { phone, username, notificationType, customData } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Número de WhatsApp obrigatório" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || '' });
    let prompt = '';

    if (notificationType === 'welcome') {
      prompt = `Crie uma primeira mensagem de boas-vindas incrivelmente criativa, dinâmica e empolgante para mandar no WhatsApp do usuário chamado "${username}". Você é o Assistente Vorix IA. Use emojis, um tom muito amigável, e dê já uma dica financeira inicial de presente. Tem que parecer uma mensagem real de WhatsApp, formatada com asteriscos para *negrito*. Seja breve mas impactante.`;
    } else if (notificationType === 'expense_alert') {
      prompt = `Crie um alerta de WhatsApp criativo e amigável (como um assistente financeiro premium) para "${username}". Baseado em: ${JSON.stringify(customData)}. Mostre que você está de olho na conta e dê um conselho imediato de economia, use emojis.`;
    } else {
      prompt = `Escreva uma notificação rápida e criativa de WhatsApp para o usuário "${username}" para o assunto: ${notificationType}.`;
    }

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: 800, temperature: 0.8 }
    });

    const messageText = aiResponse.text;
    if (!messageText) throw new Error("IA retornou vazio");

    // Envia efetivamente
    const result = await sendWhatsAppMessage(phone, messageText);
    
    if (!result.success) {
      return res.status(500).json({ error: "Falha ao enviar mensagem", details: result.error });
    }

    return res.json({ success: true, mock: result.mock, message: "Notificação despachada!" });
  } catch (error: any) {
    console.error("[whatsapp/notify] Erro geral:", error.message);
    return res.status(500).json({ error: "Erro de processamento da notificação" });
  }
});

export default app;
