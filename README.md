# Cyberpunk Diário — Android + Windows Desktop

O Cyberpunk Diário funciona offline no Android e no Windows. O aplicativo Android mantém os dados locais e pode sincronizar com o aplicativo desktop pela rede local, sem depender de nuvem ou de um serviço externo.

## Downloads

A versão mais recente é publicada em [Releases](https://github.com/otavio-dias-leite/cyberpunk-diary/releases).

- **Android:** instale `app-debug.apk`. A versão 1.4.0 mantém o mesmo `applicationId` e incrementa o `versionCode`, permitindo atualizar a instalação 1.3.0 sem desinstalar.
- **Windows:** baixe e extraia `Cyberpunk-Diario-Desktop-Windows.zip`; execute `CyberpunkDiario.exe` dentro da pasta extraída. O pacote inclui runtime Java.

## Sincronização entre Android e Windows com Tailscale

1. Instale o [Tailscale para Windows](https://tailscale.com/download/windows) no PC e o [Tailscale para Android](https://play.google.com/store/apps/details?id=com.tailscale.ipn) no celular.
2. Entre na mesma conta Tailscale nos dois dispositivos e conecte-os à rede privada.
3. Execute `CyberpunkDiario.exe` no Windows. A janela mostra os endereços de rede; use o endereço marcado **TAILSCALE** (normalmente `100.x.x.x:8765`).
4. No Android, abra **Ajustes → Sincronização Tailscale**, informe `http://100.x.x.x:8765` e cole o código de pareamento exibido no PC.
5. Salve. A sincronização bidirecional funciona também quando PC e celular estão em redes diferentes, desde que ambos estejam conectados ao Tailscale.

O desktop continua sendo o servidor e o Android é o cliente. O Tailscale fornece a conectividade privada; o token aleatório do Cyberpunk Diário continua autenticando as alterações. Não é necessário configurar um Exit Node: somente o tráfego destinado aos dispositivos do tailnet passa pela rede Tailscale, e a navegação comum continua usando a internet normal. O servidor também mantém os endereços LAN para uso na mesma Wi-Fi.

**Limites e segurança:** instale e mantenha o Tailscale conectado nos dois dispositivos. Não encaminhe a porta 8765 ao público. A sincronização atual envia o estado JSON do diário; ela ainda não é uma sincronização genérica de pastas/arquivos. O PC é o servidor nesta implementação; o Android funciona como cliente. Faça backups regulares.


## Recursos 1.4.0

- Rotinas editáveis com nome, horário, observação e link.
- Subtarefas por rotina, com checklists diários que reiniciam automaticamente na data seguinte. Os registros de dias anteriores permanecem salvos.
- Links HTTP/HTTPS associados a tarefas e rotinas.
- Calendário mensal com células maiores, altura adaptável e títulos completos em múltiplas linhas.
- Semana com sete colunas expandidas no desktop e cartões largos no celular.
- Sincronização bidirecional entre Android e Windows pela rede local.
- Perfis locais, temas, tarefas recorrentes, histórico e exportação/importação JSON.
- Funcionamento offline quando não houver servidor conectado.

## Compilar Android pelo GitHub Actions

O workflow **Build Cyberpunk Diário Android and Desktop** compila o APK no Ubuntu e o aplicativo Windows no runner Windows.

Para iniciar manualmente:
1. Abra a aba **Actions**.
2. Selecione **Build Cyberpunk Diário Android and Desktop**.
3. Clique em **Run workflow**.
4. Baixe os artefatos Android e Windows quando os dois jobs terminarem.

Em push para `main`, os dois pacotes são publicados na Release `v1.4.0`.

## Estrutura

- `app/src/main/assets/` — interface, CSS, lógica do diário e cliente de sincronização.
- `app/src/main/java/` — integração Android/WebView e backup nativo.
- `desktop/src/main/java/` — servidor HTTP local e janela de pareamento Windows.
- `desktop/build.gradle` — empacotamento da aplicação desktop com runtime Java.
- `.github/workflows/android-apk.yml` — builds Android/Windows e publicação.

## Dados

O Android mantém um snapshot no armazenamento interno do aplicativo. Exportar backups JSON continua disponível em Ajustes. A sincronização mantém uma cópia no computador; faça backups regulares antes de reinstalar, apagar dados ou trocar de aparelho.
