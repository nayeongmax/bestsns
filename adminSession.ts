import { supabase } from './supabase';
export async function adminHeaders(): Promise<Record<string,string>> {
  const {data}=await supabase.auth.getSession();
  return data.session?{Authorization:`Bearer ${data.session.access_token}`} : {};
}
export async function verifyAdminSession(): Promise<boolean> {
  const response=await fetch('/.netlify/functions/admin-session',{credentials:'same-origin',headers:await adminHeaders()});
  return response.ok && (await response.json()).authenticated===true;
}
