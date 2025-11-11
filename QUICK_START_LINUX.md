# Quick Start: Chạy CodeBattle trên Linux (isolate thật)

## Tóm tắt nhanh

1. **Có Linux VM/server** (Ubuntu 22.04+)
2. **Cài Docker** trên Linux
3. **Copy project** lên Linux
4. **Sửa docker-compose.yml** để dùng isolate thật
5. **Chạy project**

## Các bước chi tiết

### Bước 1: Cài Docker trên Linux

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

### Bước 2: Copy project lên Linux

```bash
# Cách 1: Git
git clone <your-repo>
cd CodeBattle

# Cách 2: SCP từ Windows
scp -r D:\CodeBattle user@linux-ip:/home/user/CodeBattle
```

### Bước 3: Sửa docker-compose.yml

**Cách 1: Dùng script tự động**
```bash
chmod +x setup-linux-isolate.sh
./setup-linux-isolate.sh
```

**Cách 2: Sửa thủ công**
1. Xóa dòng: `- ./judge0/fake-isolate.sh:/tmp/fake-isolate.sh:ro`
2. Xóa dòng: `USE_ISOLATE: "false"` (hoặc đổi thành `"true"`)
3. Xóa các dòng trong command liên quan đến fake isolate:
   - `echo '🔧 Installing fake isolate wrapper...'`
   - `cp /tmp/fake-isolate.sh /usr/local/bin/isolate`
   - `chmod +x /usr/local/bin/isolate`
   - `echo '✅ Fake isolate wrapper installed'`

### Bước 4: Chạy project

```bash
docker compose build backend
docker compose up -d
docker compose logs -f judge0_server
```

### Bước 5: Kiểm tra

```bash
# Kiểm tra cgroups (phải thấy thư mục memory/)
ls /sys/fs/cgroup/memory

# Kiểm tra log - không còn lỗi cgroup!
docker compose logs judge0_server | grep -i cgroup

# Test submit code - phải chạy được!
```

## So sánh: Windows vs Linux

| Tính năng | Windows/WSL2 | Linux VM/Server |
|-----------|--------------|-----------------|
| Isolate sandbox | ❌ Không hoạt động | ✅ Hoạt động đầy đủ |
| Cgroups | ❌ Không đầy đủ | ✅ Đầy đủ |
| Bảo mật | ⚠️ Fake isolate (không an toàn) | ✅ Isolate thật (an toàn) |
| Performance | ✅ Nhanh hơn | ⚠️ Chậm hơn (nếu VM) |
| Setup | ✅ Dễ (đã có) | ⚠️ Cần tạo VM/server |

## Lựa chọn

- **Development trên Windows**: Dùng fake isolate (hiện tại)
- **Production/Testing thật**: Dùng Linux VM/server với isolate thật

## Tài liệu chi tiết

- `SETUP_LINUX_VM.md` - Hướng dẫn tạo VM Linux
- `SETUP_CLOUD_SERVER.md` - Hướng dẫn deploy lên cloud

