# Cyberpunk Diary 1.2.0

Agenda pessoal offline-first para Windows, Android e navegador.

## Funcionalidades
- Visões Agora, Dia, Semana e Mês.
- Tarefas, recorrências, tags, hábitos e notas Markdown.
- Temas Cyberpunk Red, Soulkiller, Cyberpunk, Midnight e Synthwave.
- Backup/importação e armazenamento local automático.
- Sincronização P2P opcional.

## Versão 1.2.0
- Barra superior fixa com a identidade Cyberpunk Diary.
- Notificações passam a ocupar uma faixa própria abaixo do cabeçalho, sem cobrir botões, campos ou conteúdo.

## Downloads
Os instaladores Android e Windows são publicados em GitHub Releases após a compilação do workflow.

## Executar localmente
Requer Node.js 20 ou superior.
`npm install`
`npm run desktop`

Para Android, com Android SDK e Java 21:
`npx cap add android`
`npx cap sync android`
`cd android && ./gradlew assembleDebug`

Os dados são mantidos localmente no armazenamento do aplicativo/navegador. Faça backups regulares pelo menu Backup / Importar.
