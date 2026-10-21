# Segurança

Este repositório é **público**. Nada de senhas, tokens, URLs de banco, listas de CPF ou outros dados
pessoais pode ser versionado, nem em issues, logs ou capturas de tela. Segredos ficam apenas no
ambiente local (ignorado pelo Git) e no gerenciador de variáveis do serviço de hospedagem.

## Controles em vigor

- **Commits:** o hook `.githooks/pre-commit` (ativado pelo `npm install`) bloqueia `.env`, bancos,
  planilhas/CSV, senhas de conexão, chaves e listas de CPF.
- **Repositório:** secret scanning e push protection do GitHub, Dependabot, CodeQL e auditoria de
  dependências semanal.
- **Administração:** senha forte (16+ caracteres), segundo fator por aplicativo autenticador (TOTP,
  `ADMIN_TOTP_SECRET`), sessão de 30 minutos que pode ser encerrada no servidor, limite de tentativas
  por IP e atraso progressivo contra ataques em massa.
- **Associados:** senhas com scrypt, bloqueio temporário após falhas, sessões que se invalidam na
  troca de senha ou no bloqueio e isolamento dos dados por titular.
- **API:** CORS restrito ao domínio oficial, cabeçalhos de segurança (CSP restrita, HSTS,
  Permissions-Policy, Referrer-Policy), respostas sem cache e validação de entrada no servidor.
- **Site:** política de segurança de conteúdo (CSP) no HTML publicado e sessão somente na aba.
- **Dados:** o banco guarda comprovantes e anexos no próprio banco; downloads exigem autenticação e
  verificam o dono do arquivo.

## Credenciais expostas

Se uma credencial for exposta, **gere uma nova e atualize o serviço antes de qualquer outra coisa**.
Remover o texto do Git não invalida uma credencial que já foi copiada.

Gerar a chave do segundo fator do administrador (localmente, sem registrar a saída):

```
cd server && npm run admin:totp
```

## Relatar uma vulnerabilidade

Avise diretamente o responsável técnico da AAFAB, sem incluir dados pessoais reais na demonstração.
