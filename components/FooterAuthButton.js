'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FooterAuthButton() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleClick() {
    if (loggedIn) {
      supabase.auth.signOut().then(() => {
        window.location.href = '/';
      });
    } else {
      window.location.href = '/login';
    }
  }

  return (
    <button
      className="nav-link"
      style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 4 }}
      onClick={handleClick}
    >
      {loggedIn ? 'Log Out' : "Don't click this."}
    </button>
  );
}
