import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const config = {
  url: process.env.TENANT_TEST_SUPABASE_URL,
  anonKey: process.env.TENANT_TEST_SUPABASE_ANON_KEY,
  ownerAEmail: process.env.TENANT_TEST_OWNER_A_EMAIL,
  ownerAPassword: process.env.TENANT_TEST_OWNER_A_PASSWORD,
  ownerBEmail: process.env.TENANT_TEST_OWNER_B_EMAIL,
  ownerBPassword: process.env.TENANT_TEST_OWNER_B_PASSWORD,
};

const configured = Object.values(config).every(Boolean);

test("two company owners receive isolated API workspaces", {
  skip: !configured && "Set TENANT_TEST_* variables for two independent approved owner accounts.",
}, async () => {
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function getOwnerWorkspace(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert.ifError(error);
    const response = await fetch(`${config.url}/functions/v1/make-server-32660b5b/db`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.error);
    assert.ok(body.data.users.every((user) => user.companyId === body.data.company.id));
    return body.data;
  }

  const a = await getOwnerWorkspace(config.ownerAEmail, config.ownerAPassword);
  const b = await getOwnerWorkspace(config.ownerBEmail, config.ownerBPassword);
  const aUsers = new Set(a.users.map((user) => user.id));
  const bUsers = new Set(b.users.map((user) => user.id));
  assert.equal([...aUsers].some((id) => bUsers.has(id)), false, "company user lists must be disjoint");
  const aOrders = new Set(a.orders.map((order) => order.id));
  assert.equal(b.orders.some((order) => aOrders.has(order.id)), false, "company order lists must be disjoint");
  assert.equal(b.payments.some((payment) => aUsers.has(payment.userId)), false, "one company's payroll must not appear in the other workspace");

  await client.auth.signOut();
});
