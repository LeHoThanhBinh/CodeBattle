#!/bin/bash
# Script kiểm tra cgroups sau khi reboot

echo "🔍 Kiểm tra cgroups sau reboot..."

# 1. Kiểm tra kernel parameters
echo "1. Kernel parameters:"
if [ -f /proc/cmdline ]; then
    cat /proc/cmdline | grep -o "systemd.unified_cgroup_hierarchy=0\|cgroup_memory=1" || echo "Không tìm thấy tham số cgroup trong kernel parameters"
else
    echo "❌ Không tìm thấy /proc/cmdline (có thể đang chạy trên Windows)"
fi

# 2. Kiểm tra cgroup memory
echo ""
echo "2. Kiểm tra /sys/fs/cgroup/memory:"
if [ -d /sys/fs/cgroup/memory ]; then
    echo "✅ Cgroup v1 memory controller đã được mount!"
    ls -la /sys/fs/cgroup/memory/ | head -10
else
    echo "❌ Chưa có /sys/fs/cgroup/memory"
    echo ""
    echo "Thử mount thủ công:"
    echo "  sudo mkdir -p /sys/fs/cgroup/memory"
    echo "  sudo mount -t cgroup -o memory cgroup /sys/fs/cgroup/memory"
fi

# 3. Kiểm tra mount points
echo ""
echo "3. Mount points cgroup:"
mount | grep cgroup

# 4. Kiểm tra cgroup v2
echo ""
echo "4. Kiểm tra cgroup v2:"
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
    echo "⚠️  Cgroup v2 vẫn đang hoạt động"
    echo "Cần đảm bảo systemd.unified_cgroup_hierarchy=0 trong GRUB"
else
    echo "✅ Cgroup v2 đã bị disable"
fi

