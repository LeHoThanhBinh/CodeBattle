from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
# Cho phép tất cả các nguồn gốc kết nối tới server (quan trọng cho live server)
CORS(app, resources={r"/*": {"origins": "*"}}) 
socketio = SocketIO(app, cors_allowed_origins="*")

# Một dictionary để lưu user_id và session id (sid) của họ khi kết nối
# Ví dụ: {'A001': 'aBcDeFg12345', 'B002': 'xYzAbCd67890'}
user_sids = {}

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected!')

@socketio.on('disconnect')
def handle_disconnect():
    # Xóa người dùng khỏi danh sách khi họ ngắt kết nối
    disconnected_user_id = None
    for user_id, sid in user_sids.items():
        if sid == request.sid:
            disconnected_user_id = user_id
            break
    if disconnected_user_id:
        del user_sids[disconnected_user_id]
        print(f'❌ Client {disconnected_user_id} disconnected. Current users: {list(user_sids.keys())}')


@socketio.on('register')
def handle_register(data):
    """Client gửi thông tin định danh khi vừa kết nối"""
    user_id = data.get('user_id')
    if user_id:
        user_sids[user_id] = request.sid # request.sid là ID phiên duy nhất của Socket.IO
        print(f'🔗 User {user_id} registered with SID {request.sid}.')
        print(f'Current users: {list(user_sids.keys())}')


@socketio.on('send_challenge')
def handle_send_challenge(data):
    """Xử lý sự kiện khi người chơi A gửi lời mời đến B"""
    challenger_info = data.get('challenger') # {id, name}
    opponent_id = data.get('opponent_id')

    print(f"🔥 Challenge from {challenger_info['id']} to {opponent_id}")

    opponent_sid = user_sids.get(opponent_id)
    if opponent_sid:
        # Nếu tìm thấy đối thủ đang online, gửi sự kiện đến CHỈ client đó
        emit('receive_challenge', {'challenger': challenger_info}, room=opponent_sid)
        print(f"💌 Challenge sent successfully to {opponent_id}")
    else:
        # Xử lý trường hợp đối thủ không online (tùy chọn)
        print(f"🤷 Opponent {opponent_id} not found or is offline.")


if __name__ == '__main__':
    # Chạy server với SocketIO
    socketio.run(app, port=5000, debug=True)