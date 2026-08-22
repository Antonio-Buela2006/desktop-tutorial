export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  category: "Cultura" | "Música" | "Tecnologia" | "Opinião";
  author: string;
  date: string;
  readTime: string;
  image: string;
  featured?: boolean;
}

export const articles: Article[] = [
  {
    id: "1",
    slug: "tyler-flex-momento-historico",
    title: "A rima que parou a Hot 97: como Tyler e Flex reescreveram as regras da entrevista de rádio",
    excerpt: "Numa era em que cada palavra é medida por RP, o momento em que Tyler atira um verso inesperado sobre o DJ revela o poder do improviso na rádio ao vivo.",
    content: [
      "A rádio comercial viveu durante décadas de formato e previsibilidade. Artistas entram, promovem o novo álbum, respondem às mesmas cinco perguntas sobre colaborações e saem. Mas quando Tyler, The Creator entrou nos estúdios da Hot 97 para se sentar frente a frente com Funkmaster Flex, o guião desfez-se em segundos.",
      "O choque de Funkmaster Flex não foi apenas moral ou estético; foi o choque de ver um monstro sagrado da velha guarda confrontado com uma irreverência que recusa pedir licença. A rima atirada por Tyler — sobre a qual se gerou um debate imediato nas redes sociais — ilustra na perfeição a diferença entre a cultura de estúdio contemporânea e a liturgia dos anos 90.",
      "Para os ouvintes, o momento transformou-se num instantâneo cultural: a colisão entre a tradição rigorosa de Nova Iorque e a liberdade pós-moderna de um dos artistas mais influentes da sua geração. Mais do que a polêmica, o que fica é a prova de que a rádio ainda é capaz de momentos genuinamente imprevisíveis."
    ],
    category: "Cultura",
    author: "Redacção KULTURA",
    date: "20 Ago 2026",
    readTime: "4 min",
    image: "/manus-storage/broadcast-zine-hero_fe22e84b.png",
    featured: true,
  },
  {
    id: "2",
    slug: "futuro-do-vinil-nas-plataformas-digitais",
    title: "O ressurgimento analógico: porque é que os jovens continuam a esgotar edições em vinil",
    excerpt: "Numa altura em que tudo está a um clique de distância no streaming, o mercado de discos físicos regista recordes de vendas consecutivas.",
    content: [
      "À primeira vista, parece uma contradição insustentável. Com catálogos inteiros de música acessíveis instantaneamente através de telemóveis e auscultadores sem fios, o vinil físico continua a atrair compradores cada vez mais jovens.",
      "O fenómeno não se deve apenas à qualidade sonora superior — que divide audiófilos —, mas à necessidade de posse tátil. Numa economia de subscrição onde nada nos pertence verdadeiramente, o disco de vinil funciona como um objecto de arte e um compromisso com a escuta atenta.",
      "As lojas independentes de Lisboa, Porto e Coimbra relatam filas à porta em dias de lançamento. O formato físico deixou de ser um fóssil tecnológico para se assumir como o refúgio contra a hiper-aceleração digital."
    ],
    category: "Música",
    author: "Margarida Vale",
    date: "19 Ago 2026",
    readTime: "5 min",
    image: "/manus-storage/turntable-detail_1abd5504.jpg",
  },
  {
    id: "3",
    slug: "ia-e-criatividade-autenticidade",
    title: "Algoritmos na redacção: até onde pode a inteligência artificial escrever a cultura do nosso tempo?",
    excerpt: "A proliferação de textos gerados por modelos de linguagem coloca uma questão urgente aos jornalistas e criadores de conteúdos.",
    content: [
      "A facilidade com que ferramentas de IA geram prosa polida alterou profundamente o panorama dos media globais. No entanto, o resultado é frequentemente um mar de uniformidade cinzenta, desprovido de atrito, erro humano e perspectiva.",
      "O verdadeiro jornalismo cultural não vive da eficiência da síntese, mas do risco da opinião, da presença física no local e da intuição crítica. Quando tudo se torna perfeito e imediato, o valor desloca-se para a voz inconfundível do autor.",
      "O desafio para os próximos anos não será proibir a tecnologia, mas usá-la como ferramenta mecânica sem abdicar do pulso humano que torna uma crónica digna de ser lida."
    ],
    category: "Tecnologia",
    author: "Tomás Ribeiro",
    date: "18 Ago 2026",
    readTime: "6 min",
    image: "/manus-storage/radio-mic-archive_e4e5c998.jpg",
  },
  {
    id: "4",
    slug: "fim-do-algoritmo-cronologico",
    title: "Crónica: O cansaço das redes sociais baseadas em feeds infinitos e o regresso aos blogs independentes",
    excerpt: "Há um movimento silencioso de leitores a abandonar as grandes praças digitais em busca de cantos sossegados na web.",
    content: [
      "Passamos os dias a deslizar por ecrãs iluminados por notificações urgentes que amanhã já ninguém recorda. O algoritmo treinou-nos para a indignação rápida e para o consumo voraz.",
      "Não é de estranhar que o formato blog — o velho caderno de notas digital — esteja a viver uma redescoberta entusiástica. Leitores e criadores procuram espaços com ritmo próprio, tipografia cuidada e ausência de ruído publicitário.",
      "Ler um artigo sem pop-ups, sem banners a piscar e sem a pressão de comentar em trinta segundos é, hoje, um acto de resistência cultural."
    ],
    category: "Opinião",
    author: "Inês Castelo",
    date: "17 Ago 2026",
    readTime: "3 min",
    image: "/manus-storage/dj-turntable-blue_5f40d788.jpg",
  },
];
