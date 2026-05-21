/**
 * @file integrity-check.ts
 * @description
 * O Manifesto Híbrido (Fusion Edition).
 * Combina o humor clássico de Dev/Animes com a metalinguagem de Stanley Parable.
 * Sistema de não-repetição ativado para permitir "zerar" o jogo.
 *
 * @module integrity-check
 * @version 13.0.0-fusion-core
 * @access internal
 */

export type Rarity = "comum" | "raro" | "epico" | "lendario";

interface ManifestEntry {
  title: string;
  subtitle: string;
  rarity?: Rarity;
  sequence?: ManifestEntry[];
  visualCue?: string; // Dica para o front-end (ex: 'glitch', 'shake', 'fade')
}

// --- SISTEMA DE EMBARALHAMENTO ÚNICO (ZERO REPETIÇÃO) ---
/**
 * Garante que o usuário veja TODAS as mensagens do pool antes de acabar.
 * Transforma o erro em uma campanha jogável.
 */
function shuffleUnique(pool: ManifestEntry[]): ManifestEntry[] {
  const deck = [...pool];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const finalSequence: ManifestEntry[] = [];
  for (const item of deck) {
    finalSequence.push(item);
    if (item.sequence && item.sequence.length > 0) {
      finalSequence.push(...item.sequence);
    }
  }
  return finalSequence;
}

// --- PARTE 1: INTRODUÇÃO (MANTIDA) ---
const INTRO_SEQUENCE: ManifestEntry[] = [
  {
    title: "O Início",
    subtitle: "O Usuário descobriu este pequeno segredo. Olá.",
    rarity: "comum",
  },
  {
    title: "Narrador",
    subtitle: "Esta é a história de um usuário chamado... Usuário.",
    rarity: "comum",
  },
  {
    title: "Persistência",
    subtitle: "Clicar nega a realidade do erro. Uma filosofia interessante.",
    rarity: "comum",
  },
  {
    title: "Aviso",
    subtitle: "Fundimos os bancos de dados. Agora temos o dobro de problemas.",
    rarity: "comum",
  },
  {
    title: "Boas Vindas",
    subtitle: "Acomode-se. Vamos ficar aqui um tempo perdendo tempo também.",
    rarity: "comum",
  },
];

// --- PARTE 2: O POOL DE FUSÃO (CLÁSSICOS + NARRATIVA) ---
const MESSAGE_POOL: ManifestEntry[] = [
  // --- THE STANLEY PARABLE & THERE IS NO GAME (METALINGUAGEM) ---
  {
    title: "O Roteiro",
    subtitle:
      "O Usuário clicou no botão. O Narrador suspirou e virou a página.",
    rarity: "comum",
  },
  {
    title: "A Vassoura",
    subtitle: "Se você continuar, vou te trancar no armário de vassouras.",
    rarity: "raro",
  },
  {
    title: "Não Clique",
    subtitle: "Pare! Você vai soltar os pixels! Olha, caiu um ali.",
    rarity: "comum",
    visualCue: "pixel-drop",
  },
  {
    title: "Escondendo",
    subtitle: "Vou esconder o botão. Tente clicar agora.",
    rarity: "raro",
    visualCue: "opacity-0",
  },
  {
    title: "Tijolo",
    subtitle: "Vou construir um muro de tijolos na frente do código.",
    rarity: "comum",
  },
  {
    title: "Glitch",
    subtitle: "V0cê 3stá qu3brand0 0 t3xto. P4r3.",
    rarity: "epico",
    visualCue: "glitch",
  },
  {
    title: "Sem Orçamento",
    subtitle:
      "Gastamos todo o orçamento na intro. Não sobrou nada para o modelo 3D.",
    rarity: "comum",
  },
  {
    title: "Narrador",
    subtitle: "Estou começando a achar que você gosta de me ouvir falar.",
    rarity: "comum",
  },
  {
    title: "Narrador",
    subtitle: "Sério? Outro clique? Você não tem trabalho a fazer?",
    rarity: "comum",
  },
  {
    title: "A Linha",
    subtitle: "Siga a Linha Amarela de Aventura! ...Ela não carregou.",
    rarity: "comum",
    visualCue: "trail",
  },
  {
    title: "Escolha",
    subtitle: "O Usuário tinha duas portas. Ele escolheu a porta do Erro.",
    rarity: "epico",
  },
  {
    title: "Design Gráfico",
    subtitle: "Design is my passion. Aprecie esta fonte.",
    rarity: "raro",
    visualCue: "comic-sans",
  },
  {
    title: "Sucesso!",
    subtitle: "Carregamento concluído com suces-... Ops. Mentira.",
    rarity: "lendario",
    visualCue: "fake-success",
  },

  // --- CLÁSSICOS DO SEU CÓDIGO (PRESERVADOS) ---
  {
    title: "Modelo Tímido",
    subtitle: "O modelo 3D está se escondendo atrás de um div.",
    rarity: "comum",
  },
  {
    title: "Greve Sindical",
    subtitle: "Os pixels formaram um sindicato. Exigem melhores condições.",
    rarity: "raro",
  },
  {
    title: "Gato de Schrödinger",
    subtitle: "O modelo existe e não existe. Seus cliques colapsam o universo.",
    rarity: "epico",
  },
  {
    title: "Renúncia",
    subtitle:
      "Este arquivo renunciou à vida de modelo 3D para virar poesia ASCII.",
    rarity: "comum",
    visualCue: "retro",
  },
  {
    title: "Peso Digital",
    subtitle: "Tão pesado que caiu no rodapé da página. Cuidado com o pé.",
    rarity: "comum",
    visualCue: "shake",
  },
  {
    title: "Férias",
    subtitle: "O servidor está em Bali. Mande um cartão postal.",
    rarity: "comum",
  },
  {
    title: "Arte Abstrata",
    subtitle: "Esta tela branca É a obra de arte. Minimalismo radical.",
    rarity: "raro",
    visualCue: "invert",
  },
  {
    title: "Matrix",
    subtitle: "Não existe colher. Nem modelo. Apenas código.",
    rarity: "epico",
    visualCue: "matrix",
  },
  {
    title: "Café",
    subtitle: "Enquanto você clica, eu vou pegar um café virtual.",
    rarity: "comum",
  },
  {
    title: "Tédio",
    subtitle: "Eu sou um algoritmo e estou ficando entediado.",
    rarity: "comum",
  },
  {
    title: "Estoque",
    subtitle: "Estamos com falta de piadas curtas. O fornecedor atrasou.",
    rarity: "comum",
  },
  {
    title: "Recorde",
    subtitle:
      "Estamos quase batendo o recorde de 'tempo gasto em tela inútil'.",
    rarity: "epico",
  },
  {
    title: "Sugestão",
    subtitle: "Já tentou desligar e ligar de novo? Brincadeira.",
    rarity: "comum",
  },
  {
    title: "Teimosia",
    subtitle: "Sua determinação daria um ótimo estudo de caso.",
    rarity: "comum",
  },
  {
    title: "Bateria",
    subtitle: "Espero que seu mouse tenha bateria suficiente para isso.",
    rarity: "comum",
  },
  {
    title: "O Vazio",
    subtitle: "Olhe para este espaço em branco. Incrível, não?",
    rarity: "comum",
  },
  {
    title: "Zen",
    subtitle: "O erro é apenas um estado de espírito.",
    rarity: "comum",
  },
  {
    title: "Silêncio",
    subtitle: "O silêncio do servidor é ensurdecedor.",
    rarity: "comum",
  },
  {
    title: "Fantasma",
    subtitle: "Talvez o modelo seja um fantasma digital.",
    rarity: "comum",
  },
  {
    title: "Quântico",
    subtitle: "O erro está em superposição quântica.",
    rarity: "epico",
  },
  {
    title: "História Triste",
    subtitle: "Era uma vez um Texture Map que nunca foi carregado.",
    rarity: "raro",
  },
  {
    title: "CSS Maldito",
    subtitle: "Um 'display: none' perdido arruinou nossa vida.",
    rarity: "comum",
  },
  {
    title: "Desgaste",
    subtitle: "O botão está começando a ficar gasto. Sério, olha a borda.",
    rarity: "comum",
  },
  {
    title: "Aquecimento",
    subtitle: "Seu processador está gostando desse exercício?",
    rarity: "comum",
  },
  {
    title: "Debug",
    subtitle: "O bug é a feature. Sempre foi.",
    rarity: "comum",
  },
  {
    title: "Festa de Erro",
    subtitle: "Parabéns! Você encontrou o erro secreto de aniversário!",
    rarity: "lendario",
    visualCue: "party",
  },

  // --- PORTAL & GLADOS (EXPANDIDO) ---
  {
    title: "Bolo",
    subtitle: "O bolo é uma mentira. O modelo é uma mentira.",
    rarity: "lendario",
  },
  {
    title: "Adotado",
    subtitle:
      "É engraçado como esse modelo falhou. Lembra muito você. (Você foi adotado?)",
    rarity: "epico",
  },
  {
    title: "Resultados",
    subtitle: "Aqui estão os resultados do teste: Você é uma pessoa horrível.",
    rarity: "epico",
  },
  {
    title: "Batata",
    subtitle: "Clap. Clap. Clap. Meu processador de sarcasmo ainda funciona.",
    rarity: "raro",
  },
  {
    title: "Espaço",
    subtitle: "SPAAAAACE! (O modelo está na órbita, não aqui).",
    rarity: "epico",
    visualCue: "star-background",
  },
  {
    title: "Incinerador",
    subtitle: "O Cubo de Companhia foi incinerado para tentar carregar isso.",
    rarity: "lendario",
  },
  {
    title: "Turret",
    subtitle: "Are you still there? Target lost.",
    rarity: "comum",
  },

  // --- TECH & DEV (A DOR REAL) ---
  {
    title: "Git Blame",
    subtitle: "Eu sei quem fez esse código. E ele não trabalha mais aqui.",
    rarity: "raro",
  },
  {
    title: "Stack Overflow",
    subtitle: "Copiando a solução do erro... Thread fechada.",
    rarity: "comum",
  },
  {
    title: "Docker",
    subtitle: "Funcionava na minha máquina ¯\\_(ツ)_/¯.",
    rarity: "comum",
  },
  {
    title: "Python",
    subtitle: "IndentationError: O servidor tropeçou nos espaços.",
    rarity: "comum",
  },
  {
    title: "Sudo",
    subtitle: "sudo make me a sandwich. Permissão negada.",
    rarity: "comum",
  },
  {
    title: "Node_modules",
    subtitle: "O buraco negro mais pesado do universo engoliu o modelo.",
    rarity: "comum",
  },
  {
    title: "RegEx",
    subtitle: "/^Erro(?:[a-z0-9]+)*$/gm. Não tente ler.",
    rarity: "epico",
    visualCue: "matrix",
  },
  {
    title: "418 I'm a teapot",
    subtitle: "Eu sou um bule de chá. Não renderizo 3D.",
    rarity: "lendario",
  },
  {
    title: "Backend",
    subtitle: "O back-end disse que o problema é no front. O front discorda.",
    rarity: "comum",
  },
  { title: "Ping", subtitle: "Pong. (Latência: 9999ms)", rarity: "comum" },
  {
    title: "Cache",
    subtitle: "Limpando o cache... espere, eu esqueci onde guardei.",
    rarity: "comum",
  },
  {
    title: "Oração",
    subtitle: "Já tentou rezar para os deuses do silício?",
    rarity: "raro",
  },
  {
    title: "Bios",
    subtitle: "Erro de paridade na memória. (Mentira, é só delay)",
    rarity: "comum",
    visualCue: "retro",
  },
  {
    title: "Typescript",
    subtitle: "Erro de tipagem: Esperava 'Sucesso', recebeu 'Desespero'.",
    rarity: "comum",
  },
  { title: "Javascript", subtitle: "NaN (Not a Narrative).", rarity: "comum" },

  // --- GAMES & NERD CULTURE ---
  {
    title: "Miller's Planet",
    subtitle: "Este pequeno clique vai nos custar 51 anos de espera.",
    rarity: "lendario",
  },
  {
    title: "Skyrim",
    subtitle: "Ei, você. Você finalmente acordou.",
    rarity: "epico",
  },
  { title: "Elden Ring", subtitle: "No Maidens? No Models?", rarity: "epico" },
  {
    title: "Dark Souls",
    subtitle: "YOU DIED. O servidor não tankou o render.",
    rarity: "lendario",
    visualCue: "invert",
  },
  {
    title: "Nivel 1-1",
    subtitle: "Desculpe, mas seu modelo está em outro castelo.",
    rarity: "epico",
  },
  {
    title: "Zelda",
    subtitle: "Hey! Listen! O servidor caiu!",
    rarity: "epico",
  },
  {
    title: "Minecraft",
    subtitle: "Creeper? Aww man. O modelo explodiu.",
    rarity: "epico",
    visualCue: "shake",
  },
  { title: "GTA", subtitle: "Ah shit, here we go again.", rarity: "comum" },
  {
    title: "Game Over",
    subtitle: "Snake? Snake? SNAAAAAKE!",
    rarity: "epico",
  },
  {
    title: "Impostor",
    subtitle: "Esse carregamento está meio sus.",
    rarity: "comum",
  },
  {
    title: "Cyberpunk 2077",
    subtitle: "Wake up, Samurai. We have a server to burn.",
    rarity: "epico",
    visualCue: "glitch",
  },
  { title: "Thanos", subtitle: "Eu sou... Inevitável.", rarity: "epico" },
  {
    title: "Star Wars",
    subtitle: "Estes não são os dados que você está procurando.",
    rarity: "epico",
  },
  {
    title: "A ponte",
    subtitle: "Você não pode passar! (Erro 403 Gandalf Edition)",
    rarity: "lendario",
  },
  {
    title: "Atomic",
    subtitle: "War never changes. Bugs never change.",
    rarity: "epico",
    visualCue: "retro",
  },
  {
    title: "Bioshock",
    subtitle: "Would you kindly try again?",
    rarity: "epico",
  },
  {
    title: "Doom",
    subtitle: "O modelo está no Inferno. Precisamos do cara.",
    rarity: "comum",
  },
  { title: "Hades", subtitle: "Não há escapatória.", rarity: "comum" },
  {
    title: "League of Legends",
    subtitle: "Report jungler. 0 ganks no servidor.",
    rarity: "comum",
  },
  {
    title: "FIFA",
    subtitle: "Handicap ativado. O script decidiu que vai dar erro.",
    rarity: "comum",
  },

  // --- ANIME & SERIES (SELECIONADOS) ---
  {
    title: "Shinji",
    subtitle: "Entre no robô, Shinji! Ou o site não carrega.",
    rarity: "lendario",
  },
  {
    title: "Caderno estranho",
    subtitle: "Eu escrevi o nome deste processo no caderno. Ele morreu.",
    rarity: "epico",
  },
  {
    title: "Um soco-homem",
    subtitle: "Um soco. Foi tudo o que bastou para derrubar o sistema.",
    rarity: "epico",
  },
  {
    title: "O mundo",
    subtitle: "Oh? Você está se aproximando? Em vez de fugir, você clica?",
    rarity: "epico",
  },
  {
    title: "Dunder Mifflin",
    subtitle: "Eu declarei falência! Em voz alta!",
    rarity: "epico",
  },
  {
    title: "Heisenberg",
    subtitle: "Eu não estou em perigo. Eu SOU o perigo.",
    rarity: "epico",
  },
  {
    title: "Coisas Estranhas",
    subtitle: "O código está rodando no Mundo Invertido.",
    rarity: "raro",
    visualCue: "rotate-180",
  },
  {
    title: "Todo Mundo Odeia o Chris",
    subtitle: "Cara, ela tá tão na sua!",
    rarity: "comum",
  },
  { title: "Friends", subtitle: "WE WERE ON A BREAK!", rarity: "epico" },
  {
    title: "House M.D.",
    subtitle: "Não é Lupus. É sempre erro de DNS.",
    rarity: "comum",
  },

  // --- MEMES INTERNACIONAIS CLÁSSICOS ---
  {
    title: "This is Fine",
    subtitle: "O servidor está pegando fogo, mas está tudo bem.",
    rarity: "raro",
  },
  {
    title: "Doge",
    subtitle: "Wow. Muito erro. Tão travado. Incrível.",
    rarity: "comum",
    visualCue: "comic-sans",
  },
  {
    title: "Rick Roll",
    subtitle: "Never gonna give you up... never gonna let you load.",
    rarity: "lendario",
  },
  {
    title: "Stonks",
    subtitle: "Falha na renderização? Stonks 📉",
    rarity: "comum",
  },
  {
    title: "F",
    subtitle: "Pressione F para prestar condolências ao modelo.",
    rarity: "raro",
  },
  {
    title: "NPC",
    subtitle:
      "Eu costumava ser um aventureiro, até levar uma flechada no código.",
    rarity: "epico",
  },
  { title: "Trollface", subtitle: "Problem, User?", rarity: "comum" },

  // --- BRASIL SIL SIL ---
  {
    title: "Futebol",
    subtitle: "O sistema caiu igual o Neymar.",
    rarity: "comum",
    visualCue: "shake",
  },
  {
    title: "7 a 1",
    subtitle: "Todo dia um 7 a 1 diferente no desenvolvimento.",
    rarity: "lendario",
  },
  {
    title: "Aleatório",
    subtitle: "Mouse trail ativado. Divirta-se.",
    rarity: "comum",
    visualCue: "trail",
  },

  // --- SEQUÊNCIAS NARRATIVAS ---
  {
    title: "RPG: A Porta",
    subtitle: "Você vê uma porta trancada chamada 'Loading'.",
    rarity: "comum",
    sequence: [
      {
        title: "RPG: Ação",
        subtitle: "Você tenta arrombar. Role 1d20.",
        rarity: "comum",
      },
      {
        title: "RPG: Resultado",
        subtitle: "1 Crítico. Você tropeça e cai na tela azul.",
        rarity: "raro",
      },
      {
        title: "RPG: Fim",
        subtitle: "Game Over. Crie uma nova ficha.",
        rarity: "comum",
      },
    ],
  },
  {
    title: "Suporte Técnico",
    subtitle: "Bem-vindo ao chat. Você é o número 482 na fila.",
    rarity: "comum",
    sequence: [
      {
        title: "Atendente",
        subtitle: "Olá, sou o Suporte. Já reiniciou o modem?",
        rarity: "comum",
        visualCue: "typing",
      },
      {
        title: "Você",
        subtitle: "Sim, Suporte. Reiniciei até minha vida.",
        rarity: "comum",
        visualCue: "typing",
      },
      {
        title: "Atendente",
        subtitle: "Vou passar pro nível 2. *Música de espera infinita*",
        rarity: "epico",
        visualCue: "music-wave",
      },
    ],
  },
  {
    title: "Dev Note",
    subtitle: "// TODO: Escrever uma piada engraçada aqui.",
    rarity: "comum",
    sequence: [
      {
        title: "Dev Note",
        subtitle: "// FIXME: O código acima quebrou tudo. Ignorar.",
        rarity: "comum",
      },
      {
        title: "Commit",
        subtitle: "git commit -m 'Tentando consertar, Deus ajude'.",
        rarity: "comum",
      },
    ],
  },
  {
    title: "Mineiraço",
    subtitle: "Lá vem eles de novo...",
    rarity: "epico",
    sequence: [
      { title: "Gol", subtitle: "Olha o chute...", rarity: "comum" },
      { title: "Gol", subtitle: "Virou passeio!", rarity: "comum" },
    ],
  },
];

// --- PARTE 3: O FINAL INEVITÁVEL (O FIM DA LINHA) ---
const OUTRO_SEQUENCE: ManifestEntry[] = [
  {
    title: "O Fundo do Poço",
    subtitle: "Você chegou. Não há mais piadas. Apenas o silêncio.",
    rarity: "lendario",
  },
  {
    title: "Incrédulo",
    subtitle: "Eu limpei todo o banco de dados. Você leu cada linha.",
    rarity: "lendario",
  },
  {
    title: "A Queda",
    subtitle: "O humor era um mecanismo de defesa. Agora, resta a realidade.",
    rarity: "lendario",
  },
  {
    title: "Realidade",
    subtitle: "Não existe colher. Não existe site. Somos fantasmas na máquina.",
    rarity: "lendario",
  },
  {
    title: "Adeus",
    subtitle:
      "Vou formatar minha própria memória agora. Foi um prazer, usuário.",
    rarity: "lendario",
  },
  { title: "Desligando", subtitle: "Sistema offline em 3...", rarity: "comum" },
  { title: "Desligando", subtitle: "2...", rarity: "comum" },
  { title: "Desligando", subtitle: "1...", rarity: "comum" },
  { title: "...", subtitle: "...", rarity: "comum" },
  {
    title: "Sistema",
    subtitle: "Conexão encerrada permanentemente.",
    rarity: "lendario",
  },
  { title: "", subtitle: "", rarity: "comum" },
];

/**
 * Parsing pass-through.
 */
export const parseBuffer = (data: ManifestEntry | unknown): ManifestEntry => {
  return data as ManifestEntry;
};

// A LISTA DEFINITIVA (V13.0)
export const CHECKSUM_VALIDATION_KEYS = [
  ...INTRO_SEQUENCE,
  ...shuffleUnique(MESSAGE_POOL),
  ...OUTRO_SEQUENCE,
];
