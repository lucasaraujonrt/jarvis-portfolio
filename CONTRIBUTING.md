# Trabalhar no Jarvis

Direção atual: [roadmap](docs/ROADMAP.md). Capacidades comprovadas e limitações: [estado](docs/JARVIS_STATUS.md). Setup: [configurar e usar](docs/SETUP.md), [agentes de terminal](docs/TERMINAL_AGENTS.md) e [iOS](apps/ios/README.md).

## Branches e PRs

- `main` é a base compartilhada. Depois da publicação inicial, mudanças entram por pull request.
- Use uma branch por entrega, preferencialmente `codex/<descricao>`, e um worktree separado para agentes trabalhando ao mesmo tempo. Preserve branches existentes de outros agentes.
- Antes de editar, confira `git status`, branch e arquivos sob responsabilidade de cada trabalho. Não inclua mudanças alheias no commit.
- Abra o PR para `main`, descrevendo resultado, validação e limitações. Mantenha como draft enquanto houver trabalho pendente.
- Push, merge e publicação de apps são ações distintas; execute somente o que foi autorizado pelo usuário. Não use force-push na `main`.

## Validação

Para alterações no gateway, adaptadores ou dependências:

```bash
npm ci
npm test
npm run typecheck
git diff --check
```

Para iOS, siga o build em `apps/ios/README.md` e os testes relevantes em `apps/ios/tests/README.md`. No PR, separe teste simulado, build e validação física. Um build não comprova funcionamento nos óculos. Não faça chamadas pagas só para validar um PR sem autorização.

## Arquivos locais

Não versionar tokens, `.env`, conteúdo de `.jarvis`, logs de sessões pessoais, provisionamento, gravações temporárias ou worktrees. Use exemplos sem credenciais. Artefatos em `output/` e `.argent/` ficam locais; assets aprovados devem ir para o diretório de assets do produto em seu próprio PR.

Este fluxo é uma convenção do projeto. Não pressupõe proteção de branch ou CI configuradas no GitHub.
