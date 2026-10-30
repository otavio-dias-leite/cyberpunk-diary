# Cyberpunk Diário 1.10.5 — Android e Windows

O Cyberpunk Diário funciona offline nos dois sistemas. Os dados permanecem locais e podem ser sincronizados diretamente entre Android e Windows quando os dispositivos estão conectados à mesma rede Wi-Fi/LAN.

## Downloads

Os pacotes publicados ficam em [Releases](https://github.com/otavio-dias-leite/cyberpunk-diary/releases).

- **Android:** APK para instalação e atualização. O identificador do aplicativo permanece `com.cyberpunkdiario.offline`.
- **Windows:** extraia `Cyberpunk-Diario-Windows.zip` e execute `CyberpunkDiario.exe`. O diário abre dentro de uma janela própria, sem navegador externo.

## Sincronização automática pela LAN

1. Abra o Cyberpunk Diário no Windows.
2. Conecte o celular e o computador à mesma rede Wi-Fi/LAN.
3. No Android, abra **Ajustes → Sincronização pela rede local** e toque em **Procurar dispositivos**.
4. Selecione o computador detectado automaticamente.
5. No primeiro pareamento, informe o código exibido na janela do Windows. Depois disso, o endereço e a autorização ficam salvos e a sincronização ocorre automaticamente.

Não é necessário instalar Tailscale, criar conta, usar nuvem ou digitar endereço IP. O Android envia uma descoberta UDP na rede local; o Windows responde com seu nome e endereço. O Windows também identifica os celulares que procuram dispositivos compatíveis.

A sincronização usa HTTP autenticado dentro da rede privada local. Permita o Cyberpunk Diário no Firewall do Windows para redes privadas. Não encaminhe as portas 8765 (dados) ou 8766 (descoberta) para a internet. Redes Wi-Fi de convidados ou com isolamento entre clientes podem bloquear a descoberta.

## Calendário mensal

- Zoom por pinça com dois dedos em telas sensíveis ao toque.
- Botões de zoom e ajuste.
- Deslizar horizontalmente para mês anterior/próximo.
- Botão Hoje e navegação por teclado.
- Rolagem vertical da página sem prender o gesto nos quadrados.

## Compilação

O GitHub Actions compila o APK Android e o aplicativo Windows nativo e publica os dois pacotes em Releases.

A assinatura Android precisa manter o mesmo keystore entre versões para permitir atualizações sem desinstalação. Se a chave antiga não estiver disponível, o Android poderá exigir uma migração com backup e reinstalação única.
