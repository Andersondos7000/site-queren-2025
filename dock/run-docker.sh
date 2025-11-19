#!/bin/bash

# Script para construir e executar a aplicação Querenhapuque localmente com Docker

echo "Construindo a imagem Docker..."
docker build -t querenhapuque-app .

echo "Executando a aplicação..."
docker run -d \
  --name querenhapuque-container \
  --restart unless-stopped \
  -p 80:80 \
  -e NODE_ENV=production \
  -e VITE_SUPABASE_URL=https://ojxmfxbflbfinodkhixk.supabase.co \
  -e VITE_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeG1meGJmbGJmaW5vZGtoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MjUwODAsImV4cCI6MjA3MDUwMTA4MH0.CNziCYvVGA3EUXSJfigtSGuYYiOn7wGE9FfBxlLsE-o' \
  -e VITE_APP_NAME="Borboleta Eventos Loja" \
  -e VITE_APP_VERSION="3.0.0" \
  querenhapuque-app

echo "Aplicação Querenhapuque está rodando na porta 80"