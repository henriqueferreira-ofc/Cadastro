# Diagnóstico e plano de evolução — Sistema Integrado AAFAB

Data da análise: 17/10/2026

## 1. Escopo e restrições

Este documento avalia o sistema existente e propõe sua evolução sem recriar o projeto, apagar
registros ou executar migrações destrutivas. Nenhuma mudança estrutural, migração no schema
oficial ou publicação em produção faz parte desta análise.

Princípios adotados:

- preservar os 596 cadastros existentes;
- manter Cadastro, Secretaria e Financeiro funcionando durante a evolução;
- usar migrações aditivas e reversíveis;
- não inventar histórico associativo ou financeiro;
- testar com dados fictícios ou anonimizados;
- homologar antes de publicar;
- tratar o banco como fonte de verdade, sem depender de arquivos públicos ou `localStorage`.

## 2. Arquitetura atual

### Aplicação

- Frontend: React 19, TypeScript, Vite e Tailwind CSS.
- Hospedagem do frontend: GitHub Pages, com domínio `aafab.com.br`.
- Backend: monólito Express 5 em TypeScript, hospedado no Render.
- Banco: PostgreSQL no Neon, acessado com Prisma 5.
- Exportações: XLSX no frontend e ExcelJS no backend.
- Autenticação administrativa: uma senha compartilhada gera um JWT de perfil `admin` por 24
  horas.

Essa arquitetura é adequada ao porte atual. Não há benefício em dividi-la em microserviços. A
recomendação é manter um monólito modular, separar os domínios internamente e reforçar identidade,
permissões, auditoria e transações.

### Banco oficial

O schema oficial `public` possui:

| Tabela               | Registros | Uso atual                                |
| -------------------- | --------: | ---------------------------------------- |
| `Cadastro`           |       596 | Dados pessoais enviados pelos associados |
| `Member`             |       610 | Liberação ou bloqueio do CPF             |
| `_prisma_migrations` |         2 | Histórico das migrações oficiais         |

O CPF é único nas tabelas `Cadastro` e `Member`, mas não há relacionamento entre elas. Isso cria
duas representações separadas da mesma pessoa.

Situação encontrada na cópia de desenvolvimento:

- 596 cadastros têm registro correspondente em `Member`;
- 14 registros de `Member` ainda não possuem cadastro;
- 609 registros de `Member` estão ativos e 1 está bloqueado;
- não foram encontrados CPFs com formato estrutural inválido nas duas tabelas;
- há 595 e-mails distintos e 595 telefones distintos entre 596 cadastros;
- dois telefones não seguem o tamanho esperado de 10 ou 11 dígitos.

Essas contagens são diagnósticas. Nenhum registro foi alterado.

### Autorização cadastral

A autorização está distribuída entre três fontes:

1. tabela `Member`;
2. arquivo público `ENVIAR.csv`;
3. listas e substituições mantidas no navegador.

O arquivo usado pelo frontend contém 1.219 CPFs. A cópia em `docs` contém 1.215, com diferença de
quatro registros. As versões JSON estão vazias. Também existe uma lista de exclusões mantida no
código do servidor.

Essa fragmentação permite divergência entre o que o site exibe, o que o backend autoriza e o que
um navegador específico modificou. A autorização deve passar a ser uma entidade do banco, com
situação, motivo, origem, responsável e histórico.

### Secretaria e Financeiro em desenvolvimento

A primeira versão já implementada está somente no schema `aafab_desenvolvimento`. O schema contém
596 cadastros copiados e as tabelas adicionais estão vazias:

- `OfficeEntry` e `OfficeEvent`;
- `AssociateDocument`;
- `MonthlyFee` e `FeePayment`.

Essa versão já oferece uma base útil:

- atendimentos, solicitações, pendências e observações com histórico;
- documentos privados protegidos por rota autenticada;
- mensalidade única por associado e competência;
- baixa integral de pagamento com proteção contra duplicidade;
- filtros e exportação em Excel;
- validação de datas, valores e conteúdo real de PDF, PNG e JPG;
- interface responsiva para Cadastro, Secretaria e Financeiro.

Limitações atuais:

- não há dados associativos, matrícula, filiação ou situação associativa;
- não há perfis separados para Secretaria e Financeiro;
- o pagamento aceita somente baixa integral e um pagamento por mensalidade;
- não há comprovante enviado pelo associado nem fila de conferência;
- não há isenção, desconto, pagamento parcial, antecipação ou alocação múltipla;
- não há comunicados nem Portal autenticado do Associado;
- documentos ficam como bytes no PostgreSQL, o que pode aumentar rapidamente o banco;
- os eventos não registram um usuário responsável identificável.

## 3. Componentes que devem ser reaproveitados

- `Cadastro` como fonte inicial dos dados pessoais, sem troca destrutiva de chave primária;
- validação e normalização de CPF existentes;
- formulário atual de cadastro, adaptado para solicitação autenticada de atualização;
- painel administrativo responsivo e navegação Cadastro/Secretaria/Financeiro;
- rotas e componentes iniciais da Secretaria e do Financeiro;
- controles de valor em centavos e restrição de mensalidade por competência;
- validação de documentos e download por rota autenticada;
- exportação XLSX;
- estratégia de schema temporário usada nos testes de integração;
- Prisma e PostgreSQL como camada de persistência.

`AdminDashboard.tsx` e `db_service.ts` concentram responsabilidades demais. Eles devem ser
decompostos gradualmente, mantendo o comportamento existente enquanto cada fluxo passa a usar a
API central.

## 4. Riscos identificados

### Prioridade crítica

1. O repositório GitHub está público e contém credenciais em arquivos e no histórico. A conexão
   atual do banco e a senha administrativa aparecem no histórico. Elas devem ser consideradas
   comprometidas e rotacionadas.
2. A senha usada como alternativa local está incluída no JavaScript publicado. Ela não pode ser
   reutilizada como senha real do servidor.
3. O arquivo `ENVIAR.csv` está publicamente acessível pelo site e contém a lista de CPFs.
4. A consulta pública por CPF devolve o cadastro completo. Saber o CPF é suficiente para obter
   dados pessoais.
5. Um cadastro existente pode ser atualizado informando apenas o CPF, sem autenticação adicional.

### Prioridade alta

1. Não existem usuários administrativos individuais, RBAC ou identificação do responsável por
   cada decisão.
2. O JWT fica no `localStorage`, ampliando o impacto de uma falha de script no frontend.
3. O backend aceita CORS de qualquer origem.
4. O segredo JWT possui valor alternativo caso a variável de ambiente esteja ausente; o servidor
   deveria falhar ao iniciar.
5. O log atual é um arquivo local, inclui CPF em algumas ações e não é uma auditoria durável do
   banco.
6. O ambiente de desenvolvimento contém uma cópia de dados reais. Testes automatizados já usam
   dados fictícios, mas desenvolvimento e homologação devem avançar para dados mascarados.
7. A pipeline publica o frontend, mas não executa typecheck do backend, testes de integração ou
   verificação de migrações.
8. O deploy do backend não possui uma etapa explícita de `prisma migrate deploy`.

### Prioridade média

- `npm audit` apontou 1 vulnerabilidade alta no frontend e 11 ocorrências no backend, incluindo
  uma crítica transitiva. As correções precisam ser avaliadas com testes, sem atualizações cegas.
- O pacote final do frontend tem aproximadamente 603 KB antes de gzip e pode ser dividido por
  módulo.
- Há um banco SQLite legado versionado, embora a aplicação use PostgreSQL.
- Documentos de implantação e teste estão desatualizados e mencionam segredos reais.
- O rate limit é global e pode penalizar todos os usuários de uma mesma rede, enquanto o login não
  possui uma política específica por conta e origem.

## 5. Arquitetura recomendada

Manter React + Express + PostgreSQL como um monólito modular, com estes domínios:

1. **Identidade e acesso** — usuários, papéis, permissões, sessões e autenticação.
2. **Associados** — dados pessoais canônicos e dados associativos.
3. **Admissão e autorização** — autorização cadastral, bloqueios, aprovações e histórico.
4. **Secretaria** — atendimentos, pendências, documentos e eventos administrativos.
5. **Financeiro** — competências, pagamentos, alocações, comprovantes e políticas.
6. **Comunicados** — publicação e público destinatário.
7. **Relatórios** — consultas integradas e exportações autorizadas.
8. **Auditoria** — eventos imutáveis com ator, ação, entidade e horário.

### Identidade do associado

- Manter o `Int` atual como chave primária interna evita uma migração arriscada sem ganho imediato.
- Adicionar um identificador público opaco, como UUID, quando uma referência precisar aparecer em
  URLs.
- Manter CPF normalizado e único como identificador de negócio, nunca como senha.
- Evoluir `Cadastro` como fonte canônica em vez de renomeá-la ou substituí-la de uma vez.
- Adicionar `updatedAt` e controle de versão para evitar que uma atualização sobrescreva outra.
- Criar `AssociateProfile` em relação 1:1 para matrícula, filiação, aprovação, categoria, situação
  associativa e representação.

### Autenticação

- Funcionários: contas individuais, senha com hash forte, recuperação segura e MFA para
  administradores.
- Associados: código temporário ou link enviado a um contato previamente verificado. Os dados
  atuais tornam e-mail uma opção viável, mas existe pelo menos um e-mail duplicado a resolver.
- Respostas públicas genéricas para impedir enumeração de CPF.
- Sessão em cookie `HttpOnly`, `Secure` e `SameSite`, com expiração, revogação e proteção CSRF.
- Endpoints do associado devem usar o `userId` da sessão, nunca um CPF ou ID fornecido livremente
  pela tela para decidir de quem são os dados.
- Permissões verificadas em cada operação do servidor. RLS pode ser defesa adicional, mas não
  substitui essa autorização e exige configuração cuidadosa com Prisma.

### Documentos e comprovantes

- Manter metadados e permissões no PostgreSQL.
- Avaliar armazenamento privado compatível com S3 para os arquivos, com criptografia e URLs
  temporárias. Para poucos documentos, os bytes no banco podem permanecer durante a transição.
- Validar assinatura real, tamanho, extensão e autorização de leitura.
- Definir retenção, exclusão legal e procedimento de backup antes da produção.

### Financeiro

O modelo atual de um pagamento por mensalidade é seguro para a primeira versão, mas não atende
pagamentos parciais ou múltiplas competências. A evolução deve separar:

- obrigação/mensalidade;
- pagamento recebido ou declarado;
- alocação do pagamento entre competências;
- comprovante;
- decisão de conferência;
- política financeira vigente.

Uma transação deverá aprovar o comprovante, registrar ou alocar o pagamento, atualizar a situação
e criar a auditoria. Uma chave de idempotência impedirá dupla aprovação.

## 6. Migração sem perda de dados

1. Fazer backup verificável do schema oficial e testar restauração.
2. Criar um ambiente de homologação separado, preferencialmente uma branch ou banco Neon próprio,
   com dados mascarados.
3. Aplicar apenas tabelas e colunas novas; não renomear nem remover `Cadastro` ou `Member`.
4. Criar perfis associativos vazios, sem preencher filiação, aprovação ou matrícula desconhecidas.
5. Importar os 1.219 CPFs autorizados para uma tabela central, preservando origem e situação. A
   diferença de quatro CPFs entre os arquivos exige decisão administrativa antes da importação.
6. Converter as exclusões codificadas em registros de autorização revogada, sem expor a lista ao
   frontend.
7. Conciliar `Member` com a nova autorização, mantendo os 14 casos sem cadastro.
8. Executar relatório de pré-migração e pós-migração com contagens e checksums.
9. Manter leitura compatível das tabelas antigas durante a transição.
10. Remover arquivos e campos antigos apenas em uma versão futura, após homologação e período de
    observação.

## 7. Plano de implementação

### Fase 0 — contenção de segurança

- preparar troca coordenada das credenciais do Neon, senha administrativa e segredo JWT;
- remover segredos do código e dos documentos e limpar o histórico Git;
- retirar a lista de CPFs dos arquivos publicados;
- restringir CORS aos domínios autorizados;
- desativar consulta e edição de dados pessoais somente por CPF;
- remover senhas embutidas e fazer o servidor falhar se um segredo obrigatório estiver ausente;
- revisar dependências vulneráveis e atualizar com testes;
- preservar temporariamente o fluxo cadastral por uma rota de transição segura.

Critério de saída: nenhum segredo ou CPF publicado, nenhum dado pessoal acessível somente com CPF
e produção funcionando com as novas credenciais.

### Fase 1 — fundação de dados, identidade e auditoria

- adicionar usuários, papéis, permissões, sessões, perfil associativo, autorização central e
  auditoria;
- migrar os dados atuais por scripts repetíveis e idempotentes;
- implementar contas individuais de Administrador, Secretaria e Financeiro;
- criar trilha de auditoria no banco sem dados pessoais desnecessários;
- substituir gradualmente `localStorage` por consultas à API.

### Fase 2 — acesso seguro do associado

- definir e integrar o provedor de e-mail ou outro método escolhido;
- implementar ativação, código temporário, sessão, encerramento e recuperação;
- proteger rotas por propriedade do registro;
- diferenciar cadastrado, autorizado sem cadastro e não autorizado sem revelar dados;
- reutilizar o formulário atual para cadastro inicial e solicitação de atualização.

### Fase 3 — Secretaria completa

- criar Dados Associativos com histórico;
- integrar ficha pessoal, resumo financeiro, documentos, atendimentos e auditoria;
- identificar o funcionário responsável por cada evento;
- incluir relatórios de associados, filiações, estados, pendências e ficha individual;
- exportar somente os campos permitidos pelo perfil.

### Fase 4 — Financeiro completo

- cadastrar políticas por vigência: valor, vencimento, início da obrigação e isenções;
- gerar mensalidades somente a partir da regra e da data de filiação;
- adicionar estados A vencer, Aberto, Vencido, Em análise, Pago e Isento;
- criar pagamentos, alocações, antecipações e pagamentos parciais;
- criar envio de comprovante e fila de conferência;
- aprovar ou rejeitar de forma transacional e idempotente;
- gerar indicadores mensais e anuais a partir de pagamentos confirmados.

### Fase 5 — Portal do Associado e comunicados

- criar dashboard autenticado com nome, comunicados, mensalidades e dados pessoais;
- permitir seleção de competências e exibir somente instruções Pix configuradas;
- receber comprovantes privados e mostrar o estado da análise;
- permitir solicitação de atualização cadastral usando o formulário existente;
- garantir que cada associado veja somente seus próprios dados.

### Fase 6 — integração e relatórios

- refletir atualizações cadastrais, associativas e financeiras em todos os módulos;
- criar relatórios integrados com filtros e Excel;
- testar consistência das somas e das situações;
- eliminar estados duplicados mantidos no frontend.

### Fase 7 — qualidade, homologação e publicação

- adicionar testes dos fluxos atuais para impedir regressões;
- testar permissões, isolamento entre associados, concorrência e duplicidade;
- executar testes responsivos em celular, tablet e computador;
- incluir typecheck, build, testes e validação de migrações na CI;
- executar ensaio de migração e restauração em homologação;
- publicar por etapas, com monitoramento e plano de retorno.

## 8. Decisões necessárias antes da implementação

1. Confirmar qual arquivo representa a lista oficial de 1.219 autorizações.
2. Definir quem receberá contas de Administrador, Secretaria e Financeiro.
3. Escolher o método de autenticação do associado e o provedor de envio.
4. Definir regras reais de filiação, categoria e situação associativa.
5. Definir valor, vencimento, início da obrigação, isenções, descontos e tratamento histórico.
6. Definir a chave Pix oficial e se haverá apenas comprovante manual ou integração futura.
7. Escolher o armazenamento privado de documentos e a política de retenção.
8. Definir responsáveis por homologação, aprovação financeira e revisão LGPD.

## 9. Validação realizada

- typecheck do frontend e backend: aprovado;
- build de produção: aprovado;
- nove cenários de integração de Secretaria e Financeiro: aprovados em schema temporário;
- testes de valores, datas, busca e situação financeira no frontend: aprovados;
- verificação responsiva anterior entre 320 e 1.280 pixels: aprovada;
- `git diff --check`: aprovado;
- nenhuma gravação foi realizada no schema oficial durante este diagnóstico.

## 10. Recomendação de início

Começar pela Fase 0. A expansão funcional não deve ser publicada enquanto credenciais, CPFs e
rotas baseadas somente no conhecimento do CPF permanecerem expostos. Depois da contenção, seguir
com a fundação de identidade e autorização; ela é a dependência comum da Secretaria, Financeiro e
Portal do Associado.
