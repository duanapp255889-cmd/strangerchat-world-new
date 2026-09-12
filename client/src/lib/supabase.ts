import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gwxmuroazeqerskatgqg.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_GbloRMzbptNIDNRBLySa7Q_LGC8heQN";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function ensureAnonymousAuth() {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error(error?.message || "Anonymous sign-in is unavailable");
  return data.user;
}

export type SessionProfile = {
  id: string;
  display_name: string;
  gender: string;
  birth_year: number;
  country_code: string;
  city: string;
  language: string;
};

export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
  ended_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_session_id: string;
  body: string;
  created_at: string;
};
