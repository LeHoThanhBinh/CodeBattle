# D:/CodeBattle/frontend/Dockerfile
FROM node:20-alpine

# Làm việc trong thư mục /app
WORKDIR /app

# Copy package.json trước để cache dependency layer
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ source code
COPY . .

# Mở cổng Vite
EXPOSE 5173

# Chạy Vite dev server
CMD ["npm", "run", "dev", "--", "--host"]
