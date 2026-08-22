/**
 * Direção visual: Caderno de Margens — editorialismo neo-humanista, assimetria tranquila,
 * papel marfim, tinta verde-petróleo e leitura como foco central.
 */
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Menu,
  Search,
  X,
} from "lucide-react";

const heroImage = "/media/entrelinhas-hero-editorial.jpg";
const cityImage = "/media/entrelinhas-cidade-chuva.jpg";
const conversationImage = "/media/entrelinhas-mesa-conversa.jpg";
const archiveImage = "/media/entrelinhas-arquivo-notas.jpg";
const monogram = "/media/entrelinhas-monograma.png";

const navigation = ["Sociedade", "Cultura", "Mundo", "Tecnologia", "Ideias"];

const stories = [
  {
    tag: "Sociedade",
    title: "O que ainda nos aproxima quando tudo pede distância?",
    excerpt:
      "Há gestos mínimos que resistem à pressa: ouvir com demora, olhar sem responder logo, deixar uma mesa ficar ocupada.",
    author: "Marta Inês",
    date: "18 AGO 2026",
    read: "6 min",
    image: cityImage,
    tone: "city",
  },
  {
    tag: "Conversas",
    title: "Uma cidade também se lê pelas perguntas que deixa no ar",
    excerpt:
      "Entre um café que arrefece e um caderno aberto, uma conversa sobre os lugares onde ainda conseguimos imaginar em comum.",
    author: "Diogo Vale",
    date: "16 AGO 2026",
    read: "8 min",
    image: conversationImage,
    tone: "conversation",
  },
  {
    tag: "Memória",
    title: "O arquivo não é passado: é uma maneira de não esquecer o futuro",
    excerpt:
      "Procurar um rasto é aceitar que as histórias têm margens, rasuras e coisas que só aparecem quando voltamos a olhar.",
    author: "Teresa Neves",
    date: "12 AGO 2026",
    read: "5 min",
    image: archiveImage,
    tone: "archive",
  },
];

const columnists = [
  { initials: "MI", name: "Marta Inês", role: "Sociedade", color: "bg-[#a84038]" },
  { initials: "DV", name: "Diogo Vale", role: "Cultura", color: "bg-[#0b5f59]" },
  { initials: "TN", name: "Teresa Neves", role: "Ideias", color: "bg-[#1d312d]" },
  { initials: "AM", name: "Alex Monteiro", role: "Tecnologia", color: "bg-[#7d433c]" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const scrollToStories = () => {
    document.getElementById("leituras")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubscribe = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubscribed(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f0e8] text-[#1f2422]">
      <div className="announcement-bar">
        <span>LEITURA DE DOMINGO</span>
        <span className="hidden h-px w-8 bg-[#b5b0a8] sm:block" />
        <p>Ideias que continuam depois da última linha.</p>
        <button onClick={scrollToStories} className="announcement-link">
          Ver a edição <ArrowDownRight size={15} strokeWidth={1.8} />
        </button>
      </div>

      <header className="site-header">
        <div className="site-header__inner">
          <a href="#inicio" className="brand" aria-label="Entrelinhas, página inicial">
            <img src={monogram} alt="" className="brand-mark" />
            <span className="brand-wordmark">entrelinhas</span>
          </a>

          <nav className="desktop-nav" aria-label="Navegação principal">
            {navigation.map((item) => (
              <a href={`#${item.toLowerCase()}`} key={item}>
                {item}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <label className="search-control" aria-label="Pesquisar artigos">
              <Search size={17} strokeWidth={1.8} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar"
                aria-label="Pesquisar"
              />
            </label>
            <button className="subscribe-button" onClick={() => document.getElementById("carta")?.scrollIntoView({ behavior: "smooth" })}>
              A carta semanal
            </button>
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-nav" aria-label="Navegação móvel">
            {navigation.map((item) => (
              <a href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)} key={item}>
                {item}
                <ChevronRight size={16} />
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="inicio">
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-copy reveal-one">
              <div className="eyebrow-row">
                <span className="ink-bar" />
                <span>COLUNA DE ABERTURA</span>
                <span className="eyebrow-date">20 AGO 2026</span>
              </div>
              <h1>Nem tudo o que importa cabe numa notificação.</h1>
              <p className="hero-standfirst">
                Vivemos cercados de alertas, mas a atenção continua a ser um gesto raro. Uma coluna sobre recuperar o ritmo que permite pensar.
              </p>
              <div className="hero-footer">
                <div className="author-line">
                  <span className="author-dot">LM</span>
                  <span>
                    Por <strong>Leonor Matos</strong><br />
                    <em>Notas de presença</em>
                  </span>
                </div>
                <button className="read-link" onClick={scrollToStories}>
                  Ler a coluna <ArrowUpRight size={18} strokeWidth={1.7} />
                </button>
              </div>
            </div>

            <div className="hero-image-wrap reveal-two">
              <img src={heroImage} alt="Caderno aberto, caneta e ramos sobre uma mesa de madeira" className="hero-image" />
              <div className="hero-image-overlay" />
              <p className="hero-image-caption">Um caderno começa sempre por uma margem.</p>
              <div className="hero-image-number">01</div>
            </div>
          </div>
          <div className="hero-rule" />
        </section>

        <section className="topics-section" id="ideias">
          <div className="section-side-label">NAVEGAR<br />POR IDEIA</div>
          <div className="topic-rail">
            {[
              ["01", "Sociedade", "Conversas sobre o comum"],
              ["02", "Cultura", "O que fazemos com o que vemos"],
              ["03", "Mundo", "A distância que nos compromete"],
              ["04", "Tecnologia", "Viver entre máquinas e escolhas"],
            ].map(([number, topic, description]) => (
              <a href={`#${topic.toLowerCase()}`} className="topic-link" key={topic}>
                <span className="topic-number">{number}</span>
                <span className="topic-name">{topic}</span>
                <span className="topic-description">{description}</span>
                <ArrowUpRight size={17} strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </section>

        <section className="reading-section" id="leituras">
          <div className="section-heading">
            <div>
              <p className="section-kicker">LEITURAS DA SEMANA</p>
              <h2>Textos para levar<br /><em>com tempo.</em></h2>
            </div>
            <button className="all-stories-link" onClick={() => setQuery("Todas as colunas")}>Explorar todas <ArrowUpRight size={18} /></button>
          </div>

          <div className="story-layout">
            <article className="lead-story">
              <div className="story-image story-image--lead">
                <img src={stories[0].image} alt="Rua de Lisboa num dia de chuva" />
                <span className="story-index">02</span>
              </div>
              <div className="story-meta"><span>{stories[0].tag}</span><span>{stories[0].date}</span></div>
              <h3>{stories[0].title}</h3>
              <p>{stories[0].excerpt}</p>
              <a href="#sociedade" className="byline">{stories[0].author} <span>·</span> {stories[0].read}</a>
            </article>

            <div className="secondary-stories">
              {stories.slice(1).map((story, index) => (
                <article className="secondary-story" key={story.title}>
                  <div className="story-image story-image--secondary">
                    <img src={story.image} alt={story.tag === "Conversas" ? "Mesa de café com caderno e chávenas" : "Mesa de arquivo com cartões e lupa"} />
                    <span className="story-index">0{index + 3}</span>
                  </div>
                  <div className="secondary-story__content">
                    <div className="story-meta"><span>{story.tag}</span><span>{story.date}</span></div>
                    <h3>{story.title}</h3>
                    <a href="#cultura" className="byline">{story.author} <span>·</span> {story.read}</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="manifesto-section" id="sociedade">
          <div className="manifesto-gutter">ENTRELINHAS<br />NÃO É PRESSA</div>
          <div className="manifesto-copy">
            <span className="quote-mark">“</span>
            <p>Escrever é dar à atenção uma casa. Ler é aceitar entrar nela sem ter de sair igual.</p>
            <a href="#carta" className="text-link">O que nos move <ArrowUpRight size={18} /></a>
          </div>
          <div className="manifesto-stat"><strong>12</strong><span>vozes a escrever<br />com independência</span></div>
        </section>

        <section className="columnists-section" id="cultura">
          <div className="columnists-header">
            <p className="section-kicker">QUEM ESCREVE</p>
            <h2>Colunistas<br />em <em>foco.</em></h2>
            <p className="columnists-intro">Perspetivas distintas, uma vontade comum: tornar as perguntas mais nítidas.</p>
          </div>
          <div className="columnists-list">
            {columnists.map((person, index) => (
              <a className="columnist-row" href="#mundo" key={person.name}>
                <span className="columnist-order">0{index + 1}</span>
                <span className={`columnist-avatar ${person.color}`}>{person.initials}</span>
                <span className="columnist-name">{person.name}</span>
                <span className="columnist-role">{person.role}</span>
                <ArrowUpRight size={20} strokeWidth={1.45} />
              </a>
            ))}
          </div>
        </section>

        <section className="newsletter-section" id="carta">
          <div className="newsletter-mark"><img src={monogram} alt="" /></div>
          <div className="newsletter-copy">
            <p className="section-kicker">UMA VEZ POR SEMANA</p>
            <h2>Uma carta para<br />abrir <em>devagar.</em></h2>
            <p>As melhores colunas, uma recomendação inesperada e uma pergunta que fica consigo. Sem ruído.</p>
          </div>
          <form className="newsletter-form" onSubmit={handleSubscribe}>
            <label htmlFor="email">O seu endereço de email</label>
            <div className="email-row">
              <input id="email" type="email" required placeholder="nome@email.com" aria-label="O seu endereço de email" />
              <button type="submit" aria-label="Subscrever a carta semanal"><ArrowUpRight size={22} /></button>
            </div>
            <p className="form-note">{subscribed ? "Obrigado. A próxima carta chega até si." : "Pode sair quando quiser. Não partilhamos o seu email."}</p>
          </form>
        </section>
      </main>

      <footer className="site-footer" id="mundo">
        <a href="#inicio" className="brand footer-brand"><img src={monogram} alt="" className="brand-mark" /><span className="brand-wordmark">entrelinhas</span></a>
        <p>© 2026 Entrelinhas. Um espaço editorial independente.</p>
        <div className="footer-links"><a href="#tecnologia">Princípios</a><a href="#carta">Contacto</a><a href="#inicio">Instagram</a></div>
      </footer>
    </div>
  );
}
