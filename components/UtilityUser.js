'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UtilityUser() {
  const [email, setEmail] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session ? data.session.user.email : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session ? session.user.email : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!email) return null;
  return <span className="eyebrow" style={{ color: 'var(--fg-muted)' }}>{email}</span>;
}
