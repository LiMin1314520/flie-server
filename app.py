from flask import Flask, render_template, request, send_file, jsonify, redirect, url_for, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os
import datetime
import mimetypes
import json

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# 配置密钥和会话
app.secret_key = 'your-secret-key-change-this-in-production'
app.config['SESSION_TYPE'] = 'filesystem'

# 配置用户数据文件
USERS_FILE = 'users.json'

# 初始化 Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = '请先登录'

# 配置上传文件夹
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 限制上传文件最大100MB

# 配置系统设置文件
SETTINGS_FILE = 'settings.json'


# 管理员装饰器
def admin_required(f):
    """管理员权限验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.username != 'admin':
            return jsonify({'success': False, 'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated_function


# 配置文件管理函数
def load_settings():
    """加载系统设置"""
    if not os.path.exists(SETTINGS_FILE):
        default_settings = {
            'background_gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            'background_type': 'gradient',
            'background_image': '',
            'site_title': '文件网盘'
        }
        save_settings(default_settings)
        return default_settings
    
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载设置失败: {e}")
        return {}


def save_settings(settings):
    """保存系统设置"""
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存设置失败: {e}")
        return False


# User 类
class User(UserMixin):
    def __init__(self, user_id, username):
        self.id = user_id
        self.username = username


# 用户管理函数
def load_users():
    """加载用户数据"""
    if not os.path.exists(USERS_FILE):
        return {}
    
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载用户数据失败: {e}")
        return {}


def save_users(users):
    """保存用户数据"""
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存用户数据失败: {e}")
        return False


def get_user_by_username(username):
    """根据用户名获取用户"""
    users = load_users()
    if username in users:
        user_data = users[username]
        return User(user_data['id'], username)
    return None


@login_manager.user_loader
def load_user(user_id):
    """Flask-Login 回调函数"""
    users = load_users()
    for username, user_data in users.items():
        if user_data['id'] == user_id:
            return User(user_id, username)
    return None


def get_user_upload_folder(username):
    """获取用户的上传文件夹路径"""
    return os.path.join(UPLOAD_FOLDER, username)


def ensure_user_folder(username):
    """确保用户文件夹存在"""
    user_folder = get_user_upload_folder(username)
    if not os.path.exists(user_folder):
        os.makedirs(user_folder)
    return user_folder


# 创建默认管理员账户
def create_default_admin():
    """创建默认管理员账户"""
    users = load_users()
    if 'admin' not in users:
        users['admin'] = {
            'id': '1',
            'username': 'admin',
            'password_hash': generate_password_hash('admin123'),
            'created_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        save_users(users)
        ensure_user_folder('admin')
        print("已创建默认管理员账户: admin / admin123")

# 创建默认管理员
create_default_admin()

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 限制上传文件最大100MB


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/login')
def login():
    """登录页面"""
    return render_template('login.html')


@app.route('/register')
def register():
    """注册页面"""
    return render_template('register.html')


@app.route('/api/register', methods=['POST'])
def api_register():
    """注册 API"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if not username or not password or not confirm_password:
            return jsonify({'success': False, 'error': '请填写所有字段'}), 400
        
        if password != confirm_password:
            return jsonify({'success': False, 'error': '两次输入的密码不一致'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'error': '密码长度至少为6位'}), 400
        
        users = load_users()
        
        if username in users:
            return jsonify({'success': False, 'error': '用户名已存在'}), 400
        
        # 创建新用户
        user_id = str(len(users) + 1)
        users[username] = {
            'id': user_id,
            'username': username,
            'password_hash': generate_password_hash(password),
            'created_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        if save_users(users):
            # 创建用户文件夹
            ensure_user_folder(username)
            return jsonify({'success': True, 'message': '注册成功'})
        else:
            return jsonify({'success': False, 'error': '注册失败,请重试'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def api_login():
    """登录 API"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'error': '用户名和密码不能为空'}), 400
        
        user = get_user_by_username(username)
        if not user:
            return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
        
        users = load_users()
        if not check_password_hash(users[username]['password_hash'], password):
            return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
        
        login_user(user)
        
        # 确保用户文件夹存在
        ensure_user_folder(username)
        
        return jsonify({'success': True, 'message': '登录成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    """登出 API"""
    try:
        logout_user()
        return jsonify({'success': True, 'message': '登出成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/check-login', methods=['GET'])
def api_check_login():
    """检查登录状态"""
    if current_user.is_authenticated:
        return jsonify({'success': True, 'logged_in': True, 'username': current_user.username})
    else:
        return jsonify({'success': True, 'logged_in': False})


@app.route('/api/files', methods=['GET'])
@login_required
def list_files():
    """获取文件列表"""
    try:
        user_folder = get_user_upload_folder(current_user.username)
        ensure_user_folder(current_user.username)
        
        files = []
        for filename in os.listdir(user_folder):
            filepath = os.path.join(user_folder, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                file_info = {
                    'name': filename,
                    'size': stat.st_size,
                    'modified': datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'type': mimetypes.guess_type(filename)[0] or 'application/octet-stream'
                }
                files.append(file_info)
        
        # 按修改时间降序排序
        files.sort(key=lambda x: x['modified'], reverse=True)
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/upload', methods=['POST'])
@login_required
def upload_file():
    """上传文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '没有文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': '文件名为空'}), 400
        
        # 获取用户文件夹并确保存在
        user_folder = ensure_user_folder(current_user.username)
        
        # 保存文件
        filename = file.filename
        filepath = os.path.join(user_folder, filename)
        
        # 如果文件已存在，添加时间戳
        if os.path.exists(filepath):
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
            filepath = os.path.join(user_folder, filename)
        
        file.save(filepath)
        
        return jsonify({
            'success': True,
            'message': '文件上传成功',
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download/<filename>', methods=['GET'])
@login_required
def download_file(filename):
    """下载文件"""
    try:
        user_folder = get_user_upload_folder(current_user.username)
        filepath = os.path.join(user_folder, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        
        return send_file(filepath, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/delete/<filename>', methods=['DELETE'])
@login_required
def delete_file(filename):
    """删除文件"""
    try:
        user_folder = get_user_upload_folder(current_user.username)
        filepath = os.path.join(user_folder, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        
        os.remove(filepath)
        return jsonify({'success': True, 'message': '文件删除成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/file-info/<filename>', methods=['GET'])
@login_required
def file_info(filename):
    """获取文件详细信息"""
    try:
        user_folder = get_user_upload_folder(current_user.username)
        filepath = os.path.join(user_folder, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        
        stat = os.stat(filepath)
        file_info = {
            'name': filename,
            'size': stat.st_size,
            'size_human': format_size(stat.st_size),
            'modified': datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
            'type': mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        }
        return jsonify({'success': True, 'file': file_info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def format_size(size):
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"


# ========== 管理员API路由 ==========

@app.route('/admin')
@login_required
def admin():
    """管理后台页面"""
    if current_user.username != 'admin':
        return redirect(url_for('index'))
    return render_template('admin.html')


@app.route('/api/admin/users', methods=['GET'])
@login_required
@admin_required
def admin_get_users():
    """获取所有用户列表"""
    try:
        users = load_users()
        user_list = []
        
        for username, user_data in users.items():
            user_folder = get_user_upload_folder(username)
            file_count = 0
            total_size = 0
            
            if os.path.exists(user_folder):
                for filename in os.listdir(user_folder):
                    filepath = os.path.join(user_folder, filename)
                    if os.path.isfile(filepath):
                        file_count += 1
                        total_size += os.path.getsize(filepath)
            
            user_list.append({
                'username': username,
                'id': user_data['id'],
                'created_at': user_data.get('created_at', ''),
                'file_count': file_count,
                'total_size': total_size,
                'total_size_human': format_size(total_size)
            })
        
        return jsonify({'success': True, 'users': user_list})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/users/<username>', methods=['DELETE'])
@login_required
@admin_required
def admin_delete_user(username):
    """删除用户及其所有文件"""
    try:
        if username == 'admin':
            return jsonify({'success': False, 'error': '无法删除管理员账户'}), 400
        
        users = load_users()
        
        if username not in users:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        
        # 删除用户文件夹
        user_folder = get_user_upload_folder(username)
        if os.path.exists(user_folder):
            import shutil
            shutil.rmtree(user_folder)
        
        # 删除用户数据
        del users[username]
        save_users(users)
        
        return jsonify({'success': True, 'message': f'用户 {username} 已删除'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/files', methods=['GET'])
@login_required
@admin_required
def admin_get_all_files():
    """获取所有用户的文件列表"""
    try:
        users = load_users()
        all_files = []
        
        for username in users.keys():
            user_folder = get_user_upload_folder(username)
            
            if os.path.exists(user_folder):
                for filename in os.listdir(user_folder):
                    filepath = os.path.join(user_folder, filename)
                    if os.path.isfile(filepath):
                        stat = os.stat(filepath)
                        file_info = {
                            'username': username,
                            'name': filename,
                            'size': stat.st_size,
                            'size_human': format_size(stat.st_size),
                            'modified': datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                            'type': mimetypes.guess_type(filename)[0] or 'application/octet-stream'
                        }
                        all_files.append(file_info)
        
        # 按修改时间降序排序
        all_files.sort(key=lambda x: x['modified'], reverse=True)
        return jsonify({'success': True, 'files': all_files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/files/<username>/<filename>', methods=['DELETE'])
@login_required
@admin_required
def admin_delete_file(username, filename):
    """删除指定用户的文件"""
    try:
        users = load_users()
        
        if username not in users:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        
        user_folder = get_user_upload_folder(username)
        filepath = os.path.join(user_folder, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': '文件不存在'}), 404
        
        os.remove(filepath)
        return jsonify({'success': True, 'message': '文件删除成功'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/settings', methods=['GET'])
@login_required
@admin_required
def admin_get_settings():
    """获取系统设置"""
    try:
        settings = load_settings()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/settings', methods=['PUT'])
@login_required
@admin_required
def admin_update_settings():
    """更新系统设置"""
    try:
        data = request.get_json()
        settings = load_settings()
        
        # 更新设置
        for key in ['background_gradient', 'background_type', 'background_image', 'site_title']:
            if key in data:
                settings[key] = data[key]
        
        if save_settings(settings):
            return jsonify({'success': True, 'message': '设置已更新', 'settings': settings})
        else:
            return jsonify({'success': False, 'error': '保存设置失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("文件网盘服务器已启动")
    print("=" * 50)
    print(f"访问地址: http://localhost:5000")
    print(f"上传目录: {os.path.abspath(UPLOAD_FOLDER)}")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)