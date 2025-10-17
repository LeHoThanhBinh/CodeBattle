# Dán lại toàn bộ code này vào file backend/app.py

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask_mysqldb import MySQL # <-- Thư viện này giờ sẽ được tìm thấy
import pymysql

pymysql.install_as_MySQLdb()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 

# --- CẤU HÌNH KẾT NỐI MYSQL ---
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = '123456' # <-- NHỚ THAY MẬT KHẨU CỦA BẠN
app.config['MYSQL_DB'] = 'code_battle'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor' 

mysql = MySQL(app)

# --- HÀM LOGIN ĐỌC TỪ MYSQL ---
@app.route('/login', methods=['POST'])
def handle_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user_info = cursor.fetchone()
        cursor.close()

        if user_info and user_info['password'] == password:
            print(f"✅ Đăng nhập thành công cho {username} từ MySQL")
            return jsonify({
                "message": "Login successful",
                "user": {
                    "username": user_info['username'],
                    "id": user_info['id'],
                    "fullName": user_info['fullName']
                }
            }), 200
        else:
            print(f"❌ Đăng nhập thất bại cho {username}")
            return jsonify({"message": "Invalid username or password"}), 401
    except Exception as e:
        print(f"Lỗi khi truy vấn CSDL: {e}")
        return jsonify({"message": "Server error"}), 500

# --- PHẦN SOCKET.IO ---
socketio = SocketIO(app, cors_allowed_origins="*")
user_sids = {}

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected to WebSocket!')

# ... (Các hàm handle_disconnect, handle_register, handle_send_challenge giữ nguyên như cũ) ...
@socketio.on('disconnect')
def handle_disconnect():
    disconnected_user_id = None
    for user_id, sid_in_dict in user_sids.items():
        if sid_in_dict == request.sid:
            disconnected_user_id = user_id
            break
    if disconnected_user_id:
        del user_sids[disconnected_user_id]
        print(f'❌ Client {disconnected_user_id} disconnected. Users online: {list(user_sids.keys())}')

@socketio.on('register')
def handle_register(data):
    user_id = data.get('user_id')
    if user_id:
        user_sids[user_id] = request.sid
        print(f'🔗 User {user_id} registered with SID {request.sid}.')
        print(f'Users online: {list(user_sids.keys())}')

@socketio.on('send_challenge')
def handle_send_challenge(data):
    challenger_info = data.get('challenger')
    opponent_id = data.get('opponent_id')
    print(f"🔥 Challenge from {challenger_info['fullName']} to {opponent_id}")
    opponent_sid = user_sids.get(opponent_id)
    if opponent_sid:
        emit('receive_challenge', {'challenger': challenger_info}, room=opponent_sid)
        print(f"💌 Challenge sent successfully to {opponent_id}")
    else:
        print(f"🤷 Opponent {opponent_id} not found or is offline.")


if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)