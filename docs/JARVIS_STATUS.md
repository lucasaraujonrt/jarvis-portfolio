# Jarvis — estado e evidências

Recorte de portfólio em 28/09/2026: **pedido por voz no iPhone → Codex no Mac → arquivo no workspace**. O [vídeo de 1:03](media/jarvis-demo.mp4) mostra essa sequência em uma versão local. Algumas abas vistas na gravação são experimentais e não estão na `main`. A edição corta uma espera, sinaliza a aprovação feita no iPhone e oculta dados pessoais.

## O que o código implementa

| Camada | Estado |
| --- | --- |
| Gateway no Mac | Servidor Node.js com token obrigatório, workspace escolhido no início, uma tarefa ativa, andamento, aprovações, cancelamento e consulta de estado após perda da resposta ou da conexão. |
| Agentes | Adaptadores locais Codex, Claude Code e Grok Code. Sessões separadas por agente e workspace. As permissões finais dependem também das configurações de cada CLI. |
| App iOS | SwiftUI para voz, tarefas, aprovação e Conexões; URL salva nas preferências e token no Keychain. Histórico de tarefas limitado à sessão do app. |
| Voz e óculos | Sessão Meta Wearables DAT e câmera; Apple Speech detecta “Jarvis”; xAI Realtime e TTS Zagan conduzem a conversa. A chave xAI permanente fica no gateway. |

O gateway entrega credenciais efêmeras de voz ao iPhone. A conversa Realtime depende do serviço xAI e o uso de um agente depende da conta/serviço do CLI escolhido. Sem óculos ou serviço pago, é possível avaliar os testes, o código, a prévia do simulador e o vídeo; não reproduzir o fluxo físico completo. Veja o [guia de avaliação](SETUP.md).

## O que foi verificado

- **Código e simulação:** `npm test`, `npm run typecheck` e testes Swift locais cobrem contratos de gateway, agentes simulados, recuperação, estados de tarefa e áudio sintético. Os comandos reproduzíveis estão no [README](../README.md#avaliar-sem-óculos-ou-serviços-pagos) e em [testes Swift](../apps/ios/tests/README.md). Testes simulados não provam rota Bluetooth, autenticação dos provedores ou execução física.
- **Codex no Mac:** criação e edição de arquivo foram conferidas em teste físico anterior. O [vídeo de 25/09](media/jarvis-demo.mp4) é a evidência pública de outro pedido, feito no iPhone, com arquivo criado no Mac.
- **Grok Code:** leitura e resumo de arquivo foram conferidos em teste local anterior, sem gravação pública. **Claude Code:** o adaptador e seus testes simulados existem; não há validação funcional física de Claude.
- **Óculos:** testes locais de agosto confirmaram comando “Jarvis”, confirmação “Sim?”, captura por HFP, resposta falada e câmera. Os registros detalhados não acompanham esta versão pública. Esses resultados são da implementação anterior e não comprovam câmera, microfone e reprodução simultâneos por período prolongado com a conversa xAI atual.

## Limites conhecidos

- O vídeo prova um pedido completo. Interrupção de fala, recusa, cancelamento, retomada após bloquear o iPhone e reconexão dos óculos ainda precisam de uma rodada física registrada para este fluxo.
- O histórico do app dura enquanto o processo está aberto; o estado recente do gateway fica em memória. Cancelar uma tarefa não desfaz arquivos ou comandos já executados. Veja os [limites de execução](TERMINAL_AGENTS.md).
- Câmera contínua com comentário visual automático, Live Activity e avisos proativos são [propostas](ROADMAP.md), não funcionalidades desta versão.

Para configurar hardware e serviços, siga [SETUP.md](SETUP.md) e o [guia iOS](../apps/ios/README.md). Para avaliar a arquitetura e os limites de permissões, veja [TERMINAL_AGENTS.md](TERMINAL_AGENTS.md).
