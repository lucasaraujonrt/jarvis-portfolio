# UI de voz e tarefas — validação

Este relatório registra a primeira versão. O comportamento atualizado de áudio e sua validação estão em [Escuta reativa e animação de resposta](reactive-voice.md).

Branch: `codex/voice-tasks-ui`. Base funcional compartilhada: `b2f265f`.

## Implementado

- SwiftUI nativo: abas Jarvis/Tarefas, navegação, listas, detalhe, aprovação e Conexões.
- Azul padrão do iOS, SF Symbols e cores de fundo semânticas, com modos claro e escuro.
- Onda de escuta animada, transição para acompanhamento, entrada de tarefas, resposta ao toque, mudança de símbolos e confirmação ao copiar.
- Feedback háptico configurado para seleção, aprovação e conclusão. A sensação física não pode ser validada no simulador.
- Reduce Motion desliga os movimentos personalizados; a onda também pausa fora da tela e com o app inativo.
- Histórico de até 50 tarefas da sessão, identificado por UUID. Texto parcial é preservado durante falhas de conexão. Eventos atrasados não reabrem tarefas encerradas.
- Controles funcionais existentes mantidos no modelo; diagnóstico acessível em Conexões na execução real.

## Testado

Simulador QA-iPhone17, iOS 26.4.
Bundle isolado instalado para a prévia.

| Verificação | Resultado |
| --- | --- |
| Build Debug para simulador | Passou |
| Build Release para iPhone, sem assinatura | Passou |
| Ouvir → enviar → aprovação → permitir → concluir | Passou com dados simulados; vídeo salvo |
| Copiar resposta e confirmação visual | Passou |
| Cancelar tarefa / recusar alteração | Passou com dados simulados |
| Reconexão e mensagem de estado desatualizado | Passou com dados simulados |
| Falha sem indicação de sucesso | Passou com dados simulados |
| Desconectado → Conexões; histórico vazio | Passou |
| Modo escuro e Dynamic Type accessibility2 | Passou; títulos crescem em vez de cortar após duas linhas |
| Prévia com Reduzir animações | Exercitada no estado de escuta |
| Teste de histórico: IDs, estados terminais, texto parcial e limite | Passou |
| Teste existente de recuperação do gateway | Passou |
| git diff --check | Passou |

O log do simulador registra mensagens do UIKit sobre atualização de menus já fechados, métricas de lançamento e arquivos de cache ausentes. Não houve encerramento inesperado durante os fluxos exercitados. A compilação só avisou que não havia metadados de AppIntents para extrair.

## Como experimentar

O app já está instalado no simulador. Abra **Jarvis Spike**, identificado pelo botão **Prévia**. Toque em **Falar com Jarvis**, depois **Concluir e enviar**. O exemplo pede uma aprovação e conclui após permitir. O menu **Prévia → Cenário** permite selecionar outros estados; aparência e acessibilidade ficam no mesmo menu.

Em Debug no simulador, os exemplos usam apenas memória e não acessam credenciais, microfone, SDK dos óculos ou agentes remotos. Para testar uma integração real em Debug, adicione o argumento de lançamento `--live-gateway`. Em iPhone ou Release, a prévia não é ativada.

## Evidências locais

Diretório: `.qa-evidence/2026-09-14-voice-tasks-ui/` neste worktree, ignorado pelo Git.

- `voice-approval-completion.mp4`: gravação do fluxo, cerca de 24 segundos, pausas estáticas reduzidas.
- `home-light.png`, `home-dark.png`, `tasks-light.png`, `tasks-dark.png`.
- `approval-home.png`, `approval-sheet.png`, `completed.png`.
- `cancelled.png`, `approval-refused.png`, `reconnecting.png`, `failed.png`.
- `connections.png`, `disconnected.png`, `empty-tasks.png`.
- `tasks-large-text.png`, `reduced-motion-listening.png`.
- Logs de build, histórico, recuperação do gateway e erros do simulador.

## Limites desta rodada

Voz real, rota Bluetooth HFP, óculos Meta, comandos no Mac e hápticos precisam de validação física. O histórico é temporário, sem persistência entre aberturas do app. A onda representa escuta, não amplitude do microfone. iOS 17.2 é o mínimo de compilação, mas a execução visual foi validada somente no simulador iOS 26.4. Nenhuma alteração foi enviada ao remoto.
