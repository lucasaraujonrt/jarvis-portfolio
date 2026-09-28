# Ativação e voz Zagan — 15/09/2026

## Entrega

Branch `codex/voice-activation-fix`, baseada na main com PR #1. O código desta entrega não altera o worktree da implementação anterior de TTS.

A UI exigia HFP já ativo para liberar o controle que chama a configuração de áudio. Essa dependência circular foi removida: a sessão DAT precisa estar started; a operação de áudio configura e valida HFP. Falhas de permissão ou de rota continuam visíveis.

O padrão agora é xAI Realtime com Zagan. O botão Falar abre a conversa; o modo Jarvis usa a palavra de ativação antes de abrir a conexão. A conversa permanece ativa até ser encerrada. Tarefas de execução usam o agente selecionado no Mac e as aprovações existentes. Leitura de texto usa TTS Zagan. Respostas interrompidas não devem continuar enfileirando áudio na reprodução.

## Evidência

- `npm ci`, 17 testes via `npm test`, `npm run typecheck` e `git diff --check`: passaram.
- Testes Swift de PCM/estado de resposta, contrato do gateway xAI e recuperação de tarefas: passaram.
- `GET /v1/tts/voices/zagan`: HTTP 200 na conta existente.
- Emissão de token efêmero: HTTP 200; configuração exata do app aceita com `session.updated`, incluindo Zagan, ferramenta e PCM 16 kHz. Nenhum áudio ou pedido de geração foi enviado nesse teste.
- Gateway local atualizado na porta usada pelo app; health 200, acesso sem token rejeitado com 401, emissão autenticada de credencial Zagan 200. Workspace, estado e token anteriores preservados.
- Build Debug assinado para iPhone: passou. Único aviso: extração de metadados AppIntents ignorada, pois o app não usa esse framework.
- Instalação no iPhone 14 Pro via CoreDevice: confirmada.

Logs locais em `.qa-evidence/2026-09-15-xai-voice/` no worktree, fora do versionamento.

## Validação física pendente

O roteiro físico no aparelho inclui: ativação com sessão started, palavra Jarvis, Sim? em Zagan, voz bidirecional, interrupção, criação de tarefa, aprovação e resposta final. Build e handshake não comprovam reprodução, captura Bluetooth ou execução por fala. Argent não foi usado nesta rodada.
