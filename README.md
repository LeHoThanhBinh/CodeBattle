# Code Battle Project

A real-time coding battle platform built with Django and Vanilla JavaScript.

## Structure

- `backend/` - Django backend API
- `frontend/` - Vanilla JavaScript frontend
- `docker/` - Docker configuration files

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run with Docker:
   ```bash
   docker-compose up
   ```

## Development

- Backend runs on port 8000
- Frontend runs on port 80
### 🔧 Language Configuration
Languages are now defined in `config/languages.json`.

To add or edit supported languages:
1. Open `config/languages.json`
2. Add a new entry:
   ```json
   { "id": 91, "key": "go", "label": "Go 1.20" }
