# Jarvis — possíveis extensões

O recorte de portfólio desta versão é **pedido por voz no iPhone → Codex no Mac → arquivo criado**. A [demo](media/jarvis-demo.mp4) e o [estado com evidências](JARVIS_STATUS.md) mostram o que existe hoje. Este documento lista ideias para uma eventual retomada; não é um plano de entrega.

## Antes de chamar o uso diário de confiável

1. Registrar em hardware uma sessão que inclua interrupção da fala, aprovação, recusa, cancelamento, bloqueio do iPhone e reconexão dos óculos. Os testes simulados e o vídeo de um pedido não cobrem essa sequência.
2. Validar câmera, microfone e reprodução simultâneos nos óculos por uma sessão prolongada, medindo latência, quedas e bateria. O código recebe frames e pode anexar o mais recente a uma tarefa; acompanhamento contínuo da cena ainda não foi implementado.
3. Se houver uso fora da rede local, projetar uma conexão autenticada e cifrada até o Mac. O gateway atual usa HTTP com token na LAN.

## Ideias adiadas

- Reconexão automática dos óculos e diagnóstico claro dos estados de áudio.
- Live Activity para consultar o estado da tarefa na tela bloqueada.
- Escolha de modelo dentro de cada agente, conforme as capacidades reais do CLI instalado.
- Acompanhamento visual ativado pelo usuário e avisos por voz durante uma sessão.
- Instalação mais simples do gateway e persistência além da memória do processo.

Esses itens são hipóteses técnicas. O projeto não depende deles para apresentar o fluxo de portfólio atual. Para executar e avaliar esta versão, siga o [guia de configuração](SETUP.md).
