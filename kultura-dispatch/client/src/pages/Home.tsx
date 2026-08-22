/*
 * KULTURA Dispatch - Blog de Notícias
 * Broadcast Zine style system: paper-cream canvas, charcoal ink, Signal Red #E4372E
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { articles, Article } from "@/data/articles";
import { ArrowUpRight, Clock, Filter, Radio, Search } from "lucide-react";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [selectedCategory, searchQuery]);

  const categories = ["Todas", "Cultura", "Música", "Tecnologia", "Opinião"];

  const filteredArticles = articles.filter((article) => {
    const matchesCategory =
      selectedCategory === "Todas" || article.category === selectedCategory;
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredArticle = articles.find((a) => a.featured) || articles[0];

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

          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>Menu</span>
          </button>

          <nav id="main-nav" className={`main-nav ${menuOpen ? "is-open" : ""}`}>
            <a href="#destaque" onClick={() => setMenuOpen(false)}>Destaque</a>
            <a href="#arquivo" onClick={() => setMenuOpen(false)}>Artigos</a>
            <a href="#sobre" onClick={() => setMenuOpen(false)}>Sobre</a>
          </nav>

          <div className="topbar-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <main id="top">
          {/* HERO / FEATURED ARTICLE */}
          {!searchQuery && selectedCategory === "Todas" && (
            <section className="hero-news" id="destaque">
              <div className="hero-news-content reveal">
                <div className="eyebrow">
                  <span className="eyebrow-line" />
                  EDIÇÃO DE HOJE / {featuredArticle.category.toUpperCase()}
                </div>
                <h1 className="hero-news-title">
                  <Link href={`/artigo/${featuredArticle.slug}`}>
                    {featuredArticle.title}
                  </Link>
                </h1>
                <p className="hero-news-excerpt">{featuredArticle.excerpt}</p>
                <div className="hero-news-meta">
                  <span>Por {featuredArticle.author}</span>
                  <span className="dot-separator">•</span>
                  <span>{featuredArticle.date}</span>
                  <span className="dot-separator">•</span>
                  <span className="read-time"><Clock size={12} /> {featuredArticle.readTime}</span>
                </div>
                <div className="hero-news-actions">
                  <Link href={`/artigo/${featuredArticle.slug}`} className="button button-primary">
                    Ler artigo completo <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="hero-news-image reveal">
                <Link href={`/artigo/${featuredArticle.slug}`} className="image-frame-link">
                  <img src={featuredArticle.image} alt={featuredArticle.title} />
                  <div className="hero-stamp">TOP<br />STORY</div>
                </Link>
              </div>
            </section>
          )}

          <div className="signal-strip" aria-label="Ticker de notícias">
            <div><span>TENDÊNCIA</span><strong>#TylerFlexHot97</strong></div>
            <div><span>MERCADO</span><strong>Vinil +24% YoY</strong></div>
            <div><span>OPINIÃO</span><strong>Fim dos feeds infinitos</strong></div>
            <div><span>ESTATUTO</span><strong>Jornalismo Independente</strong></div>
          </div>

          {/* ARTICLE ARCHIVE & FILTERS */}
          <section className="archive-section section-block" id="arquivo">
            <div className="archive-header reveal">
              <div>
                <span className="red-kicker">ARQUIVO DISPATCH</span>
                <h2>Crónicas e Notícias <em>Recentes.</em></h2>
              </div>
              
              <div className="category-filters">
                <Filter size={14} />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`filter-btn ${selectedCategory === cat ? "is-active" : ""}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="articles-grid reveal">
              {filteredArticles.map((article) => (
                <article key={article.id} className="article-card">
                  <Link href={`/artigo/${article.slug}`} className="card-thumb">
                    <img src={article.image} alt={article.title} />
                    <span className="card-cat-tag">{article.category}</span>
                  </Link>
                  <div className="card-content">
                    <div className="card-meta">
                      <span>{article.date}</span>
                      <span>•</span>
                      <span>{article.readTime}</span>
                    </div>
                    <h3>
                      <Link href={`/artigo/${article.slug}`}>{article.title}</Link>
                    </h3>
                    <p>{article.excerpt}</p>
                    <div className="card-footer">
                      <span className="card-author">Por {article.author}</span>
                      <Link href={`/artigo/${article.slug}`} className="read-more-link">
                        Ler <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}

              {filteredArticles.length === 0 && (
                <div className="no-results">
                  <Radio size={32} />
                  <p>Nenhum artigo encontrado para a pesquisa efectuada.</p>
                  <button onClick={() => { setSearchQuery(""); setSelectedCategory("Todas"); }} className="button button-primary">
                    Repor filtros
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ABOUT SECTION */}
          <section className="about-section" id="sobre">
            <div className="about-inner reveal">
              <div>
                <span className="red-kicker">MANIFESTO KULTURA</span>
                <h2>Informação com peso, <em>sem pressas.</em></h2>
                <p>
                  O Kultura Dispatch é um blog de notícias e ensaios dedicado à intersecção entre a cultura contemporânea, a música, a tecnologia e o pensamento crítico. Recusamos o ritmo vertiginoso do ciclo diário de notícias em prol de peças fundamentadas, investigação e estética editorial cuidada.
                </p>
              </div>
              <div className="about-stats">
                <div className="stat-box">
                  <strong>04</strong>
                  <span>Editorias</span>
                </div>
                <div className="stat-box">
                  <strong>100%</strong>
                  <span>Independente</span>
                </div>
                <div className="stat-box">
                  <strong>2026</strong>
                  <span>Fundação</span>
                </div>
              </div>
            </div>
          </section>
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
          <a href="#top" className="back-top">Voltar ao topo <ArrowUpRight size={14} /></a>
        </footer>
      </div>
    </div>
  );
}
