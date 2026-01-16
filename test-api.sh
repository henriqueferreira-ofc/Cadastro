#!/bin/bash

echo "🧪 TESTE RÁPIDO DO SISTEMA DE CADASTRO"
echo "======================================"
echo ""

# Teste 1: Health Check
echo "✅ Teste 1: Verificando se o servidor está online..."
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
    echo "   ✓ Servidor está respondendo!"
else
    echo "   ✗ Servidor NÃO está respondendo!"
    echo "   👉 Execute: cd server && npm run dev"
    exit 1
fi

echo ""
echo "✅ Teste 2: Testando cadastro de exemplo..."

# CPF de teste (CPF válido - calculado)
TEST_CPF="11144477735"

# Dados de teste
TEST_DATA='{
  "cpf": "'$TEST_CPF'",
  "nome": "TESTE USUARIO",
  "estado": "SP",
  "turma_cesd": "2024/2",
  "rg": "123456789",
  "email": "teste@example.com",
  "telefone": "11999999999",
  "endereco": "Rua Teste, 123",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "cep": "01310100",
  "certidao_obito": "N/A"
}'

# Enviar cadastro
echo "   Enviando cadastro para o banco..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/cadastro \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "   ✓ Cadastro salvo com sucesso!"
else
    echo "   ✗ Erro ao salvar cadastro"
    echo "   Resposta: $RESPONSE"
fi

echo ""
echo "✅ Teste 3: Buscando cadastro pelo CPF..."

# Consultar
CONSULTA=$(curl -s http://localhost:3001/api/cadastro/consulta/$TEST_CPF)

if echo "$CONSULTA" | jq -e '.nome' > /dev/null; then
    echo "   ✓ Cadastro encontrado!"
    echo "   Nome: $(echo $CONSULTA | jq -r '.nome')"
    echo "   Email: $(echo $CONSULTA | jq -r '.email')"
else
    echo "   ✗ Cadastro NÃO encontrado"
fi

echo ""
echo "======================================"
echo "✅ TESTES CONCLUÍDOS!"
echo ""
echo "🔐 Próximo passo: Testar o painel admin"
echo "   Senha: AAFAB@2026#Secure!"
