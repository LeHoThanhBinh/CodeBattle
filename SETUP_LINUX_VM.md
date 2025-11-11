# Hướng dẫn chạy CodeBattle trên Linux VM (để isolate hoạt động)

## Bước 1: Tạo VM Ubuntu

### 1.1. Cài VirtualBox (nếu chưa có)
- Tải: https://www.virtualbox.org/wiki/Downloads
- Cài đặt VirtualBox trên Windows

### 1.2. Tải Ubuntu ISO
- Tải Ubuntu 22.04 LTS Server: https://ubuntu.com/download/server
- Hoặc Ubuntu Desktop nếu muốn có GUI

### 1.3. Tạo VM mới
1. Mở VirtualBox → New
2. Tên: `CodeBattle-Linux`
3. Type: Linux
4. Version: Ubuntu (64-bit)
5. Memory: **Tối thiểu 4GB** (khuyến nghị 8GB)
6. Hard disk: **Tối thiểu 40GB** (khuyến nghị 60GB)
7. Chọn "Create a virtual hard disk now" → VDI → Dynamically allocated

### 1.4. Cài Ubuntu
1. Start VM
2. Chọn Ubuntu ISO file
3. Cài đặt Ubuntu (chọn "Install Ubuntu Server")
4. **Quan trọng**: Khi cài đặt, chọn:
   - Enable OpenSSH server (để SSH từ Windows)
   - Install Docker (nếu có option)

### 1.5. Cấu hình VM
1. Settings → System → Processor: **2-4 cores**
2. Settings → Network → Adapter 1: **NAT** (hoặc Bridged để có IP riêng)
3. Settings → Shared Folders: Thêm thư mục `D:\CodeBattle` (để share code)

## Bước 2: Cài Docker trên Ubuntu VM

### 2.1. SSH vào VM (hoặc dùng terminal trong VM)
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

# Kiểm tra Docker
docker --version
docker compose version
```

### 2.2. Kiểm tra cgroups (quan trọng!)
```bash
# Kiểm tra cgroup v1 memory controller
ls /sys/fs/cgroup/memory

# Nếu thấy thư mục memory/ → OK! isolate sẽ hoạt động
# Nếu không thấy → cần cấu hình thêm (xem bước 2.3)
```

### 2.3. Cấu hình cgroups (nếu cần)
```bash
# Kiểm tra kernel parameters
cat /proc/cmdline

# Nếu không có cgroup_memory=1, thêm vào GRUB:
sudo nano /etc/default/grub
# Tìm dòng GRUB_CMDLINE_LINUX_DEFAULT và thêm:
# GRUB_CMDLINE_LINUX_DEFAULT="cgroup_memory=1"

# Cập nhật GRUB
sudo update-grub
sudo reboot
```

## Bước 3: Copy project vào VM

### 3.1. Cách 1: Dùng Shared Folder (VirtualBox)
```bash
# Mount shared folder (nếu chưa tự động)
sudo mkdir -p /mnt/shared
sudo mount -t vboxsf CodeBattle /mnt/shared

# Copy project
cp -r /mnt/shared /home/$USER/CodeBattle
cd /home/$USER/CodeBattle
```

### 3.2. Cách 2: Dùng SCP từ Windows
```powershell
# Trên Windows PowerShell
scp -r D:\CodeBattle user@vm-ip:/home/user/CodeBattle
```

### 3.3. Cách 3: Dùng Git (nếu project đã push lên Git)
```bash
git clone <your-repo-url>
cd CodeBattle
```

## Bước 4: Sửa docker-compose.yml để dùng isolate thật

### 4.1. Xóa fake isolate, dùng isolate thật
```bash
# Xóa file fake isolate (không cần nữa)
rm judge0/fake-isolate.sh

# Sửa docker-compose.yml: xóa volume mount fake-isolate.sh
# Và xóa phần command tạo fake isolate
```

### 4.2. Cập nhật docker-compose.yml
- Xóa dòng: `- ./judge0/fake-isolate.sh:/tmp/fake-isolate.sh:ro`
- Xóa các dòng trong command tạo fake isolate
- Giữ lại: `USE_ISOLATE: "false"` → đổi thành `USE_ISOLATE: "true"` hoặc xóa luôn (mặc định là true)

## Bước 5: Chạy project

```bash
cd /home/$USER/CodeBattle

# Build backend image
docker compose build backend

# Khởi động tất cả services
docker compose up -d

# Kiểm tra log
docker compose logs -f judge0_server
```

## Bước 6: Kiểm tra isolate hoạt động

```bash
# Xem log Judge0 - không còn lỗi cgroup!
docker compose logs judge0_server | grep -i "cgroup\|isolate"

# Submit code test - phải chạy được!
```

## Lưu ý quan trọng

1. **VM phải có đủ RAM**: Tối thiểu 4GB, khuyến nghị 8GB
2. **VM phải có đủ disk**: Tối thiểu 40GB
3. **Network**: Cấu hình NAT hoặc Bridged để truy cập từ Windows
4. **Performance**: VM sẽ chậm hơn native, nhưng isolate sẽ hoạt động đúng

## Troubleshooting

### Lỗi: "Cannot write /sys/fs/cgroup/memory/box-*/tasks"
→ Cgroups chưa được cấu hình đúng. Xem lại Bước 2.3

### Lỗi: "Docker daemon not running"
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Lỗi: "Permission denied"
```bash
sudo usermod -aG docker $USER
newgrp docker
```

