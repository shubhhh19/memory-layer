#!/bin/bash
# Memory Mesh Development Helper Script

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Memory Mesh Development Helper${NC}"
echo "================================"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${YELLOW}Warning: docker-compose not found, trying 'docker compose'${NC}"
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Menu
echo "Select an option:"
echo "1) Start all services"
echo "2) Stop all services"
echo "3) View logs"
echo "4) Run database migrations"
echo "5) Run tests"
echo "6) Clean up (remove containers and volumes)"
echo "7) Check service health"
echo "8) Exit"
echo ""
read -p "Enter your choice [1-8]: " choice

case $choice in
    1)
        echo -e "${GREEN}Starting all services...${NC}"
        docker compose up -d
        echo -e "${GREEN}✓ Services started${NC}"
        echo "API: http://localhost:8001"
        echo "Frontend: http://localhost:3000"
        ;;
    2)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
    3)
        echo -e "${GREEN}Viewing logs (Ctrl+C to exit)...${NC}"
        docker compose logs -f
        ;;
    4)
        echo -e "${GREEN}Running database migrations...${NC}"
        cd backend
        alembic upgrade head
        cd ..
        echo -e "${GREEN}✓ Migrations complete${NC}"
        ;;
    5)
        echo -e "${GREEN}Running tests...${NC}"
        cd backend
        pytest
        cd ..
        echo -e "${GREEN}✓ Tests complete${NC}"
        ;;
    6)
        echo -e "${RED}Warning: This will remove all containers and volumes${NC}"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            docker compose down -v
            echo -e "${GREEN}✓ Cleanup complete${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    7)
        echo -e "${GREEN}Checking service health...${NC}"
        echo ""
        echo "Database:"
        docker compose exec db pg_isready -U memory || echo -e "${RED}Database not ready${NC}"
        echo ""
        echo "Redis:"
        docker compose exec redis redis-cli ping || echo -e "${RED}Redis not ready${NC}"
        echo ""
        echo "API:"
        curl -s http://localhost:8001/v1/admin/health | grep -q "ok" && echo -e "${GREEN}API healthy${NC}" || echo -e "${RED}API not healthy${NC}"
        ;;
    8)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac
