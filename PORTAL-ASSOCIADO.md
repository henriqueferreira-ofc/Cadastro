# Portal do Associado AAFAB

## Fluxos de acesso

A página inicial separa três situações para evitar confusão entre os códigos e as senhas:

1. **Entrar no portal** — o associado já ativou a conta e usa CPF e senha pessoal.
2. **Primeiro acesso** — o cadastro já foi enviado. A Secretaria gera um código de ativação de oito dígitos, válido por 24 horas e por um único uso. O titular usa esse código para criar a senha.
3. **Realizar cadastro** — a pessoa informa primeiro apenas o CPF. Se ele estiver na relação oficial e ainda estiver bloqueado, o sistema mostra o QR Code e os dados Pix. Depois da confirmação do comprovante, a Secretaria libera o CPF e fornece o código específico de cadastro.

O código de cadastro e o código de ativação do portal têm finalidades diferentes. Um não funciona no lugar do outro.

Para um CPF que ainda não concluiu o cadastro, a sequência completa é: pagamento, envio do comprovante, liberação pela Secretaria, código de cadastro, envio dos dados cadastrais e, por fim, código de ativação para criação da senha do portal.

## Conteúdo do portal

O associado autenticado encontra somente informações destinadas a ele:

- trabalhos e comunicados publicados pela AAFAB, inclusive imagens e documentos anexados;
- solicitações do próprio titular, com conversa privada entre o associado e a Secretaria;
- mensalidades, Pix no valor exato da cobrança e envio de comprovante para aprovação;
- dados pessoais enviados pelo titular.

O associado não recebe funções administrativas, listas gerais, observações internas, documentos administrativos ou informações de outros associados.

## Operação pela administração

No painel administrativo:

- **Cadastro > Controle de acesso** gera o código inicial de cadastro, o código de ativação do portal ou o código de redefinição de senha, conforme a situação do CPF;
- **Comunicação** cria rascunhos, anexa PDF/JPG/PNG, publica trabalhos e arquiva comunicados;
- **Secretaria** recebe as solicitações do portal, responde ao titular e acompanha o atendimento;
- **Financeiro** registra mensalidades, recebe comprovantes e decide entre aprovar ou recusar.

O envio de comprovante nunca dá baixa sozinho. Ele muda a mensalidade para **Em análise**. A
aprovação administrativa registra o pagamento pelo valor da mensalidade; a recusa exige um motivo
que aparece para o associado e permite um novo envio.

### Consulta dos meses e pagamento

- Os cartões **Pago**, **Em aberto**, **Vencido** e **Em análise** mostram os meses de cada situação. Clicar em um cartão filtra a lista; o filtro de ano também se aplica aos cartões. No portal, esses totais são separados: vencidos e valores em análise não entram novamente em “Em aberto”.
- **Pagar via Pix** abre o QR Code com o valor da mensalidade. **Já paguei · Enviar comprovante** permite anexar o arquivo diretamente, sem depender da geração do Pix.
- O Pix fixo de **R$ 40,00**, com a mesma chave, QR Code e dados bancários da página de cadastro, permanece visível mesmo sem lançamentos. As duas telas usam o componente `AafabPixPayment`.
- O formulário **Já paguei · Enviar comprovante** permanece visível no início de **Meu financeiro**, mesmo sem mensalidades. O associado escolhe o mês e anexa PDF/JPG/PNG de até 5 MB. Sem lançamento anterior, o valor é R$ 40,00, definido no servidor; se o mês já existe, vale o valor cadastrado.
- Um comprovante sem lançamento fica **Em análise**, sem criar uma dívida ou pagamento. A Secretaria recebe o arquivo em **Financeiro → Comprovantes enviados pelo portal**. Ao aprovar, informa a data do pagamento e, se o mês ainda não existe, seu vencimento: a mensalidade e a baixa são registradas juntas. A recusa informa o motivo e permite reenvio.
- Se a Secretaria lançar o mês enquanto o comprovante aguarda análise, o arquivo é vinculado ao lançamento. Valores divergentes são bloqueados até a revisão. O banco impede mais de um comprovante pendente por associado e mês, inclusive em envios simultâneos.
- O associado pode baixar o comprovante que enviou e consultar o motivo de uma eventual recusa.

O bloqueio transacional das mensalidades usa explicitamente o schema de `DATABASE_URL`, para
funcionar também quando a conexão remota reutiliza um `search_path` de outra sessão.

O envio sem lançamento utiliza a migração `20261020000000_standalone_payment_proofs`, aplicada
ao schema `aafab_desenvolvimento`. Ela preserva os comprovantes existentes e acrescenta o vínculo
direto com o associado, o mês e o valor. Validação: tipos, build, testes do cliente, segurança,
9 cenários administrativos e 18 cenários do portal; o formulário e a aprovação também foram
verificados no navegador com dados fictícios, em desktop e celular.

## Segurança implementada

- senhas protegidas com `scrypt` e salt aleatório;
- sessão do associado separada da sessão administrativa;
- autorização no servidor baseada no cadastro contido no token, sem aceitar um identificador enviado pelo navegador;
- registros antigos e observações internas da Secretaria permanecem privados por padrão;
- bloqueio temporário após tentativas de senha incorreta;
- códigos armazenados apenas como hash, com validade de 24 horas e uso único;
- proteção contra uso simultâneo do mesmo código;
- logout, redefinição de senha e bloqueio do CPF revogam as sessões anteriores;
- mensagens públicas genéricas para não confirmar se um CPF está ou não na base;
- comunicados em rascunho ou arquivados nunca são enviados ao associado.
- comprovantes e anexos são validados por tipo real e tamanho, sem URL pública;
- um associado só consegue abrir seus próprios atendimentos, mensalidades e comprovantes;
- um índice no banco impede dois comprovantes pendentes para a mesma mensalidade;
- a baixa financeira continua protegida contra pagamentos duplicados.

## Desenvolvimento local

Na raiz do projeto:

```bash
npm run dev
```

O comando inicia o site em `http://localhost:3000` e a API em `http://localhost:3001`. A mensagem `Cannot GET /` na porta 3001 é normal: essa porta atende a API. O teste de saúde fica em `http://localhost:3001/health`.

O banco local configurado usa o schema de desenvolvimento. Antes de qualquer implantação, aplique
as migrações no ambiente de destino e configure `DATABASE_URL`, `ADMIN_PASSWORD`, `JWT_SECRET`,
`CORS_ORIGINS`, `PIX_KEY`, `PIX_RECEIVER_NAME` e `PIX_RECEIVER_CITY` no serviço do backend.

## Verificações

```bash
npm run typecheck:all
npm run build
npm run test:client
npm run test:integration
```

Os testes de integração criam schemas temporários e os removem ao terminar. Eles não gravam nos cadastros oficiais.

As suítes aceitam `DATABASE_URL` definido no ambiente do processo, com prioridade sobre
`server/.env`. Isso permite testar em um PostgreSQL descartável sem modificar a configuração local.

### Revisão de 18/10/2026

- Corrigido o formulário da Secretaria, que acessava o evento React depois da resposta assíncrona e mostrava erro mesmo após salvar a solicitação.
- Comprovantes simultâneos retornam um único envio aceito e um conflito; aprovações simultâneas registram somente um pagamento.
- A baixa manual exige resolver primeiro um comprovante pendente, evitando mensalidades pagas com análise ainda aberta.
- Erros internos de banco não são devolvidos ao associado; identificadores inválidos recebem resposta de validação.
- Downloads com sessão expirada limpam a sessão local.
- Exportação financeira em CSV protege textos iniciados por fórmulas ao abrir no Excel.
- Validados: tipos, builds, teste de funções do cliente, segurança, 9 cenários de gestão e 14 cenários do portal. A integração foi executada com dados fictícios em PostgreSQL temporário local, encerrado ao final. O envio do formulário foi também validado em React com DOM simulado.

Na retomada, a conexão de exemplo em `server/.env` foi substituída pela conexão Neon no schema
`aafab_desenvolvimento`. As migrações desse schema estão atualizadas. A senha administrativa e o
segredo de sessão locais foram gerados e salvos somente no `.env`, ignorado pelo Git. O schema
oficial `public` foi preservado; não houve publicação do site.
