#!/bin/bash

# Script de deploy Docker para Querenhapuque
# Uso: ./docker-deploy.sh [build|up|down|restart|logs]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   DEPLOY DOCKER - QUERENHAPUQUE${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Função para build
build() {
    echo -e "${YELLOW}🔨 Construindo imagem Docker...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✅ Build concluído!${NC}\n"
}

# Função para subir containers
up() {
    echo -e "${YELLOW}🚀 Iniciando containers...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Containers iniciados!${NC}"
    echo -e "${GREEN}📱 Aplicação disponível em: http://localhost:3000${NC}\n"
}

# Função para parar containers
down() {
    echo -e "${YELLOW}🛑 Parando containers...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Containers parados!${NC}\n"
}

# Função para reiniciar
restart() {
    echo -e "${YELLOW}🔄 Reiniciando containers...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Containers reiniciados!${NC}\n"
}

# Função para ver logs
logs() {
    echo -e "${YELLOW}📋 Exibindo logs...${NC}"
    docker-compose logs -f
}

# Função para status
status() {
    echo -e "${YELLOW}📊 Status dos containers:${NC}"
    docker-compose ps
    echo ""
}

# Função para deploy completo
deploy() {
    echo -e "${YELLOW}🚀 Deploy completo...${NC}"
    build
    down
    up
    status
    echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
    echo -e "${GREEN}📱 Aplicação disponível em: http://localhost:3000${NC}\n"
}

# Menu principal
case "$1" in
    build)
        build
        ;;
    up)
        up
        status
        ;;
    down)
        down
        ;;
    restart)
        restart
        status
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    deploy)
        deploy
        ;;
    *)
        echo -e "${YELLOW}Uso: $0 {build|up|down|restart|logs|status|deploy}${NC}"
        echo ""
        echo "Comandos disponíveis:"
        echo "  build   - Construir imagem Docker"
        echo "  up      - Iniciar containers"
        echo "  down    - Parar containers"
        echo "  restart - Reiniciar containers"
        echo "  logs    - Ver logs em tempo real"
        echo "  status  - Ver status dos containers"
        echo "  deploy  - Deploy completo (build + up)"
        echo ""
        exit 1
        ;;
esac

