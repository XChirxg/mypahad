const { createClient } = require('@supabase/supabase-js');

const MAIN_DB_URL = 'https://khbotkadtbkwqxjxlyhm.supabase.co';
const MAIN_DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYm90a2FkdGJrd3F4anhseWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTU4OTAsImV4cCI6MjA4ODUzMTg5MH0.MnNTuoONyBTGZeO1qYyRUTtkRdFreK0OrOcYk66pWxs';

const supabase = createClient(MAIN_DB_URL, MAIN_DB_KEY);

async function check() {
  const { data, error } = await supabase.from('listings').select('*').limit(1);
  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(JSON.stringify(Object.keys(data[0])));
  } else {
    console.log("Empty");
  }
}

check();
