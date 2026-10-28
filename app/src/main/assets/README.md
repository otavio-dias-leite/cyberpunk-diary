# Cyberpunk Diário v0.7 — Android-first PWA

Site estático com tarefas únicas e recorrentes, agenda Agora/Semana/Mês, editor Markdown, conclusão por ocorrência, backup JSON, compartilhamento manual de tarefa e navegação para Android.

## Deploy gratuito (GitHub Actions + Pages)
1. Coloque **todos os arquivos** (inclusive `.github/workflows/pages.yml`) na raiz de um repositório GitHub.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. Faça push para `main`. O workflow publica a aplicação no GitHub Pages automaticamente.
4. No Android, abra o site por HTTPS e use **Adicionar à tela inicial**.

## Integração futura / ponte
O arquivo **`bridge.js`** contém comentários e os pontos de extensão `CyberpunkBridge.changed`, `pull` e `push`, a serem substituídos por chamadas a uma API autenticada. `app.js` aciona `changed` depois de salvar. Há também um evento `cyberpunk:local-change` para integrações. **Não existe sincronização remota nesta versão**. O GitHub Actions faz apenas deploy; não armazena tarefas de usuários.

Para sincronização privada/publicação real, use backend com autenticação, regras de acesso, controle de versões e banco de dados. **Nunca coloque tokens GitHub ou chaves de administração no JavaScript enviado ao navegador.**

## Segurança e armazenamento
Dados ficam no `localStorage` do navegador (sem criptografia e sem sincronização); não adequado para segredos. Faça backup JSON regularmente. Compartilhamento via link exporta a tarefa no próprio URL, então quem recebe o link tem acesso a esses dados. Marcar `privada` apenas impede gerar links; não é controle de acesso no servidor.

## Desenvolvimento
Abra `index.html` em servidor local para testar. Service worker requer HTTPS ou localhost. Para atualizar no Android, recarregue a página (versão de cache `v07`).

## Histórico e ícone (v0.7)
Concluir uma tarefa remove sua ocorrência das listas de Agora. O botão **Ver tarefas antigas** revela até 30 dias de ocorrências concluídas, em cinza grafite, com ação para desfazer. Semana/Mês continuam mostrando os registros concluídos em cinza grafite. O ícone `icon.svg` é um diário de capa chanfrada, com encadernação e linhas diagonais.

## Funcionamento offline (v0.7)
Depois da primeira visita **online por HTTPS** e da instalação do service worker, o site abre sem internet e permite visualizar/criar/concluir/desfazer tarefas. O cache inclui HTML, CSS, JavaScript, ícone e manifesto. Os dados são persistidos em `localStorage`, no aparelho e navegador onde foram criados.

A fonte Orbitron/Rajdhani é carregada por Google Fonts **quando há rede**; offline, se o navegador não tiver armazenado essas fontes, será usada a fonte alternativa do sistema. Para manter as fontes oficiais sempre offline, adicione os arquivos WOFF2 licenciados ao projeto, configure `@font-face` local e liste os arquivos em `SHELL` do `sw.js`.

**Importante:** limpar os dados do navegador, remover a aplicação ou abrir em outro navegador pode apagar ou deixar inacessíveis as tarefas. Faça backup JSON periodicamente. O Actions publica o código, não sincroniza os dados. Verifique a operação offline após a primeira instalação usando o modo avião.

## Visual v0.7
Tarefas concluídas usam cinza grafite dessaturado, opacidade reduzida e texto riscado. A conclusão continua removendo a ocorrência da aba Agora, recuperável pelo histórico. O antigo tema azul foi removido. O vermelho permanece para ações, navegação e progresso.

## Temas (v0.7)
Em **Ajustes → Personalizar / Temas**, selecione Cyberpunk Red, Matrix, Carbon, Midnight, Soulkiller ou Mono. Tema salvo no mesmo estado local das tarefas, sem depender de internet. O estado concluído permanece em grafite discreto independentemente do tema.


## v0.8 — tema e marca
O topo da aba Agora foi simplificado. Logo na interface e favicon do navegador mudam com o tema. O brilho (glow) acompanha a cor de destaque; tarefas concluídas permanecem cinza. No Android, o **ícone já instalado na tela inicial** é controlado pelo sistema/manifesto e pode exigir reinstalação para mudanças futuras; a marca interna muda instantaneamente.


## v0.9 — tema em toda a interface
Os seis temas agora aplicam sua cor a cabeçalhos, barra superior, faixa do sistema, menu inferior, grades decorativas, linhas, divisórias, cards ativos, calendário, formulários, ícones, foco e brilho. A marca interna e o favicon seguem o tema. Elementos concluídos continuam em grafite neutro, intencionalmente. A preferência permanece no armazenamento local; o cache offline foi versionado para forçar a atualização dos arquivos.
