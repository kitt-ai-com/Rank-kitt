import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 서버 전용. SERVICE_ROLE_KEY 는 절대 클라이언트에 노출하지 마세요.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // 미설정이면 리드 저장 스킵
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

type LeadInput = {
  email: string;
  url: string;
  biz: string;
  result: unknown;
};

export async function saveLead(lead: LeadInput): Promise<void> {
  const supabase = getClient();
  if (!supabase) return; // 조용히 스킵

  const { error } = await supabase.from("geo_leads").insert({
    email: lead.email,
    site_url: lead.url,
    industry: lead.biz || null,
    result: lead.result,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export type LeadRow = {
  id: string;
  email: string;
  site_url: string;
  industry: string | null;
  result: unknown;
  created_at: string;
};

export async function listLeads(limit = 200): Promise<LeadRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("geo_leads")
    .select("id,email,site_url,industry,result,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as LeadRow[];
}
