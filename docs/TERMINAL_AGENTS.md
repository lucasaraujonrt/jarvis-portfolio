# Agentes de terminal pelo iPhone

Atualizado em 2026-09-14. Codex: criação/edição física e Grok: leitura/resumo validados. Recuperação após bloqueio implementada e testada por simulação, aguardando novo teste físico.

## Uso

O Mac precisa estar acordado, acessível ao iPhone e com os CLIs instalados e autenticados. A conta é utilizada pelo próprio CLI local. O gateway não recebe chaves de provedores pelo iPhone.

```bash
codex --version
claude --version
claude auth status
grok --version
npm run probe:agents
```

`probe:agents` somente inicializa os protocolos. Não cria tarefas nem envia prompts aos modelos e não comprova acesso ao modelo ou saldo. A reinstalação autorizada do Claude restaurou `~/.local/bin/claude` em 14/09, versão 2.1.271.

Inicie na raiz do Jarvis, apontando explicitamente o projeto que será operado:

```bash
export JARVIS_GATEWAY_TOKEN="$(openssl rand -hex 24)"
npm run gateway -- --workspace '/caminho/absoluto/do/projeto' --host 127.0.0.1 --port 4317
```

Para o iPhone, use o IP privado do Mac em `--host` e informe `http://<ip>:4317` no app. Digite o mesmo token no campo do app. O exemplo loopback acima serve apenas para acesso no próprio Mac. Não exponha essa porta na internet; HTTP não cifra token, conteúdo ou aprovações. Acesso remoto requer transporte privado/cifrado, fora desta entrega.

Se o gateway não encontrar os comandos, configure os executáveis antes de iniciá-lo:

```bash
export JARVIS_CODEX_COMMAND='/opt/homebrew/bin/codex'
export JARVIS_CLAUDE_COMMAND="$HOME/.local/bin/claude"
export JARVIS_GROK_COMMAND="$HOME/.grok/bin/grok"
```

Não informe flags dentro dessas variáveis: cada valor é um caminho de executável. Não há shell intermediário no lançamento.

No app, abra **Conexões** pelo ícone de Mac, escolha o agente e configure endereço/token. Na aba **Jarvis**, use **Falar com Jarvis** e **Concluir e enviar**; abra a tarefa para acompanhar a resposta, revisar aprovações ou cancelar. O fluxo automático `Jarvis` continua usando a transcrição existente e pode ser ativado em Conexões. Um frame opcional é enviado como imagem; não há streaming contínuo de vídeo para o agente.

## Execução, sessões e permissões

- Codex: App Server, `workspace-write`, política `untrusted`.
- Claude Code: protocolo stream-json bidirecional, `default`, permissões por `stdio`.
- Grok Code: ACP por `stdio`, processo local `--no-leader`, sem `--always-approve`.
- O diretório de trabalho vem de `--workspace`; o app não escolhe caminhos arbitrários por requisição.
- Estado local em `.jarvis/agents/<hash-do-workspace>/<agente>.json`, relativo ao diretório de lançamento. `--state-dir` substitui a raiz. Não apague esses arquivos para tentar corrigir uma tarefa em andamento.
- `--state` legado substitui apenas o arquivo Codex. Estado antigo sem vínculo ao workspace é recusado em execução; o caminho padrão novo evita reutilizar a conversa histórica por acidente.
- Cada agente tem seu histórico próprio. Alternar agente não transfere automaticamente a conversa; os arquivos do projeto são compartilhados.
- Uma tarefa por vez. Aprovações são vinculadas à tarefa e só valem uma vez; expiração em 2 minutos recusa a ação.
- O app fala um aviso para conferir o iPhone quando recebe um pedido de aprovação. A decisão é pelos botões **Permitir uma vez** ou **Recusar**.
- Aprovações seguem as regras nativas do CLI. Ferramentas já permitidas por configurações locais podem executar sem prompt. `cwd` não é uma sandbox universal para Claude/Grok; o Jarvis não promete isolamento equivalente entre provedores.
- Cancelar ou atingir 10 minutos interrompe o processo controlado. Perder a conexão não interrompe mais a tarefa: o app consulta seu estado ao recuperar a rede. Alterações, comandos concluídos, serviços externos e processos que se destacaram da árvore podem permanecer. Confira o projeto antes de reenviar.
- Erros e EOF sem conclusão nunca são tratados como sucesso. Confira arquivos e histórico do CLI antes de tentar novamente.

## Contrato do gateway

`GET /healthz` só informa que o servidor responde; não verifica login ou disponibilidade de modelos.

Todas as rotas de tarefa, inclusive GET, exigem `Authorization: Bearer <token>`:

- `/v1/turn`: `{requestId, agent, message, imageDataUrl?}`. `agent` é `codex`, `claude` ou `grok`; omissão seleciona Codex por compatibilidade.
- `/v1/turn/start`: inicia uma tarefa com UUID obrigatório e retorna `{requestId}`; repetir UUID/conteúdo dentro da retenção não inicia outra execução.
- `GET /v1/turn/status?requestId=<UUID>`: estado, texto atual, atividade, aprovações ainda válidas e resultado. Requer Bearer.
- O iPhone usa início + consulta periódica, sem repetir o POST em falhas de conexão. Tarefas ficam em memória por 30 minutos após conclusão (até 32); reinício do gateway perde esse estado. Force-quit do app ainda não recupera o identificador automaticamente.
- Eventos NDJSON: `started`, `delta`, `activity`, `approval`, `approval_resolved`, `completed`, `error`, sempre com `requestId`.
- `/v1/approval`: `{requestId, approvalId, approved}`.
- `/v1/turn/cancel`: `{requestId}`.

`requestId` deve ser único por tarefa (UUID no iPhone). O token dá controle do gateway; não é autenticação multiusuário. O servidor não registra falas, imagens, respostas ou decisões em logs próprios. Os CLIs podem registrar esses conteúdos em seus históricos nativos.

## Verificação feita

- 14 testes com processos simulados e HTTP local: seleção, autenticação, concorrência, aprovação/recusa, expiração, cancelamento, streaming, retomada do ID, perda de conexão, consulta de resultado, expiração de aprovação sem reapresentação, idempotência e falhas.
- Cliente Swift testado com URLProtocol: resposta inicial perdida, rede interrompida, consulta sem reexecução, lista atual de aprovações, resultado final e erro de autenticação. Comando reproduzível em `apps/ios/tests/README.md`.
- `npm run typecheck` e `git diff --check`: passaram.
- Build Swift sem assinatura para iOS: passou, SDK Meta do cache local.
- `npm run probe:agents`: inicialização real dos três CLIs passou sem prompts. Não foi executado comando por IA nem feito teste pago.

## Próximo teste físico

Use um diretório descartável e uma conta CLI com uso autorizado:

1. Pelo iPhone, pedir “crie briefing.md com título Teste Jarvis e a tarefa criar uma landing page”. Verificar o arquivo no Mac, não apenas a resposta falada.
2. No mesmo agente, pedir uma alteração ao arquivo e verificar a retomada.
3. Provocar um pedido de permissão nativo adequado à configuração local, conferir os detalhes no iPhone e recusar. Verificar que a ação recusada não aconteceu. Repetir permitindo uma vez.
4. Cancelar uma tarefa em execução e conferir quais efeitos ficaram. Não usar operações destrutivas como teste.
5. Codex criação/edição e Grok leitura/resumo já passaram. Repetir os demais cenários; Claude aguarda acesso válido.
6. Validar aviso de aprovação, áudio HFP e comportamento com app em background. Não presumir que o gate de voz de agosto se estende a esse novo fluxo.

## Fontes de protocolo

Consultadas em 14/09/2026:

- [Codex App Server](https://learn.chatgpt.com/docs/app-server).
- [Claude Code CLI](https://code.claude.com/docs/en/cli-reference) e [controle stream-json no SDK oficial](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py).
- Grok Code 1.0.25: `grok agent --help` e documentação fornecida pelo CLI em `~/.grok/docs/user-guide/15-agent-mode.md`.

Quem distribuir uma integração com contas ou CLIs de terceiros deve verificar os termos de uso dos respectivos provedores.
