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

async function authenticate(c: { req: { header: (name: string) => string | undefined } }) {
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
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id, name, slug, status")
    .eq("id", profile.company_id)
    .single();
  if (companyError || !company) throw new Error("COMPANY_NOT_FOUND");
  if (!["active", "trial"].includes(company.status)) throw new Error("COMPANY_INACTIVE");
  return { client, user, profile, company };
}

function fail(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return c.json({ error: "Authentication required" }, 401);
  if (message === "PROFILE_NOT_FOUND") return c.json({ error: "User profile is not configured" }, 403);
  if (message === "COMPANY_NOT_FOUND") return c.json({ error: "Company is not configured" }, 403);
  if (message === "COMPANY_INACTIVE") return c.json({ error: "Company subscription is not active" }, 403);
  if (message.startsWith("Cross-company")) return c.json({ error: message }, 403);
  console.error("TextilePay API error", error);
  return c.json({ error: "Unable to process the request" }, 500);
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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
    attendanceResult,
    submissionsResult,
    paymentsResult,
    settingsResult,
  ] = await Promise.all([
    client.from("profiles").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("profile_private").select("*").eq("company_id", viewer.company_id),
    client.from("orders").select("*").eq("company_id", viewer.company_id).order("created_at"),
    client.from("piece_rates").select("*").eq("company_id", viewer.company_id),
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
      stages: { S1: order.s1, S2: order.s2, S3: order.s3, S4: order.s4, S5: order.s5, S6: order.s6 },
      createdAt: order.created_at,
      status: order.status,
    })),
    pieceRates: Object.fromEntries((ratesResult.data ?? []).map((row) => [row.section, Number(row.rate)])),
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
    section: user.role === "worker" ? user.section ?? "S1" : null,
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
    status: order.status,
    created_at: order.createdAt,
  };
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
  for (const order of data.orders) {
    const row = orderRow(order, companyId);
    const { error } = await client.from("orders").update({
      s1: row.s1,
      s2: row.s2,
      s3: row.s3,
      s4: row.s4,
      s5: row.s5,
      s6: row.s6,
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
        section: requestedRole === "worker" ? form.section || "S1" : null,
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
