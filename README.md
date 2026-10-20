# NEXO SEI Android · PWA

Versão estática do aplicativo para instalação no Android pelo navegador. **Não contém cadastro de policiais, escalas ou mensagens reais.**

## Publicar no GitHub Pages

1. Envie estes arquivos **diretamente à raiz** do repositório destinado a este aplicativo, inclusive `assets/`.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, `main` e `/ (root)`. Salve.
3. Depois da publicação, abra `https://USUARIO.github.io/NOME_DO_REPOSITORIO/` no Chrome Android e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**.
4. O cadastro e as escalas são importados **localmente** por um JSON produzido no computador com o exportador que acompanha o pacote desktop/Android original. **Nunca envie esse JSON ao GitHub**.

## Privacidade

Todo conteúdo publicado pelo GitHub Pages pode ser visto por outras pessoas. O aplicativo não possui controle de acesso próprio. Os cadastros importados ficam no IndexedDB do aparelho; proteja o telefone, utilize somente dispositivos autorizados e faça backups.

O aplicativo não acessa o SEI, não envia mensagens ao servidor e não realiza assinatura eletrônica. É um gerador de três blocos para colagem manual.
