import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "OWNER_PASSWORD",
  "COMPANY_NAME",
  "COMPANY_SLUG",
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
const companySlug = process.env.COMPANY_SLUG.trim().toLowerCase();

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(companySlug)) {
  console.error("COMPANY_SLUG must contain lowercase letters, numbers, and single hyphens only.");
  process.exit(1);
}

const { data: company, error: companyError } = await supabase
  .from("companies")
  .insert({ name: companyName, slug: companySlug, status: "active" })
  .select("id")
  .single();

if (companyError) {
  console.error(`Unable to create company: ${companyError.message}`);
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
  },
});

if (error) {
  await supabase.from("companies").delete().eq("id", company.id);
  console.error(`Unable to create owner: ${error.message}`);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "owner", status: "approved", section: null, pay_type: null })
  .eq("id", data.user.id)
  .eq("company_id", company.id);

if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  await supabase.from("companies").delete().eq("id", company.id);
  console.error(`Unable to approve owner profile: ${profileError.message}`);
  process.exit(1);
}

const sections = ["S1", "S2", "S3", "S4", "S5", "S6"];
const { error: defaultsError } = await supabase.from("piece_rates").insert(
  sections.map((section) => ({ company_id: company.id, section, rate: 0 })),
);
const { error: settingsError } = await supabase.from("app_settings").insert({
  company_id: company.id,
  singleton: true,
});

if (defaultsError || settingsError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  await supabase.from("companies").delete().eq("id", company.id);
  console.error(`Unable to create company defaults: ${(defaultsError || settingsError).message}`);
  process.exit(1);
}

console.log(`Company "${companyName}" and owner ${email} created successfully.`);
