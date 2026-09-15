'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      window.location.href = '/admin';
    }
  }

  return (
    <div className="admin-wrap" style={{ maxWidth: 420 }}>
      <p className="dek" style={{ fontSize: 20, marginBottom: 24 }}>
        Hey Copernicus, why don&rsquo;t you navigate yourself back to the homepage with your mouse and read the
        articles with your eyes. If you&rsquo;re not an editor, you&rsquo;re not supposed to be here.
      </p>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary">Log In</button>
        <div className="error-status">{error}</div>
      </form>
    </div>
  );
}
