import './globals.css';
import EditorNavLink from '../components/EditorNavLink';
import UtilityUser from '../components/UtilityUser';
import FooterAuthButton from '../components/FooterAuthButton';
import { CATS, CAT_LABEL } from '../lib/categories';

export const metadata = {
  metadataBase: new URL('https://wtfisthis.wtf'),
  title: 'WTF Is This',
  description: "Nobody asked, we're telling you anyway.",
  openGraph: {
    title: 'WTF Is This',
    description: "Nobody asked, we're telling you anyway.",
    url: '/',
    siteName: 'WTF Is This',
    images: ['/og-image.png'],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WTF Is This',
    description: "Nobody asked, we're telling you anyway.",
    images: ['/og-image.png']
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <div className="page">
          <div className="utility-bar">
            <div className="eyebrow" style={{ color: 'var(--fg-dim)' }}>
              WTF IS THIS &mdash; NOBODY ASKED, WE&apos;RE TELLING YOU ANYWAY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <UtilityUser />
            </div>
          </div>

          <div className="masthead">
            <a href="/" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <h1 className="headline wordmark">
                <span style={{ color: 'var(--accent-text)' }}>WTF</span> IS THIS
              </h1>
            </a>
            <div className="nav-row">
              <a href="/" className="nav-link">Home</a>
              {CATS.map((cat) => (
                <a key={cat} href={`/category/${cat}`} className="nav-link">{CAT_LABEL[cat]}</a>
              ))}
              <EditorNavLink />
            </div>
          </div>
          <div style={{ height: 3, background: 'var(--line-strong)', margin: '0 clamp(20px, 4vw, 48px)' }} />

          <div id="app">{children}</div>

          <div className="footer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 className="headline" style={{ fontSize: 26 }}>
                <span style={{ color: 'var(--accent-text)' }}>WTF</span> IS THIS
              </h3>
              <p className="byline" style={{ color: 'var(--fg-dim)' }}>&copy; 2026 WTF IS THIS MEDIA. WE&apos;RE NOT SORRY.</p>
              <FooterAuthButton />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
