# Testes Swift

## Cliente de recuperação

No macOS com Xcode, sem iPhone, sem gateway externo e sem chamadas a modelos:

```bash
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/GatewayClient.swift apps/ios/tests/GatewayRecoveryTests.swift \
  -o /private/tmp/jarvis-gateway-recovery-tests
/private/tmp/jarvis-gateway-recovery-tests
```

O URLProtocol de teste simula uma resposta inicial perdida e uma queda de rede durante as consultas. Confere um único POST, recuperação de aprovação, remoção de aprovação já resolvida, resultado final e falha de autenticação sem repetição.

Isso não substitui testar o app físico sendo bloqueado/desbloqueado pelo usuário.

## Persistência do gateway

```bash
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/GatewaySettings.swift apps/ios/tests/GatewaySettingsTests.swift \
  -o /private/tmp/jarvis-gateway-settings-tests
/private/tmp/jarvis-gateway-settings-tests
```

Usa o Keychain real do macOS com serviço aleatório e token fictício, removidos ao finalizar. Verifica criação, leitura por nova instância, atualização, remoção idempotente, URL persistida e ausência do token nas preferências. Não substitui o teste de encerrar/reabrir o app no iPhone.

## Histórico de tarefas

```bash
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/JarvisTask.swift apps/ios/tests/JarvisTaskHistoryTests.swift \
  -o /private/tmp/jarvis-task-history-tests
/private/tmp/jarvis-task-history-tests
```

Verifica IDs isolados, retomada sem duplicação, preservação de texto parcial, estados terminais e limite do histórico.

## Intensidade, tom e apresentação da fala

```bash
xcrun swiftc -O -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/VoiceSignal.swift apps/ios/tests/VoiceSignalTests.swift \
  -o /private/tmp/jarvis-voice-signal-tests
/private/tmp/jarvis-voice-signal-tests
```

Usa sinais sintéticos para conferir intensidade, estimativa de tom em cinco taxas de amostragem, silêncio, ruído e dados inválidos. Também confere início, pausa, continuação, fim e descarte de eventos de uma fala substituída. Não usa microfone, modelos externos ou síntese de voz. A calibração com voz humana e Bluetooth HFP depende do teste físico.

## Voz xAI

```bash
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/XAIVoiceProtocol.swift apps/ios/tests/XAIVoiceTests.swift \
  -o /private/tmp/jarvis-xai-tests
/private/tmp/jarvis-xai-tests
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/GatewayClient.swift apps/ios/tests/XAIGatewayTests.swift \
  -o /private/tmp/jarvis-xai-gateway-tests
/private/tmp/jarvis-xai-gateway-tests
```

Valida PCM little-endian, valores inválidos, descarte de áudio interrompido ou antigo, seleção Zagan, expiração do token efêmero, autenticação e contrato de áudio. Não usa modelos pagos ou hardware. O teste físico cobre ativação com sessão started, Sim? em Zagan, conversa, interrupção, execução no Mac e retorno após aprovação.

## Eventos reais e conversão de frequência xAI

```bash
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/XAIVoiceProtocol.swift apps/ios/tests/XAIEventDecodingTests.swift \
  -o /private/tmp/jarvis-event-tests
/private/tmp/jarvis-event-tests apps/ios/tests/fixtures/xai-greeting-events.json
xcrun swiftc -module-cache-path /private/tmp/jarvis-swift-module-cache \
  apps/ios/JarvisSpike/XAIVoiceProtocol.swift apps/ios/tests/XAIAudioGraphTests.swift \
  -o /private/tmp/jarvis-audio-graph-tests
/private/tmp/jarvis-audio-graph-tests
```

O primeiro teste reproduz a sequência de uma saudação sintética Zagan capturada na API: `status_details` pode ser texto (`unimplemented`), objeto ou nulo. O áudio da fixture foi substituído por silêncio e os IDs normalizados. Erros de resposta continuam propagados.

O segundo renderiza áudio sintético offline pelo AVAudioEngine, com entrada PCM 16 kHz e saída 16/48 kHz em dois ciclos. Verifica amplitude, frequência e conclusão sem usar microfone, alto-falante ou APIs pagas. A contagem de ciclos usa histerese para desconsiderar transientes de baixa amplitude do conversor. O hardware Bluetooth ainda exige teste físico.
