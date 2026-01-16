#!/bin/bash

echo "🚀 ENVIANDO PARA GITHUB..."
echo "================================"
echo ""

cd /Users/henriquecesararaujoferreira/Desktop/Cadastro

# Verificar status
echo "1️⃣ Status do repositório:"
git status --short

echo ""
echo "2️⃣ Adicionando arquivos..."
git add .

echo ""
echo "3️⃣ Criando commit..."
git commit -m "✨ feat: sincronização de dados entre dispositivos

- Adicionada rota de consulta por CPF no backend
- Alterada prioridade: salva backend primeiro
- Implementada busca inteligente de dados
- Sincronizado painel admin
- Configuradas variáveis de ambiente (.env e .env.production)
- Adicionada documentação completa
- Inclusos scripts de teste automatizados"

echo ""
echo "4️⃣ Enviando para GitHub..."
git push

echo ""
echo "✅ CONCLUÍDO!"
echo ""
echo "📊 Resumo:"
git log --oneline -1
