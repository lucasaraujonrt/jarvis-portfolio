# Escuta reativa e animação de resposta

Refinamento da UI na branch `codex/voice-tasks-ui`, após a primeira prévia.

## Comportamento

- Escuta: barras azuis existentes, altura pela intensidade RMS em escala logarítmica; o formato fica mais largo nos graves e mais concentrado nos agudos. A onda baixa nas pausas, com ataque rápido e queda suavizada.
- Tom: estimativa de frequência fundamental entre aproximadamente 70 e 450 Hz, com correlação e rejeição de ruído não periódico. Não representa emoção nem uma transcrição da entonação. Quando o tom não é confiável, a largura fica neutra e a intensidade continua respondendo ao áudio.
- Resposta: três anéis e um símbolo de alto-falante. Pulsos acompanham as palavras; início, pausa, continuação, cancelamento e término acompanham o sintetizador do iOS. O controle **Parar resposta** interrompe a reprodução.
- Os anéis representam o ritmo dos eventos da fala, não a amplitude PCM de saída. São usados os callbacks oficiais de [AVSpeechSynthesizerDelegate](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizerdelegate).
- Reduzir movimento mantém formas estáticas. Os anéis deixam de animar quando o app fica inativo.

## Implementação

`AudioProbe` aproveita o tap de áudio já usado para reconhecimento. Copia uma quantidade limitada de amostras para uma fila de análise; se a fila estiver ocupada, descarta apenas esse quadro visual. A análise publica no máximo cerca de 22 atualizações por segundo. IDs de captura impedem que amostras antigas voltem à UI depois de parar a escuta.

`VoiceSignalAnalyzer` mede intensidade e estima tom localmente. O modelo de apresentação da fala descarta callbacks de uma resposta substituída. A escolha de voz, o reconhecimento, a rota HFP e o fluxo funcional de ativação por voz foram mantidos.

## Prévia para avaliação manual

Instalada no simulador QA-iPhone17 como prévia isolada.

- **Prévia → Voz de teste**: variação, suave, forte, grave, agudo e silêncio. Os exemplos geram sinais PCM sintéticos e passam pelo mesmo analisador da captura real.
- **Prévia → Cenário → Jarvis falando**: demonstra os anéis e o botão de parada.
- O fluxo de aprovação também termina com a animação de resposta.

Os exemplos do simulador não captam a voz de quem está olhando. A reação à voz real está conectada à captura existente no iPhone e depende da sessão dos óculos.

## Validação

- Testes passaram para intensidade, diferença entre grave/agudo, 25 combinações de frequência/taxa de amostragem, silêncio, ruído, entradas inválidas e callbacks de fala atrasados.
- Build Debug de simulador e Release de iPhone passaram. Aviso apenas sobre ausência de metadados AppIntents.
- `git diff --check` passou.
- Logs: `.qa-evidence/2026-09-15-reactive-voice/` neste worktree.
- Esta rodada não usou Argent nem realizou inspeção visual automatizada. A calibração com voz humana e Bluetooth HFP ainda precisa ser feita no dispositivo real.
