# JarvisSpike no iPhone

App SwiftUI do protótipo de portfólio. A prévia de interface funciona no simulador; o fluxo real por voz exige iPhone com iOS 17.2+, sessão Meta DAT iniciada, gateway no Mac e acesso à API de voz xAI. O teste original usou Oakley Meta HSTN.

## Build físico

Para testar com óculos em **Developer Mode**, configure seu `DEVELOPMENT_TEAM` e `PRODUCT_BUNDLE_IDENTIFIER` para assinar o app e mantenha `META_APP_ID=0` e `CLIENT_TOKEN` vazio, como no projeto. Habilite Developer Mode no Meta AI para os óculos pareados. Segundo o [guia oficial do SDK Meta](https://github.com/facebook/meta-wearables-dat-ios/blob/main/plugins/mwdat-ios/skills/getting-started/SKILL.md), esse modo dispensa App ID e Client Token. Para uma distribuição fora do Developer Mode, configure `META_APP_ID` e `CLIENT_TOKEN` do seu app no Wearables Developer Center, com Team e bundle ID correspondentes. O `Info.plist` usa esses build settings e o callback `jarvisspike://`.

Configure os valores na cópia local do projeto ou passe-os ao `xcodebuild`; não versione credenciais nem arquivos de assinatura. Se editar o projeto no Xcode, confira o diff antes de commitar. Build e instalação não garantem que o registro Meta ou a rota HFP funcionem no aparelho.

```bash
xcodebuild \
  -project apps/ios/JarvisSpike.xcodeproj \
  -scheme JarvisSpike \
  -configuration Debug \
  -destination 'id=<id-do-iphone>' \
  -clonedSourcePackagesDirPath /private/tmp/jarvis-source-packages \
  -derivedDataPath /private/tmp/jarvis-device-derived \
  DEVELOPMENT_TEAM=<seu-team-id> \
  PRODUCT_BUNDLE_IDENTIFIER=<seu-bundle-id> \
  META_APP_ID=0 \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates build
```

Substitua os valores entre `<...>` antes de executar. Para Developer Mode, deixe `CLIENT_TOKEN` vazio como está no projeto. O comando é um exemplo de build; a instalação física é feita pelo Xcode com o iPhone selecionado.

## Gateway privado

Use o IP privado atual do Mac e o token preenchido no `.env` conforme o [guia de configuração](../../docs/SETUP.md#reproduzir-no-iphone-e-mac). O mesmo token entra em **Conexões** no iPhone. O gateway não lê `.env` sozinho:

```bash
set -a
source .env
set +a
npm run gateway -- --workspace '/caminho/absoluto/do/projeto' --host '<ip-privado>' --port 4317
```

O gateway exige token inclusive em loopback. Ele não registra a transcrição, a imagem ou a resposta em logs próprios; os CLIs podem guardar seus históricos. A porta usa HTTP sem criptografia e deve ficar restrita à rede local.

## Roteiro do gate físico

1. Abra **Conexões** pelo ícone de Mac e informe `http://<ip-privado>:4317`, o token do processo e o agente.
2. Toque **Conectar óculos**, conclua o registro no Meta AI e retorne ao JarvisSpike.
3. Toque **Iniciar sessão** e confirme que o dispositivo mostra `oakleyMetaHSTN` e a sessão chega a `started`.
4. Em **Conexões → Diagnóstico**, toque **Iniciar câmera** e confirme que aparece um frame real dos óculos. Em Conexões, ative **Anexar imagem ao pedido** se desejar enviá-la.
5. Volte à aba **Jarvis**. Com os óculos vestidos, toque **Falar com Jarvis**, autorize microfone e reconhecimento de fala e diga uma pergunta sobre o frame.
6. Confirme `BluetoothHFP` tanto em Entrada quanto em Saída e `PASS — BluetoothHFP duplex`.
7. Toque **Concluir e enviar**. Abra a tarefa atual para acompanhar texto, responder aprovações e cancelar. Confirme a resposta audível nos óculos.

Só marque os gates de hardware como aprovados com evidência visual/sonora dessa execução. Pareamento no Meta AI ou áudio funcionando em outro app não bastam.

## UI e prévia do simulador

As abas **Jarvis** e **Tarefas** reúnem voz, andamento, aprovações e respostas. O histórico guarda até 50 tarefas enquanto o app está aberto. Os controles técnicos continuam em **Conexões → Diagnóstico**. A ativação ao dizer “Jarvis” fica em Conexões.

Em Debug no simulador, o app inicia com exemplos locais e o botão **Prévia**. **Cenário** seleciona os estados; **Voz de teste** demonstra intensidade, tom e silêncio. **Jarvis falando** demonstra os anéis da resposta. Essa avaliação dispensa óculos, gateway, chave xAI e login em CLI; o simulador não capta voz real nem executa agentes no Mac nesse modo. Para usar a integração real em Debug, adicione `--live-gateway` aos argumentos de lançamento. No iPhone e em Release, o app usa a integração real.

Detalhes e limites: [validação da UI](../../docs/design/voice-tasks-ui-qa.md) e [áudio reativo](../../docs/design/reactive-voice.md).

## Execução com agentes de terminal

Veja [configuração e roteiro atual](../../docs/TERMINAL_AGENTS.md). O roteiro físico acima é a referência de voz/câmera; não valida por si só execução, permissões ou cancelamento dos novos adaptadores.

### Configuração persistente do gateway

O endereço é salvo automaticamente em UserDefaults e o token no Keychain (`AfterFirstUnlockThisDeviceOnly`, sem sincronização iCloud). Editar o token atualiza o item; limpar o campo o remove. Falhas de armazenamento geram alerta. Em builds Debug, as variáveis de lançamento preenchem e salvam apenas configurações ainda ausentes; dados salvos têm prioridade. O token não é incluído no código nem nas preferências.

## Voz xAI Zagan

O padrão é xAI Realtime com Zagan. Ao iniciar a sessão dos óculos, **Ativar ao dizer “Jarvis”** fica ligado automaticamente e aguarda a palavra de ativação. **Falar com Jarvis** também permite abrir a conversa diretamente após pausar a escuta. A rota HFP é configurada ao ativar a escuta. **Encerrar conversa** em Conexões para captura, áudio e conexão xAI.

O gateway precisa de `XAI_API_KEY` e serve `POST /v1/voice/session` para emitir credenciais efêmeras, além de `POST /v1/speak` para ler respostas com Zagan. Ambos exigem o token do gateway. A chave xAI não é copiada para o iPhone. Use `XAI_VOICE_ID=zagan` quando houver uma variável de voz antiga no ambiente.

Pedidos de execução na conversa usam o agente selecionado em Conexões. Aprovações e cancelamento continuam na tarefa. Uma falha de voz aparece no app; a resposta de texto já concluída permanece disponível.
