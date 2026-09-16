'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CATS, CAT_LABEL } from '../../lib/categories';
import { POSITION_LABEL, POSITION_CSS, FIT_LABEL } from '../../lib/imageFit';

const ALLOWED_TAGS = { P: 1, STRONG: 1, B: 1, EM: 1, I: 1, S: 1, STRIKE: 1, U: 1, BR: 1, A: 1 };

function isSafeHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch (e) {
    return false;
  }
}

function sanitizeHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  (function clean(node) {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 1) {
        if (!ALLOWED_TAGS[child.tagName]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        } else if (child.tagName === 'A') {
          const href = child.getAttribute('href') || '';
          while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
          if (isSafeHref(href)) {
            child.setAttribute('href', href);
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer nofollow');
            clean(child);
          } else {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
          }
        } else {
          while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
          clean(child);
        }
      } else if (child.nodeType !== 3) {
        node.removeChild(child);
      }
      child = next;
    }
  })(container);
  return container.innerHTML;
}

export default function AdminPage() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [articles, setArticles] = useState([]);
  const [heroId, setHeroId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFit, setPreviewFit] = useState('cover');
  const [previewPosition, setPreviewPosition] = useState('center');
  const [showSettings, setShowSettings] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadArticles() {
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
    setArticles(data || []);
  }

  async function loadHero() {
    const { data } = await supabase.from('site_settings').select('hero_article_id').eq('id', true).maybeSingle();
    setHeroId(data ? data.hero_article_id : null);
  }

  useEffect(() => {
    if (session) {
      loadArticles();
      loadHero();
    }
  }, [session]);

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="admin-wrap">
        <p className="dek">
          You need to <a href="/login" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>log in</a> to edit articles.
        </p>
      </div>
    );
  }

  const editing = editingId ? articles.find((a) => a.id === editingId) : null;

  function resetPreview(article) {
    setPreviewUrl(article ? article.image_url : null);
    setPreviewFit(article ? (article.image_fit || 'cover') : 'cover');
    setPreviewPosition(article ? (article.image_position || 'center') : 'center');
  }

  function startNew() { setEditingId(null); setShowForm(true); setShowSettings(false); resetPreview(null); }
  function startEdit(id) { setEditingId(id); setShowForm(true); setShowSettings(false); resetPreview(articles.find((a) => a.id === id)); }
  function cancelForm() { setEditingId(null); setShowForm(false); }

  function handleImageChange(e) {
    const file = e.target.files[0];
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : (editing ? editing.image_url : null);
    });
  }

  async function deleteConfirm() {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await supabase.from('articles').delete().eq('id', id);
    loadArticles();
  }

  async function handleSave(e, targetStatus) {
    e.preventDefault();
    const form = e.target;
    const headline = form.headline.value.trim();
    const dek = form.dek.value.trim();
    const byline = form.byline.value.trim();
    const category = form.category.value;
    const isHero = form.hero.checked;
    const bodyText = editorRef.current.textContent.trim();
    if (!headline || !byline || !bodyText) {
      alert('Please fill in a headline, byline, and some body text.');
      return;
    }
    setSaving(true);
    setStatus('Saving…');
    try {
      let imageUrl = editing ? editing.image_url || null : null;
      const file = form.image.files[0];
      if (file) {
        setStatus('Uploading image…');
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('article-images').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('article-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
      const bodyHtml = sanitizeHtml(editorRef.current.innerHTML);
      const wordCount = bodyText.split(/\s+/).length;
      const readTime = form.readTime.value.trim() || `${Math.max(1, Math.round(wordCount / 200))} min read`;

      const payload = {
        headline,
        dek,
        byline,
        category,
        image_url: imageUrl,
        image_position: form.imagePosition.value,
        image_fit: form.imageFit.value,
        tldr: form.tldr.value.trim(),
        body_html: bodyHtml,
        read_time: readTime,
        status: targetStatus
      };

      let docId = editingId;
      if (editingId) {
        const { error } = await supabase.from('articles').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('articles').insert(payload).select('id').single();
        if (error) throw error;
        docId = data.id;
      }

      if (isHero) {
        await supabase.from('site_settings').update({ hero_article_id: docId }).eq('id', true);
      } else if (heroId === docId) {
        await supabase.from('site_settings').update({ hero_article_id: null }).eq('id', true);
      }

      setEditingId(null);
      setShowForm(false);
      setStatus('');
      loadArticles();
      loadHero();
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function exec(cmd) {
    document.execCommand(cmd);
  }

  function insertLink() {
    const url = window.prompt('Link URL (include https://):', 'https://');
    if (!url) return;
    if (!isSafeHref(url)) {
      alert("That doesn't look like a valid web link. Use a full https:// (or http:// or mailto:) URL.");
      return;
    }
    document.execCommand('createLink', false, url);
  }

  if (showForm) {
    return (
      <form
        key={editingId || 'new'}
        onSubmit={(e) => handleSave(e, e.nativeEvent.submitter ? e.nativeEvent.submitter.dataset.status : 'draft')}
      >
          <div className="editor-topbar">
            <button type="button" className="editor-back" onClick={cancelForm} aria-label="Back">&larr;</button>
            <div className="editor-topbar-right">
              <span className="publish-status" style={{ marginTop: 0 }}>{status}</span>
              <button type="submit" data-status="draft" className="btn btn-outline" disabled={saving}>Save Draft</button>
              <button type="submit" data-status="published" className="btn btn-primary" disabled={saving}>Publish</button>
            </div>
          </div>

          <div className="editor-canvas">
            <input
              className="editor-title"
              name="headline"
              placeholder="Title"
              defaultValue={editing ? editing.headline : ''}
              required
            />
            <input
              className="editor-subtitle"
              name="dek"
              placeholder="Add a subtitle..."
              defaultValue={editing ? editing.dek : ''}
            />

            <div className="editor-byline-row">
              <span className="editor-pill">
                <input
                  className="editor-pill-input"
                  name="byline"
                  defaultValue={editing ? editing.byline : ''}
                  placeholder="By Your Name"
                  required
                />
              </span>
              <select className="editor-pill editor-pill-select" name="category" defaultValue={editing ? editing.category : CATS[0]}>
                {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>

            <div className="editor-toolbar">
              <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><strong>B</strong></button>
              <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><em>I</em></button>
              <button type="button" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>S</s></button>
              <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><u>U</u></button>
              <button type="button" title="Add link" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>&#128279;</button>
              <button type="button" title="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('unlink')}>&#128279;&#8416;</button>
            </div>

            <div
              className="editor-body"
              data-placeholder="Start writing..."
              contentEditable
              suppressContentEditableWarning
              ref={editorRef}
              dangerouslySetInnerHTML={{ __html: editing ? (editing.body_html || '') : '' }}
            />

            {/* Hidden fields kept in the form so handleSave can read them via form.<name>.value */}
            <input type="hidden" name="imageFit" value={previewFit} readOnly />
            <input type="hidden" name="imagePosition" value={previewPosition} readOnly />
          </div>

          <button type="button" className="editor-settings-fab" onClick={() => setShowSettings(true)}>
            &#9881; Settings
          </button>

          {showSettings && (
            <div className="editor-settings-overlay" onClick={() => setShowSettings(false)}>
              <div className="editor-settings-panel admin-form" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 className="section-title" style={{ fontSize: 22 }}>Settings</h2>
                  <button type="button" className="btn btn-outline btn-small" onClick={() => setShowSettings(false)}>Done</button>
                </div>

                <div className="field-row">
                  <input
                    type="checkbox"
                    id="hero-check"
                    name="hero"
                    defaultChecked={editing ? editing.id === heroId : false}
                  />
                  <label htmlFor="hero-check" style={{ margin: 0 }}>Make this the main hero story</label>
                </div>

                <label>Image</label>
                <input type="file" name="image" accept="image/*" onChange={handleImageChange} />
                <div className="hint">
                  {editing ? 'Leave blank to keep the current image.' : 'Optional — leave blank to use a placeholder.'}
                </div>

                {previewUrl ? (
                  <div className="image-preview" style={{ height: 200 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: previewFit,
                        objectPosition: POSITION_CSS[previewPosition],
                        display: 'block'
                      }}
                    />
                  </div>
                ) : null}

                <label>Image Fit</label>
                <select value={previewFit} onChange={(e) => setPreviewFit(e.target.value)}>
                  {Object.keys(FIT_LABEL).map((f) => <option key={f} value={f}>{FIT_LABEL[f]}</option>)}
                </select>
                <div className="hint">Fill &amp; Crop scales and crops to fit the box. Show Full Photo never crops (adds padding instead). Stretch to Fit fills the box exactly but can distort the image.</div>

                <label>Image Position</label>
                <select value={previewPosition} onChange={(e) => setPreviewPosition(e.target.value)}>
                  {Object.keys(POSITION_LABEL).map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
                </select>
                <div className="hint">Which part of the photo stays in frame under Fill &amp; Crop or Show Full Photo.</div>

                <label>Read Time</label>
                <input type="text" name="readTime" defaultValue={editing ? editing.read_time : ''} placeholder="e.g. 4 min read" />

                <label>Well, WTF is this? (short TL;DR)</label>
                <textarea
                  name="tldr"
                  style={{ minHeight: 80 }}
                  defaultValue={editing ? editing.tldr || '' : ''}
                  placeholder="One or two sentences summing up the story."
                />
              </div>
            </div>
          )}
      </form>
    );
  }

  return (
    <div className="admin-wrap">
      <a href="/" className="see-all" style={{ display: 'inline-block', marginBottom: 24 }}>&larr; Back to the Feed</a>
      <h1 className="headline" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', marginBottom: 12 }}>Edit Articles</h1>
      <p className="dek" style={{ marginBottom: 24 }}>
        Signed in as {session.user.email}. Changes go live for everyone immediately.
      </p>

      <button className="btn btn-primary" onClick={startNew}>+ New Article</button>

      <div style={{ marginTop: 32 }}>
        {articles.map((a) => (
          <div className="admin-list-item" key={a.id}>
            <div className="meta">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: `var(--cat-${a.category})`, width: 'fit-content' }}>
                  {CAT_LABEL[a.category]}{a.id === heroId ? ' · HERO' : ''}
                </span>
                {a.status !== 'published' ? <span className="chip chip-draft" style={{ width: 'fit-content' }}>DRAFT</span> : null}
              </div>
              <strong style={{ fontSize: 15 }}>{a.headline}</strong>
              <span className="byline">{a.byline}</span>
            </div>
            <div className="actions">
              <button className="btn btn-outline btn-small" onClick={() => { window.location.href = `/article/${a.id}`; }}>View</button>
              <button className="btn btn-outline btn-small" onClick={() => startEdit(a.id)}>Edit</button>
              <button className="btn btn-outline btn-small" onClick={() => setPendingDeleteId(a.id)}>Delete</button>
            </div>
            {pendingDeleteId === a.id && (
              <div className="delete-confirm">
                Delete &ldquo;{a.headline}&rdquo;? This can&apos;t be undone.
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  <button className="btn btn-danger btn-small" onClick={deleteConfirm}>Delete It</button>
                  <button className="btn btn-outline btn-small" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
