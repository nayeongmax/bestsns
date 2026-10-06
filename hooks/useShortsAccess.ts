import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { UserProfile } from '../types';

export function useShortsAccess(user: UserProfile | null) {
  const [access, setAccess] = useState({ loading: true, published: false, preview: false });
  useEffect(() => {
    let active = true;
    setAccess({ loading: true, published: false, preview: false });
    (async () => {
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      const response = await fetch('/.netlify/functions/shorts-access', { headers });
      if (!response.ok) throw new Error('Access check failed');
      const result = await response.json();
      if (active) setAccess({ loading: false, published: result.published === true, preview: result.preview === true });
    })().catch(() => { if (active) setAccess({ loading: false, published: false, preview: false }); });
    return () => { active = false; };
  }, [user?.id, user?.role]);
  return access;
}
