# Hướng dẫn deploy CodeBattle lên Cloud Server Linux

## Bước 1: Chọn và tạo Cloud Server

### 1.1. Các nhà cung cấp phổ biến:
- **DigitalOcean**: https://www.digitalocean.com (dễ dùng, $6/tháng)
- **AWS EC2**: https://aws.amazon.com/ec2 (phức tạp hơn, mạnh mẽ)
- **Linode**: https://www.linode.com (giá tốt)
- **Vultr**: https://www.vultr.com (nhiều location)
- **Hetzner**: https://www.hetzner.com (giá rẻ, châu Âu)

### 1.2. Tạo Droplet/Instance
- **OS**: Ubuntu 22.04 LTS
- **Size**: Tối thiểu 2GB RAM, 2 vCPU (khuyến nghị 4GB RAM, 2 vCPU)
- **Region**: Chọn gần bạn nhất
- **SSH Key**: Thêm SSH key của bạn (hoặc dùng password)

## Bước 2: SSH vào server

```bash
# Trên Windows (PowerShell hoặc WSL)
ssh root@your-server-ip

# Hoặc nếu dùng user khác
ssh user@your-server-ip
```

## Bước 3: Cài đặt Docker

```bash
# Cập nhật hệ thống
sudo apt-get update
sudo apt-get upgrade -y

# Cài Docker
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Thêm user vào group docker
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra
docker --version
docker compose version
```

## Bước 4: Kiểm tra cgroups

```bash
# Kiểm tra cgroup v1 memory controller
ls /sys/fs/cgroup/memory

# Phải thấy thư mục memory/ → OK!
# Trên cloud server Linux thật, cgroups thường đã được cấu hình sẵn
```

## Bước 5: Copy project lên server

### 5.1. Cách 1: Dùng Git (khuyến nghị)
```bash
# Cài Git
sudo apt-get install -y git

# Clone project
git clone <your-repo-url>
cd CodeBattle
```

### 5.2. Cách 2: Dùng SCP từ Windows
```powershell
# Trên Windows PowerShell
scp -r D:\CodeBattle user@server-ip:/home/user/CodeBattle
```

### 5.3. Cách 3: Dùng rsync
```bash
# Trên Windows (WSL)
rsync -avz D:/CodeBattle/ user@server-ip:/home/user/CodeBattle/
```

## Bước 6: Cấu hình project

### 6.1. Tạo file .env
```bash
cd CodeBattle/backend
cp .env.example .env  # Nếu có
# Hoặc tạo mới
nano .env
```

### 6.2. Sửa docker-compose.yml
- Xóa fake isolate (nếu có)
- Đảm bảo `USE_ISOLATE: "false"` được xóa hoặc đặt `"true"` (mặc định là true)
- Xóa volume mount fake-isolate.sh

## Bước 7: Chạy project

```bash
cd /home/$USER/CodeBattle

# Build backend
docker compose build backend

# Khởi động services
docker compose up -d

# Kiểm tra log
docker compose logs -f judge0_server
```

## Bước 8: Cấu hình Firewall

```bash
# Mở các port cần thiết
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8000/tcp  # Backend API
sudo ufw allow 5173/tcp  # Frontend (nếu cần)
sudo ufw allow 2358/tcp # Judge0 API
sudo ufw enable
```

## Bước 9: Cấu hình Domain (tùy chọn)

### 9.1. Trỏ domain về server IP
- Vào DNS provider (Cloudflare, Namecheap, etc.)
- Thêm A record: `@` → server IP
- Thêm A record: `api` → server IP (cho API)

### 9.2. Cài Nginx reverse proxy (tùy chọn)
```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/codebattle
```

## Bước 10: Kiểm tra

```bash
# Kiểm tra services đang chạy
docker compose ps

# Kiểm tra log Judge0 - không còn lỗi cgroup!
docker compose logs judge0_server | grep -i "cgroup\|isolate"

# Test API
curl http://localhost:8000/api/health
```

## Lưu ý bảo mật

1. **Đổi SSH port mặc định** (tùy chọn)
2. **Dùng SSH key thay vì password**
3. **Cập nhật hệ thống thường xuyên**: `sudo apt-get update && sudo apt-get upgrade`
4. **Backup database định kỳ**
5. **Giới hạn quyền truy cập**: Chỉ mở port cần thiết

## Chi phí ước tính

- **DigitalOcean**: $6-12/tháng (2-4GB RAM)
- **AWS EC2**: ~$10-20/tháng (t2.small)
- **Hetzner**: €4-8/tháng (rất rẻ!)

## Troubleshooting

### Lỗi: "Cannot connect to Docker daemon"
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Lỗi: "Port already in use"
```bash
# Tìm process đang dùng port
sudo lsof -i :8000
# Kill process
sudo kill -9 <PID>
```

### Lỗi: "Out of memory"
→ Upgrade server lên RAM cao hơn

