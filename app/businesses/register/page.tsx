import { redirect } from 'next/navigation'

// Redirect to the existing static partner.html
// Put partner.html in your public/ folder, OR change this URL to your deployed HTML app
export default function RegisterPage() {
  redirect('https://xchirxg.github.io/partner.html')
}