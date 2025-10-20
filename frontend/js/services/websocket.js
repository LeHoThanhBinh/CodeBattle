/**
 * Thiết lập và quản lý kết nối WebSocket cho trang Dashboard.
 * @param {function} onMessageCallback - Hàm sẽ được gọi mỗi khi có tin nhắn từ server.
 * @returns {WebSocket} - Trả về đối tượng WebSocket đã được khởi tạo.
 */
export function setupDashboardSocket(onMessageCallback) {
    // URL của WebSocket endpoint trên server Django Channels.
    const socketUrl = 'ws://127.0.0.1:8000/ws/dashboard/';
    const socket = new WebSocket(socketUrl);

    socket.onopen = (event) => {
        console.log('✅ WebSocket connection established for dashboard.');
        // Bạn có thể gửi một tin nhắn "đăng ký" ở đây nếu cần.
        // Ví dụ:
        // const token = sessionStorage.getItem('accessToken');
        // if (token) {
        //     socket.send(JSON.stringify({ type: 'authenticate', token: token }));
        // }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Gọi hàm callback được truyền vào để xử lý dữ liệu
            if (onMessageCallback) {
                onMessageCallback(data);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };

    socket.onclose = (event) => {
        console.log('❌ WebSocket connection closed.');
        // Có thể thêm logic tự động kết nối lại ở đây.
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    return socket;
}
