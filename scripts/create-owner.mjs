import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "OWNER_PASSWORD",
  "COMPANY_NAME",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.OWNER_PASSWORD.length < 12) {
  console.error("OWNER_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const email = process.env.OWNER_EMAIL.trim().toLowerCase();
const name = process.env.OWNER_NAME?.trim() || "Owner";
const username = process.env.OWNER_USERNAME?.trim().toLowerCase() || "owner";
const companyName = process.env.COMPANY_NAME.trim();

if (!companyName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Provide a non-empty COMPANY_NAME and a valid OWNER_EMAIL.");
  process.exit(1);
}

async function rollbackProvisioning(companyId, userId) {
  if (userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error(`Rollback could not delete the new owner account: ${error.message}`);
  }
  if (companyId) {
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) console.error(`Rollback could not delete the new company: ${error.message}`);
  }
}

const { data: company, error: companyError } = await supabase
  .from("companies")
  .insert({ name: companyName, status: "active" })
  .select("id")
  .single();

if (companyError) {
  console.error(`Unable to create company: ${companyError.message}`);
  process.exit(1);
}

const defaultSections = [
  { code: "S1", name: "Cutting" },
  { code: "S2", name: "Stitching" },
  { code: "S3", name: "Embroidery" },
  { code: "S4", name: "Checking" },
  { code: "S5", name: "Finishing" },
  { code: "S6", name: "Packing" },
].map((section, index) => ({ ...section, company_id: company.id, position: index + 1, active: true }));
const { error: sectionError } = await supabase.from("company_sections").insert(defaultSections);
if (sectionError) {
  await rollbackProvisioning(company.id);
  console.error(`Unable to initialize company sections: ${sectionError.message}`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: process.env.OWNER_PASSWORD,
  email_confirm: true,
  user_metadata: {
    name,
    username,
    mobile: "",
    role: "worker",
    company_id: company.id,
    section: defaultSections[0].code,
  },
});

if (error) {
  await rollbackProvisioning(company.id);
  console.error(`Unable to create owner: ${error.message}`);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "owner", status: "approved", section: null, pay_type: null })
  .eq("id", data.user.id)
  .eq("company_id", company.id);

if (profileError) {
  await rollbackProvisioning(company.id, data.user.id);
  console.error(`Unable to approve owner profile: ${profileError.message}`);
  process.exit(1);
}

const { error: defaultsError } = await supabase.from("piece_rates").insert(
  defaultSections.map(({ code }) => ({ company_id: company.id, section: code, rate: 0 })),
);
const { error: settingsError } = await supabase.from("app_settings").insert({
  company_id: company.id,
  singleton: true,
});

if (defaultsError || settingsError) {
  await rollbackProvisioning(company.id, data.user.id);
  console.error(`Unable to create company defaults: ${(defaultsError || settingsError).message}`);
  process.exit(1);
}

console.log(`Company "${companyName}" and owner ${email} created successfully.`);
