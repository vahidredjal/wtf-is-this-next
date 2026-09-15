import { CAT_LABEL } from '../lib/categories';

const POSITION_CSS = {
  center: '50% 50%',
  top: '50% 0%',
  bottom: '50% 100%',
  left: '0% 50%',
  right: '100% 50%'
};

export function MediaBox({ article, height }) {
  if (!article.image_url) {
    return (
      <div className="img-ph" style={{ width: '100%', height }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--fg-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }
  const pos = POSITION_CSS[article.image_position || 'center'];
  return (
    <div className="img-ph" style={{ width: '100%', height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={article.image_url}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'fill', objectPosition: pos, display: 'block' }}
      />
    </div>
  );
}

export function ArticleCard({ article, headingTag: H, headingSize, mediaHeight = 220 }) {
  return (
    <a className="card card-link" href={`/article/${article.id}`}>
      <MediaBox article={article} height={mediaHeight} />
      <div className="chip" style={{ background: `var(--cat-${article.category})` }}>
        {CAT_LABEL[article.category] || article.category}
      </div>
      <H className="headline" style={{ fontSize: headingSize }}>{article.headline}</H>
      <p className="byline">{article.byline} &middot; {article.read_time}</p>
    </a>
  );
}
