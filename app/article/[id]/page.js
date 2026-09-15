import { getArticleById } from '../../../lib/articles';
import { CAT_LABEL } from '../../../lib/categories';
import { POSITION_CSS } from '../../../lib/imageFit';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export async function generateMetadata({ params }) {
  const article = await getArticleById(params.id);
  if (!article) {
    return { title: "Can't find that one — WTF Is This" };
  }
  const description = article.dek || article.tldr || "Nobody asked, we're telling you anyway.";
  const title = `${article.headline} — WTF Is This`;
  const image = article.image_url || '/og-image.png';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: 'article',
      url: `/article/${article.id}`
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image]
    }
  };
}

export default async function ArticlePage({ params }) {
  const article = await getArticleById(params.id);
  if (!article) notFound();

  const isDraft = article.status !== 'published';
  const dateStr = new Date(article.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <>
      <div className="admin-wrap">
        <a href="/" className="see-all" style={{ display: 'inline-block', marginBottom: 24 }}>&larr; Back to the Feed</a>
        {isDraft ? (
          <div className="tldr-box" style={{ borderLeftColor: 'var(--fg-dim)', marginBottom: 20 }}>
            This is a draft &mdash; only visible to editors, not public yet.
          </div>
        ) : null}
        <div className="chip" style={{ background: `var(--cat-${article.category})` }}>
          {CAT_LABEL[article.category] || article.category}
        </div>
        <h1 className="headline" style={{ fontSize: 'clamp(32px, 4.2vw, 52px)', marginTop: 16 }}>{article.headline}</h1>
        {article.dek ? <p className="dek" style={{ fontSize: 19, marginTop: 16 }}>{article.dek}</p> : null}
        <p className="byline" style={{ marginTop: 16 }}>{article.byline} &middot; {dateStr} &middot; {article.read_time}</p>
      </div>

      {article.image_url ? (
        <div className="img-ph" style={{ width: '100%', height: 520, marginTop: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image_url}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: article.image_fit || 'cover',
              objectPosition: POSITION_CSS[article.image_position || 'center'],
              display: 'block'
            }}
          />
        </div>
      ) : null}

      {article.tldr ? (
        <div className="admin-wrap" style={{ paddingTop: 32 }}>
          <div className="tldr-box"><strong>Well, WTF is this?: {article.tldr}</strong></div>
        </div>
      ) : null}

      <div
        className="admin-wrap article-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          paddingTop: article.tldr ? 24 : (article.image_url ? 40 : 32)
        }}
        dangerouslySetInnerHTML={{ __html: article.body_html || '' }}
      />
    </>
  );
}
