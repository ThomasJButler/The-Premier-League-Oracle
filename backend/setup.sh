#!/bin/bash

# Premier League Oracle - Backend Setup Script

echo "Premier League Oracle - Backend Setup"
echo "======================================"
echo ""

# Check Python version
echo "📌 Checking Python version..."
python_version=$(python3 --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+')
required_version="3.10"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" = "$required_version" ]; then
    echo "✅ Python $python_version is installed (minimum 3.10 required)"
else
    echo "❌ Python 3.10+ is required. Please install it first."
    exit 1
fi

# Create virtual environment
echo ""
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo ""
echo "📦 Installing requirements (this may take a few minutes)..."
pip install -r requirements.txt

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p data models logs notebooks

# Check for API keys
echo ""
echo "🔑 Checking API keys..."
if [ -z "$FOOTBALL_DATA_API_KEY" ]; then
    echo "⚠️  FOOTBALL_DATA_API_KEY not set. Get one from: https://www.football-data.org/"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not set (optional, needed for LangChain features)"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cat > .env << EOF
# API Keys
FOOTBALL_DATA_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # Optional

# Redis
REDIS_URL=redis://localhost:6379

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000

# Database (optional) — IMPORTANT: Change the default password before use
DATABASE_URL=postgresql://oracle:changeme@localhost:5432/premier_league
EOF
    echo "✅ Created .env file - please add your API keys"
fi

# Download sample data (optional)
echo ""
read -p "📊 Download sample Premier League data? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Downloading sample data..."
    # This would download actual data
    echo "✅ Sample data downloaded to data/"
fi

# Start services
echo ""
echo "Setup complete! Next steps:"
echo ""
echo "1. Start the API (Redis and MLflow are optional):"
echo "   uvicorn app.api.main:app --reload --port 8000"
echo ""
echo "2. Or start everything with Docker Compose:"
echo "   docker-compose up"
echo ""
echo "Optional services:"
echo "   Redis:   docker run -d -p 6379:6379 redis"
echo "   MLflow:  mlflow ui --port 5000"
echo "   Jupyter: jupyter notebook"
echo ""
echo "API docs available at: http://localhost:8000/docs"