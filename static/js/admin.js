// API基础URL
const API_BASE = '/api';

// 全局变量
let users = [];
let allFiles = [];
let settings = {};
let currentConfirmCallback = null;

// DOM元素
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');
const notificationIcon = document.getElementById('notificationIcon');
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadFiles();
    loadSettings();
});

// 切换页面
function switchSection(section) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    
    // 更新内容显示
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    // 更新页面标题
    const titles = {
        'users': '用户管理',
        'files': '文件管理',
        'settings': '系统设置'
    };
    document.getElementById('pageTitle').textContent = titles[section];
}

// ========== 用户管理 ==========

// 加载用户列表
async function loadUsers() {
    try {
        showLoading('加载用户列表...');
        
        const response = await fetch(`${API_BASE}/admin/users`);
        const data = await response.json();

        if (data.success) {
            users = data.users;
            renderUsers();
            updateStats();
        } else {
            showNotification('加载用户列表失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('加载用户列表失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 渲染用户列表
function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                    </svg>
                    <p>暂无用户</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <span class="user-name">${user.username}</span>
                ${user.username === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}
            </td>
            <td>${user.created_at || '-'}</td>
            <td>${user.file_count}</td>
            <td>${user.total_size_human}</td>
            <td>
                <button class="btn btn-delete" 
                        onclick="deleteUser('${user.username}')" 
                        ${user.username === 'admin' ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    删除
                </button>
            </td>
        </tr>
    `).join('');
}

// 更新统计数据
function updateStats() {
    document.getElementById('totalUsers').textContent = users.length;
    
    let totalFiles = 0;
    let totalSize = 0;
    
    users.forEach(user => {
        totalFiles += user.file_count;
        totalSize += user.total_size;
    });
    
    document.getElementById('totalFiles').textContent = totalFiles;
    document.getElementById('totalStorage').textContent = formatSize(totalSize);
}

// 删除用户
function deleteUser(username) {
    if (username === 'admin') {
        showNotification('无法删除管理员账户', 'error');
        return;
    }
    
    showConfirmModal(
        '删除用户',
        `确定要删除用户 "${username}" 吗？此操作将同时删除该用户的所有文件，且不可恢复。`,
        async () => {
            try {
                showLoading('正在删除用户...');
                
                const response = await fetch(`${API_BASE}/admin/users/${username}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification(data.message, 'success');
                    await loadUsers();
                    await loadFiles();
                } else {
                    showNotification('删除失败: ' + data.error, 'error');
                }
            } catch (error) {
                showNotification('删除失败: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// ========== 文件管理 ==========

// 加载所有文件
async function loadFiles() {
    try {
        const response = await fetch(`${API_BASE}/admin/files`);
        const data = await response.json();

        if (data.success) {
            allFiles = data.files;
            renderFiles(allFiles);
        } else {
            showNotification('加载文件列表失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('加载文件列表失败: ' + error.message, 'error');
    }
}

// 渲染文件列表
function renderFiles(files) {
    const grid = document.getElementById('fileGrid');
    
    if (files.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13,2 13,9 20,9"/>
                </svg>
                <p>暂无文件</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = files.map(file => `
        <div class="file-card">
            <div class="file-card-header">
                <div class="file-icon">${getFileIcon(file.name, file.type)}</div>
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-owner">${file.username}</div>
                </div>
            </div>
            <div class="file-meta">
                <span>${file.size_human}</span>
                <span>${formatDate(file.modified)}</span>
            </div>
            <div class="file-actions">
                <button class="file-action-btn btn-delete" onclick="deleteFile('${file.username}', '${file.name}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    删除
                </button>
            </div>
        </div>
    `).join('');
}

// 搜索文件
function filterFiles() {
    const searchTerm = document.getElementById('fileSearchInput').value.toLowerCase();
    
    const filteredFiles = allFiles.filter(file => 
        file.name.toLowerCase().includes(searchTerm) ||
        file.username.toLowerCase().includes(searchTerm)
    );
    
    renderFiles(filteredFiles);
}

// 删除文件
function deleteFile(username, filename) {
    showConfirmModal(
        '删除文件',
        `确定要删除 "${filename}" 吗？此操作不可恢复。`,
        async () => {
            try {
                showLoading('正在删除文件...');
                
                const response = await fetch(`${API_BASE}/admin/files/${username}/${encodeURIComponent(filename)}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification(data.message, 'success');
                    await loadFiles();
                    await loadUsers();
                } else {
                    showNotification('删除失败: ' + data.error, 'error');
                }
            } catch (error) {
                showNotification('删除失败: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// ========== 系统设置 ==========

// 加载系统设置
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/admin/settings`);
        const data = await response.json();

        if (data.success) {
            settings = data.settings;
            renderSettings();
        } else {
            showNotification('加载设置失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('加载设置失败: ' + error.message, 'error');
    }
}

// 渲染设置
function renderSettings() {
    document.getElementById('siteTitle').value = settings.site_title || '文件网盘';
    document.getElementById('backgroundGradient').value = settings.background_gradient || '';
    
    // 设置背景类型
    const bgType = settings.background_type || 'gradient';
    document.querySelector(`input[name="backgroundType"][value="${bgType}"]`).checked = true;
    
    // 显示/隐藏相应的设置项
    handleBackgroundTypeChange();
    
    // 如果有背景图片，显示预览
    if (settings.background_image) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${settings.background_image}" alt="背景预览">`;
        preview.classList.add('has-image');
    }
}

// 保存系统设置
async function saveSettings() {
    try {
        showLoading('正在保存设置...');
        
        const newSettings = {
            site_title: document.getElementById('siteTitle').value || '文件网盘',
            background_type: document.querySelector('input[name="backgroundType"]:checked').value,
            background_gradient: document.getElementById('backgroundGradient').value || '',
            background_image: settings.background_image || ''
        };
        
        const response = await fetch(`${API_BASE}/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newSettings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            settings = data.settings;
            showNotification('设置已保存', 'success');
        } else {
            showNotification('保存设置失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('保存设置失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 处理背景类型变化
function handleBackgroundTypeChange() {
    const bgType = document.querySelector('input[name="backgroundType"]:checked').value;
    
    if (bgType === 'gradient') {
        document.getElementById('gradientSetting').style.display = 'block';
        document.getElementById('imageSetting').style.display = 'none';
    } else {
        document.getElementById('gradientSetting').style.display = 'none';
        document.getElementById('imageSetting').style.display = 'block';
    }
}

// 处理图片选择
function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showNotification('请选择图片文件', 'error');
        return;
    }
    
    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
        showNotification('图片大小不能超过5MB', 'error');
        return;
    }
    
    // 读取文件并转换为base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${e.target.result}" alt="背景预览">`;
        preview.classList.add('has-image');
        
        // 保存到设置中
        settings.background_image = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 预览背景
function previewBackground() {
    const gradient = document.getElementById('backgroundGradient').value;
    
    if (!gradient) {
        showNotification('请先输入渐变背景值', 'warning');
        return;
    }
    
    // 临时应用到body
    const originalBackground = document.body.style.background;
    document.body.style.background = gradient;
    
    showNotification('背景已预览，点击"保存设置"以应用', 'success');
    
    // 5秒后恢复原背景
    setTimeout(() => {
        document.body.style.background = originalBackground;
    }, 5000);
}

// ========== 工具函数 ==========

// 获取文件图标
function getFileIcon(filename, fileType) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
        // 图片
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️', 'webp': '🖼️', 'bmp': '🖼️',
        // 文档
        'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄', 'md': '📄',
        // 表格
        'xls': '📊', 'xlsx': '📊', 'csv': '📊',
        // 演示文稿
        'ppt': '📽️', 'pptx': '📽️',
        // 压缩文件
        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
        // 音频
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'ogg': '🎵',
        // 视频
        'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', 'wmv': '🎬',
        // 代码
        'js': '💻', 'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'css': '🎨', 'html': '🌐',
        'json': '📋', 'xml': '📋', 'sql': '🗃️', 'php': '🐘',
        // 其他
        'exe': '⚙️', 'apk': '📱', 'iso': '💿', 'dmg': '💿'
    };

    return iconMap[ext] || '📁';
}

// 格式化文件大小
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }
    
    // 小于1小时
    if (diff < 3600000) {
        return Math.floor(diff / 60000) + '分钟前';
    }
    
    // 小于24小时
    if (diff < 86400000) {
        return Math.floor(diff / 3600000) + '小时前';
    }
    
    // 小于7天
    if (diff < 604800000) {
        return Math.floor(diff / 86400000) + '天前';
    }
    
    // 格式化为 YYYY-MM-DD
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 显示加载遮罩
function showLoading(text = '加载中...') {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

// 隐藏加载遮罩
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// 显示通知
function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;
    notification.className = `notification ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    notificationIcon.textContent = icons[type] || 'ℹ️';
    notification.classList.add('show');

    // 3秒后自动隐藏
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 显示确认对话框
function showConfirmModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    currentConfirmCallback = onConfirm;
    
    // 移除之前的事件监听器
    modalConfirmBtn.replaceWith(modalConfirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById('modalConfirmBtn');
    
    newConfirmBtn.addEventListener('click', () => {
        if (currentConfirmCallback) {
            currentConfirmCallback();
        }
        closeModal();
    });
    
    confirmModal.classList.add('active');
}

// 关闭确认对话框
function closeModal() {
    confirmModal.classList.remove('active');
    currentConfirmCallback = null;
}

// 点击遮罩关闭模态框
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        closeModal();
    }
});