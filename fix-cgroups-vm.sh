#!/bin/bash
# Script để fix cgroups trên Ubuntu VM
# Chạy: sudo bash fix-cgroups-vm.sh

echo "🔍 Kiểm tra cgroups hiện tại..."

# Kiểm tra cgroup v1
echo "1. Kiểm tra /sys/fs/cgroup:"
ls -la /sys/fs/cgroup/ | head -20

# Kiểm tra cgroup v2
echo ""
echo "2. Kiểm tra cgroup v2:"
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
    echo "Cgroup v2 đang được sử dụng (unified hierarchy)"
    cat /sys/fs/cgroup/cgroup.controllers
else
    echo "Không có cgroup v2"
fi

# Kiểm tra kernel parameters
echo ""
echo "3. Kernel parameters:"
cat /proc/cmdline

# Kiểm tra mount points
echo ""
echo "4. Mount points:"
mount | grep cgroup

echo ""
echo "📝 Giải pháp:"
echo "Cần thêm systemd.unified_cgroup_hierarchy=0 vào GRUB để disable cgroup v2"
echo ""
echo "Chạy các lệnh sau:"
echo "  sudo nano /etc/default/grub"
echo "  # Thêm systemd.unified_cgroup_hierarchy=0 vào GRUB_CMDLINE_LINUX_DEFAULT"
echo "  sudo update-grub"
echo "  sudo reboot"

