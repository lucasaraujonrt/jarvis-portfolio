# Erro de formato ao iniciar xAI — 15/09/2026

## Causa reproduzida

O alerta no iPhone dizia “The data couldn’t be read because it isn’t in the correct format.” A reprodução com uma saudação sintética Sim? da xAI capturou `response.created` e `response.done` com `response.status_details = "unimplemented"`. O decoder Swift esperava um objeto. A sequência real reproduziu o mesmo DecodingError antes de o primeiro buffer de áudio ser reproduzido.

O teste anterior validava apenas o handshake; ele não exercitava os eventos da primeira resposta.

## Correção

`RealtimeStatusDetails` aceita texto, objeto e ausência/nulo. O estado da resposta determina falhas, e erros estruturados continuam visíveis. Falhas de leitura agora identificam o campo incompatível em português.

A captura confere se a taxa do microfone ainda corresponde à taxa anunciada à xAI antes de instalar o tap. Diagnóstico exibe as taxas do microfone, da API e da saída do dispositivo. O áudio da API permanece PCM 16 kHz; o mixer adapta para a saída do dispositivo. Não foi necessário trocar a frequência padrão para corrigir este erro de leitura.

## Validação

- Fixture de eventos reais: falhou antes e passou depois da correção.
- Texto/objeto/nulo/ausente e resposta de erro: testes passaram.
- Testes existentes de PCM e descarte de resposta interrompida: passaram.
- Build Debug assinado para iPhone: passou, somente aviso existente de AppIntents.
- Conversão offline 16 → 16/48 kHz: passou em duas inicializações por taxa, com amplitude e tom preservados.
- Instalação no iPhone 14 Pro: confirmada via CoreDevice. Logs em `.qa-evidence/2026-09-15-xai-decoding/` no worktree.

Reprodução e captura nos óculos dependem da confirmação física do usuário. Nenhum áudio pessoal foi enviado na reprodução do erro.
