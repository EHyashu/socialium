#!/bin/bash

# Install git hooks for security scanning
# Run this script after cloning the repository

echo "🔐 Installing Git Hooks for Security..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo "❌ Error: .git directory not found. Initialize git first."
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f ".githooks/pre-commit" ]; then
    cp .githooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook installed"
else
    echo "❌ Warning: .githooks/pre-commit not found"
fi

echo ""
echo "📋 Installed hooks:"
echo "  - pre-commit: Scans for exposed secrets before each commit"
echo ""
echo "🎯 What it protects against:"
echo "  - API keys (OpenAI, Anthropic, Groq, etc.)"
echo "  - OAuth secrets (LinkedIn, Twitter, etc.)"
echo "  - Twilio credentials"
echo "  - .env files with real credentials"
echo ""
echo "✨ You're now protected from accidentally committing secrets!"
echo ""
