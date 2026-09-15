export default function NotFound() {
  return (
    <div className="admin-wrap">
      <h1 className="headline" style={{ fontSize: 40 }}>Can&apos;t find that one.</h1>
      <p className="dek" style={{ marginTop: 12 }}>
        <a href="/" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>Back to the feed</a>
      </p>
    </div>
  );
}
