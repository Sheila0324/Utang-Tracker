// ============================================================
// SUPABASE EDGE FUNCTION: send-reminders
// Deploy with: supabase functions deploy send-reminders
//
// This function runs on a schedule (every hour via pg_cron
// or Supabase CRON) and sends FCM push notifications to all
// registered devices when a debt installment is due soon.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── STEP 2: Set these as Supabase Edge Function secrets ────
// Run: supabase secrets set FCM_SERVER_KEY=your_server_key
// Get FCM_SERVER_KEY from: Firebase Console → Project Settings
// → Cloud Messaging → Server key (Legacy) OR use the newer
// service account JSON for V1 API (see comments below).
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY") || "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")   || "";
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// ────────────────────────────────────────────────────────────

const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

interface Reminder {
  daysBefore: number;
  time: string; // "HH:MM"
}

interface DebtSchedule {
  enabled: boolean;
  dueDay: number;
  numMonths: number;
  startYear: number;
  startMonth: number;
  monthlyAmount: number;
  reminderEnabled: boolean;
  reminders: Reminder[];
  paidInstallments: number[];
}

interface Debt {
  id: string;
  name: string;
  total: number;
  schedule: DebtSchedule | null;
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(n: number): string {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });
}

async function sendFCMPush(token: string, title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(FCM_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `key=${FCM_SERVER_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
        data: { tag: "utang-reminder", url: "./" },
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } },
      }),
    });
    const json = await res.json();
    console.log("[FCM] Response:", JSON.stringify(json));
    return json.success === 1;
  } catch (e) {
    console.error("[FCM] Error sending push:", e);
    return false;
  }
}

serve(async (_req) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Load all debts and push tokens
    const [{ data: debts, error: debtsErr }, { data: tokens, error: tokensErr }] = await Promise.all([
      sb.from("debts").select("*"),
      sb.from("push_tokens").select("token"),
    ]);

    if (debtsErr) throw debtsErr;
    if (tokensErr) throw tokensErr;

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No push tokens registered" }), { status: 200 });
    }

    const now          = new Date();
    const currentHour  = now.getHours();
    const currentMin   = now.getMinutes();
    const tokenList    = tokens.map((t: { token: string }) => t.token);

    let pushCount = 0;

    for (const debt of (debts as Debt[] || [])) {
      if (!debt.schedule?.enabled || !debt.schedule?.reminderEnabled) continue;

      const { dueDay = 15, numMonths = 1, startYear, startMonth, monthlyAmount = 0, paidInstallments = [], reminders = [] } = debt.schedule;

      for (let i = 0; i < numMonths; i++) {
        if ((paidInstallments || []).includes(i)) continue;

        let m = startMonth + i;
        let y = startYear + Math.floor(m / 12);
        m = m % 12;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day     = Math.min(dueDay, lastDay);
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const days    = daysUntil(dateStr);

        for (const rem of reminders) {
          const daysBefore = parseInt(String(rem.daysBefore ?? 1));
          if (days !== daysBefore) continue;

          // Check time window: send if we're within the reminder hour
          const [remHour, remMin] = (rem.time || "09:00").split(":").map(Number);
          if (currentHour !== remHour) continue;
          if (currentMin > remMin + 5) continue; // 5-min window

          const dedupKey = `notif_${debt.id}_${i}_${dateStr}_${rem.daysBefore}_${rem.time}`;
          const { data: already } = await sb
            .from("push_tokens")
            .select("id")
            .eq("sent_key", dedupKey)
            .limit(1);

          // Build message
          const amtStr = formatCurrency(monthlyAmount);
          const title  = "💸 Utang Tracker";
          const body   = daysBefore === 0
            ? `Payment DUE TODAY: ${debt.name} — ${amtStr}`
            : `Payment in ${daysBefore} day${daysBefore > 1 ? "s" : ""}: ${debt.name} — ${amtStr}`;

          // Send to all registered devices
          for (const token of tokenList) {
            const sent = await sendFCMPush(token, title, body);
            if (sent) pushCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${pushCount} push notification(s)` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-reminders] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
