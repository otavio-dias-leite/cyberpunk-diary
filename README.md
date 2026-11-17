# Cyberpunk Diary 1.3.2

Agenda pessoal offline-first para Windows, Android e navegador.

## Funcionalidades
- Visões Agora, Dia, Semana e Mês.
- Tarefas, recorrências, tags, hábitos e notas Markdown.
- Temas Cyberpunk Red, Soulkiller, Cyberpunk, Midnight e Synthwave.
- Backup/importação e armazenamento local automático.
- Sincronização P2P opcional por servidor de sinalização Node.js.

## Atualizações Android
Os APKs de produção são assinados com uma chave de lançamento persistente. Preserve o arquivo de assinatura e os segredos GitHub Actions para que futuras versões possam ser instaladas por cima da anterior. O identificador Android permanece `br.com.otaviodiasleite.cyberpunkdiary` e o `versionCode` aumenta automaticamente em cada execução do workflow.

Configure os segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` conforme as instruções do arquivo de configuração da assinatura. Sem esses segredos, o workflow não publica um APK não-assinado ou assinado com chave temporária.

## Executar localmente
Requer Node.js 20 ou superior.
```sh
npm ci
npm run desktop
```

Para Android, com Android SDK e Java 21:
```sh
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Dados
Os dados são mantidos localmente no armazenamento do aplicativo/navegador. Faça backups regulares pelo menu Backup / Importar. O servidor de sinalização não é um banco de dados e não armazena as notas ou tarefas.
