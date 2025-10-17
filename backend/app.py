import os
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask_pymysql import MySQL

backend_dir = os.path.abspath(os.path.dirname(__file__))
root_dir = os.path.abspath(os.path.join(backend_dir, '..'))
frontend_dir = os.path.join(root_dir, 'frontend')

app = Flask(__name__,
            template_folder=os.path.join(frontend_dir, 'html'),
            static_folder=frontend_dir, static_url_path='')

CORS(app)
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = '123456' 
app.config['MYSQL_DB'] = 'code_battle'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor' 
mysql = MySQL(app)

@app.route('/api/register', methods=['POST'])
def handle_register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    fullName = data.get('fullName')

    import random
    user_id = f"U{random.randint(1000, 9999)}"
    
    try:
        cursor = mysql.connection.cursor()
        
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            cursor.close()
            return jsonify({"message": "Username already exists"}), 409 # 409 Conflict

        cursor.execute(
            "INSERT INTO users (id, username, password, fullName) VALUES (%s, %s, %s, %s)",
            (user_id, username, password, fullName)
        )
        mysql.connection.commit()
        cursor.close()
        
        print(f"🎉 Người dùng mới đã đăng ký: {username}")
        return jsonify({"message": "User registered successfully"}), 201 # 201 Created

    except Exception as e:
        print(f"Lỗi khi đăng ký: {e}")
        return jsonify({"message": "Server error during registration"}), 500

@app.route('/api/login', methods=['POST'])
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

@app.route('/')
def serve_login_page():
    return render_template('login.html')

@app.route('/register')
def serve_register_page():
    return render_template('register.html')

@app.route('/dashboard')
def serve_dashboard_page():
    return render_template('dashboard.html')

socketio = SocketIO(app, cors_allowed_origins="*")
user_sids = {}

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected to WebSocket!')

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
    challenger_name = challenger_info.get('fullName', challenger_info.get('id', 'Unknown'))
    print(f"🔥 Challenge from {challenger_name} to {opponent_id}")
    opponent_sid = user_sids.get(opponent_id)
    if opponent_sid:
        emit('receive_challenge', {'challenger': challenger_info}, room=opponent_sid)
        print(f"💌 Challenge sent successfully to {opponent_id}")
    else:
        print(f"🤷 Opponent {opponent_id} not found or is offline.")

if __name__ == '__main__':
    print("🚀 Code Battle Server is starting at http://127.0.0.1:5000")
    socketio.run(app, port=5000, debug=True)