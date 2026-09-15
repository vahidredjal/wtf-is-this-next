'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EditorNavLink() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!loggedIn) return null;
  return <a href="/admin" className="nav-link">Edit</a>;
}
