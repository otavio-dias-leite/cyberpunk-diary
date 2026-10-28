# Cyberpunk Diário — Android

Aplicativo Android offline que empacota a interface do Cyberpunk Diário em uma WebView nativa. Os dados são armazenados localmente no aparelho; não há conta online nem servidor obrigatório.

## Gerar o APK pelo GitHub Actions

O repositório está preparado para compilar o APK automaticamente:

1. Abra a aba **Actions** deste repositório.
2. Selecione **Build Android APK**.
3. Clique em **Run workflow** e confirme.
4. Aguarde o job **Compile debug APK** terminar com sucesso.
5. Abra a execução concluída e baixe **Cyberpunk-Diario-debug-APK** na seção **Artifacts**.
6. Extraia o ZIP e instale `app-debug.apk` no Android. Se necessário, autorize a instalação de aplicativos pela fonte usada para abrir o arquivo.

Também há compilação automática em push para `main` quando arquivos do aplicativo, configuração Gradle ou workflows são alterados, e em pull requests direcionados a `main`.

### O que o workflow faz

- Usa Ubuntu hospedado pelo GitHub.
- Instala Java 17 e Gradle 8.9, compatível com Android Gradle Plugin 8.7.3.
- Executa `gradle :app:assembleDebug`.
- Gera um arquivo SHA-256 para verificação da integridade.
- Publica o APK como artefato por 14 dias.

O projeto ainda não contém Gradle Wrapper (`gradlew` e `gradle/wrapper`), então o workflow instala uma versão fixa do Gradle no runner. Não é necessário instalar Android Studio ou SDK no seu computador.

## Compilar localmente

Com Java 17, Android SDK e Gradle 8.9 instalados:

```bash
gradle --no-daemon :app:assembleDebug
```

O APK será gerado em:

```
app/build/outputs/apk/debug/app-debug.apk
```

## Recursos

- Interface web empacotada nos assets do aplicativo.
- Funcionamento offline, sem dependência de hospedagem.
- Navegação adaptada para Android.
- Perfis locais e armazenamento separado por perfil.
- Exportação e importação de backup JSON pelo seletor de arquivos nativo.
- Tarefas únicas e recorrentes, agenda semanal e mensal, histórico e temas.

## Dados e privacidade

Os perfis são apenas separações locais de dados, não são autenticação nem isolamento criptográfico. Qualquer pessoa com acesso ao aplicativo pode alternar entre eles. Os dados ficam no armazenamento interno do aplicativo e são apagados ao limpar os dados ou desinstalar. Exporte backups regularmente.

Os dados do site publicado no GitHub Pages não são migrados automaticamente para o APK, pois são origens de armazenamento diferentes. Exporte um backup JSON no site e importe-o no aplicativo.

## Estrutura

- `app/src/main/assets/` — interface, estilos e lógica JavaScript.
- `app/src/main/java/` — Activity Android e integração com a WebView.
- `app/src/main/AndroidManifest.xml` — configuração do aplicativo.
- `.github/workflows/android-apk.yml` — compilação automática do APK.

## Assinatura e distribuição

O artefato gerado é um APK **debug**, assinado automaticamente com a chave de depuração do Android. É adequado para instalação e testes pessoais. Para publicar em lojas ou distribuir atualizações oficiais, será necessário configurar uma chave de assinatura release protegida em GitHub Secrets e gerar um build release assinado.
