# Cyberpunk Diário — Android + Windows Desktop

O Cyberpunk Diário funciona offline no Android e no Windows. O aplicativo Android mantém os dados locais e pode sincronizar com o aplicativo desktop pela rede local, sem depender de nuvem ou de um serviço externo.

## Downloads

A versão mais recente é publicada em [Releases](https://github.com/otavio-dias-leite/cyberpunk-diary/releases).

- **Android:** instale `app-debug.apk`. A versão 1.4.0 mantém o mesmo `applicationId` e incrementa o `versionCode`, permitindo atualizar a instalação 1.3.0 sem desinstalar.
- **Windows:** baixe e extraia `Cyberpunk-Diario-Desktop-Windows.zip`; execute `CyberpunkDiario.exe` dentro da pasta extraída. O pacote inclui runtime Java.

## Sincronização entre Android e Windows

1. Conecte computador e celular à mesma rede Wi-Fi.
2. Execute `CyberpunkDiario.exe` no Windows.
3. A janela do desktop mostra o endereço local do servidor e um código de pareamento.
4. No Android, abra **Ajustes → Sincronização LAN**.
5. Informe o endereço IP do computador (por exemplo, `http://192.168.1.20:8765`) e cole o código de pareamento.
6. Salve. A sincronização bidirecional acontece automaticamente enquanto os dois dispositivos estiverem conectados à mesma rede.

O desktop é o servidor local; Android e navegador desktop são clientes. O estado sincronizado fica salvo em `%APPDATA%/CyberpunkDiario/state.json` no Windows. O código de pareamento fica em `%APPDATA%/CyberpunkDiario/pairing.token`.

**Segurança:** o servidor usa token aleatório e aceita alterações somente com autenticação. A comunicação LAN usa HTTP; utilize apenas em redes privadas confiáveis, não compartilhe o código e não encaminhe a porta 8765 para a internet. A sincronização não substitui backups.

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
