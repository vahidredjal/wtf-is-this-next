import { getPublishedArticles } from '../../../lib/articles';
import { CAT_LABEL, CATS } from '../../../lib/categories';
import { ArticleCard } from '../../../components/ArticleCard';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export function generateMetadata({ params }) {
  const label = CAT_LABEL[params.cat];
  if (!label) return {};
  return { title: `${label} — WTF Is This` };
}

export default async function CategoryPage({ params }) {
  if (!CATS.includes(params.cat)) notFound();
  const articles = await getPublishedArticles();
  const items = articles.filter((a) => a.category === params.cat);
  const label = CAT_LABEL[params.cat];

  return (
    <div className="category-section" style={{ paddingTop: 44 }}>
      <div className="category-header" style={{ borderBottom: `3px solid var(--cat-${params.cat})` }}>
        <h2 className="section-title" style={{ fontSize: 34, color: `var(--cat-${params.cat}-text)` }}>{label}</h2>
      </div>
      {items.length === 0 ? (
        <p className="dek">No articles in this category yet.</p>
      ) : (
        <div className="card-grid">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} headingTag="h3" headingSize={22} />
          ))}
        </div>
      )}
    </div>
  );
}
