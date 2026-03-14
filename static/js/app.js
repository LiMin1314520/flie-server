// API基础URL
const API_BASE = '/api';

// 全局变量
let files = [];
let isLoggedIn = false;
let currentUsername = '';

// DOM元素
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');
const notificationIcon = document.getElementById('notificationIcon');
const fileCount = document.getElementById('fileCount');
const userInfo = document.getElementById('userInfo');
const usernameDisplay = document.getElementById('username');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    initUploadZone();
    loadFiles();
});

// 初始化上传区域
function initUploadZone() {
    // 拖拽事件
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.remove('dragover');
        }, false);
    });

    // 处理文件拖放
    uploadZone.addEventListener('drop', handleDrop, false);

    // 文件选择
    fileInput.addEventListener('change', handleFileSelect, false);
}

// 处理文件拖放
function handleDrop(e) {
    const dt = e.dataTransfer;
    const fileList = dt.files;
    handleFiles(fileList);
}

// 处理文件选择
function handleFileSelect(e) {
    const fileList = e.target.files;
    handleFiles(fileList);
    // 清空input，允许重复选择同一文件
    fileInput.value = '';
}

// 处理文件上传
function handleFiles(fileList) {
    if (fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    
    showLoading('正在上传文件...');
    
    let uploadCount = 0;
    let errorCount = 0;

    filesArray.forEach(file => {
        uploadFile(file).then(result => {
            if (result.success) {
                uploadCount++;
                showNotification(`"${file.name}" 上传成功`, 'success');
            } else {
                errorCount++;
                showNotification(`"${file.name}" 上传失败: ${result.error}`, 'error');
            }

            // 所有文件处理完成后刷新列表
            if (uploadCount + errorCount === filesArray.length) {
                hideLoading();
                setTimeout(() => {
                    loadFiles();
                }, 500);
            }
        }).catch(err => {
            errorCount++;
            showNotification(`"${file.name}" 上传失败: ${err.message}`, 'error');
            
            if (uploadCount + errorCount === filesArray.length) {
                hideLoading();
                setTimeout(() => {
                    loadFiles();
                }, 500);
            }
        });
    });
}

// 上传单个文件
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 加载文件列表
async function loadFiles() {
    try {
        showLoading('加载文件列表...');
        
        const response = await fetch(`${API_BASE}/files`);
        const data = await response.json();

        if (data.success) {
            files = data.files;
            renderFiles();
        } else {
            showNotification('加载文件列表失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('加载文件列表失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 渲染文件列表
function renderFiles() {
    // 更新文件计数
    fileCount.textContent = files.length;

    if (files.length === 0) {
        filesContainer.innerHTML = '';
        filesContainer.appendChild(emptyState);
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    const fileGrid = document.createElement('div');
    fileGrid.className = 'file-grid';

    files.forEach(file => {
        const fileCard = createFileCard(file);
        fileGrid.appendChild(fileCard);
    });

    filesContainer.innerHTML = '';
    filesContainer.appendChild(fileGrid);
}

// 创建文件卡片
function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';

    const icon = getFileIcon(file.name, file.type);
    
    card.innerHTML = `
        <div class="file-icon">${icon}</div>
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-info">
            <span>${formatFileSize(file.size)}</span>
            <span>${formatDate(file.modified)}</span>
        </div>
        <div class="file-actions">
            <button class="file-action-btn btn-download" onclick="downloadFile('${file.name}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                下载
            </button>
            <button class="file-action-btn btn-delete" onclick="deleteFile('${file.name}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除
            </button>
        </div>
    `;

    return card;
}

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

// 下载文件
function downloadFile(filename) {
    showLoading('正在准备下载...');
    
    const downloadUrl = `${API_BASE}/download/${encodeURIComponent(filename)}`;
    
    // 创建隐藏的a标签来触发下载
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    hideLoading();
    showNotification(`"${filename}" 下载已开始`, 'success');
}

// 删除文件
async function deleteFile(filename) {
    if (!confirm(`确定要删除 "${filename}" 吗？此操作不可恢复。`)) {
        return;
    }

    showLoading('正在删除文件...');

    try {
        const response = await fetch(`${API_BASE}/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`"${filename}" 删除成功`, 'success');
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

// 刷新文件列表
function refreshFiles() {
    loadFiles();
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

// 格式化文件大小
function formatFileSize(bytes) {
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

// 检查登录状态
async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE}/check-login`);
        const data = await response.json();

        if (data.success) {
            isLoggedIn = data.logged_in;
            currentUsername = data.username || '';
            
            if (isLoggedIn) {
                userInfo.style.display = 'flex';
                usernameDisplay.textContent = currentUsername;
            } else {
                userInfo.style.display = 'none';
                window.location.href = '/login';
            }
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
        window.location.href = '/login';
    }
}

// 登出
async function logout() {
    if (!confirm('确定要登出吗?')) {
        return;
    }

    showLoading('正在登出...');

    try {
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('登出成功', 'success');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } else {
            showNotification('登出失败: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('登出失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}