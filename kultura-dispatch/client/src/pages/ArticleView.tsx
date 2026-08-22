import { useParams, Link } from "wouter";
import { articles, Article } from "@/data/articles";
import { ArrowLeft, Clock, Share2, Check, Bookmark } from "lucide-react";
import { useState } from "react";

export default function ArticleView() {
  const params = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const article = articles.find((a) => a.slug === params.slug) || articles[0];

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="site-shell">
      <aside className="signal-rail" aria-label="Identidade da publicação">
        <Link href="/" className="rail-mark" aria-label="KULTURA">
          <span>KD</span>
        </Link>
        <div className="rail-vertical">KULTURA / DISPATCH</div>
        <div className="rail-bottom">
          <span className="live-dot" />
          <span>LIVE</span>
        </div>
      </aside>

      <div className="page-content">
        <header className="topbar">
          <Link href="/" className="wordmark">
            <span className="wordmark-symbol">KD</span>
            <span className="wordmark-text">Kultura Dispatch</span>
          </Link>
          <div className="topbar-actions">
            <Link href="/" className="back-link">
              <ArrowLeft size={16} /> Voltar ao feed
            </Link>
          </div>
          <span className="topbar-code">ISSUE / 042</span>
        </header>

        <main className="article-main">
          <article className="article-container">
            <div className="article-issue-bar">
              <span>DISPATCH / ISSUE 042</span>
              <span>FILE 001 / ON AIR</span>
            </div>
            <header className="article-header">
              <div className="article-meta-top">
                <span className="category-badge">{article.category}</span>
                <span className="dot-separator">•</span>
                <span className="article-date">{article.date}</span>
                <span className="dot-separator">•</span>
                <span className="read-time"><Clock size={13} /> {article.readTime} de leitura</span>
              </div>
              <h1 className="article-title">{article.title}</h1>
              <p className="article-excerpt">{article.excerpt}</p>
              
              <div className="article-author-row">
                <div className="author-info">
                  <strong>Por {article.author}</strong>
                  <span>Redacção Editorial KULTURA</span>
                </div>
                <div className="article-toolbar">
                  <button onClick={handleShare} className="tool-btn" title="Partilhar link">
                    {copied ? <Check size={16} /> : <Share2 size={16} />}
                    <span>{copied ? "Copiado!" : "Partilhar"}</span>
                  </button>
                  <button onClick={() => setSaved(!saved)} className={`tool-btn ${saved ? 'is-active' : ''}`} title="Guardar artigo">
                    <Bookmark size={16} />
                    <span>{saved ? "Guardado" : "Guardar"}</span>
                  </button>
                </div>
              </div>
            </header>

            <div className="article-hero-image">
              <img src={article.image} alt={article.title} />
              <div className="image-caption-bar">
                <span>DOCUMENTO / ARQUIVO EDITORIAL</span>
                <span>KULTURA DISPATCH</span>
              </div>
            </div>

            <div className="article-body">
              {article.content.map((paragraph, index) => (
                <div key={index}>
                  <p>{paragraph}</p>
                  {index === 1 && (
                    <aside className="article-pullquote">
                      <span>EDITORIAL INTERRUPTION / 02</span>
                      <strong>“A rádio ainda é capaz de momentos genuinamente imprevisíveis.”</strong>
                    </aside>
                  )}
                </div>
              ))}
            </div>

            <footer className="article-footer-box">
              <div className="footer-box-content">
                <span className="red-kicker">SUBSCREVA A EDIÇÃO IMPRESSA & DIGITAL</span>
                <h3>Histórias que merecem tempo de antena.</h3>
                <p>Receba todas as semanas análises de cultura, música e tecnologia sem ruído.</p>
                <div className="newsletter-form-inline">
                  <input type="email" placeholder="O seu endereço de email..." />
                  <button type="button" className="button button-primary">Subscrever</button>
                </div>
              </div>
            </footer>
          </article>

          <section className="related-section">
            <div className="section-heading-small">
              <span>OUTROS ARTIGOS RECENTES</span>
              <div className="heading-rule" />
            </div>
            <div className="related-grid">
              {articles
                .filter((a) => a.id !== article.id)
                .slice(0, 3)
                .map((item) => (
                  <Link key={item.id} href={`/artigo/${item.slug}`} className="related-card">
                    <span className="related-cat">{item.category}</span>
                    <h4>{item.title}</h4>
                    <span className="related-date">{item.date}</span>
                  </Link>
                ))}
            </div>
          </section>
          <aside className="article-side-rail" aria-label="Ficha editorial">
            <div className="issue-stamp-large">KD<br /><span>042</span></div>
            <div className="side-rule" />
            <span>REPORT / CULTURE</span>
            <p>Uma peça da redacção KULTURA DISPATCH sobre rádio, improviso e o poder do momento ao vivo.</p>
            <span className="side-vertical-label">READ / LISTEN / THINK</span>
          </aside>
        </main>

        <footer className="footer">
          <div className="footer-brand">
            <span>KD</span>
            <p>Kultura Dispatch<br /><small>jornalismo de cultura e actualidade.</small></p>
          </div>
          <div className="footer-meta">
            <span>ISSN 2792-411X</span>
            <span>LISBOA / PORTO</span>
          </div>
          <Link href="/" className="back-top">Início <ArrowLeft size={14} /></Link>
        </footer>
      </div>
    </div>
  );
}
