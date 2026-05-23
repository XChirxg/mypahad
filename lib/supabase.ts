import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://khbotkadtbkwqxjxlyhm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYm90a2FkdGJrd3F4anhseWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTU4OTAsImV4cCI6MjA4ODUzMTg5MH0.MnNTuoONyBTGZeO1qYyRUTtkRdFreK0OrOcYk66pWxs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
