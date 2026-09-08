import { ApiError } from "../../utils/apiError";
import { cassoConfig } from "../../config/casso";
import { countPendingGatewayPayments } from "./payments.repo";
import { confirmGatewayPaymentByRequestId } from "./payments.service";

type CassoTransaction = {
  id: string;
  amount: number;
  description: string;
  order: string | null;
  tid: string | null;
  when: string | null;
  raw: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCassoSyncEnabled() {
  return !!cassoConfig.apiKey && !!cassoConfig.bankAccId;
}

function extractRequestIds(input: string): string[] {
  const matches = String(input || "")
    .toUpperCase()
    .match(/VQR\d{10}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function normalizeTransaction(raw: unknown): CassoTransaction | null {
  if (!isRecord(raw)) return null;

  const amount = Number(raw.amount ?? 0);
  const description = String(raw.description ?? "").trim();
  const order = raw.order == null ? null : String(raw.order).trim() || null;
  const id = String(raw.id ?? raw.tid ?? order ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!description && !order) return null;

  return {
    id: id || `tx-${Date.now()}`,
    amount,
    description,
    order,
    tid: raw.tid == null ? null : String(raw.tid),
    when: raw.when == null ? null : String(raw.when),
    raw,
  };
}

function normalizeTransactions(input: unknown): CassoTransaction[] {
  if (Array.isArray(input)) {
    return input
      .map((transaction) => normalizeTransaction(transaction))
      .filter((transaction): transaction is CassoTransaction => !!transaction);
  }

  const single = normalizeTransaction(input);
  return single ? [single] : [];
}

function getRecentTransactionFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

async function fetchRecentTransactions(): Promise<CassoTransaction[]> {
  const query = new URLSearchParams({
    sort: "DESC",
    page: "1",
    pageSize: "100",
    fromDate: getRecentTransactionFromDate(),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://oauth.casso.vn/v2/transactions?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Apikey ${cassoConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Casso transactions failed with ${response.status}: ${body || response.statusText}`
      );
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const records = isRecord(payload?.data)
      ? payload?.data?.records
      : payload?.data;

    return normalizeTransactions(records);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestCassoSync(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://oauth.casso.vn/v2/sync", {
      method: "POST",
      headers: {
        Authorization: `Apikey ${cassoConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bank_acc_id: cassoConfig.bankAccId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Casso sync failed with ${response.status}: ${body || response.statusText}`
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function reconcileCassoTransactions(input: unknown) {
  const transactions = normalizeTransactions(input);
  let matched = 0;

  for (const transaction of transactions) {
    const requestIds = extractRequestIds(
      [transaction.description, transaction.order || ""].join(" ")
    );

    for (const requestId of requestIds) {
      const result = await confirmGatewayPaymentByRequestId({
        requestId,
        providerOrderId: transaction.tid || `CASSO-${transaction.id}`,
        expectedAmount: transaction.amount,
        rawResponse: {
          provider: "casso",
          transactionId: transaction.id,
          transaction,
        },
      });

      if (result.ok) {
        matched += 1;
      }
    }
  }

  return {
    received: transactions.length,
    matched,
  };
}

let lastRecentPullAt = 0;
let recentPullPromise: Promise<{ received: number; matched: number }> | null = null;
let lastSyncAt = 0;
let syncPromise: Promise<void> | null = null;

async function syncCassoIfAllowed() {
  const now = Date.now();
  if (syncPromise) {
    await syncPromise;
    return;
  }

  if (now - lastSyncAt < 60_000) {
    return;
  }

  syncPromise = (async () => {
    await requestCassoSync();
    lastSyncAt = Date.now();
  })();

  try {
    await syncPromise;
  } finally {
    syncPromise = null;
  }
}

export async function reconcileRecentCassoTransactions(options?: {
  includeSync?: boolean;
  minPullIntervalMs?: number;
}) {
  if (!isCassoSyncEnabled()) {
    return { received: 0, matched: 0 };
  }

  if (options?.includeSync) {
    try {
      await syncCassoIfAllowed();
    } catch (error) {
      console.error("[payment-reconcile] Casso sync failed:", error);
    }
  }

  const now = Date.now();
  const minPullIntervalMs = Math.max(2_000, options?.minPullIntervalMs ?? 5_000);

  if (recentPullPromise) {
    return recentPullPromise;
  }

  if (now - lastRecentPullAt < minPullIntervalMs) {
    return { received: 0, matched: 0 };
  }

  recentPullPromise = (async () => {
    const transactions = await fetchRecentTransactions();
    const result = await reconcileCassoTransactions(transactions);
    lastRecentPullAt = Date.now();
    return result;
  })();

  try {
    return await recentPullPromise;
  } finally {
    recentPullPromise = null;
  }
}

export async function handleCassoWebhook(params: {
  secureToken?: string | null;
  body: unknown;
}) {
  if (
    cassoConfig.webhookSecureToken &&
    params.secureToken !== cassoConfig.webhookSecureToken
  ) {
    throw new ApiError(401, "Invalid Casso secure token");
  }

  const payload = isRecord(params.body) ? params.body : {};
  const errorCode = Number(payload.error ?? 0);
  if (Number.isFinite(errorCode) && errorCode !== 0) {
    return { ok: true, received: 0, matched: 0 };
  }

  const result = await reconcileCassoTransactions(payload.data ?? payload);
  return { ok: true, ...result };
}

export async function runPaymentReconciliationSweepOnce() {
  if (!isCassoSyncEnabled()) return;

  const pendingCount = await countPendingGatewayPayments();
  if (pendingCount <= 0) return;

  try {
    await reconcileRecentCassoTransactions({ includeSync: true, minPullIntervalMs: 10_000 });
  } catch (error) {
    console.error("[payment-reconcile] Casso sync failed:", error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startPaymentReconciliationSweep(): void {
  if (!isCassoSyncEnabled()) {
    console.log(
      "[payment-reconcile] disabled (missing CASSO_API_KEY or CASSO_BANK_ACC_ID)"
    );
    return;
  }

  if (cassoConfig.syncIntervalMs <= 0) {
    console.log("[payment-reconcile] disabled by CASSO_SYNC_INTERVAL_MS");
    return;
  }

  if (intervalId) return;

  const intervalMs = Math.max(60000, cassoConfig.syncIntervalMs);
  void runPaymentReconciliationSweepOnce();
  intervalId = setInterval(() => {
    void runPaymentReconciliationSweepOnce();
  }, intervalMs);
  intervalId.unref?.();

  console.log(`[payment-reconcile] sync every ${intervalMs}ms`);
}
