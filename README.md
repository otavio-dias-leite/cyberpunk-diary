# Cyberpunk Diary 1.2.1

Agenda pessoal offline-first para Windows, Android e navegador. A versão 1.2.1 adiciona uma barra superior permanente e notificações em faixa própria, sem sobrepor a interface.

## Funcionalidades
- Visões Agora, Dia, Semana e Mês.
- Tarefas, recorrências, tags, hábitos e notas Markdown.
- Temas Cyberpunk Red, Soulkiller, Cyberpunk, Midnight e Synthwave.
- Backup/importação e armazenamento local automático.
- Links funcionais em descrições, editor visual e notas.
- Sincronização P2P opcional por servidor de sinalização Node.js.

## Downloads
Os instaladores Windows e Android são publicados em GitHub Releases após a compilação do workflow Cyberpunk Diary 1.2.1.

## Executar localmente
Requer Node.js 20 ou superior.
npm install
npm run desktop

Para Android, com Android SDK e Java 21:
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug

## Dados
Os dados são mantidos localmente no armazenamento do aplicativo/navegador. Faça backups regulares pelo menu Backup / Importar. O servidor de sinalização não é um banco de dados e não armazena as notas ou tarefas.
