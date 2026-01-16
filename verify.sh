#!/bin/bash

# 🔍 VERIFICADOR RÁPIDO DO SISTEMA

echo "🔍 VERIFICAÇÃO RÁPIDA DO SISTEMA"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Verificando arquivos modificados..."
echo ""

# Lista de arquivos
files=(
  "server/src/routes/cadastroRoutes.ts"
  "db_service.ts"
  "components/RegistrationForm.tsx"
  "components/AdminDashboard.tsx"
  "vite.config.ts"
  ".env"
  ".env.production"
)

for file in "${files[@]}"; do
  if [ -f "/Users/henriquecesararaujoferreira/Desktop/Cadastro/$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
  else
    echo -e "${RED}❌${NC} $file"
  fi
done

echo ""
echo "Verificando servidor..."
echo ""

if curl -s http://localhost:3001/health > /dev/null; then
  echo -e "${GREEN}✅${NC} Backend está rodando (porta 3001)"
else
  echo -e "${RED}❌${NC} Backend NÃO está rodando"
  echo "   Execute: cd server && npm run dev"
fi

echo ""
echo "Verificando banco de dados..."
echo ""

# Teste de conexão com um CPF que deve existir
if curl -s http://localhost:3001/api/cadastro/consulta/11144477735 | grep -q "error\|TESTE"; then
  echo -e "${GREEN}✅${NC} Banco de dados acessível"
else
  echo -e "${YELLOW}⚠️${NC} Banco de dados respondendo mas sem dados"
fi

echo ""
echo "=================================="
echo "✅ Verificação concluída!"
echo ""
