# Configurar e avaliar o Jarvis

Há dois caminhos: avaliar o código sem hardware nem serviços pagos, ou reproduzir o pedido por voz que cria um arquivo no Mac. O segundo caminho usa iPhone físico, sessão dos óculos Meta, Codex autenticado e API de voz xAI.

O gateway escuta na sua rede local. Não publique a porta na internet: o tráfego é HTTP e leva o token, o pedido e a aprovação.

## Avaliação local sem chamadas a modelos

Com Node.js 22.18+:

```bash
npm ci
npm test
npm run typecheck
```

Os testes do gateway usam agentes simulados e não exigem `.env`, login em CLI, xAI, iPhone ou óculos. No Mac com Xcode, os [testes Swift](../apps/ios/tests/README.md) validam cliente, histórico e áudio sintético sem chamadas pagas. A [prévia do simulador](../apps/ios/README.md#ui-e-prévia-do-simulador) mostra estados de interface, mas não executa tarefas. O vídeo no [README](../README.md#demonstração) é a evidência do fluxo físico de criação de arquivo.

## Reproduzir no iPhone e Mac

### O que você precisa

- Mac acordado, com Node.js 22.18 ou mais novo e Xcode para instalar o app.
- iPhone com iOS 17.2 ou mais novo.
- Óculos Meta pareados no app Meta AI, com Developer Mode ligado.
- Conta Apple para assinar o app e instalar no seu iPhone.
- Codex instalado e autenticado no Mac. Claude Code e Grok Code são opcionais.
- Uma chave `XAI_API_KEY` com acesso à API de voz xAI para a conversa Zagan. A chave fica só no Mac. O provedor de voz e o CLI escolhido podem ter custo.

## 1. Clonar e preparar o ambiente

Na raiz do repositório, se ainda não executou a avaliação local:

```bash
npm ci
cp .env.example .env
```

Gere o token com `openssl rand -hex 24`. Preencha `JARVIS_GATEWAY_TOKEN` e `XAI_API_KEY` diretamente no `.env`, sem copiar os valores para chat ou Git. Deixe `XAI_VOICE_ID=zagan`. O gateway lê essas variáveis do ambiente do processo; ele não carrega `.env` automaticamente.

Confira o Codex. Este comando não envia um pedido ao modelo:

```bash
codex --version
```

Se tiver os três CLIs, `npm run probe:agents` testa a inicialização dos protocolos sem enviar pedidos a modelos. Ele falha quando algum CLI está ausente; isso não impede usar Codex. O comando de versão e o probe não comprovam login válido nem acesso ao modelo.

Se o gateway não achar um comando, aponte o executável no `.env`. O valor é só o caminho, sem flags:

```bash
JARVIS_CODEX_COMMAND=/opt/homebrew/bin/codex
JARVIS_CLAUDE_COMMAND=$HOME/.local/bin/claude
JARVIS_GROK_COMMAND=$HOME/.grok/bin/grok
```

## 2. Subir o gateway

O token é a senha do gateway. Gere um novo e não reutilize um token antigo de outra máquina.

```bash
set -a
source .env
set +a
ipconfig getifaddr en0
npm run gateway -- --workspace '/caminho/absoluto/do/projeto' --host '192.168.0.10' --port 4317
```

Troque `192.168.0.10` pelo IP que o `ipconfig` mostrou. `--workspace` é a pasta que o agente vai ler e editar. O app não escolhe outra pasta depois.

O processo fica no terminal e imprime `gateway.listening`. Para parar, use Ctrl+C. Cole no iPhone o token salvo no `.env`. Se trocar o token, reinicie o gateway e atualize Conexões. O workspace deve ser uma pasta descartável no primeiro teste, pois o agente pode escrever arquivos nela.

## 3. Instalar o app no iPhone

1. Abra `apps/ios/JarvisSpike.xcodeproj` no Xcode.
2. Configure seu Team e bundle ID para assinar o app. Com os óculos em Developer Mode, mantenha `META_APP_ID=0` e `CLIENT_TOKEN` vazio. Fora desse modo, use os valores do seu app no Wearables Developer Center. Veja o [guia iOS](../apps/ios/README.md#build-físico).
3. Selecione o seu iPhone e rode o scheme JarvisSpike.
4. No iPhone, aceite o desenvolvedor em Ajustes, se o iOS pedir.

O simulador mostra uma prévia. A voz, os óculos e os agentes reais rodam no iPhone.

## 4. Ligar o iPhone ao Mac

No app, abra **Conexões** pelo ícone de Mac.

1. Endereço: `http://192.168.0.10:4317` (o mesmo IP e a porta do gateway).
2. Token: o `JARVIS_GATEWAY_TOKEN` desta execução.
3. Agente: Codex para reproduzir a demonstração.

O endereço fica salvo no app. O token fica no Keychain do iPhone.

## 5. Ligar os óculos

1. Toque **Conectar óculos** e conclua o registro no Meta AI. O botão de voz do app exige uma sessão DAT iniciada; a prévia do simulador não é uma alternativa para execução real.
2. Volte ao Jarvis e toque **Iniciar sessão**.
3. A sessão precisa chegar a iniciada, com o modelo dos óculos reconhecido.
4. Se quiser mandar o que a câmera está vendo, ative **Anexar imagem ao pedido** em Conexões.

## 6. Fazer um pedido

1. Abra a aba **Jarvis**.
2. Toque **Falar com Jarvis** e aceite as permissões solicitadas. Esse botão inicia a conversa diretamente; se a opção **Ativar ao dizer “Jarvis”** estiver ligada, também é possível começar pela palavra de ativação.
3. Aguarde a conversa Zagan abrir nos óculos e fale o pedido.
4. Fale o pedido, por exemplo: “pede pro Codex criar demo-jarvis.md com o título Teste Jarvis”.
5. Se o agente precisar de permissão, o iPhone mostra **Permitir uma vez** ou **Recusar**. Sem resposta em dois minutos, o pedido é recusado.
6. Confira o arquivo no Mac. A resposta deve voltar falada nos óculos; texto e andamento ficam na aba **Tarefas**. A existência do arquivo é a prova da execução, enquanto áudio e rota HFP precisam ser conferidos separadamente.

Para encerrar a escuta, o áudio e a conexão de voz, use **Encerrar conversa** em Conexões.

## O que conferir se algo falhar

- Mac e iPhone na mesma rede Wi-Fi. O gateway precisa estar rodando.
- O token do app é o mesmo do processo atual. Um gateway novo pede um token novo, se você gerou outro.
- `GET http://127.0.0.1:4317/healthz` no Mac só diz que o processo responde. Não confirma login do agente nem saldo da xAI.
- Um pedido de voz sem `XAI_API_KEY` no ambiente do gateway não abre a sessão Zagan.
- Cancele pelo iPhone se a tarefa passou do que você queria. Arquivo já escrito ou comando já executado pode permanecer. Olhe a pasta do `--workspace` antes de pedir de novo.

Detalhes de protocolo, permissões de cada CLI e testes: [agentes de terminal](TERMINAL_AGENTS.md). Build e roteiro de hardware: [app iOS](../apps/ios/README.md).

## Prompts para configurar com um agente

Cole um prompt por vez no Codex, no Claude Code ou no Grok Code, na raiz deste repositório. O agente para no fim da etapa. A chave da xAI e o token não entram no chat.

### 1. Gateway

~~~~text
Você está na raiz do repositório Jarvis. Faça só a etapa do gateway no Mac. Pare antes do iPhone e dos óculos.

Regras:
- Não imprima nem commite o .env ou seus valores.
- Não coloque a chave da xAI no código, no Git nem no chat.
- Não exponha a porta 4317 na internet. Use o IP local do Mac.
- npm run probe:agents só inicia o protocolo. Não envie prompt ao modelo.

Passos:
1. Confira Node.js 22.18 ou mais novo com node -v. Se faltar, diga o que instalar e pare.
2. Rode npm ci.
3. Se .env não existir, copie .env.example para .env.
4. Se XAI_API_KEY estiver vazio, pare e peça para eu preencher a chave só no .env. Deixe XAI_VOICE_ID=zagan.
5. Rode codex --version. Claude e Grok são opcionais; rode npm run probe:agents somente se os três CLIs estiverem instalados.
6. Mostre o IP de ipconfig getifaddr en0. Gere um token com openssl rand -hex 24 e grave em JARVIS_GATEWAY_TOKEN no .env. Não repita o token no chat.
7. Pergunte o caminho absoluto do projeto que o agente vai editar e use primeiro uma pasta descartável.
8. Suba o gateway e deixe o processo rodando: set -a && source .env && set +a && npm run gateway -- --workspace '/caminho' --host 'IP_LOCAL' --port 4317
9. Confirme o log gateway.listening. GET http://127.0.0.1:4317/healthz só prova que o processo responde.

Entregue o IP, a porta 4317 e a frase: cole o mesmo token do .env em Conexões. Não avance para o iPhone.
~~~~

### 2. iPhone

~~~~text
O gateway do Jarvis já está rodando no Mac. Faça só a etapa do iPhone. Não pare o gateway, não gere outro token e não pareie os óculos.

O app está em apps/ios/JarvisSpike.xcodeproj, scheme JarvisSpike, iOS 17.2 ou mais novo. O simulador não serve para voz, óculos nem agentes.

1. Confirme comigo o IP e a porta 4317 e que o processo segue no ar. Não peça a chave da xAI.
2. Abra o projeto no Xcode. Assinatura automática com o meu Time. Não use Team ID de outra pessoa. Não commite provisioning, .p12 nem .mobileprovision.
3. Diga para eu selecionar o meu iPhone e apertar Run. Se o iOS bloquear, o caminho é Ajustes, Geral, VPN e gerenciamento de dispositivo.
4. Eu preencho Conexões, no ícone de Mac: endereço http://IP:4317, o token igual ao JARVIS_GATEWAY_TOKEN do .env, e o agente. Não peça o token neste chat. Ele fica no Keychain do iPhone.
5. Pare quando eu disser que o endereço foi salvo.

Pronto desta etapa: app instalado e Conexões preenchido. A próxima etapa é só os óculos.
~~~~

### 3. Óculos

~~~~text
O gateway está no Mac e o app no iPhone já tem endereço e token em Conexões. Faça só a etapa dos óculos. Não reinicie o gateway e não gere outro token.

Você não toca no iPhone nem nos óculos. Eu executo. Você confere o que eu descrever.

1. Os óculos precisam estar pareados no app Meta AI, com Developer Mode ligado. Se não estiver, pare e passe só esse passo.
2. No Jarvis, toque Conectar óculos, conclua o registro no Meta AI e volte.
3. Toque Iniciar sessão. Eu digo se a sessão iniciou e qual dispositivo apareceu. Se falhar, pare no erro. Não repita o pareamento sem eu pedir.
4. Na aba Jarvis, toque Falar com Jarvis e aceite as permissões solicitadas. Esse botão inicia a conversa diretamente.
5. Com os óculos no rosto, eu digo um pedido curto, por exemplo criar um arquivo de teste na pasta do --workspace. Para testar a palavra de ativação separadamente, ligo Ativar ao dizer “Jarvis” e digo Jarvis antes do pedido.
6. Se aparecer permissão, eu escolho Permitir uma vez ou Recusar. Sem resposta em dois minutos, o pedido é recusado.
7. A resposta precisa voltar falada nos óculos. O texto fica na aba Tarefas. Eu confirmo o arquivo na pasta do Mac, não só a fala.

Se a voz não abrir, confira se o gateway subiu com XAI_API_KEY no ambiente. Não imprima a chave. Para encerrar: Conexões, Encerrar conversa.
~~~~
