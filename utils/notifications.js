// نظام الإشعارات المتقدم

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.defaultDuration = 5000; // 5 ثواني
        this.maxNotifications = 5;
        this.position = 'top-right'; // top-left, top-right, bottom-left, bottom-right
        this.init();
    }

    // تهيئة النظام
    init() {
        // إنشاء حاوية الإشعارات
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.id = 'notificationSystem';
        this.updateContainerPosition();
        
        document.body.appendChild(this.container);
        
        // إضافة الأنماط
        this.addStyles();
    }

    // إضافة الأنماط
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: fixed;
                z-index: 99999;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }
            
            .notification-container.top-right {
                top: 20px;
                left: 20px;
                right: auto;
                align-items: flex-start;
            }
            
            .notification-container.top-left {
                top: 20px;
                right: 20px;
                left: auto;
                align-items: flex-end;
            }
            
            .notification-container.bottom-right {
                bottom: 20px;
                left: 20px;
                right: auto;
                align-items: flex-start;
            }
            
            .notification-container.bottom-left {
                bottom: 20px;
                right: 20px;
                left: auto;
                align-items: flex-end;
            }
            
            .notification {
                background: white;
                border-radius: 10px;
                padding: 15px 20px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                pointer-events: auto;
                animation: slideIn 0.3s ease;
                max-width: 350px;
                border-right: 4px solid;
                position: relative;
                overflow: hidden;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
            
            .notification.success {
                border-right-color: #2ea043;
                background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%);
            }
            
            .notification.error {
                border-right-color: #ff6b6b;
                background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
            }
            
            .notification.warning {
                border-right-color: #ffa500;
                background: linear-gradient(135deg, #fff9e6 0%, #ffffff 100%);
            }
            
            .notification.info {
                border-right-color: #1a5fb4;
                background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%);
            }
            
            .notification-icon {
                font-size: 20px;
                width: 24px;
                text-align: center;
            }
            
            .notification.success .notification-icon {
                color: #2ea043;
            }
            
            .notification.error .notification-icon {
                color: #ff6b6b;
            }
            
            .notification.warning .notification-icon {
                color: #ffa500;
            }
            
            .notification.info .notification-icon {
                color: #1a5fb4;
            }
            
            .notification-content {
                flex: 1;
                min-width: 0;
            }
            
            .notification-title {
                font-weight: 700;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
            }
            
            .notification-message {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .notification-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #666;
            }
            
            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            
            .notification-progress-bar {
                height: 100%;
                animation: progressBar linear forwards;
            }
            
            .notification.success .notification-progress-bar {
                background: #2ea043;
            }
            
            .notification.error .notification-progress-bar {
                background: #ff6b6b;
            }
            
            .notification.warning .notification-progress-bar {
                background: #ffa500;
            }
            
            .notification.info .notification-progress-bar {
                background: #1a5fb4;
            }
            
            @keyframes progressBar {
                from { width: 100%; }
                to { width: 0%; }
            }
            
            @media (max-width: 768px) {
                .notification-container {
                    left: 10px !important;
                    right: 10px !important;
                    max-width: none;
                }
                
                .notification {
                    max-width: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // تحديث موضع الحاوية
    updateContainerPosition() {
        if (!this.container) return;
        
        this.container.className = `notification-container ${this.position}`;
    }

    // عرض إشعار
    show(message, type = 'info', options = {}) {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const {
            title = this.getDefaultTitle(type),
            duration = this.defaultDuration,
            icon = this.getIcon(type),
            onClose = null,
            persistent = false,
            action = null
        } = options;

        // التحكم في العدد الأقصى
        if (this.notifications.size >= this.maxNotifications) {
            const oldestId = Array.from(this.notifications.keys())[0];
            this.remove(oldestId);
        }

        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.id = id;
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="window.notificationSystem.remove('${id}')">
                <i class="fas fa-times"></i>
            </button>
            ${!persistent ? `
                <div class="notification-progress">
                    <div class="notification-progress-bar" style="animation-duration: ${duration}ms"></div>
                </div>
            ` : ''}
        `;

        // إضافة زر الإجراء إذا وجد
        if (action) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'notification-action';
            actionBtn.innerHTML = `<i class="fas ${action.icon || 'fa-external-link-alt'}"></i>`;
            actionBtn.title = action.text || 'تنفيذ';
            actionBtn.onclick = action.handler;
            
            notification.querySelector('.notification-content').appendChild(actionBtn);
        }

        // إضافة إلى الحاوية
        this.container.appendChild(notification);
        
        // حفظ المرجع
        this.notifications.set(id, {
            element: notification,
            timeout: !persistent ? setTimeout(() => this.remove(id), duration) : null,
            onClose: onClose
        });

        // إرجاع المعرف للإدارة
        return id;
    }

    // إشعار النجاح
    success(message, options = {}) {
        return this.show(message, 'success', {
            title: 'نجاح',
            icon: 'fa-check-circle',
            ...options
        });
    }

    // إشعار الخطأ
    error(message, options = {}) {
        return this.show(message, 'error', {
            title: 'خطأ',
            icon: 'fa-exclamation-circle',
            ...options
        });
    }

    // إشعار التحذير
    warning(message, options = {}) {
        return this.show(message, 'warning', {
            title: 'تحذير',
            icon: 'fa-exclamation-triangle',
            ...options
        });
    }

    // إشعار معلومات
    info(message, options = {}) {
        return this.show(message, 'info', {
            title: 'معلومة',
            icon: 'fa-info-circle',
            ...options
        });
    }

    // إزالة إشعار
    remove(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // إضافة تأثير الخروج
        notification.element.style.animation = 'slideOut 0.3s ease forwards';
        
        // تنفيذ callback الإغلاق
        if (notification.onClose) {
            notification.onClose();
        }
        
        // إزالة بعد انتهاء العرض
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
        
        // إلغاء المؤقت
        if (notification.timeout) {
            clearTimeout(notification.timeout);
        }
    }

    // إزالة جميع الإشعارات
    clearAll() {
        this.notifications.forEach((_, id) => this.remove(id));
    }

    // تحديث إشعار موجود
    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const { message, type, title, icon } = updates;
        
        if (message) {
            const messageEl = notification.element.querySelector('.notification-message');
            if (messageEl) messageEl.textContent = message;
        }
        
        if (title) {
            const titleEl = notification.element.querySelector('.notification-title');
            if (titleEl) titleEl.textContent = title;
        }
        
        if (type || icon) {
            const newType = type || notification.element.className.split(' ')[1];
            const newIcon = icon || this.getIcon(newType);
            
            // تحديث الفئة
            notification.element.className = `notification ${newType}`;
            
            // تحديث الأيقونة
            const iconEl = notification.element.querySelector('.notification-icon i');
            if (iconEl) iconEl.className = `fas ${newIcon}`;
        }
    }

    // الحصول على العنوان الافتراضي
    getDefaultTitle(type) {
        const titles = {
            success: 'نجاح',
            error: 'خطأ',
            warning: 'تحذير',
            info: 'معلومة'
        };
        return titles[type] || 'إشعار';
    }

    // الحصول على الأيقونة الافتراضية
    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-bell';
    }

    // تغيير موضع الإشعارات
    setPosition(position) {
        const validPositions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
        if (validPositions.includes(position)) {
            this.position = position;
            this.updateContainerPosition();
        }
    }

    // تغيير المدة الافتراضية
    setDefaultDuration(duration) {
        this.defaultDuration = duration;
    }

    // تغيير العدد الأقصى
    setMaxNotifications(max) {
        this.maxNotifications = max;
    }

    // التحقق من وجود إشعار
    hasNotification(id) {
        return this.notifications.has(id);
    }

    // جلب جميع الإشعارات النشطة
    getAllNotifications() {
        return Array.from(this.notifications.entries()).map(([id, data]) => ({
            id,
            type: data.element.className.split(' ')[1],
            message: data.element.querySelector('.notification-message')?.textContent,
            title: data.element.querySelector('.notification-title')?.textContent
        }));
    }

    // إشعار التحميل
    showLoading(message = 'جاري التحميل...', id = 'loading_notification') {
        return this.show(message, 'info', {
            title: 'جاري المعالجة',
            icon: 'fa-spinner fa-spin',
            persistent: true,
            id: id
        });
    }

    // إخفاء إشعار التحميل
    hideLoading(id = 'loading_notification') {
        if (this.hasNotification(id)) {
            this.remove(id);
        }
    }

    // إشعار التأكيد
    confirm(message, onConfirm, onCancel = null) {
        const confirmId = this.show(message, 'warning', {
            title: 'تأكيد الإجراء',
            persistent: true,
            action: {
                text: 'تأكيد',
                icon: 'fa-check',
                handler: () => {
                    onConfirm();
                    this.remove(confirmId);
                }
            }
        });

        // إضافة زر الإلغاء
        const notification = this.notifications.get(confirmId);
        if (notification && onCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'notification-action';
            cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
            cancelBtn.title = 'إلغاء';
            cancelBtn.onclick = () => {
                onCancel();
                this.remove(confirmId);
            };
            
            notification.element.querySelector('.notification-content').appendChild(cancelBtn);
        }

        return confirmId;
    }

    // إشعار مع زر الإجراء
    withAction(message, actionText, actionHandler, type = 'info') {
        return this.show(message, type, {
            action: {
                text: actionText,
                icon: 'fa-external-link-alt',
                handler: actionHandler
            }
        });
    }
}

// إنشاء نسخة وحيدة من النظام
const notificationSystem = new NotificationSystem();

// تعريض للاستخدام العالمي
window.notificationSystem = notificationSystem;

// دوال مختصرة للاستخدام
export function showNotification(message, type = 'info', options = {}) {
    return notificationSystem.show(message, type, options);
}

export function showSuccess(message, options = {}) {
    return notificationSystem.success(message, options);
}

export function showError(message, options = {}) {
    return notificationSystem.error(message, options);
}

export function showWarning(message, options = {}) {
    return notificationSystem.warning(message, options);
}

export function showInfo(message, options = {}) {
    return notificationSystem.info(message, options);
}

export function showLoading(message, id) {
    return notificationSystem.showLoading(message, id);
}

export function hideLoading(id) {
    return notificationSystem.hideLoading(id);
}

export function showConfirm(message, onConfirm, onCancel) {
    return notificationSystem.confirm(message, onConfirm, onCancel);
}

// تصدير النظام الكامل
export default notificationSystem;
