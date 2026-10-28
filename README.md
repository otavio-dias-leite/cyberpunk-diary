# Cyberpunk Diário — Android 1.0 (offline)

Aplicativo Android com interface do Cyberpunk Diário 0.9 empacotada em WebView. Interface inspirada em navegação mobile com barra inferior; não usa APIs nem código do Instagram.

## Contas locais

- Selecione **PERFIL** para alternar perfis ou criar um novo. Sem e-mail, senha, servidor ou rede.
- Cada perfil guarda tarefas em uma chave local diferente. O primeiro perfil importa automaticamente os dados do armazenamento antigo se existirem **na mesma origem WebView**.
- **Isto não é autenticação nem isolamento criptográfico**: qualquer pessoa que acessar o app pode trocar perfis. Use bloqueio de tela do Android. Dados ficam no armazenamento interno do app e são eliminados ao limpar dados/desinstalar. Exporte backups antes disso.
- Dados do site publicado via GitHub Pages **não migram automaticamente para o APK** porque são origens distintas. Exporte um backup JSON no site e importe no app usando o fluxo da interface. A seleção e gravação de arquivos JSON é integrada ao seletor nativo do Android.

## Compilar sem PC

1. Crie um repositório público no GitHub e envie **o conteúdo desta pasta à raiz**.
2. Abra **Actions → Build Android APK → Run workflow** (ou faça push na branch main).
3. Após build bem-sucedido, abra a execução e baixe **Cyberpunk-Diario-debug-APK** em Artifacts.
4. Extraia o arquivo APK e instale no Android. Pode ser preciso autorizar instalação dessa fonte.

O APK de debug é para teste e assinado automaticamente com chave de depuração. Para distribuição pública, configure assinatura release e atualizações.

## Offline

HTML, JS, CSS e ícone estão embutidos em `app/src/main/assets`. Não exige hospedagem, login ou INTERNET no Android. Fontes externas foram removidas para funcionar sem rede; fontes alternativas do sistema são utilizadas caso Orbitron/Rajdhani não sejam empacotadas. A interface mantém os seis temas.

## Limitações

A compilação final depende do GitHub Actions ou de Android SDK + Gradle em um computador. Não há APK compilado neste pacote. Exportação e importação JSON usam o seletor nativo do Android. Links compartilhados podem exigir melhorias posteriores; armazenamento local e tarefas operam offline.

## Estrutura

- `app/src/main/assets` — interface e lógica web
- `app/src/main/java` — tela Android WebView
- `.github/workflows/android-apk.yml` — compilação gratuita no GitHub Actions
