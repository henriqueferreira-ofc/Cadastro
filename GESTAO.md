# Secretaria e Financeiro — primeira versão

Os módulos ficam dentro do painel administrativo e usam o mesmo login. Cadastro continua como a página inicial. As novas operações são salvas no PostgreSQL, sem fallback para localStorage.

## Ambiente local

O localhost está configurado para o schema `aafab_desenvolvimento` no mesmo banco Neon, com uma cópia inicial de Cadastro e Member. Esse schema é separado do `public` usado pelo site. A faixa amarela no painel identifica esse ambiente. A cópia não recebe automaticamente as alterações do site oficial.

- Configuração local: `server/.env` (ignorada pelo Git).
- Configuração anterior: `server/.env.site-backup` (também ignorada).
- Iniciar a partir da raiz do projeto: `npm run dev:all`.
- Recriar a preparação em outro computador: configurar uma conexão autorizada em `server/.env` e executar `npm --prefix server run setup:development`. O script cria/migra o schema de desenvolvimento, copia os cadastros se a tabela estiver vazia e ajusta o `.env`. Não sobrescreve cadastros já copiados.

## Secretaria

A página começa com uma caixa geral das solicitações recebidas pelo Portal do Associado. Ao abrir
uma solicitação, a administração responde dentro de uma conversa privada e define a situação como
aberta, em andamento ou concluída. O titular só visualiza mensagens ligadas ao próprio cadastro.

Selecione um associado por nome ou CPF para visualizar a ficha cadastral. Os dados da ficha vêm do Cadastro e são somente leitura nesta versão.

- Atendimento, solicitação e pendência: assunto, descrição, prazo opcional e situação (aberto, em andamento ou concluído).
- Atualizações de situação exigem uma observação e acrescentam um evento ao histórico. O texto original permanece registrado.
- Observações avulsas entram diretamente no histórico, sem gerar pendência.
- Documentos: PDF, JPG ou PNG de até 5 MB, com título. São guardados no banco e baixados por uma rota autenticada; não possuem URL pública.
- Histórico reúne criação dos registros, suas atualizações e os documentos anexados.
- Não há exclusão ou edição do texto original nesta versão.

## Financeiro

- Criação manual de uma mensalidade por associado e mês de referência, com valor, vencimento e observação opcional.
- Valores armazenados como centavos inteiros; meses, datas e valores validados no servidor.
- Baixa manual e integral com data, forma de pagamento e referência opcional. Um índice único impede pagamentos duplicados, inclusive em requisições simultâneas.
- O associado pode abrir uma mensalidade, gerar um Pix com o valor exato e enviar PDF/JPG/PNG de até 5 MB como comprovante.
- Também pode escolher o mês e enviar o comprovante diretamente, sem lançamento prévio. Nesse caso, o servidor usa R$ 40,00 e mantém o envio em análise. A aprovação pede a data do pagamento e o vencimento para criar a mensalidade e a baixa na mesma transação; uma recusa não cria cobrança. Se o mês for lançado antes da análise, o comprovante é vinculado automaticamente, desde que o valor coincida.
- O comprovante entra como `PENDING` e não altera os totais pagos. O Financeiro abre o arquivo e aprova ou recusa; a aprovação cria a baixa integral e a recusa exige um motivo visível ao titular.
- Apenas uma análise pendente é aceita por mensalidade. Depois de uma recusa, o associado pode enviar outro arquivo.
- Sem geração automática de cobranças, integração bancária, juros, pagamento parcial ou estorno nesta versão.
- Registrar pagamento não libera nem bloqueia CPF.
- Mensalidades com comprovante em análise exigem aprovação ou recusa antes da baixa manual. O envio de comprovantes e as baixas são serializados por mensalidade para evitar conflitos entre operações simultâneas.
- Filtros por mês de referência, associado e situação. “Em aberto” na lista representa valores ainda não vencidos; o resumo “Em aberto (inclui vencidos)” soma todas as mensalidades não pagas que passaram pelos filtros.
- Os cartões e a exportação usam exatamente as linhas filtradas. Recebido corresponde aos pagamentos dessas mensalidades, independentemente da data em que foram pagos; não é um relatório de fluxo de caixa por data de recebimento.
- A exportação atual gera CSV compatível com Excel, com os filtros, resumo, mensalidades e pagamentos. Campos textuais recebem proteção contra interpretação como fórmulas.

## Validação

- `npm run typecheck:all`
- `npm run build -- --outDir /tmp/aafab-management-build`
- `npm --prefix server run test:management`: cria um schema temporário com dados fictícios, aplica as migrações, testa autenticação, Secretaria, anexos e pagamentos via HTTP e remove somente o schema criado pelo teste.

A migração `20261016000000_secretaria_financeiro` é aditiva e foi aplicada apenas ao desenvolvimento e aos schemas temporários dos testes. Para publicar, será necessário revisar as regras com o responsável, aplicar a migração no ambiente oficial e publicar o backend e o frontend juntos. Nenhuma publicação é feita pelos comandos de validação acima.

Os fluxos do portal usam também a migração aditiva
`20261019000000_portal_workflows`, que cria anexos de comunicados, mensagens da Secretaria e
comprovantes financeiros. Ela já foi aplicada ao schema local `aafab_desenvolvimento`; a produção
continua dependendo de migração e publicação coordenadas do backend e frontend.
