import { createClient } from '@supabase/supabase-js';

const SUPABASE_LEADS_URL = 'https://rcyvtdmvimqvsrglrnwv.supabase.co';
// Fallback to a dummy valid format key during build time to prevent build failures when env key is not yet set
const SUPABASE_LEADS_ANON_KEY = 
  process.env.NEXT_PUBLIC_SUPABASE_LEADS_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjeXZ0ZG12aW1xdnNyZ2xybnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTQ1NTAsImV4cCI6MjA5NTk3MDU1MH0.kRvgihk-ZIT82L8W3vR9T0QASoCDeEsNwVsh7851KRk';

export const supabaseLeads = createClient(SUPABASE_LEADS_URL, SUPABASE_LEADS_ANON_KEY);
