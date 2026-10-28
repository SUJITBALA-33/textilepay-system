import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: Deno.env.get("ALLOWED_ORIGIN") || "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
  }),
);

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

function hasBillingAccess(company: any) {
  const now = Date.now();
  if (["trial", "pending"].includes(company.subscription_state)) {
    return Date.parse(company.trial_ends_at) > now;
  }
  return ["active", "past_due", "cancelled", "halted"].includes(company.subscription_state)
    && company.subscription_period_end
    && Date.parse(company.subscription_period_end) > now;
}

async function authenticate(c: any, allowBillingBlocked = false) {
  const authorization = c.req.header("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");

  const client = admin();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHORIZED");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new Error("PROFILE_NOT_FOUND");
  if (profile.status !== "approved") throw new Error("ACCOUNT_NOT_APPROVED");
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id, name, status, subscription_state, trial_ends_at, subscription_period_end, subscription_cancel_at_period_end, razorpay_subscription_id")
    .eq("id", profile.company_id)
    .single();
  if (companyError) {
    console.error("Unable to load company billing fields. Check that the subscription migrations have been applied.", companyError);
    throw new Error("BILLING_CONFIGURATION_REQUIRED");
  }
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  if (!["active", "trial"].includes(company.status)) throw new Error("COMPANY_INACTIVE");
  if (!allowBillingBlocked && !hasBillingAccess(company)) throw new Error("SUBSCRIPTION_REQUIRED");
  return { client, user, profile, company };
}

function fail(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return c.json({ error: "Authentication required" }, 401);
  if (message === "PROFILE_NOT_FOUND") return c.json({ error: "User profile is not configured" }, 403);
  if (message === "COMPANY_NOT_FOUND") return c.json({ error: "Company is not configured" }, 403);
  if (message === "BILLING_CONFIGURATION_REQUIRED") return c.json({ error: "Company billing is not configured. Apply the latest Supabase migrations and redeploy this Edge Function.", code: message }, 503);
  if (message === "COMPANY_INACTIVE") return c.json({ error: "Company subscription is not active" }, 403);
  if (message === "SUBSCRIPTION_REQUIRED") return c.json({ error: "Your TextilePay plan has expired. Renew to continue." }, 402);
  if (message === "ACCOUNT_NOT_APPROVED") return c.json({ error: "Your account is awaiting company approval or is no longer active." }, 403);
  if (message.startsWith("Cross-company")) return c.json({ error: message }, 403);
  console.error("TextilePay API error", error);
  return c.json({ error: "Unable to process the request" }, 500);
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function razorpayHeaders(keyId: string, keySecret: string) {
  return {
    Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
    "Content-Type": "application/json",
  };
}

async function razorpayRequest(path: string, method: string, body?: unknown) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Billing is not configured. Ask the platform administrator to finish Razorpay setup.");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: razorpayHeaders(keyId, keySecret),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Razorpay API request failed", response.status, result?.error?.code);
    throw new Error("Razorpay could not process the subscription request. Try again later.");
  }
  return result;
}

function toUser(profile: any, privateProfile?: any) {
  return {
    id: profile.id,
    companyId: profile.company_id,
    email: profile.email,
    name: profile.name,
    mobile: profile.mobile,
    username: profile.username,
    address: privateProfile?.address ?? "",
    aadhaar: privateProfile?.aadhaar ?? "",
    bankDetails: privateProfile?.bank_details ?? "",
    upi: privateProfile?.upi ?? "",
    emergencyContact: privateProfile?.emergency_contact ?? "",
    dob: privateProfile?.dob ?? "",
    joinDate: privateProfile?.join_date ?? "",
    role: profile.role,
    status: profile.status,
    pfEnabled: profile.pf_enabled,
    esiEnabled: profile.esi_enabled,
    section: profile.section ?? undefined,
    payType: profile.pay_type ?? undefined,
    dailyRate: Number(profile.daily_rate),
    hourlyOT: Number(profile.hourly_ot),
    workDays: profile.work_days,
    monthlySalary: Number(profile.monthly_salary),
  };
}

async function loadDatabase(client: ReturnType<typeof admin>, viewer: any, company: any) {
  const [
    profilesResult,
    privateResult,
    ordersResult,
    ratesResult,
    sectionsResult,
    attendanceResult,
    submissionsResult,
    paymentsResult,
    settingsResult,
  ] = await Promise.all([
    client.from("profiles").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("profile_private").select("*").eq("company_id", viewer.company_id),
    client.from("orders").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("piece_rates").select("*").eq("company_id", viewer.company_id),
    client.from("company_sections").select("*").eq("company_id", viewer.company_id).order("position"),
    client.from("attendance").select("*").eq("company_id", viewer.company_id),
    client.from("submissions").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("payments").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("app_settings").select("*").eq("company_id", viewer.company_id).single(),
  ]);

  [
    profilesResult.error,
    privateResult.error,
    ordersResult.error,
    ratesResult.error,
    sectionsResult.error,
    attendanceResult.error,
    submissionsResult.error,
    paymentsResult.error,
    settingsResult.error,
  ].forEach(assertNoError);

  const profiles = profilesResult.data ?? [];
  const visibleProfiles = viewer.role === "owner"
    ? profiles
    : viewer.role === "manager"
      ? profiles.filter((profile) => profile.id === viewer.id || profile.role === "worker")
      : profiles.filter((profile) => profile.id === viewer.id);
  const visibleIds = new Set(visibleProfiles.map((profile) => profile.id));
  const privateByUser = new Map(
    (privateResult.data ?? [])
      .filter((row) => viewer.role === "owner" || row.user_id === viewer.id)
      .map((row) => [row.user_id, row]),
  );
  const canSeeOperations = viewer.role !== "worker";

  const attendance: Record<string, Record<string, { present: number; otHours: number }>> = {};
  for (const row of attendanceResult.data ?? []) {
    if (!canSeeOperations && row.worker_id !== viewer.id) continue;
    attendance[row.worker_id] ??= {};
    attendance[row.worker_id][row.month] = {
      present: row.present,
      otHours: Number(row.ot_hours),
    };
  }

  return {
    company,
    users: visibleProfiles.map((profile) => toUser(profile, privateByUser.get(profile.id))),
    orders: (ordersResult.data ?? []).map((order) => ({
      id: order.id,
      name: order.name,
      target: order.target,
      revenue: Number(order.revenue),
      costs: Number(order.costs),
      stages: order.stage_values ?? { S1: order.s1, S2: order.s2, S3: order.s3, S4: order.s4, S5: order.s5, S6: order.s6 },
      createdAt: order.created_at,
      status: order.status,
    })),
    pieceRates: Object.fromEntries((ratesResult.data ?? []).map((row) => [row.section, Number(row.rate)])),
    sections: (sectionsResult.data ?? []).map((row) => ({
      code: row.code,
      name: row.name,
      position: row.position,
      active: row.active,
    })),
    attendance,
    submissions: (submissionsResult.data ?? [])
      .filter((row) => canSeeOperations || row.user_id === viewer.id)
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        orderId: row.order_id,
        section: row.section,
        pieces: row.pieces,
        note: row.note,
        timestamp: row.created_at,
        month: row.month,
      })),
    payments: (paymentsResult.data ?? [])
      .filter((row) => viewer.role === "owner" || row.user_id === viewer.id)
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        month: row.month,
        base: Number(row.base),
        ot: Number(row.ot),
        gross: Number(row.gross),
        poolShare: Number(row.pool_share),
        finalPay: Number(row.final_pay),
        pf: Number(row.pf),
        esiEmployee: Number(row.esi_employee),
        esiEmployer: Number(row.esi_employer),
        net: Number(row.net),
        paid: row.paid,
        paidAt: row.paid_at ?? undefined,
      })),
    settings: {
      ownerReservePercent: Number(settingsResult.data.owner_reserve_percent),
      otMultiplier: Number(settingsResult.data.ot_multiplier),
      maxHours: Number(settingsResult.data.max_hours),
    },
  };
}

function profileRow(user: any, companyId: string) {
  return {
    id: user.id,
    company_id: companyId,
    email: user.email,
    username: user.username,
    name: user.name,
    mobile: user.mobile ?? "",
    role: user.role,
    status: user.status,
    section: user.role === "worker" ? user.section : null,
    pay_type: user.role === "worker" ? user.payType ?? "piece" : null,
    daily_rate: Number(user.dailyRate ?? 0),
    hourly_ot: Number(user.hourlyOT ?? 0),
    work_days: Number(user.workDays ?? 26),
    monthly_salary: Number(user.monthlySalary ?? 0),
    pf_enabled: user.pfEnabled !== false,
    esi_enabled: user.esiEnabled !== false,
  };
}

function privateRow(user: any, companyId: string) {
  return {
    user_id: user.id,
    company_id: companyId,
    address: user.address ?? "",
    aadhaar: user.aadhaar ?? "",
    bank_details: user.bankDetails ?? "",
    upi: user.upi ?? "",
    emergency_contact: user.emergencyContact ?? "",
    dob: user.dob || null,
    join_date: user.joinDate || null,
  };
}

function orderRow(order: any, companyId: string) {
  return {
    id: order.id,
    company_id: companyId,
    name: order.name,
    target: Number(order.target),
    revenue: Number(order.revenue),
    costs: Number(order.costs),
    s1: Number(order.stages?.S1 ?? 0),
    s2: Number(order.stages?.S2 ?? 0),
    s3: Number(order.stages?.S3 ?? 0),
    s4: Number(order.stages?.S4 ?? 0),
    s5: Number(order.stages?.S5 ?? 0),
    s6: Number(order.stages?.S6 ?? 0),
    stage_values: order.stages ?? {},
    status: order.status,
    created_at: order.createdAt,
  };
}

function validateOrderPipeline(orders: any[], sectionRows: any[]) {
  const activeCodes = sectionRows
    .filter((section) => section.active)
    .sort((a, b) => a.position - b.position)
    .map((section) => section.code as string);
  if (!activeCodes.length) throw new Error("Company must retain an active production section");
  for (const order of orders) {
    let previous = Number(order.target);
    if (!Number.isInteger(previous) || previous < 0) throw new Error("Invalid order target");
    for (const code of activeCodes) {
      const value = Number(order.stages?.[code] ?? 0);
      if (!Number.isInteger(value) || value < 0 || value > previous) {
        throw new Error("Production counts must be whole numbers within the previous stage capacity");
      }
      previous = value;
    }
    for (const value of Object.values(order.stages ?? {})) {
      if (!Number.isInteger(Number(value)) || Number(value) < 0) {
        throw new Error("Production counts must be non-negative whole numbers");
      }
    }
  }
}

async function assertCompanyUsers(
  client: ReturnType<typeof admin>,
  companyId: string,
  userIds: string[],
) {
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) return;
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .in("id", uniqueIds);
  assertNoError(error);
  if ((data ?? []).length !== uniqueIds.length) throw new Error("Cross-company user reference rejected");
}

async function saveOwnerDatabase(
  client: ReturnType<typeof admin>,
  ownerId: string,
  companyId: string,
  data: any,
) {
  const sections = Array.isArray(data.sections) ? data.sections : [];
  if (sections.length) {
    if (!sections.some((section: any) => section.active)) throw new Error("Company must retain an active production section");
    if (new Set(sections.map((section: any) => section.code)).size !== sections.length) throw new Error("Duplicate company section code");
    if (new Set(sections.map((section: any) => Number(section.position))).size !== sections.length) throw new Error("Section order must not contain duplicates");
    if (new Set(sections.map((section: any) => String(section.name).trim().toLowerCase())).size !== sections.length) throw new Error("Company section names must be unique");
    for (const section of sections) {
      if (!/^S[0-9]+$/.test(section.code) || !String(section.name).trim() || section.name.length > 80 || !Number.isInteger(Number(section.position)) || Number(section.position) < 1) {
        throw new Error("Invalid company section configuration");
      }
    }
    assertNoError((await client.from("company_sections").upsert(
      sections.map((section: any) => ({
        company_id: companyId,
        code: section.code,
        name: String(section.name).trim(),
        position: Number(section.position),
        active: Boolean(section.active),
      })),
    )).error);
  }

  const { data: sectionRows, error: sectionLoadError } = await client
    .from("company_sections")
    .select("code, position, active")
    .eq("company_id", companyId);
  assertNoError(sectionLoadError);
  validateOrderPipeline(data.orders, sectionRows ?? []);

  const users = data.users.filter((user: any) => user.id && user.email);
  const userIds = users.map((user: any) => user.id);
  if (userIds.length) {
    const { data: foundUsers, error } = await client.from("profiles").select("id, company_id").in("id", userIds);
    assertNoError(error);
    if ((foundUsers ?? []).some((user) => user.company_id !== companyId)) {
      throw new Error("Cross-company user update rejected");
    }
  }
  assertNoError((await client.from("profiles").upsert(users.map((user: any) => profileRow(user, companyId)))).error);
  assertNoError((await client.from("profile_private").upsert(users.map((user: any) => privateRow(user, companyId)))).error);

  const { data: existingUsers, error: existingUsersError } = await client
    .from("profiles")
    .select("id")
    .eq("company_id", companyId);
  assertNoError(existingUsersError);
  const retainedIds = new Set(users.map((user: any) => user.id));
  for (const existing of existingUsers ?? []) {
    if (existing.id !== ownerId && !retainedIds.has(existing.id)) {
      const { error } = await client.auth.admin.deleteUser(existing.id);
      assertNoError(error);
    }
  }

  const orders = data.orders.map((order: any) => orderRow(order, companyId));
  const orderIds = orders.map((order: any) => order.id);
  if (orderIds.length) {
    const { data: foundOrders, error } = await client.from("orders").select("id, company_id").in("id", orderIds);
    assertNoError(error);
    if ((foundOrders ?? []).some((order) => order.company_id !== companyId)) {
      throw new Error("Cross-company order update rejected");
    }
  }
  if (orders.length) assertNoError((await client.from("orders").upsert(orders)).error);
  const { data: existingOrders, error: existingOrdersError } = await client
    .from("orders")
    .select("id")
    .eq("company_id", companyId);
  assertNoError(existingOrdersError);
  const retainedOrders = new Set(orders.map((order: any) => order.id));
  for (const existing of existingOrders ?? []) {
    if (!retainedOrders.has(existing.id)) {
      assertNoError((await client.from("orders").delete().eq("id", existing.id).eq("company_id", companyId)).error);
    }
  }

  assertNoError((await client.from("piece_rates").upsert(
    Object.entries(data.pieceRates).map(([section, rate]) => ({ company_id: companyId, section, rate })),
  )).error);
  assertNoError((await client.from("app_settings").upsert({
    company_id: companyId,
    singleton: true,
    owner_reserve_percent: data.settings.ownerReservePercent,
    ot_multiplier: data.settings.otMultiplier,
    max_hours: data.settings.maxHours,
  })).error);

  const attendanceRows = Object.entries(data.attendance).flatMap(([workerId, months]: [string, any]) =>
    Object.entries(months).map(([month, value]: [string, any]) => ({
      company_id: companyId,
      worker_id: workerId,
      month,
      present: Number(value.present),
      ot_hours: Number(value.otHours),
    }))
  );
  if (attendanceRows.length) {
    await assertCompanyUsers(client, companyId, attendanceRows.map((row) => row.worker_id));
    assertNoError((await client.from("attendance").upsert(attendanceRows)).error);
  }

  const paymentRows = data.payments.map((payment: any) => ({
    id: payment.id,
    company_id: companyId,
    user_id: payment.userId,
    month: payment.month,
    base: payment.base,
    ot: payment.ot,
    gross: payment.gross,
    pool_share: payment.poolShare,
    final_pay: payment.finalPay,
    pf: payment.pf,
    esi_employee: payment.esiEmployee,
    esi_employer: payment.esiEmployer,
    net: payment.net,
    paid: payment.paid,
    paid_at: payment.paidAt ?? null,
  }));
  if (paymentRows.length) {
    const paymentIds = paymentRows.map((row: any) => row.id);
    const { data: foundPayments, error } = await client
      .from("payments")
      .select("id, company_id")
      .in("id", paymentIds);
    assertNoError(error);
    if ((foundPayments ?? []).some((payment) => payment.company_id !== companyId)) {
      throw new Error("Cross-company payment update rejected");
    }
    await assertCompanyUsers(client, companyId, paymentRows.map((row: any) => row.user_id));
    assertNoError((await client.from("payments").upsert(paymentRows)).error);
  }
}

async function saveManagerDatabase(client: ReturnType<typeof admin>, companyId: string, data: any) {
  const { data: sectionRows, error: sectionError } = await client
    .from("company_sections")
    .select("code, position, active")
    .eq("company_id", companyId);
  assertNoError(sectionError);
  validateOrderPipeline(data.orders, sectionRows ?? []);
  for (const order of data.orders) {
    const row = orderRow(order, companyId);
    const { error } = await client.from("orders").update({
      s1: row.s1,
      s2: row.s2,
      s3: row.s3,
      s4: row.s4,
      s5: row.s5,
      s6: row.s6,
      stage_values: row.stage_values,
      status: row.status,
    }).eq("id", row.id).eq("company_id", companyId);
    assertNoError(error);
  }
  const attendanceRows = Object.entries(data.attendance).flatMap(([workerId, months]: [string, any]) =>
    Object.entries(months).map(([month, value]: [string, any]) => ({
      company_id: companyId,
      worker_id: workerId,
      month,
      present: Number(value.present),
      ot_hours: Number(value.otHours),
    }))
  );
  if (attendanceRows.length) {
    const workerIds = [...new Set(attendanceRows.map((row) => row.worker_id))];
    const { data: workers, error } = await client
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("role", "worker")
      .in("id", workerIds);
    assertNoError(error);
    if ((workers ?? []).length !== workerIds.length) throw new Error("Invalid worker attendance payload");
    assertNoError((await client.from("attendance").upsert(attendanceRows)).error);
  }
}

async function saveWorkerDatabase(client: ReturnType<typeof admin>, worker: any, data: any) {
  const { data: existing, error } = await client
    .from("submissions")
    .select("id")
    .eq("company_id", worker.company_id)
    .eq("user_id", worker.id);
  assertNoError(error);
  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const newRows = data.submissions
    .filter((submission: any) => submission.userId === worker.id && !existingIds.has(submission.id))
    .map((submission: any) => ({
      id: submission.id,
      company_id: worker.company_id,
      user_id: worker.id,
      order_id: submission.orderId,
      section: worker.section,
      pieces: Number(submission.pieces),
      note: String(submission.note ?? "").slice(0, 500),
      month: submission.month,
      created_at: submission.timestamp,
    }));
  if (newRows.length) assertNoError((await client.from("submissions").insert(newRows)).error);
}

app.get("/make-server-32660b5b/health", (c) => c.json({ status: "ok" }));

app.get("/make-server-32660b5b/billing/status", async (c) => {
  try {
    const { profile, company } = await authenticate(c, true);
    return c.json({
      companyName: company.name,
      state: company.subscription_state,
      trialEndsAt: company.trial_ends_at,
      periodEndsAt: company.subscription_period_end,
      cancelAtPeriodEnd: company.subscription_cancel_at_period_end,
      hasAccess: hasBillingAccess(company),
      canManage: profile.role === "owner",
      user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role },
      amount: 99,
      currency: "INR",
      interval: "monthly",
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post("/make-server-32660b5b/billing/checkout", async (c) => {
  try {
    const { client, profile, company } = await authenticate(c, true);
    if (profile.role !== "owner") return c.json({ error: "Only the company owner can manage billing." }, 403);
    if (hasBillingAccess(company) && company.subscription_state !== "trial") {
      return c.json({ error: "Your company already has an active subscription." }, 409);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const planId = Deno.env.get("RAZORPAY_PLAN_ID");
    if (!keyId || !keySecret || !planId) {
      return c.json({ error: "Billing setup is incomplete. Contact the TextilePay administrator." }, 503);
    }

    const plan = await razorpayRequest(`/plans/${encodeURIComponent(planId)}`, "GET");
    if (plan.item?.amount !== 9900 || plan.item?.currency !== "INR" || plan.period !== "monthly" || plan.interval !== 1) {
      return c.json({ error: "The configured Razorpay plan must be ₹99 INR per month." }, 503);
    }

    let subscription: any;
    if (company.subscription_state === "pending" && company.razorpay_subscription_id) {
      subscription = await razorpayRequest(`/subscriptions/${encodeURIComponent(company.razorpay_subscription_id)}`, "GET");
      if (!["created", "authenticated"].includes(subscription.status)) subscription = null;
    }
    if (!subscription) {
      subscription = await razorpayRequest("/subscriptions", "POST", {
        plan_id: planId,
        total_count: 120,
        quantity: 1,
        customer_notify: false,
        notes: { company_id: company.id, owner_id: profile.id },
      });
      const { error } = await client.from("companies").update({
        subscription_state: "pending",
        razorpay_subscription_id: subscription.id,
      }).eq("id", company.id);
      assertNoError(error);
    }

    return c.json({
      keyId,
      subscriptionId: subscription.id,
      companyName: company.name,
      email: profile.email,
      ownerName: profile.name,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post("/make-server-32660b5b/billing/verify", async (c) => {
  try {
    const { client, profile, company } = await authenticate(c, true);
    if (profile.role !== "owner") return c.json({ error: "Only the company owner can manage billing." }, 403);
    const { paymentId, subscriptionId, signature } = await c.req.json();
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!secret || typeof paymentId !== "string" || typeof subscriptionId !== "string" || typeof signature !== "string") {
      return c.json({ error: "Invalid payment verification details." }, 400);
    }
    if (!company.razorpay_subscription_id || subscriptionId !== company.razorpay_subscription_id) {
      return c.json({ error: "The payment does not match this company subscription." }, 400);
    }
    const expected = await hmacHex(secret, `${paymentId}|${company.razorpay_subscription_id}`);
    if (!secureEqual(expected, signature)) return c.json({ error: "Razorpay payment signature could not be verified." }, 400);

    // The client callback proves the authorization response; entitlement still
    // follows Razorpay's server-side subscription status and signed webhooks.
    const subscription = await razorpayRequest(`/subscriptions/${encodeURIComponent(company.razorpay_subscription_id)}`, "GET");
    if (subscription.status === "active") {
      const periodEnd = Number(subscription.current_end) ? new Date(Number(subscription.current_end) * 1000).toISOString() : null;
      assertNoError((await client.from("companies").update({
        subscription_state: "active",
        subscription_period_end: periodEnd,
      }).eq("id", company.id)).error);
    }
    const { data: freshCompany, error } = await client.from("companies")
      .select("id, name, status, subscription_state, trial_ends_at, subscription_period_end, subscription_cancel_at_period_end, razorpay_subscription_id")
      .eq("id", company.id)
      .single();
    assertNoError(error);
    return c.json({ hasAccess: hasBillingAccess(freshCompany), state: freshCompany.subscription_state });
  } catch (error) {
    return fail(c, error);
  }
});

app.post("/make-server-32660b5b/billing/cancel", async (c) => {
  try {
    const { client, profile, company } = await authenticate(c, true);
    if (profile.role !== "owner") return c.json({ error: "Only the company owner can manage billing." }, 403);
    if (!company.razorpay_subscription_id || !["active", "past_due"].includes(company.subscription_state)) {
      return c.json({ error: "There is no active subscription to cancel." }, 409);
    }
    await razorpayRequest(`/subscriptions/${encodeURIComponent(company.razorpay_subscription_id)}/cancel`, "POST", { cancel_at_cycle_end: true });
    assertNoError((await client.from("companies").update({ subscription_cancel_at_period_end: true }).eq("id", company.id)).error);
    return c.json({ cancelled: true, periodEndsAt: company.subscription_period_end });
  } catch (error) {
    return fail(c, error);
  }
});

app.post("/make-server-32660b5b/billing/webhook", async (c) => {
  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) return c.json({ error: "Webhook is not configured." }, 503);
    const rawBody = await c.req.text();
    const signature = c.req.header("X-Razorpay-Signature") ?? "";
    const eventId = c.req.header("x-razorpay-event-id") ?? "";
    if (!eventId || !secureEqual(await hmacHex(webhookSecret, rawBody), signature)) {
      return c.json({ error: "Invalid webhook signature." }, 400);
    }
    const event = JSON.parse(rawBody);
    const entity = event.payload?.subscription?.entity;
    const service = admin();
    let company: any = null;
    if (typeof entity?.id === "string") {
      const { data, error } = await service.from("companies").select("id")
        .eq("razorpay_subscription_id", entity.id).maybeSingle();
      assertNoError(error);
      company = data;
    }
    if (company && entity) {
      // Read the current Razorpay state so delayed or out-of-order webhooks
      // cannot reactivate a subscription that has since been cancelled.
      const current = await razorpayRequest(`/subscriptions/${encodeURIComponent(entity.id)}`, "GET");
      const stateByRazorpayStatus: Record<string, string> = {
        created: "pending",
        authenticated: "pending",
        active: "active",
        pending: "past_due",
        halted: "halted",
        cancelled: "cancelled",
        completed: "expired",
        expired: "expired",
      };
      const nextState = stateByRazorpayStatus[current.status];
      if (nextState) {
        const update: Record<string, unknown> = { subscription_state: nextState };
        if (nextState === "cancelled") update.subscription_cancel_at_period_end = true;
        else if (nextState === "active" && current.status === "active" && current.has_scheduled_changes !== true) {
          update.subscription_cancel_at_period_end = false;
        }
        if (Number(current.current_end) > 0) update.subscription_period_end = new Date(Number(current.current_end) * 1000).toISOString();
        const { error } = await service.from("companies").update(update).eq("id", company.id);
        assertNoError(error);
      }
    }

    const { error: eventError } = await service.from("billing_events").insert({
      event_id: eventId,
      company_id: company?.id ?? null,
      event_type: String(event.event ?? "unknown"),
    });
    if (eventError?.code === "23505") return c.json({ received: true, duplicate: true });
    assertNoError(eventError);
    return c.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error", error);
    return c.json({ error: "Unable to process webhook." }, 500);
  }
});

app.post("/make-server-32660b5b/users", async (c) => {
  try {
    const { client, profile } = await authenticate(c);
    if (profile.status !== "approved" || !["owner", "manager"].includes(profile.role)) {
      return c.json({ error: "Only approved owners and managers can create accounts" }, 403);
    }

    const form = await c.req.json();
    const requestedRole = profile.role === "manager" ? "worker" : form.role;
    if (!["worker", "manager"].includes(requestedRole)) {
      return c.json({ error: "Invalid account type" }, 400);
    }
    if (
      typeof form.email !== "string" ||
      typeof form.password !== "string" ||
      typeof form.name !== "string" ||
      typeof form.username !== "string" ||
      typeof form.mobile !== "string" ||
      !form.email.trim() ||
      !form.name.trim() ||
      !form.username.trim() ||
      !form.mobile.trim()
    ) {
      return c.json({ error: "Name, email, username, mobile, and password are required" }, 400);
    }
    if (form.password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    let workerSection: string | null = null;
    if (requestedRole === "worker") {
      const { data: firstSection, error: sectionError } = await client
        .from("company_sections")
        .select("code")
        .eq("company_id", profile.company_id)
        .eq("active", true)
        .order("position")
        .limit(1)
        .maybeSingle();
      assertNoError(sectionError);
      workerSection = typeof form.section === "string" && form.section ? form.section : firstSection?.code;
      if (!workerSection || !firstSection) return c.json({ error: "Configure an active company section before creating workers" }, 400);
      const { data: validSection, error: validSectionError } = await client
        .from("company_sections")
        .select("code")
        .eq("company_id", profile.company_id)
        .eq("code", workerSection)
        .eq("active", true)
        .maybeSingle();
      assertNoError(validSectionError);
      if (!validSection) return c.json({ error: "Choose an active company section" }, 400);
    }

    const { data, error } = await client.auth.admin.createUser({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      email_confirm: true,
      user_metadata: {
        username: form.username.trim().toLowerCase(),
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        role: requestedRole,
        company_id: profile.company_id,
        section: workerSection,
        pay_type: requestedRole === "worker" ? form.payType || "piece" : null,
        address: String(form.address || "").trim(),
        aadhaar: String(form.aadhaar || "").trim(),
        bank_details: String(form.bankDetails || "").trim(),
        upi: String(form.upi || "").trim(),
        emergency_contact: String(form.emergencyContact || "").trim(),
        dob: form.dob || null,
        join_date: form.joinDate || null,
        created_by: profile.id,
      },
    });
    if (error) return c.json({ error: error.message }, 400);
    if (requestedRole === "manager") {
      const { error: roleError } = await client
        .from("profiles")
        .update({ role: "manager", section: null, pay_type: null })
        .eq("id", data.user.id)
        .eq("company_id", profile.company_id)
        .eq("status", "pending");
      if (roleError) {
        const { error: cleanupError } = await client.auth.admin.deleteUser(data.user.id);
        if (cleanupError) console.error("Failed to roll back manager account creation", cleanupError);
        return c.json({ error: "Unable to finish manager account setup" }, 500);
      }
    }
    return c.json({ id: data.user.id, status: "pending" }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get("/make-server-32660b5b/db", async (c) => {
  try {
    const { client, profile, company } = await authenticate(c);
    return c.json({ data: await loadDatabase(client, profile, company) });
  } catch (error) {
    return fail(c, error);
  }
});

app.post("/make-server-32660b5b/db", async (c) => {
  try {
    const { client, profile } = await authenticate(c);
    if (profile.status !== "approved") return c.json({ error: "Account is not approved" }, 403);
    const data = await c.req.json();
    if (!data || !Array.isArray(data.users) || !Array.isArray(data.orders)) {
      return c.json({ error: "Invalid database payload" }, 400);
    }

    if (profile.role === "owner") await saveOwnerDatabase(client, profile.id, profile.company_id, data);
    else if (profile.role === "manager") await saveManagerDatabase(client, profile.company_id, data);
    else await saveWorkerDatabase(client, profile, data);
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

Deno.serve(app.fetch);
