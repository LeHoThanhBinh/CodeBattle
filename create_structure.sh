#!/bin/bash

# Backend structure
mkdir -p backend/code_battle_api/{__pycache__,migrations}
touch backend/code_battle_api/{__init__,settings,urls,wsgi,asgi,routing}.py
touch backend/manage.py
touch backend/requirements.txt
touch backend/.env
touch backend/db.sqlite3

# Django apps
for app in users problems matches submissions; do
    mkdir -p backend/$app/{__pycache__,migrations}
    touch backend/$app/{__init__,models,admin,apps,serializers,views,urls}.py
done

# Additional files for matches app
touch backend/matches/{services,consumers}.py

# Additional file for submissions app
touch backend/submissions/judge_service.py

# Frontend structure
mkdir -p frontend/assets/{images,fonts,videos}
mkdir -p frontend/css/pages
mkdir -p frontend/js/{services,components,pages,utils}
mkdir -p frontend/html/components
mkdir -p frontend/lib

# Frontend files
touch frontend/index.html
touch frontend/package.json

# CSS files
touch frontend/css/{style,components,responsive,variables}.css
touch frontend/css/pages/{home,login,register,dashboard,battle-room,history}.css

# JavaScript files
touch frontend/js/main.js
touch frontend/js/config.js

# JavaScript services
touch frontend/js/services/{api,auth,websocket,storage}.js

# JavaScript components
touch frontend/js/components/{navbar,editor,scoreboard,login-form,register-form,problem-card,modal,toast}.js

# JavaScript pages
touch frontend/js/pages/{home,login,register,dashboard,battle-room,history}.js

# JavaScript utils
touch frontend/js/utils/{helpers,formatter,validator}.js

# HTML files
touch frontend/html/{home,login,register,dashboard,battle-room,history}.html
touch frontend/html/components/{navbar,editor,scoreboard,modal}.html

# Libraries
touch frontend/lib/{monaco-editor,chart}.js

# Root level files
touch frontend/README.md

# Docker files
mkdir -p docker
touch docker/{Dockerfile.backend,Dockerfile.frontend,docker-compose.yml}

# Root project files
touch {.gitignore,README.md,LICENSE}
