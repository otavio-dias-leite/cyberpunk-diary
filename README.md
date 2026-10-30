# Cyberpunk Diário 1.7.1 — Android, Windows e Linux

O Cyberpunk Diário funciona offline no Android, Windows e Linux. O aplicativo Android mantém os dados locais e pode sincronizar com o aplicativo desktop pela rede local, sem depender de nuvem ou de um serviço externo.

## Downloads

A versão mais recente é publicada em [Releases](https://github.com/otavio-dias-leite/cyberpunk-diary/releases).

- **Android:** instale `app-debug.apk`. A versão 1.7.1 mantém o mesmo `applicationId` e incrementa o `versionCode` para permitir atualização direta.
- **Windows:** extraia `Cyberpunk-Diario-Desktop-Windows.zip` e execute `CyberpunkDiario.exe`. O pacote inclui runtime Java.
- **Linux:** extraia `Cyberpunk-Diario-Desktop-Linux.tar.gz` e execute `CyberpunkDiario/bin/CyberpunkDiario`. O pacote inclui runtime Java.

## Sincronização entre Android, Windows e Linux com Tailscale

1. Instale o [Tailscale para Windows](https://tailscale.com/download/windows) no PC e o [Tailscale para Android](https://play.google.com/store/apps/details?id=com.tailscale.ipn) no celular.
2. Entre na mesma conta Tailscale nos dois dispositivos e conecte-os à rede privada.
3. Execute `CyberpunkDiario.exe` no Windows. A janela mostra os endereços de rede; use o endereço marcado **TAILSCALE** (normalmente `100.x.x.x:8765`).
4. No Android, abra **Ajustes → Sincronização Tailscale**, informe `http://100.x.x.x:8765` e cole o código de pareamento exibido no PC.
5. Salve. A sincronização bidirecional funciona também quando PC e celular estão em redes diferentes, desde que ambos estejam conectados ao Tailscale.

O desktop (Windows ou Linux) funciona como servidor e o Android como cliente. O Tailscale fornece criptografia de transporte entre os dispositivos; o token aleatório do Cyberpunk Diário autentica as alterações. Não é necessário configurar um Exit Node: somente o tráfego destinado aos dispositivos do tailnet passa pela rede Tailscale, e a navegação comum continua usando a internet normal. O servidor também mantém os endereços LAN para uso na mesma Wi-Fi.

**Limites e segurança:** a interface não oferece tarefas públicas nem links de compartilhamento. Os links inseridos em tarefas e notas são apresentados como botões. O Tailscale criptografa o tráfego na rede, mas esta versão ainda não implementa criptografia ponta a ponta do conteúdo nem criptografia independente do arquivo armazenado no PC: o servidor recebe e grava o JSON. Portanto, não trate o armazenamento desktop como E2EE. Não encaminhe a porta 8765 ao público. Faça backups regulares.


## Recursos 1.7.0

- Rotinas editáveis com nome, horário, observação e link.
- Subtarefas por rotina, com checklists diários que reiniciam automaticamente na data seguinte. Os registros de dias anteriores permanecem salvos.
- Links HTTP/HTTPS em tarefas, rotinas e notas apresentados como botões.
- Remoção dos controles e da interface de compartilhamento público.
- Distribuições desktop para Windows e Linux, ambas com runtime Java incluído.
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

Em push para `main`, os três pacotes são publicados na Release `v1.7.1`.


## Assinatura Android e atualização sem conflito

Os APKs de atualização devem ser assinados sempre com o mesmo keystore. O build antigo usava a assinatura de depuração automática do runner do GitHub Actions, que muda entre execuções; por isso o Android pode recusar a instalação por cima da versão antiga.

Configure uma chave permanente uma única vez e guarde uma cópia segura dela. Não a perca: futuras atualizações precisam da mesma chave.

1. Gere o keystore localmente:
   `keytool -genkeypair -v -keystore cyberpunk-release.jks -alias cyberpunk -keyalg RSA -keysize 2048 -validity 10000`
2. Converta o arquivo para Base64. Linux: `base64 -w 0 cyberpunk-release.jks`. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cyberpunk-release.jks"))`.
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre:
   - `ANDROID_KEYSTORE_BASE64`: conteúdo Base64 do arquivo.
   - `ANDROID_KEYSTORE_PASSWORD`: senha do keystore.
   - `ANDROID_KEY_ALIAS`: `cyberpunk`.
   - `ANDROID_KEY_PASSWORD`: senha da chave (pode ser a mesma do keystore).
4. Execute novamente o workflow. Ele compila o APK Release assinado e valida a assinatura antes de publicar.

**Migração única:** APKs antigos gerados pelo workflow com chave debug efêmera não podem ser atualizados por um APK assinado com uma chave permanente diferente. Se o Android ainda acusar conflito na primeira instalação desta migração, faça backup/exportação dos dados, desinstale a versão antiga uma única vez e instale o novo APK assinado. Depois disso, as próximas versões poderão ser instaladas por cima sem desinstalar, desde que o keystore seja preservado.

## Estrutura

- `app/src/main/assets/` — interface, CSS, lógica do diário e cliente de sincronização.
- `app/src/main/java/` — integração Android/WebView e backup nativo.
- `desktop/src/main/java/` — servidor HTTP local e janela de pareamento Windows.
- `desktop/build.gradle` — empacotamento da aplicação desktop com runtime Java.
- `.github/workflows/android-apk.yml` — builds Android/Windows e publicação.

## Dados

O Android mantém um snapshot no armazenamento interno do aplicativo. Exportar backups JSON continua disponível em Ajustes. A sincronização mantém uma cópia no computador; faça backups regulares antes de reinstalar, apagar dados ou trocar de aparelho.
