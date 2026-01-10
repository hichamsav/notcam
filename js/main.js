// التطبيق الرئيسي
class NoteCamApp {
    constructor() {
        this.currentView = null;
        this.isInitialized = false;
        this.systemStatus = {
            supabase: false,
            camera: false,
            sync: false,
            storage: true
        };
    }
    
    // تهيئة التطبيق
    async initialize() {
        try {
            console.log('Initialisation de l\'application NoteCam...');
            
            // إخفاء شاشة التحميل
            this.hideLoadingScreen();
            
            // التحقق من دعم المتصفح
            if (!this.checkBrowserSupport()) {
                this.showBrowserError();
                return false;
            }
            
            // تهيئة Supabase
            await this.initializeSupabase();
            
            // تهيئة نظام المصادقة
            await this.initializeAuth();
            
            // تهيئة نظام المزامنة
            await this.initializeSync();
            
            // إعداد مستمعات الأحداث
            this.setupEventListeners();
            
            // التحقق من المستخدم المسجل
            await this.checkLoggedInUser();
            
            // بدء المزامنة الدورية
            this.startBackgroundSync();
            
            this.isInitialized = true;
            console.log('Application NoteCam initialisée avec succès');
            
            // تحديث حالة النظام
            this.updateSystemStatus();
            
            return true;
            
        } catch (error) {
            console.error('Erreur initialisation application:', error);
            this.showError('Erreur d\'initialisation de l\'application');
            return false;
        }
    }
    
    // إخفاء شاشة التحميل
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        const app = document.getElementById('app');
        if (app) {
            app.style.display = 'block';
        }
    }
    
    // التحقق من دعم المتصفح
    checkBrowserSupport() {
        const requiredFeatures = [
            'localStorage',
            'sessionStorage',
            'indexedDB',
            'Promise',
            'fetch',
            'URL',
            'Blob',
            'FileReader',
            'canvas',
            'MediaDevices'
        ];
        
        const missingFeatures = [];
        
        requiredFeatures.forEach(feature => {
            if (!window[feature]) {
                missingFeatures.push(feature);
            }
        });
        
        if (missingFeatures.length > 0) {
            console.error('Fonctionnalités manquantes:', missingFeatures);
            return false;
        }
        
        return true;
    }
    
    // عرض خطأ المتصفح
    showBrowserError() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="browser-error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2>Navigateur Non Supporté</h2>
                <p>Votre navigateur ne supporte pas toutes les fonctionnalités requises.</p>
                <p>Veuillez utiliser une version récente de :</p>
                <div class="browser-list">
                    <div class="browser-item">
                        <i class="fab fa-chrome"></i>
                        <span>Google Chrome</span>
                    </div>
                    <div class="browser-item">
                        <i class="fab fa-firefox"></i>
                        <span>Mozilla Firefox</span>
                    </div>
                    <div class="browser-item">
                        <i class="fab fa-safari"></i>
                        <span>Safari</span>
                    </div>
                </div>
                <button class="retry-btn" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Réessayer
                </button>
            </div>
        `;
    }
    
    // تهيئة Supabase
    async initializeSupabase() {
        try {
            if (!Config.SUPABASE_URL || !Config.SUPABASE_ANON_KEY) {
                throw new Error('Clés Supabase non configurées');
            }
            
            await window.supabaseClient.initialize();
            this.systemStatus.supabase = window.supabaseClient.isInitialized;
            
            if (this.systemStatus.supabase) {
                console.log('Supabase initialisé avec succès');
                showNotification('Connecté à Supabase', 'success');
            } else {
                console.warn('Supabase en mode hors ligne');
                showNotification('Mode hors ligne activé', 'warning');
            }
            
        } catch (error) {
            console.error('Erreur initialisation Supabase:', error);
            this.systemStatus.supabase = false;
            showNotification('Erreur connexion Supabase', 'error');
        }
    }
    
    // تهيئة المصادقة
    async initializeAuth() {
        try {
            // تحميل الجلسة الحالية
            const user = window.Auth.checkSession();
            
            if (user) {
                console.log('Session utilisateur restaurée:', user.username);
            }
            
        } catch (error) {
            console.error('Erreur initialisation auth:', error);
        }
    }
    
    // تهيئة المزامنة
    async initializeSync() {
        try {
            window.syncManager.initialize();
            this.systemStatus.sync = true;
            
        } catch (error) {
            console.error('Erreur initialisation sync:', error);
            this.systemStatus.sync = false;
        }
    }
    
    // التحقق من المستخدم المسجل
    async checkLoggedInUser() {
        const user = window.Auth.checkSession();
        
        if (user) {
            // تحميل الواجهة المناسبة
            await this.loadUserInterface(user);
        } else {
            // عرض شاشة تسجيل الدخول
            this.showLoginScreen();
        }
    }
    
    // تحميل واجهة المستخدم
    async loadUserInterface(user) {
        try {
            if (user.role === 'admin') {
                // تهيئة لوحة المشرف
                await window.adminPanel.initialize();
                this.currentView = 'admin';
            } else {
                // تهيئة لوحة الموظف
                await window.employeePanel.initialize(user);
                this.currentView = 'employee';
            }
            
        } catch (error) {
            console.error('Erreur chargement interface:', error);
            this.showError('Erreur de chargement de l\'interface');
            window.Auth.logout();
            this.showLoginScreen();
        }
    }
    
    // عرض شاشة تسجيل الدخول
    showLoginScreen() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="app-container">
                <div class="status-bar">
                    <div>${Config.APP_NAME} • Version ${Config.VERSION}</div>
                    <div class="sync-status" id="loginSyncStatus">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Connexion requise</span>
                    </div>
                </div>
                
                <div class="login-container">
                    <div class="login-header">
                        <div class="login-logo">
                            <i class="fas fa-camera"></i>
                            <h1>${Config.APP_NAME}</h1>
                        </div>
                        <p class="login-subtitle">Système de Gestion des Rapports de Terrain</p>
                    </div>
                    
                    <div class="login-form">
                        <div class="input-group">
                            <i class="fas fa-user"></i>
                            <input type="text" id="loginUsername" 
                                   placeholder="Nom d'utilisateur" 
                                   autocomplete="username">
                        </div>
                        
                        <div class="input-group">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="loginPassword" 
                                   placeholder="Mot de passe" 
                                   autocomplete="current-password">
                        </div>
                        
                        <div class="login-options">
                            <label class="checkbox">
                                <input type="checkbox" id="rememberMe">
                                <span>Se souvenir de moi</span>
                            </label>
                        </div>
                        
                        <button class="login-btn" onclick="noteCamApp.login()">
                            <i class="fas fa-sign-in-alt"></i> Se connecter
                        </button>
                        
                        <div class="system-status" id="systemStatus">
                            <div class="status-item">
                                <i class="fas fa-database"></i>
                                <span>Supabase: <span id="supabaseStatus">Connexion...</span></span>
                            </div>
                            <div class="status-item">
                                <i class="fas fa-sync"></i>
                                <span>Sync: <span id="syncStatus">Initialisation...</span></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="login-footer">
                        <p>Version ${Config.VERSION} • © ${new Date().getFullYear()} ${Config.APP_NAME}</p>
                        <p class="support-info">
                            <i class="fas fa-life-ring"></i>
                            Support technique: support@notecam.com
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        this.currentView = 'login';
        this.updateSystemStatus();
        
        // إضافة مستمع لإدخال Enter
        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
    }
    
    // تسجيل الدخول
    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            showNotification('Veuillez saisir le nom d\'utilisateur et le mot de passe', 'warning');
            return;
        }
        
        // عرض مؤشر التحميل
        const loginBtn = document.querySelector('.login-btn');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        loginBtn.disabled = true;
        
        try {
            const result = await window.Auth.login(username, password);
            
            if (result.success) {
                showNotification(`Bienvenue ${result.user.name}`, 'success');
                
                // تحميل الواجهة المناسبة
                await this.loadUserInterface(result.user);
                
            } else {
                showNotification(result.message, 'error');
            }
            
        } catch (error) {
            console.error('Erreur connexion:', error);
            showNotification('Erreur système lors de la connexion', 'error');
            
        } finally {
            // إعادة تعيين الزر
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }
    
    // تسجيل الخروج
    async logout() {
        try {
            // تسجيل الخروج من النظام
            window.Auth.logout();
            
            // إغلاق الكاميرا إذا كانت مفتوحة
            if (window.cameraManager) {
                window.cameraManager.cleanup();
            }
            
            // عرض شاشة تسجيل الدخول
            this.showLoginScreen();
            
            showNotification('Déconnexion réussie', 'success');
            
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            showNotification('Erreur lors de la déconnexion', 'error');
        }
    }
    
    // إعداد مستمعات الأحداث
    setupEventListeners() {
        // تغيير المسار (Hash)
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        
        // اتصال/انفصال الإنترنت
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });
        
        // حدث الرؤية (تبويب الصفحة)
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // حدث التخزين (من نافذة أخرى)
        window.addEventListener('storage', (e) => {
            this.handleStorageEvent(e);
        });
    }
    
    // معالجة تغيير المسار
    handleRouteChange() {
        const hash = window.location.hash.substring(1);
        
        if (!Auth.currentUser) return;
        
        switch (hash) {
            case 'reports':
                if (Auth.currentUser.role === 'admin') {
                    window.reportsManager.showReportsPanel();
                    this.currentView = 'reports';
                }
                break;
                
            case 'admin':
                if (Auth.currentUser.role === 'admin') {
                    window.adminPanel.renderDashboard();
                    this.currentView = 'admin';
                }
                break;
                
            case 'employee':
                if (Auth.currentUser.role === 'employee') {
                    window.employeePanel.renderDashboard();
                    this.currentView = 'employee';
                }
                break;
                
            default:
                // العودة للوحة المناسبة
                if (Auth.currentUser.role === 'admin') {
                    window.location.hash = '#admin';
                } else {
                    window.location.hash = '#employee';
                }
        }
    }
    
    // معالجة حالة الاتصال بالإنترنت
    handleOnlineStatus(isOnline) {
        if (isOnline) {
            showNotification('Connexion Internet rétablie', 'success');
            
            // بدء المزامنة
            if (window.syncManager && !window.syncManager.isSyncing) {
                window.syncManager.syncAllData();
            }
            
        } else {
            showNotification('Mode hors ligne', 'warning');
        }
        
        // تحديث حالة النظام
        this.updateSystemStatus();
    }
    
    // معالجة تغيير الرؤية
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // الصفحة مرئية - تحديث البيانات
            if (Auth.currentUser && !window.syncManager.isSyncing && navigator.onLine) {
                window.syncManager.syncAllData();
            }
        }
    }
    
    // معالجة حدث التخزين
    handleStorageEvent(event) {
        // تحديث البيانات إذا تم تغييرها من نافذة أخرى
        if (event.key === Config.LOCAL_STORAGE_KEYS.REPORTS && Auth.currentUser) {
            if (Auth.currentUser.role === 'admin') {
                window.adminPanel?.updateReportsList();
            } else {
                window.employeePanel?.updateEmployeeReportsList();
            }
        }
    }
    
    // بدء المزامنة الخلفية
    startBackgroundSync() {
        // المزامنة كل 5 دقائق
        setInterval(() => {
            if (Auth.currentUser && !window.syncManager.isSyncing && navigator.onLine) {
                window.syncManager.syncAllData();
            }
        }, 5 * 60 * 1000); // 5 دقائق
    }
    
    // تحديث حالة النظام
    updateSystemStatus() {
        // تحديث شاشة تسجيل الدخول
        if (this.currentView === 'login') {
            const supabaseStatus = document.getElementById('supabaseStatus');
            const syncStatus = document.getElementById('syncStatus');
            
            if (supabaseStatus) {
                supabaseStatus.textContent = this.systemStatus.supabase ? 
                    'Connecté' : 'Hors ligne';
                supabaseStatus.className = this.systemStatus.supabase ? 
                    'status-online' : 'status-offline';
            }
            
            if (syncStatus) {
                syncStatus.textContent = this.systemStatus.sync ? 
                    'Actif' : 'Inactif';
                syncStatus.className = this.systemStatus.sync ? 
                    'status-online' : 'status-offline';
            }
        }
    }
    
    // عرض خطأ
    showError(message) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.style.background = '#ff6b6b';
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }
    
    // الحصول على حالة النظام
    getSystemStatus() {
        return {
            ...this.systemStatus,
            initialized: this.isInitialized,
            currentView: this.currentView,
            loggedIn: !!Auth.currentUser,
            userRole: Auth.currentUser?.role,
            online: navigator.onLine,
            storage: this.checkStorage(),
            camera: window.cameraManager?.hasPermission || false
        };
    }
    
    // التحقق من مساحة التخزين
    checkStorage() {
        try {
            const testKey = 'notecam_storage_test';
            const testValue = 'test'.repeat(1000); // 4KB
            localStorage.setItem(testKey, testValue);
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.error('Erreur stockage:', error);
            return false;
        }
    }
    
    // تصدير بيانات النظام
    exportSystemData() {
        const exportData = {
            app: {
                name: Config.APP_NAME,
                version: Config.VERSION,
                status: this.getSystemStatus()
            },
            user: Auth.currentUser,
            sync: window.syncManager?.getSyncStatus(),
            reports: window.reportsManager?.stats,
            exportDate: new Date().toISOString()
        };
        
        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Diagnostic_NoteCam_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Données système exportées', 'success');
    }
    
    // إعادة تعيين النظام
    resetSystem() {
        if (!confirm('Voulez-vous vraiment réinitialiser le système ? Toutes les données locales seront perdues.')) {
            return;
        }
        
        try {
            // إعادة تعيين جميع المكونات
            localStorage.clear();
            sessionStorage.clear();
            
            // إعادة تعيين المصادقة
            window.Auth.currentUser = null;
            window.Auth.isAuthenticated = false;
            
            // إعادة تعيين المزامنة
            if (window.syncManager) {
                window.syncManager.resetSync();
            }
            
            // إعادة تعيين الكاميرا
            if (window.cameraManager) {
                window.cameraManager.cleanup();
            }
            
            // إعادة تحميل الصفحة
            location.reload();
            
        } catch (error) {
            console.error('Erreur réinitialisation système:', error);
            showNotification('Erreur lors de la réinitialisation', 'error');
        }
    }
    
    // فحص النظام
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            system: this.getSystemStatus(),
            browser: this.getBrowserInfo(),
            storage: this.getStorageInfo(),
            supabase: await this.testSupabaseConnection(),
            camera: await this.testCamera(),
            sync: window.syncManager?.getSyncStatus()
        };
        
        return diagnostics;
    }
    
    // الحصول على معلومات المتصفح
    getBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            online: navigator.onLine,
            screen: {
                width: window.screen.width,
                height: window.screen.height,
                colorDepth: window.screen.colorDepth
            },
            window: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }
    
    // الحصول على معلومات التخزين
    getStorageInfo() {
        let total = 0;
        let used = 0;
        
        try {
            // تقدير حجم التخزين المحلي
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                used += (key.length + value.length) * 2; // تقدير بالبايت
            }
            
            // الحد الأقصى هو عادة 5-10MB
            total = 5 * 1024 * 1024; // 5MB
            
        } catch (error) {
            console.error('Erreur calcul stockage:', error);
        }
        
        return {
            usedBytes: used,
            totalBytes: total,
            percentage: total > 0 ? Math.round((used / total) * 100) : 0,
            items: localStorage.length
        };
    }
    
    // اختبار اتصال Supabase
    async testSupabaseConnection() {
        try {
            if (!window.supabaseClient) {
                return { connected: false, error: 'Client non initialisé' };
            }
            
            const startTime = Date.now();
            const result = await window.supabaseClient.testConnection();
            const duration = Date.now() - startTime;
            
            return {
                connected: true,
                duration: duration,
                result: result
            };
            
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                duration: 0
            };
        }
    }
    
    // اختبار الكاميرا
    async testCamera() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');
            
            // اختبار الإذن
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            
            return {
                available: true,
                count: cameras.length,
                permission: true,
                devices: cameras.map(cam => ({
                    label: cam.label,
                    deviceId: cam.deviceId
                }))
            };
            
        } catch (error) {
            return {
                available: false,
                count: 0,
                permission: false,
                error: error.message
            };
        }
    }
}

// إنشاء وتصدير نسخة واحدة
const noteCamApp = new NoteCamApp();
window.noteCamApp = noteCamApp;

// إضافة أنماط إضافية للتطبيق
const appStyles = document.createElement('style');
appStyles.textContent = `
    .browser-error {
        max-width: 600px;
        margin: 50px auto;
        padding: 40px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        text-align: center;
    }
    
    .error-icon {
        font-size: 64px;
        color: #ff6b6b;
        margin-bottom: 20px;
    }
    
    .browser-error h2 {
        color: #1a5fb4;
        margin-bottom: 15px;
    }
    
    .browser-error p {
        color: #666;
        margin-bottom: 10px;
        line-height: 1.6;
    }
    
    .browser-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin: 30px 0;
    }
    
    .browser-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 10px;
        border-left: 4px solid #1a5fb4;
    }
    
    .browser-item i {
        font-size: 24px;
        width: 40px;
        text-align: center;
    }
    
    .browser-item:nth-child(1) i { color: #4285f4; }
    .browser-item:nth-child(2) i { color: #ff7139; }
    .browser-item:nth-child(3) i { color: #000000; }
    
    .retry-btn {
        padding: 12px 30px;
        background: #1a5fb4;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 20px auto 0;
        transition: all 0.3s ease;
    }
    
    .retry-btn:hover {
        background: #154a8a;
        transform: translateY(-2px);
    }
    
    .login-header {
        text-align: center;
        margin-bottom: 30px;
    }
    
    .login-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        margin-bottom: 10px;
    }
    
    .login-logo i {
        font-size: 36px;
        color: #1a5fb4;
    }
    
    .login-logo h1 {
        color: #1a5fb4;
        font-size: 28px;
        margin: 0;
    }
    
    .login-subtitle {
        color: #666;
        font-size: 14px;
        margin: 0;
    }
    
    .input-group {
        position: relative;
        margin-bottom: 20px;
    }
    
    .input-group i {
        position: absolute;
        left: 15px;
        top: 50%;
        transform: translateY(-50%);
        color: #666;
    }
    
    .input-group input {
        width: 100%;
        padding: 14px 14px 14px 45px;
        border: 2px solid #e1e8ed;
        border-radius: 8px;
        font-size: 16px;
        transition: all 0.3s ease;
    }
    
    .input-group input:focus {
        border-color: #1a5fb4;
        outline: none;
        box-shadow: 0 0 0 3px rgba(26, 95, 180, 0.1);
    }
    
    .login-options {
        margin-bottom: 20px;
    }
    
    .checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #666;
        font-size: 14px;
    }
    
    .checkbox input {
        width: 16px;
        height: 16px;
    }
    
    .system-status {
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e1e8ed;
    }
    
    .status-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 14px;
    }
    
    .status-item:last-child {
        margin-bottom: 0;
    }
    
    .status-item i {
        color: #666;
        width: 20px;
        text-align: center;
    }
    
    .status-online {
        color: #2ea043;
        font-weight: 600;
    }
    
    .status-offline {
        color: #ff6b6b;
        font-weight: 600;
    }
    
    .login-footer {
        margin-top: 30px;
        text-align: center;
        color: #666;
        font-size: 12px;
        border-top: 1px solid #e1e8ed;
        padding-top: 20px;
    }
    
    .support-info {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }
    
    @media (max-width: 480px) {
        .login-container {
            padding: 20px !important;
            margin: 10px !important;
        }
        
        .login-logo {
            flex-direction: column;
            gap: 10px;
        }
        
        .browser-error {
            margin: 20px;
            padding: 20px;
        }
    }
`;
document.head.appendChild(appStyles);

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await noteCamApp.initialize();
    } catch (error) {
        console.error('Erreur initialisation:', error);
        noteCamApp.showError('Erreur critique lors du démarrage de l\'application');
    }
});

// تصدير دوال عامة
window.showNotification = function(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.style.background = 
        type === 'success' ? '#2ea043' :
        type === 'warning' ? '#ffa500' :
        type === 'error' ? '#ff6b6b' : '#1a5fb4';
    
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
};

window.logout = function() {
    noteCamApp.logout();
};

// تسجيل الدخول العام (للاستخدام من HTML)
window.login = function() {
    noteCamApp.login();
};
