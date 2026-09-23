'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CATS, CAT_LABEL } from '../../lib/categories';
import { POSITION_LABEL, POSITION_CSS, FIT_LABEL } from '../../lib/imageFit';

const ALLOWED_TAGS = { P: 1, STRONG: 1, B: 1, EM: 1, I: 1, S: 1, STRIKE: 1, U: 1, BR: 1, A: 1, SPAN: 1 };

const FONT_SIZES = { small: '14px', normal: '19px', large: '24px', xlarge: '32px' };
const FONT_FAMILIES = {
  sans: "'Work Sans', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace"
};
const SAFE_FONT_SIZE_VALUES = Object.values(FONT_SIZES).reduce((acc, v) => { acc[v] = 1; return acc; }, {});
const SAFE_FONT_FAMILY_VALUES = Object.values(FONT_FAMILIES).reduce((acc, v) => { acc[v] = 1; return acc; }, {});

function sanitizeStyle(styleValue) {
  var out = [];
  var sizeMatch = /font-size:\s*([^;]+)/i.exec(styleValue || '');
  if (sizeMatch && SAFE_FONT_SIZE_VALUES[sizeMatch[1].trim()]) out.push('font-size:' + sizeMatch[1].trim());
  var familyMatch = /font-family:\s*([^;]+)/i.exec(styleValue || '');
  if (familyMatch && SAFE_FONT_FAMILY_VALUES[familyMatch[1].trim()]) out.push('font-family:' + familyMatch[1].trim());
  return out.join('; ');
}

function isSafeHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch (e) {
    return false;
  }
}

// Reads bold/italic/underline/strikethrough/size/family off of a pasted
// element's own tag name and inline style — pasted content (Word, Google
// Docs, other sites) almost always expresses these via inline styles on
// <span>/<div> rather than semantic tags, which our normal sanitizer
// wouldn't recognize.
function classifyPastedStyle(el) {
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  const marks = { bold: false, italic: false, underline: false, strike: false, fontSize: null, fontFamily: null };

  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') marks.bold = true;
  if (tag === 'I' || tag === 'EM') marks.italic = true;
  if (tag === 'U') marks.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') marks.strike = true;

  const fw = /font-weight:\s*([^;]+)/i.exec(style);
  if (fw) {
    const v = fw[1].trim().toLowerCase();
    if (v === 'bold' || v === 'bolder' || parseInt(v, 10) >= 600) marks.bold = true;
  }
  const fs = /font-style:\s*([^;]+)/i.exec(style);
  if (fs && /italic|oblique/i.test(fs[1])) marks.italic = true;
  const td = /text-decoration(?:-line)?:\s*([^;]+)/i.exec(style);
  if (td) {
    if (/underline/i.test(td[1])) marks.underline = true;
    if (/line-through/i.test(td[1])) marks.strike = true;
  }

  const size = /font-size:\s*([\d.]+)(px|pt|em|rem)?/i.exec(style);
  if (size) {
    const num = parseFloat(size[1]);
    const unit = (size[2] || 'px').toLowerCase();
    const px = unit === 'pt' ? num * 1.333 : (unit === 'em' || unit === 'rem') ? num * 19 : num;
    const presets = [14, 19, 24, 32];
    const nearest = presets.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
    marks.fontSize = nearest + 'px';
  }
  const fam = /font-family:\s*([^;]+)/i.exec(style);
  if (fam) {
    const f = fam[1].toLowerCase();
    if (/mono|courier|consolas|menlo/.test(f)) marks.fontFamily = FONT_FAMILIES.mono;
    else if (/serif/.test(f) && !/sans-serif/.test(f)) marks.fontFamily = FONT_FAMILIES.serif;
  }
  return marks;
}

function cleanPastedNode(node) {
  if (node.nodeType === 3) return [document.createTextNode(node.textContent)];
  if (node.nodeType !== 1) return [];

  const tag = node.tagName;
  if (tag === 'BR') return [document.createElement('br')];
  if (tag === 'SCRIPT' || tag === 'STYLE') return [];

  let children = [];
  node.childNodes.forEach((c) => { children = children.concat(cleanPastedNode(c)); });

  if (tag === 'A') {
    const href = node.getAttribute('href') || '';
    if (isSafeHref(href)) {
      const a = document.createElement('a');
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
      children.forEach((c) => a.appendChild(c));
      return [a];
    }
    return children;
  }

  const marks = classifyPastedStyle(node);
  let wrapped = children;

  function wrapAll(tagName) {
    const el = document.createElement(tagName);
    wrapped.forEach((c) => el.appendChild(c));
    wrapped = [el];
  }

  if (marks.bold) wrapAll('strong');
  if (marks.italic) wrapAll('em');
  if (marks.underline) wrapAll('u');
  if (marks.strike) wrapAll('s');
  if (marks.fontSize || marks.fontFamily) {
    const span = document.createElement('span');
    const parts = [];
    if (marks.fontSize) parts.push('font-size:' + marks.fontSize);
    if (marks.fontFamily) parts.push('font-family:' + marks.fontFamily);
    span.setAttribute('style', parts.join('; '));
    wrapped.forEach((c) => span.appendChild(c));
    wrapped = [span];
  }

  const isBlock = tag === 'P' || tag === 'DIV' || tag === 'LI' || /^H[1-6]$/.test(tag);
  if (isBlock) {
    const p = document.createElement('p');
    wrapped.forEach((c) => p.appendChild(c));
    return [p];
  }
  return wrapped;
}

function cleanPastedHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  let result = [];
  container.childNodes.forEach((c) => { result = result.concat(cleanPastedNode(c)); });
  const out = document.createElement('div');
  result.forEach((n) => out.appendChild(n));
  return out.innerHTML;
}

function sanitizeHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  (function clean(node) {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 1) {
        if (child.tagName === 'DIV') {
          // Browsers sometimes wrap each line typed in a contentEditable area
          // in a plain <div> instead of a <p> (e.g. pressing Enter before the
          // defaultParagraphSeparator fix above takes effect, or content
          // pasted from elsewhere). Treat it as a paragraph instead of
          // stripping it, so the line break it represents survives.
          const p = document.createElement('P');
          while (child.firstChild) p.appendChild(child.firstChild);
          node.replaceChild(p, child);
          clean(p);
        } else if (!ALLOWED_TAGS[child.tagName]) {
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
        } else if (child.tagName === 'SPAN') {
          const safeStyle = sanitizeStyle(child.getAttribute('style'));
          while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
          if (safeStyle) {
            child.setAttribute('style', safeStyle);
            clean(child);
          } else {
            // Nothing safe left to keep it for — unwrap rather than keep a bare span.
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

  const userId = session ? session.user.id : null;
  useEffect(() => {
    if (userId) {
      loadArticles();
      loadHero();
    }
    // Deliberately keyed on the user id, not the whole session object: Supabase
    // silently refreshes the session (new object, same user) whenever the tab
    // regains focus, which would otherwise re-trigger this fetch constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!editorRef.current) return;
    // Without this, pressing Enter in the editor makes the browser insert a
    // plain <div> for each new line instead of a real <p>, which then gets
    // stripped out entirely when saving (divs aren't a formatting tag we
    // allow), silently merging separate paragraphs into one run-on block.
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    const current = editingId ? articles.find((a) => a.id === editingId) : null;
    editorRef.current.innerHTML = current ? (current.body_html || '') : '';
    // Deliberately runs only when opening a new/different article (or when the
    // form first mounts), not on every re-render — otherwise unrelated state
    // changes (like the periodic session-refresh refetch above) would wipe out
    // whatever the editor has typed since, because contentEditable's live DOM
    // is separate from React's own re-render diffing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, showForm]);

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

  function replaceFontTags(selector, apply) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll(selector).forEach((f) => {
      const span = document.createElement('span');
      apply(span);
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
    });
  }

  // execCommand('fontSize'/'fontName') only understands legacy <font> tags,
  // not real CSS — so we use an out-of-range marker value to make the
  // resulting <font> elements easy to find, then swap each for a <span>
  // with the actual font-size/font-family style we want.
  function applyFontSize(px) {
    document.execCommand('fontSize', false, '7');
    replaceFontTags('font[size="7"]', (span) => { span.style.fontSize = px; });
  }

  function applyFontFamily(family) {
    document.execCommand('fontName', false, 'wtf-tmp-font');
    replaceFontTags('font[face="wtf-tmp-font"]', (span) => { span.style.fontFamily = family; });
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

  function handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    let toInsert;
    if (html) {
      toInsert = cleanPastedHtml(html);
    } else {
      const text = e.clipboardData.getData('text/plain');
      const esc = document.createElement('div');
      esc.textContent = text;
      const lines = esc.innerHTML.split(/\r\n|\r|\n/).filter(Boolean);
      toInsert = lines.map((l) => '<p>' + l + '</p>').join('');
    }
    document.execCommand('insertHTML', false, toInsert);
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

            <div className="editor-tldr-box">
              <strong>Well, WTF is this?:</strong>
              <textarea
                className="editor-tldr-input"
                name="tldr"
                rows={2}
                defaultValue={editing ? editing.tldr || '' : ''}
                placeholder="One or two sentences summing up the story."
              />
            </div>

            <div className="editor-toolbar">
              <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><strong>B</strong></button>
              <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><em>I</em></button>
              <button type="button" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>S</s></button>
              <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><u>U</u></button>
              <button type="button" title="Add link" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>&#128279;</button>
              <button type="button" title="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('unlink')}>&#128279;&#8416;</button>

              <span className="editor-toolbar-divider" />

              <button type="button" className="editor-toolbar-wide" title="Small text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontSize(FONT_SIZES.small)}>S</button>
              <button type="button" className="editor-toolbar-wide" title="Normal text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontSize(FONT_SIZES.normal)}>M</button>
              <button type="button" className="editor-toolbar-wide" title="Large text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontSize(FONT_SIZES.large)}>L</button>
              <button type="button" className="editor-toolbar-wide" title="Extra-large text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontSize(FONT_SIZES.xlarge)}>XL</button>

              <span className="editor-toolbar-divider" />

              <button type="button" className="editor-toolbar-wide" title="Sans-serif font" style={{ fontFamily: FONT_FAMILIES.sans }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontFamily(FONT_FAMILIES.sans)}>Sans</button>
              <button type="button" className="editor-toolbar-wide" title="Serif font" style={{ fontFamily: FONT_FAMILIES.serif }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontFamily(FONT_FAMILIES.serif)}>Serif</button>
              <button type="button" className="editor-toolbar-wide" title="Monospace font" style={{ fontFamily: FONT_FAMILIES.mono }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFontFamily(FONT_FAMILIES.mono)}>Mono</button>
            </div>

            <div
              className="editor-body"
              data-placeholder="Start writing..."
              contentEditable
              suppressContentEditableWarning
              ref={editorRef}
              onPaste={handlePaste}
            />

            {/* Hidden fields kept in the form so handleSave can read them via form.<name>.value */}
            <input type="hidden" name="imageFit" value={previewFit} readOnly />
            <input type="hidden" name="imagePosition" value={previewPosition} readOnly />
          </div>

          <button type="button" className="editor-settings-fab" onClick={() => setShowSettings(true)}>
            &#9881; Settings
          </button>

          {
            <div
              className="editor-settings-overlay"
              style={{ display: showSettings ? 'flex' : 'none' }}
              onClick={() => setShowSettings(false)}
            >
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
              </div>
            </div>
          }
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
