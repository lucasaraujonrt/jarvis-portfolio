const LANGS = ["pt", "en", "es"];

const copy = {
  pt: {
    meta: {
      title: "Jarvis — um pedido falado, do ouvido ao seu Mac",
      description: "Jarvis é um protótipo de portfólio: um pedido por voz no iPhone chega ao Codex no Mac e cria um arquivo, com andamento e aprovação no app.",
    },
    langGroup: "Idioma",
    nav: { listen: "Ouvir", mac: "Mac", approve: "Aprovar", status: "Estado", use: "Usar", code: "Código" },
    aria: {
      home: "Jarvis, início",
      chapters: "Capítulos",
      stage: "Modelo 3D ilustrativo de óculos inteligentes. Arraste para girar.",
      agents: "Agente de terminal",
    },
    callouts: { camera: "câmera", led: "LED de captura", mic: "microfone", speaker: "alto-falante aberto" },
    drag: "Arraste os óculos para girar",
    hero: {
      eyebrow: "Protótipo · óculos Meta, iPhone e o seu Mac",
      title1: "Diga o nome.",
      title2: "Seu Mac trabalha.",
      lede: "Jarvis liga os óculos aos agentes de terminal do seu computador. Você fala, o agente executa, e você decide pelo iPhone.",
    },
    c1: {
      kicker: "Ouvir",
      title: "Toque para falar. Ou ative pela voz.",
      body: "Com a sessão dos óculos ativa, Falar com Jarvis abre a conversa. A opção “Ativar ao dizer Jarvis” também inicia pela palavra de ativação. A voz Zagan usa a API da xAI.",
      fine: "A rota de microfone e áudio dos óculos depende da sessão Bluetooth ativa e deve ser conferida no dispositivo.",
    },
    c2: {
      kicker: "Delegar",
      note: "Fale o pedido inteiro, do jeito que sai. O Jarvis entende a intenção e envia para o agente escolhido, no projeto certo do seu Mac.",
    },
    said: [
      { text: "“Jarvis," },
      { text: "pede" },
      { text: "pro" },
      { text: "Codex", agent: true },
      { text: "adicionar" },
      { text: "as" },
      { text: "notas" },
      { text: "da" },
      { text: "reunião" },
      { text: "no" },
      { text: "briefing" },
      { text: "da" },
      { text: "Acme.”" },
    ],
    c3: {
      kicker: "Trabalhar",
      title: "O agente que você já usa. No seu Mac.",
      body: "Um gateway roda no seu Mac e envia a tarefa ao agente escolhido. O workspace é fixado ao iniciar o gateway; o CLI pode enviar contexto ao seu provedor.",
    },
    c4: {
      kicker: "Aprovar",
      title: "Permissões aparecem no iPhone.",
      body: "Quando o agente solicita permissão, ele espera sua decisão no iPhone. Ela vale uma vez; sem resposta em dois minutos, o pedido é recusado.",
      taskTitle: "Editar briefing.md",
      allow: "Permitir uma vez",
      deny: "Recusar",
      again: "Ver de novo",
    },
    task: {
      needsApproval: ["Sua aprovação", "Codex quer alterar um arquivo em ~/clientes/acme."],
      completed: ["Concluída", "briefing.md atualizado. A resposta volta falada nos óculos."],
      cancelled: ["Cancelada", "Pedido recusado. Confira o workspace antes de tentar novamente."],
    },
    c5: {
      kicker: "Enxergar",
      tag: "experimento",
      title: "“Olha esse quadro.”",
      body: "O app pode anexar o frame mais recente da câmera a um pedido. Acompanhar uma cena continuamente, junto com microfone e resposta nos óculos, ainda precisa de validação física.",
    },
    c6: {
      kicker: "Responder",
      title: "A resposta volta pelo ouvido.",
      reply: "“Pronto. Adicionei as notas da reunião no briefing da Acme.”",
      body: "O app envia a resposta falada quando a rota de áudio está ativa. O andamento e o texto ficam na aba Tarefas do iPhone.",
    },
    c7: {
      kicker: "Estado real · setembro de 2026",
      title: "Um protótipo, contado sem exagero.",
      rows: [
        ["“Jarvis” abre a conversa nos óculos", "validação física parcial", "wip"],
        ["Conversa em tempo real com a voz Zagan", "em validação", "wip"],
        ["Codex cria e edita arquivos por pedido falado", "confirmado no teste físico", "ok"],
        ["Grok Code lê e resume o projeto", "confirmado no teste físico", "ok"],
        ["Claude Code", "teste físico pendente", "wip"],
        ["Aprovar, recusar e cancelar pelo iPhone", "em validação", "wip"],
        ["Acompanhar uma cena pela câmera", "validação física pendente", "wip"],
        ["Reconexão automática dos óculos", "não implementado", "no"],
        ["Live Activity na tela bloqueada", "não implementado", "no"],
        ["Avisos por voz sem você perguntar", "não implementado", "no"],
      ],
    },
    guide: {
      kicker: "Começar",
      title: "Avalie o código. Depois reproduza a demo.",
      lede: "Sem hardware ou serviços pagos, rode npm ci, npm test e npm run typecheck. O roteiro completo está em docs/SETUP.md.",
      setupTitle: "Configurar",
      useTitle: "Usar",
      s1t: "O que você precisa",
      s1b: "Um Mac acordado com Node 22.18 ou mais novo, um iPhone com iOS 17.2 ou mais novo, e óculos Meta pareados no app Meta AI, com Developer Mode ligado.",
      s2t: "Agente no Mac",
      s2b: "Instale e autentique o Codex para repetir a demo. Claude Code e Grok Code são opcionais.",
      s3t: "Chave de voz",
      s3b: "Copie .env.example para .env e preencha XAI_API_KEY no Mac. A API de voz pode ter custo; os testes locais não usam essa chave.",
      s4t: "Gateway",
      s4b: "Gere um token com openssl rand -hex 24 e salve em JARVIS_GATEWAY_TOKEN no .env. Carregue o .env e suba o gateway no IP local, porta 4317, com --workspace em uma pasta descartável. Não exponha a porta à internet.",
      s5t: "App no iPhone",
      s5b: "Abra apps/ios/JarvisSpike.xcodeproj no Xcode; configure seu Team e bundle ID. Em Developer Mode, use META_APP_ID=0 e CLIENT_TOKEN vazio. Instale no iPhone e, em Conexões, use http://IP-do-Mac:4317, o mesmo token do .env e Codex.",
      u1t: "Conecte os óculos",
      u1b: "Toque Conectar óculos, termine o registro no Meta AI e volte para Iniciar sessão.",
      u2t: "Fale",
      u2b: "Na aba Jarvis, toque Falar com Jarvis e peça ao Codex para criar um arquivo. Dizer “Jarvis” antes é opcional quando a ativação por voz está ligada.",
      u3t: "Aprove",
      u3b: "Se o agente precisar de permissão, o iPhone mostra Permitir uma vez ou Recusar. Sem resposta em dois minutos, o pedido é recusado.",
      u4t: "Confira o resultado",
      u4b: "Confira o arquivo no Mac. Texto e andamento ficam na aba Tarefas; valide o áudio nos óculos separadamente.",
    },
    prompts: {
      title: "Prompts para o seu agente",
      lede: "Cole um por vez no Codex, no Claude Code ou no Grok. Ele para no fim da etapa e não pede a chave no chat.",
      copy: "Copiar prompt",
      copied: "Copiado",
      failed: "Não copiou. O texto está aberto aqui embaixo.",
      preview: "Ver o prompt",
      gatewayTitle: "Gateway",
      gatewayHint: "Sobe o gateway no Mac e para antes do iPhone.",
      iphoneTitle: "iPhone",
      iphoneHint: "Instala o app e preenche Conexões. Não mexe no gateway.",
      glassesTitle: "Óculos",
      glassesHint: "Guia o pareamento e o primeiro pedido falado.",
      gateway: "Você está na raiz do repositório Jarvis. Faça só a etapa do gateway no Mac. Pare antes do iPhone e dos óculos.\n\nRegras:\n- Não imprima nem commite o .env ou seus valores.\n- Não coloque a chave da xAI no código, no Git nem no chat.\n- Não exponha a porta 4317 na internet. Use o IP local do Mac.\n- npm run probe:agents só inicia o protocolo. Não envie prompt ao modelo.\n\nPassos:\n1. Confira Node.js 22.18 ou mais novo com node -v. Se faltar, diga o que instalar e pare.\n2. Rode npm ci.\n3. Se .env não existir, copie .env.example para .env.\n4. Se XAI_API_KEY estiver vazio, pare e peça para eu preencher a chave só no .env. Deixe XAI_VOICE_ID=zagan.\n5. Rode codex --version. Claude e Grok são opcionais. Se Codex não estiver no PATH, peça o caminho e grave só o executável em JARVIS_CODEX_COMMAND, sem flags.\n6. Rode npm run probe:agents somente se os três CLIs estiverem instalados.\n7. Mostre o IP de ipconfig getifaddr en0. Gere um token com openssl rand -hex 24 e grave em JARVIS_GATEWAY_TOKEN no .env. Não repita o token no chat.\n8. Pergunte o caminho absoluto do projeto que o agente vai editar.\n9. Suba o gateway e deixe o processo rodando: set -a && source .env && set +a && npm run gateway -- --workspace '/caminho' --host 'IP_LOCAL' --port 4317\n10. Confirme o log gateway.listening. GET http://127.0.0.1:4317/healthz só prova que o processo responde.\n\nEntregue o IP, a porta 4317 e a frase: cole o mesmo token do .env em Conexões. Não avance para o iPhone.",
      iphone: "O gateway do Jarvis já está rodando no Mac. Faça só a etapa do iPhone. Não pare o gateway, não gere outro token e não pareie os óculos.\n\nO app está em apps/ios/JarvisSpike.xcodeproj, scheme JarvisSpike, iOS 17.2 ou mais novo. O simulador não serve para voz, óculos nem agentes.\n\n1. Confirme comigo o IP e a porta 4317 e que o processo segue no ar. Não peça a chave da xAI.\n2. Abra o projeto no Xcode. Configure o seu Team e bundle ID. Em Developer Mode, use META_APP_ID=0 e CLIENT_TOKEN vazio; fora dele, configure os valores do seu app Meta. Não use Team ID de outra pessoa. Não commite provisioning, .p12 nem .mobileprovision.\n3. Diga para eu selecionar o meu iPhone e apertar Run. Se o iOS bloquear, o caminho é Ajustes, Geral, VPN e gerenciamento de dispositivo.\n4. Eu preencho Conexões, no ícone de Mac: endereço http://IP:4317, o token igual ao JARVIS_GATEWAY_TOKEN do .env, e o agente. Não peça o token neste chat. Ele fica no Keychain do iPhone.\n5. Pare quando eu disser que o endereço foi salvo.\n\nPronto desta etapa: app instalado e Conexões preenchido. A próxima etapa é só os óculos.",
      glasses: "O gateway está no Mac e o app no iPhone já tem endereço e token em Conexões. Faça só a etapa dos óculos. Não reinicie o gateway e não gere outro token.\n\nVocê não toca no iPhone nem nos óculos. Eu executo. Você confere o que eu descrever.\n\n1. Os óculos precisam estar pareados no app Meta AI, com Developer Mode ligado. Se não estiver, pare e passe só esse passo.\n2. No Jarvis, toque Conectar óculos, conclua o registro no Meta AI e volte.\n3. Toque Iniciar sessão. Eu digo se a sessão iniciou e qual dispositivo apareceu. Se falhar, pare no erro. Não repita o pareamento sem eu pedir.\n4. Na aba Jarvis, toque Falar com Jarvis e aceite microfone e reconhecimento de fala. Esse botão abre a conversa diretamente; dizer Jarvis é opcional se a ativação por voz estiver ligada.\n5. Com os óculos no rosto, eu faço um pedido curto, por exemplo criar um arquivo de teste na pasta do --workspace.\n6. Se aparecer permissão, eu escolho Permitir uma vez ou Recusar. Sem resposta em dois minutos, o pedido é recusado.\n7. Eu confirmo o arquivo na pasta do Mac; o texto fica na aba Tarefas. Confira a rota de áudio nos óculos separadamente.\n\nSe a voz não abrir, confira se o gateway subiu com XAI_API_KEY no ambiente. Não imprima a chave. Para encerrar: Conexões, Encerrar conversa.",
    },
    cta: {
      title1: "Jarvis como portfólio.",
      title2: "Voz, agentes e aprovação em um fluxo real.",
      lede: "A demo de 1:03 no README mostra voz no iPhone, Codex no Mac e um arquivo criado. O guia abaixo separa avaliação local e reprodução nos óculos.",
      button: "Ver código e demo",
    },
    foot: {
      proto: "Jarvis · protótipo",
      note: "Modelo 3D ilustrativo. Sem afiliação com Meta, Ray-Ban, OpenAI, Anthropic ou xAI.",
    },
    agents: {
      codex: {
        path: "~/clientes/acme · codex",
        state: "confirmado no teste físico",
        lines: [
          ["you", "› adicionar as notas da reunião no briefing da Acme"],
          ["dim", "lendo briefing.md e notas-reuniao.txt"],
          ["dim", "pedindo aprovação para editar briefing.md"],
          ["ok", "✓ briefing.md atualizado · turno concluído"],
        ],
      },
      claude: {
        path: "~/clientes/acme · claude code",
        state: "teste físico pendente",
        lines: [
          ["you", "› adicionar as notas da reunião no briefing da Acme"],
          ["dim", "lendo briefing.md e notas-reuniao.txt"],
          ["ok", "✓ briefing.md atualizado · turno concluído"],
        ],
      },
      grok: {
        path: "~/clientes/acme · grok code",
        state: "confirmado no teste físico",
        lines: [
          ["you", "› resumir o briefing da Acme em três frases"],
          ["dim", "lendo briefing.md"],
          ["ok", "✓ resumo em três frases · turno concluído"],
        ],
      },
    },
    voice: {
      idle: ["Pronto para ouvir", "Seu próximo pedido começa com a sua voz.", "Falar com Jarvis"],
      armed: ["Diga “Jarvis”", "A conversa começa pelos seus óculos.", "Pausar escuta"],
      awake: ["Ouvindo você", "Fale o pedido.", "Pausar escuta"],
      speaking: ["Jarvis está falando", "", "Parar resposta"],
      mic: "Liberando o microfone…",
      sim: "Simulação: sem microfone ou reconhecimento de fala neste navegador.",
      noSpeech: "O reconhecimento de fala não está disponível aqui. Veja a simulação.",
      understood: "Entendi: “{command}”. No Jarvis de verdade, isso vira uma tarefa no seu Mac.",
      yes: "Sim? Pode pedir.",
      demo: "adiciona as notas da reunião no briefing da Acme",
      wake: "“Jarvis”",
    },
  },
  en: {
    meta: {
      title: "Jarvis — a spoken request, from your ear to your Mac",
      description: "Jarvis is a portfolio prototype: a spoken request on an iPhone reaches Codex on a Mac and creates a file, with progress and approval in the app.",
    },
    langGroup: "Language",
    nav: { listen: "Listen", mac: "Mac", approve: "Approve", status: "Status", use: "Use", code: "Code" },
    aria: {
      home: "Jarvis, home",
      chapters: "Chapters",
      stage: "Illustrative 3D model of smart glasses. Drag to rotate.",
      agents: "Terminal agent",
    },
    callouts: { camera: "camera", led: "capture LED", mic: "microphone", speaker: "open speaker" },
    drag: "Drag the glasses to rotate",
    hero: {
      eyebrow: "Prototype · Meta glasses, iPhone, and your Mac",
      title1: "Say the name.",
      title2: "Your Mac gets to work.",
      lede: "Jarvis connects the glasses to the terminal agents on your computer. You speak, the agent runs, and you decide on your iPhone.",
    },
    c1: {
      kicker: "Listen",
      title: "Tap to speak. Or enable the wake word.",
      body: "With the glasses session active, Falar com Jarvis starts the conversation. The optional “Ativar ao dizer Jarvis” setting also starts it with a wake word. Zagan voice uses the xAI API.",
      fine: "The glasses microphone and audio route depend on an active Bluetooth session and should be checked on the device.",
    },
    c2: {
      kicker: "Delegate",
      note: "Say the whole request, just as it comes out. Jarvis understands the intent and sends it to the agent you picked, in the right project on your Mac.",
    },
    said: [
      { text: "“Jarvis," },
      { text: "ask" },
      { text: "Codex", agent: true },
      { text: "to" },
      { text: "add" },
      { text: "today’s" },
      { text: "meeting" },
      { text: "notes" },
      { text: "to" },
      { text: "the" },
      { text: "Acme" },
      { text: "briefing.”" },
    ],
    c3: {
      kicker: "Work",
      title: "The agent you already use. On your Mac.",
      body: "A gateway runs on your Mac and sends the task to the selected agent. Its workspace is fixed at startup; the CLI may send context to its provider.",
    },
    c4: {
      kicker: "Approve",
      title: "Permission requests reach your iPhone.",
      body: "When an agent requests permission, it waits for your decision on the iPhone. It applies once; with no answer in two minutes, the request is declined.",
      taskTitle: "Edit briefing.md",
      allow: "Allow once",
      deny: "Decline",
      again: "See it again",
    },
    task: {
      needsApproval: ["Your approval", "Codex wants to change a file in ~/clientes/acme."],
      completed: ["Done", "briefing.md updated. The reply comes back spoken in the glasses."],
      cancelled: ["Cancelled", "Request declined. Check the workspace before trying again."],
    },
    c5: {
      kicker: "See",
      tag: "experiment",
      title: "“Look at this board.”",
      body: "The app can attach the latest camera frame to a request. Continuous scene tracking alongside microphone and glasses playback still needs physical validation.",
    },
    c6: {
      kicker: "Reply",
      title: "The answer comes back through your ear.",
      reply: "“Done. I added the meeting notes to the Acme briefing.”",
      body: "The app sends the spoken reply when the audio route is active. Progress and text stay in the Tasks tab on the iPhone.",
    },
    c7: {
      kicker: "Actual status · September 2026",
      title: "A prototype, told without exaggeration.",
      rows: [
        ["“Jarvis” opens the conversation in the glasses", "partial physical validation", "wip"],
        ["Realtime conversation with the Zagan voice", "being validated", "wip"],
        ["Codex creates and edits files from a spoken request", "confirmed in a physical test", "ok"],
        ["Grok Code reads and summarizes the project", "confirmed in a physical test", "ok"],
        ["Claude Code", "physical test pending", "wip"],
        ["Approve, decline, and cancel from the iPhone", "being validated", "wip"],
        ["Follow a scene through the camera", "physical validation pending", "wip"],
        ["Automatic glasses reconnection", "not implemented", "no"],
        ["Live Activity on the lock screen", "not implemented", "no"],
        ["Spoken alerts without you asking", "not implemented", "no"],
      ],
    },
    guide: {
      kicker: "Start",
      title: "Evaluate the code. Then reproduce the demo.",
      lede: "Without hardware or paid services, run npm ci, npm test, and npm run typecheck. The full walkthrough is in docs/SETUP.md.",
      setupTitle: "Set up",
      useTitle: "Use",
      s1t: "What you need",
      s1b: "An awake Mac with Node 22.18 or newer, an iPhone on iOS 17.2 or newer, and Meta glasses paired in the Meta AI app, with Developer Mode on.",
      s2t: "Agent on the Mac",
      s2b: "Install and authenticate Codex to reproduce the demo. Claude Code and Grok Code are optional.",
      s3t: "Voice key",
      s3b: "Copy .env.example to .env and fill in XAI_API_KEY on the Mac. The voice API may cost money; local tests do not use this key.",
      s4t: "Gateway",
      s4b: "Generate a token with openssl rand -hex 24 and save it as JARVIS_GATEWAY_TOKEN in .env. Load .env and start the gateway on the local IP, port 4317, with --workspace set to a disposable folder. Do not expose the port to the internet.",
      s5t: "iPhone app",
      s5b: "Open apps/ios/JarvisSpike.xcodeproj in Xcode; set your Team and bundle ID. In Developer Mode, use META_APP_ID=0 and an empty CLIENT_TOKEN. Install on the iPhone and enter http://MAC-IP:4317, the same .env token, and Codex in Conexões.",
      u1t: "Connect the glasses",
      u1b: "Tap Conectar óculos, finish registration in Meta AI, then come back and tap Iniciar sessão.",
      u2t: "Speak",
      u2b: "On the Jarvis tab, tap Falar com Jarvis and ask Codex to create a file. Saying “Jarvis” first is optional when voice activation is enabled.",
      u3t: "Approve",
      u3b: "If the agent needs permission, the iPhone shows Permitir uma vez or Recusar. With no answer in two minutes, the request is declined.",
      u4t: "Check the result",
      u4b: "Check the file on the Mac. Text and progress stay on the Tarefas tab; validate glasses audio separately.",
    },
    prompts: {
      title: "Prompts for your agent",
      lede: "Paste one at a time into Codex, Claude Code, or Grok. It stops at the end of the stage and does not ask for the key in chat.",
      copy: "Copy prompt",
      copied: "Copied",
      failed: "Copy failed. The text is open below.",
      preview: "Show the prompt",
      gatewayTitle: "Gateway",
      gatewayHint: "Starts the gateway on the Mac and stops before the iPhone.",
      iphoneTitle: "iPhone",
      iphoneHint: "Installs the app and fills in Conexões. Leaves the gateway alone.",
      glassesTitle: "Glasses",
      glassesHint: "Walks through pairing and the first spoken request.",
      gateway: "You are at the root of the Jarvis repository. Do only the Mac gateway stage. Stop before the iPhone and the glasses.\n\nRules:\n- Do not print or commit .env or its values.\n- Do not put the xAI key in code, Git, or chat.\n- Do not expose port 4317 to the internet. Use the Mac’s local IP.\n- npm run probe:agents only starts the protocol. Do not send a prompt to the model.\n\nSteps:\n1. Check Node.js 22.18 or newer with node -v. If it is missing, say what to install and stop.\n2. Run npm ci.\n3. If .env does not exist, copy .env.example to .env.\n4. If XAI_API_KEY is empty, stop and ask me to fill the key only in .env. Leave XAI_VOICE_ID=zagan.\n5. Run codex --version. Claude and Grok are optional. If Codex is not on PATH, ask for its path and save only the executable in JARVIS_CODEX_COMMAND, with no flags.\n6. Run npm run probe:agents only when all three CLIs are installed.\n7. Show the IP from ipconfig getifaddr en0. Generate a token with openssl rand -hex 24 and save it as JARVIS_GATEWAY_TOKEN in .env. Do not repeat the token in chat.\n8. Ask for the absolute path of the project the agent will edit.\n9. Start the gateway and leave the process running: set -a && source .env && set +a && npm run gateway -- --workspace '/path' --host 'LOCAL_IP' --port 4317\n10. Confirm the gateway.listening log. GET http://127.0.0.1:4317/healthz only proves the process answers.\n\nHand back the IP, port 4317, and this sentence: paste the same token from .env into Conexões. Do not move on to the iPhone.",
      iphone: "The Jarvis gateway is already running on the Mac. Do only the iPhone stage. Do not stop the gateway, do not generate another token, and do not pair the glasses.\n\nThe app is apps/ios/JarvisSpike.xcodeproj, scheme JarvisSpike, iOS 17.2 or newer. The simulator is not enough for voice, glasses, or agents.\n\n1. Confirm with me the IP and port 4317, and that the process is still up. Do not ask for the xAI key.\n2. Open the project in Xcode. Set your Team and bundle ID. In Developer Mode, use META_APP_ID=0 and an empty CLIENT_TOKEN; otherwise configure your Meta app values. Do not use someone else’s Team ID. Do not commit provisioning, .p12, or .mobileprovision.\n3. Tell me to select my iPhone and press Run. If iOS blocks it, the path is Settings, General, VPN & Device Management.\n4. I fill in Conexões, from the Mac icon: address http://IP:4317, the token matching JARVIS_GATEWAY_TOKEN in .env, and the agent. Do not ask for the token in this chat. It stays in the iPhone Keychain.\n5. Stop when I say the address was saved.\n\nDone for this stage: app installed and Conexões filled in. The next stage is only the glasses.",
      glasses: "The gateway is on the Mac and the iPhone app already has the address and token in Conexões. Do only the glasses stage. Do not restart the gateway and do not generate another token.\n\nYou cannot touch the iPhone or the glasses. I do the taps. You check what I describe.\n\n1. The glasses must be paired in the Meta AI app, with Developer Mode on. If they are not, stop and give only that step.\n2. In Jarvis, tap Conectar óculos, finish registration in Meta AI, and come back.\n3. Tap Iniciar sessão. I will say whether the session started and which device appeared. If it fails, stop on the error. Do not repeat pairing unless I ask.\n4. On the Jarvis tab, tap Falar com Jarvis and accept microphone and speech recognition. This button starts the conversation directly; saying Jarvis is optional when voice activation is on.\n5. With the glasses on, I make a short request, for example creating a test file in the --workspace folder.\n6. If a permission appears, I choose Permitir uma vez or Recusar. With no answer in two minutes, the request is declined.\n7. I confirm the file in the Mac folder; text stays on the Tarefas tab. Check the glasses audio route separately.\n\nIf voice does not start, check that the gateway was launched with XAI_API_KEY in the environment. Do not print the key. To end: Conexões, Encerrar conversa.",
    },
    cta: {
      title1: "Jarvis as a portfolio project.",
      title2: "Voice, agents, and approval in one real workflow.",
      lede: "The 1:03 demo in the README shows iPhone voice, Codex on a Mac, and a created file. The guide below separates local evaluation from reproducing it with glasses.",
      button: "View code and demo",
    },
    foot: {
      proto: "Jarvis · prototype",
      note: "Illustrative 3D model. Not affiliated with Meta, Ray-Ban, OpenAI, Anthropic, or xAI.",
    },
    agents: {
      codex: {
        path: "~/clientes/acme · codex",
        state: "confirmed in a physical test",
        lines: [
          ["you", "› add the meeting notes to the Acme briefing"],
          ["dim", "reading briefing.md and notas-reuniao.txt"],
          ["dim", "asking approval to edit briefing.md"],
          ["ok", "✓ briefing.md updated · turn complete"],
        ],
      },
      claude: {
        path: "~/clientes/acme · claude code",
        state: "physical test pending",
        lines: [
          ["you", "› add the meeting notes to the Acme briefing"],
          ["dim", "reading briefing.md and notas-reuniao.txt"],
          ["ok", "✓ briefing.md updated · turn complete"],
        ],
      },
      grok: {
        path: "~/clientes/acme · grok code",
        state: "confirmed in a physical test",
        lines: [
          ["you", "› summarize the Acme briefing in three sentences"],
          ["dim", "reading briefing.md"],
          ["ok", "✓ three-sentence summary · turn complete"],
        ],
      },
    },
    voice: {
      idle: ["Ready to listen", "Your next request starts with your voice.", "Talk to Jarvis"],
      armed: ["Say “Jarvis”", "The conversation starts through your glasses.", "Pause listening"],
      awake: ["Listening to you", "Say the request.", "Pause listening"],
      speaking: ["Jarvis is speaking", "", "Stop reply"],
      mic: "Turning the microphone on…",
      sim: "Simulation: no microphone or speech recognition in this browser.",
      noSpeech: "Speech recognition isn’t available here. Watch the simulation.",
      understood: "Got it: “{command}”. In the real Jarvis, that becomes a task on your Mac.",
      yes: "Yes? Go ahead.",
      demo: "add the meeting notes to the Acme briefing",
      wake: "“Jarvis”",
    },
  },
  es: {
    meta: {
      title: "Jarvis — un pedido hablado, del oído a tu Mac",
      description: "Jarvis es un prototipo de portafolio: un pedido hablado en el iPhone llega a Codex en el Mac y crea un archivo, con progreso y aprobación en la app.",
    },
    langGroup: "Idioma",
    nav: { listen: "Escuchar", mac: "Mac", approve: "Aprobar", status: "Estado", use: "Usar", code: "Código" },
    aria: {
      home: "Jarvis, inicio",
      chapters: "Capítulos",
      stage: "Modelo 3D ilustrativo de gafas inteligentes. Arrastra para girar.",
      agents: "Agente de terminal",
    },
    callouts: { camera: "cámara", led: "LED de captura", mic: "micrófono", speaker: "altavoz abierto" },
    drag: "Arrastra las gafas para girar",
    hero: {
      eyebrow: "Prototipo · gafas Meta, iPhone y tu Mac",
      title1: "Di el nombre.",
      title2: "Tu Mac trabaja.",
      lede: "Jarvis conecta las gafas con los agentes de terminal de tu computadora. Tú hablas, el agente ejecuta y tú decides desde el iPhone.",
    },
    c1: {
      kicker: "Escuchar",
      title: "Toca para hablar. O activa la palabra clave.",
      body: "Con la sesión de las gafas activa, Falar com Jarvis inicia la conversación. La opción “Ativar ao dizer Jarvis” también la inicia con la palabra clave. La voz Zagan usa la API de xAI.",
      fine: "La ruta de micrófono y audio de las gafas depende de una sesión Bluetooth activa y debe comprobarse en el dispositivo.",
    },
    c2: {
      kicker: "Delegar",
      note: "Di el pedido entero, tal como sale. Jarvis entiende la intención y lo envía al agente elegido, en el proyecto correcto de tu Mac.",
    },
    said: [
      { text: "“Jarvis," },
      { text: "pídele" },
      { text: "a" },
      { text: "Codex", agent: true },
      { text: "que" },
      { text: "agregue" },
      { text: "las" },
      { text: "notas" },
      { text: "de" },
      { text: "la" },
      { text: "reunión" },
      { text: "al" },
      { text: "briefing" },
      { text: "de" },
      { text: "Acme.”" },
    ],
    c3: {
      kicker: "Trabajar",
      title: "El agente que ya usas. En tu Mac.",
      body: "Un gateway corre en tu Mac y envía la tarea al agente elegido. El workspace se fija al iniciarlo; el CLI puede enviar contexto a su proveedor.",
    },
    c4: {
      kicker: "Aprobar",
      title: "Los permisos llegan a tu iPhone.",
      body: "Cuando un agente solicita permiso, espera tu decisión en el iPhone. Vale una vez; sin respuesta en dos minutos, el pedido se rechaza.",
      taskTitle: "Editar briefing.md",
      allow: "Permitir una vez",
      deny: "Rechazar",
      again: "Ver de nuevo",
    },
    task: {
      needsApproval: ["Tu aprobación", "Codex quiere cambiar un archivo en ~/clientes/acme."],
      completed: ["Terminada", "briefing.md actualizado. La respuesta vuelve hablada en las gafas."],
      cancelled: ["Cancelada", "Pedido rechazado. Revisa el workspace antes de volver a intentarlo."],
    },
    c5: {
      kicker: "Ver",
      tag: "experimento",
      title: "“Mira este tablero.”",
      body: "La app puede adjuntar el frame más reciente de la cámara a un pedido. Seguir una escena continuamente junto con micrófono y audio en las gafas aún necesita validación física.",
    },
    c6: {
      kicker: "Responder",
      title: "La respuesta vuelve por el oído.",
      reply: "“Listo. Agregué las notas de la reunión al briefing de Acme.”",
      body: "La app envía la respuesta hablada cuando la ruta de audio está activa. El avance y el texto quedan en la pestaña Tareas del iPhone.",
    },
    c7: {
      kicker: "Estado real · septiembre de 2026",
      title: "Un prototipo, contado sin exagerar.",
      rows: [
        ["“Jarvis” abre la conversación en las gafas", "validación física parcial", "wip"],
        ["Conversación en tiempo real con la voz Zagan", "en validación", "wip"],
        ["Codex crea y edita archivos con un pedido hablado", "confirmado en prueba física", "ok"],
        ["Grok Code lee y resume el proyecto", "confirmado en prueba física", "ok"],
        ["Claude Code", "prueba física pendiente", "wip"],
        ["Aprobar, rechazar y cancelar desde el iPhone", "en validación", "wip"],
        ["Seguir una escena con la cámara", "validación física pendiente", "wip"],
        ["Reconexión automática de las gafas", "no implementado", "no"],
        ["Live Activity en la pantalla bloqueada", "no implementado", "no"],
        ["Avisos por voz sin que preguntes", "no implementado", "no"],
      ],
    },
    guide: {
      kicker: "Empezar",
      title: "Evalúa el código. Luego reproduce la demo.",
      lede: "Sin hardware ni servicios pagos, ejecuta npm ci, npm test y npm run typecheck. La guía completa está en docs/SETUP.md.",
      setupTitle: "Configurar",
      useTitle: "Usar",
      s1t: "Qué necesitas",
      s1b: "Un Mac despierto con Node 22.18 o más nuevo, un iPhone con iOS 17.2 o más nuevo, y gafas Meta emparejadas en la app Meta AI, con Developer Mode activado.",
      s2t: "Agente en el Mac",
      s2b: "Instala e inicia sesión en Codex para repetir la demo. Claude Code y Grok Code son opcionales.",
      s3t: "Clave de voz",
      s3b: "Copia .env.example a .env y completa XAI_API_KEY en el Mac. La API de voz puede tener costo; las pruebas locales no usan la clave.",
      s4t: "Gateway",
      s4b: "Genera un token con openssl rand -hex 24 y guárdalo como JARVIS_GATEWAY_TOKEN en .env. Carga .env y levanta el gateway en la IP local, puerto 4317, con --workspace en una carpeta desechable. No expongas el puerto a internet.",
      s5t: "App en el iPhone",
      s5b: "Abre apps/ios/JarvisSpike.xcodeproj en Xcode; configura tu Team y bundle ID. En Developer Mode, usa META_APP_ID=0 y CLIENT_TOKEN vacío. Instala en el iPhone y, en Conexões, usa http://IP-del-Mac:4317, el mismo token de .env y Codex.",
      u1t: "Conecta las gafas",
      u1b: "Toca Conectar óculos, termina el registro en Meta AI y vuelve a Iniciar sesión.",
      u2t: "Habla",
      u2b: "En la pestaña Jarvis, toca Falar com Jarvis y pide a Codex que cree un archivo. Decir “Jarvis” antes es opcional con la activación por voz habilitada.",
      u3t: "Aprueba",
      u3b: "Si el agente necesita permiso, el iPhone muestra Permitir uma vez o Recusar. Sin respuesta en dos minutos, el pedido se rechaza.",
      u4t: "Comprueba el resultado",
      u4b: "Comprueba el archivo en el Mac. Texto y avance quedan en la pestaña Tarefas; valida el audio de las gafas por separado.",
    },
    prompts: {
      title: "Prompts para tu agente",
      lede: "Pega uno por vez en Codex, Claude Code o Grok. Se detiene al final de la etapa y no pide la clave en el chat.",
      copy: "Copiar prompt",
      copied: "Copiado",
      failed: "No se copió. El texto está abierto aquí abajo.",
      preview: "Ver el prompt",
      gatewayTitle: "Gateway",
      gatewayHint: "Levanta el gateway en el Mac y se detiene antes del iPhone.",
      iphoneTitle: "iPhone",
      iphoneHint: "Instala la app y completa Conexões. No toca el gateway.",
      glassesTitle: "Gafas",
      glassesHint: "Guía el emparejamiento y el primer pedido hablado.",
      gateway: "Estás en la raíz del repositorio Jarvis. Haz solo la etapa del gateway en el Mac. Detente antes del iPhone y de las gafas.\n\nReglas:\n- No imprimas ni hagas commit de .env o de sus valores.\n- No pongas la clave de xAI en el código, en Git ni en el chat.\n- No expongas el puerto 4317 a internet. Usa la IP local del Mac.\n- npm run probe:agents solo inicia el protocolo. No envíes un prompt al modelo.\n\nPasos:\n1. Comprueba Node.js 22.18 o más nuevo con node -v. Si falta, di qué instalar y detente.\n2. Ejecuta npm ci.\n3. Si no existe .env, copia .env.example a .env.\n4. Si XAI_API_KEY está vacío, detente y pídeme completar la clave solo en .env. Deja XAI_VOICE_ID=zagan.\n5. Ejecuta codex --version. Claude y Grok son opcionales. Si Codex no está en PATH, pregunta su ruta y guarda solo el ejecutable en JARVIS_CODEX_COMMAND, sin flags.\n6. Ejecuta npm run probe:agents solo si los tres CLI están instalados.\n7. Muestra la IP de ipconfig getifaddr en0. Genera un token con openssl rand -hex 24 y guárdalo en JARVIS_GATEWAY_TOKEN dentro de .env. No repitas el token en el chat.\n8. Pregunta la ruta absoluta del proyecto que el agente va a editar.\n9. Levanta el gateway y deja el proceso corriendo: set -a && source .env && set +a && npm run gateway -- --workspace '/ruta' --host 'IP_LOCAL' --port 4317\n10. Confirma el log gateway.listening. GET http://127.0.0.1:4317/healthz solo prueba que el proceso responde.\n\nEntrega la IP, el puerto 4317 y la frase: pega el mismo token del .env en Conexões. No avances al iPhone.",
      iphone: "El gateway de Jarvis ya está corriendo en el Mac. Haz solo la etapa del iPhone. No detengas el gateway, no generes otro token y no emparejes las gafas.\n\nLa app está en apps/ios/JarvisSpike.xcodeproj, scheme JarvisSpike, iOS 17.2 o más nuevo. El simulador no sirve para voz, gafas ni agentes.\n\n1. Confirma conmigo la IP y el puerto 4317 y que el proceso sigue en marcha. No pidas la clave de xAI.\n2. Abre el proyecto en Xcode. Configura tu Team y bundle ID. En Developer Mode, usa META_APP_ID=0 y CLIENT_TOKEN vacío; fuera de ese modo, configura los valores de tu app Meta. No uses el Team ID de otra persona. No hagas commit de provisioning, .p12 ni .mobileprovision.\n3. Dime que seleccione mi iPhone y pulse Run. Si iOS lo bloquea, el camino es Ajustes, General, VPN y gestión de dispositivos.\n4. Yo completo Conexões, en el icono del Mac: dirección http://IP:4317, el token igual a JARVIS_GATEWAY_TOKEN del .env, y el agente. No pidas el token en este chat. Queda en el Keychain del iPhone.\n5. Detente cuando yo diga que la dirección quedó guardada.\n\nListo en esta etapa: app instalada y Conexões completo. La siguiente etapa es solo las gafas.",
      glasses: "El gateway está en el Mac y la app del iPhone ya tiene dirección y token en Conexões. Haz solo la etapa de las gafas. No reinicies el gateway y no generes otro token.\n\nTú no tocas el iPhone ni las gafas. Yo ejecuto. Tú compruebas lo que yo describa.\n\n1. Las gafas tienen que estar emparejadas en la app Meta AI, con Developer Mode activado. Si no lo están, detente y pasa solo ese paso.\n2. En Jarvis, toca Conectar óculos, termina el registro en Meta AI y vuelve.\n3. Toca Iniciar sessão. Yo digo si la sesión inició y qué dispositivo apareció. Si falla, detente en el error. No repitas el emparejamiento si yo no lo pido.\n4. En la pestaña Jarvis, toca Falar com Jarvis y acepta micrófono y reconocimiento de voz. Este botón inicia la conversación directamente; decir Jarvis es opcional si está activa la activación por voz.\n5. Con las gafas puestas, hago un pedido corto, por ejemplo crear un archivo de prueba en la carpeta de --workspace.\n6. Si aparece un permiso, elijo Permitir uma vez o Recusar. Sin respuesta en dos minutos, el pedido se rechaza.\n7. Confirmo el archivo en la carpeta del Mac; el texto queda en la pestaña Tarefas. Comprueba la ruta de audio de las gafas por separado.\n\nSi la voz no abre, comprueba que el gateway haya arrancado con XAI_API_KEY en el entorno. No imprimas la clave. Para terminar: Conexões, Encerrar conversa.",
    },
    cta: {
      title1: "Jarvis como proyecto de portafolio.",
      title2: "Voz, agentes y aprobación en un flujo real.",
      lede: "La demo de 1:03 en el README muestra voz en el iPhone, Codex en el Mac y un archivo creado. La guía separa evaluación local y reproducción con gafas.",
      button: "Ver código y demo",
    },
    foot: {
      proto: "Jarvis · prototipo",
      note: "Modelo 3D ilustrativo. Sin afiliación con Meta, Ray-Ban, OpenAI, Anthropic o xAI.",
    },
    agents: {
      codex: {
        path: "~/clientes/acme · codex",
        state: "confirmado en la prueba física",
        lines: [
          ["you", "› agregar las notas de la reunión al briefing de Acme"],
          ["dim", "leyendo briefing.md y notas-reuniao.txt"],
          ["dim", "pidiendo aprobación para editar briefing.md"],
          ["ok", "✓ briefing.md actualizado · turno terminado"],
        ],
      },
      claude: {
        path: "~/clientes/acme · claude code",
        state: "prueba física pendiente",
        lines: [
          ["you", "› agregar las notas de la reunión al briefing de Acme"],
          ["dim", "leyendo briefing.md y notas-reuniao.txt"],
          ["ok", "✓ briefing.md actualizado · turno terminado"],
        ],
      },
      grok: {
        path: "~/clientes/acme · grok code",
        state: "confirmado en la prueba física",
        lines: [
          ["you", "› resumir el briefing de Acme en tres frases"],
          ["dim", "leyendo briefing.md"],
          ["ok", "✓ resumen en tres frases · turno terminado"],
        ],
      },
    },
    voice: {
      idle: ["Listo para escuchar", "Tu próximo pedido empieza con tu voz.", "Hablar con Jarvis"],
      armed: ["Di “Jarvis”", "La conversación empieza por tus gafas.", "Pausar escucha"],
      awake: ["Escuchándote", "Di el pedido.", "Pausar escucha"],
      speaking: ["Jarvis está hablando", "", "Parar respuesta"],
      mic: "Activando el micrófono…",
      sim: "Simulación: no hay micrófono ni reconocimiento de voz en este navegador.",
      noSpeech: "El reconocimiento de voz no está disponible aquí. Mira la simulación.",
      understood: "Entendido: “{command}”. En el Jarvis de verdad, eso se vuelve una tarea en tu Mac.",
      yes: "¿Sí? Puedes pedir.",
      demo: "agrega las notas de la reunión al briefing de Acme",
      wake: "“Jarvis”",
    },
  },
};

const htmlLang = { pt: "pt-BR", en: "en", es: "es" };
const speech = { pt: "pt-BR", en: "en-US", es: "es-ES" };

let current = "pt";
const listeners = new Set();

function lookup(key) {
  let value = copy[current];
  for (const part of key.split(".")) value = value?.[part];
  return value;
}

export function t(key) {
  const value = lookup(key);
  return value === undefined ? key : value;
}

export function speechLang() {
  return speech[current];
}

export function onLang(fn) {
  listeners.add(fn);
}

function paint() {
  document.documentElement.lang = htmlLang[current];
  document.title = t("meta.title");
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", t("meta.description"));
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = lookup(el.dataset.i18n);
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const value = lookup(el.dataset.i18nAria);
    if (typeof value === "string") el.setAttribute("aria-label", value);
  });
  document.querySelectorAll(".lang button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === current));
  });
  const spec = document.querySelector(".spec");
  if (spec) {
    spec.replaceChildren(...t("c7.rows").map(([label, status, kind]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = status;
      dd.dataset.s = kind;
      row.append(dt, dd);
      return row;
    }));
  }
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return;
  current = next;
  localStorage.setItem("jarvis-lang", next);
  paint();
  listeners.forEach((fn) => fn(next));
}

export function initLang() {
  const saved = localStorage.getItem("jarvis-lang");
  const browser = (navigator.language || "pt").slice(0, 2);
  current = LANGS.includes(saved) ? saved : LANGS.includes(browser) ? browser : "pt";
  paint();
  document.querySelector(".lang")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });
}
