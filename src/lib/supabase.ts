import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const makeUrl = `https://${projectId}.supabase.co`;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || makeUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;

// Supabase's Functions gateway requires the project API key alongside the
// signed-in user's access token when calling Edge Functions with fetch().
export const edgeFunctionHeaders = { apikey: supabaseAnonKey };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const edgeFunctionBase = `${supabaseUrl}/functions/v1/make-server-32660b5b`;
