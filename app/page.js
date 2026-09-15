import { getPublishedArticles, getHeroId } from '../lib/articles';
import { CAT_LABEL, CATS } from '../lib/categories';
import { MediaBox, ArticleCard } from '../components/ArticleCard';

export const revalidate = 0;

export default async function HomePage() {
  const [articles, heroId] = await Promise.all([getPublishedArticles(), getHeroId()]);

  if (articles.length === 0) {
    return <div className="admin-wrap"><p className="dek">No articles yet.</p></div>;
  }

  const hero = articles.find((a) => a.id === heroId) || articles[0];
  const secondaries = articles.filter((a) => a.id !== hero.id).slice(0, 2);

  return (
    <>
      <div className="hero">
        <a className="card card-link" href={`/article/${hero.id}`}>
          <MediaBox article={hero} height={460} />
          <div className="chip" style={{ background: `var(--cat-${hero.category})` }}>
            {CAT_LABEL[hero.category] || hero.category}
          </div>
          <h2 className="headline" style={{ fontSize: 'clamp(30px, 3.4vw, 46px)' }}>{hero.headline}</h2>
          {hero.dek ? <p className="dek" style={{ fontSize: 18, maxWidth: 640 }}>{hero.dek}</p> : null}
          <p className="byline">{hero.byline} &middot; {hero.read_time}</p>
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {secondaries.map((a, i) => (
            <div key={a.id}>
              {i > 0 ? <div style={{ height: 1, background: 'var(--line)', marginBottom: 28 }} /> : null}
              <ArticleCard article={a} headingTag="h3" headingSize={24} mediaHeight={200} />
            </div>
          ))}
        </div>
      </div>

      {CATS.map((cat) => {
        const items = articles.filter((a) => a.category === cat).slice(0, 3);
        if (items.length === 0) return null;
        return (
          <div className="category-section" key={cat}>
            <div className="category-header" style={{ borderBottom: `3px solid var(--cat-${cat})` }}>
              <h2 className="section-title" style={{ fontSize: 34, color: `var(--cat-${cat}-text)` }}>{CAT_LABEL[cat]}</h2>
              <a href={`/category/${cat}`} className="see-all">See All &rarr;</a>
            </div>
            <div className="card-grid">
              {items.map((a) => (
                <ArticleCard key={a.id} article={a} headingTag="h3" headingSize={22} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
