# Cyberpunk Diary 1.5.0

Agenda pessoal offline-first para Windows, Android e navegador.

## Funcionalidades
- Visões Agora, Dia, Semana e Mês.
- Tarefas, recorrências, tags, hábitos e notas Markdown.
- Temas Red (padrão), Soulkiller, Cyberpunk, Midnight e Synthwave.
- Navegação por gestos e dock inferior em telas móveis.
- Backup/importação e armazenamento local automático.
- Sincronização P2P opcional por servidor de sinalização Node.js.

## Plataformas
- Android: APK gerado pelo workflow GitHub Actions.
- Windows 10/11: instalador NSIS .exe.
- Web: demo hospedada pelo GitHub Pages a partir de web/.

## Atualizações Android
Para instalar atualizações sobre versões anteriores, o APK precisa ser assinado com a mesma chave persistente. Configure os segredos ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS e ANDROID_KEY_PASSWORD no GitHub Actions. Sem esses segredos, o workflow gera APK de teste (debug), que pode não atualizar uma instalação assinada anteriormente.

O identificador Android permanece br.com.otaviodiasleite.cyberpunkdiary; o workflow incrementa automaticamente o versionCode.

## Executar localmente
Requer Node.js 20 ou superior.

    npm ci
    npm run desktop

Para Android, com Android SDK e Java 21:

    npx cap add android
    npx cap sync android
    cd android && ./gradlew assembleDebug

## Dados e sincronização
Os dados são mantidos localmente no armazenamento do aplicativo/navegador. Faça backups regulares pelo menu Backup / Importar. O servidor de sinalização auxilia a conexão entre dispositivos; não é um banco de dados central e não armazena as notas ou tarefas.
