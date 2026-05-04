import { createClient } from '@supabase/supabase-js'

const SU = 'https://khbotkadtbkwqxjxlyhm.supabase.co'
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYm90a2FkdGJrd3F4anhseWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTU4OTAsImV4cCI6MjA4ODUzMTg5MH0.MnNTuoONyBTGZeO1qYyRUTtkRdFreK0OrOcYk66pWxs'

// Server-side client (no cookies needed for public data)
export const supabase = createClient(SU, SK)

export type Business = {
  id: string
  business_name: string
  username?: string
  dp_url?: string
  description?: string
  address?: string
  whatsapp?: string
  is_premium?: boolean
  is_approved?: boolean
  is_active?: boolean
  area_id?: string
  category_id?: string
  hearts?: number
  areas?: { id: string; name: string; slug?: string }
  categories?: { id: string; name: string }
  photos?: string[]
  instagram?: string
  facebook?: string
  website?: string
}

export type Listing = {
  id: string
  name: string
  price?: string
  description?: string
  image_url?: string
  listing_type?: 'product' | 'service'
  is_available?: boolean
  business_id?: string
  category_id?: string
  created_at?: string
  businesses?: Business
}
