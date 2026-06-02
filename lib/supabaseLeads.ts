import { createClient } from '@supabase/supabase-js';

const SUPABASE_LEADS_URL = 'https://rcyvtdmvimqvsrglrnwv.supabase.co';
// Fallback to a dummy valid format key during build time to prevent build failures when env key is not yet set
const SUPABASE_LEADS_ANON_KEY = 
  process.env.NEXT_PUBLIC_SUPABASE_LEADS_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYm90a2FkdGJrd3F4anhseWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTU4OTAsImV4cCI6MjA4ODUzMTg5MH0.MnNTuoONyBTGZeO1qYyRUTtkRdFreK0OrOcYk66pWxs';

export const supabaseLeads = createClient(SUPABASE_LEADS_URL, SUPABASE_LEADS_ANON_KEY);
