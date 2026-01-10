// نظام المزامنة
class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.retryCount = 0;
        this.maxRetries = Config.MAX_RETRIES;
        this.syncQueue = [];
        this.syncHistory = [];
        
        // إحصائيات المزامنة
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastError: null,
            totalDataSynced: 0
        };
    }
    
    // تهيئة المدير
    initialize() {
        console.log('Initialisation du gestionnaire de synchronisation...');
        
        // تحميل تاريخ المزامنة
        this.loadSyncHistory();
        
        // بدء المزامنة الدورية
        this.startPeriodicSync();
        
        // إعداد مستمعات الأحداث
        this.setupEventListeners();
        
        console.log('Gestionnaire de synchronisation initialisé');
    }
    
    // تحميل تاريخ المزامنة
    loadSyncHistory() {
        try {
            const history = localStorage.getItem('notecam_sync_history');
            if (history) {
                this.syncHistory = JSON.parse(history);
            }
            
            const stats = localStorage.getItem('notecam_sync_stats');
            if (stats) {
                this.stats = JSON.parse(stats);
            }
            
            const lastSync = localStorage.getItem('notecam_last_sync');
            if (lastSync) {
                this.lastSyncTime = new Date(lastSync);
            }
            
        } catch (error) {
            console.error('Erreur chargement historique sync:', error);
        }
    }
    
    // حفظ تاريخ المزامنة
    saveSyncHistory() {
        try {
            localStorage.setItem('notecam_sync_history', JSON.stringify(this.syncHistory));
            localStorage.setItem('notecam_sync_stats', JSON.stringify(this.stats));
            if (this.lastSyncTime) {
                localStorage.setItem('notecam_last_sync', this.lastSyncTime.toISOString());
            }
        } catch (error) {
            console.error('Erreur sauvegarde historique sync:', error);
        }
    }
    
    // بدء المزامنة الدورية
    startPeriodicSync() {
        // إيقاف أي فاصل زمني سابق
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // بدء فاصل زمني جديد
        this.syncInterval = setInterval(() => {
            if (!this.isSyncing && navigator.onLine) {
                this.syncAllData();
            }
        }, Config.SYNC_INTERVAL);
        
        // المزامنة الفورية عند الاتصال بالإنترنت
        window.addEventListener('online', () => {
            this.syncAllData();
        });
    }
    
    // إعداد مستمعات الأحداث
    setupEventListeners() {
        // المزامنة عند تركيز النافذة
        window.addEventListener('focus', () => {
            if (!this.isSyncing && navigator.onLine) {
                this.syncAllData();
            }
        });
        
        // المزامنة قبل إغلاق الصفحة
        window.addEventListener('beforeunload', (e) => {
            if (this.syncQueue.length > 0 && !this.isSyncing) {
                e.preventDefault();
                e.returnValue = 'Des données non synchronisées seront perdues.';
                this.forceSync();
            }
        });
    }
    
    // مزامنة جميع البيانات
    async syncAllData() {
        if (this.isSyncing || !navigator.onLine) {
            return;
        }
        
        this.isSyncing = true;
        this.stats.totalSyncs++;
        
        const syncStartTime = new Date();
        let success = false;
        let error = null;
        let syncedItems = 0;
        
        try {
            // تحديث حالة المزامنة
            this.updateSyncStatus('Synchronisation en cours...', 'warning');
            
            // 1. المزامنة من Supabase
            const fromResult = await this.syncFromSupabase();
            
            // 2. المزامنة إلى Supabase
            const toResult = await this.syncToSupabase();
            
            // 3. معالجة قائمة الانتظار
            const queueResult = await this.processSyncQueue();
            
            // حساب العناصر المزامنة
            syncedItems = (fromResult?.syncedItems || 0) + 
                         (toResult?.syncedItems || 0) + 
                         (queueResult?.syncedItems || 0);
            
            this.stats.totalDataSynced += syncedItems;
            success = true;
            this.retryCount = 0;
            
            // تحديث وقت المزامنة الأخير
            this.lastSyncTime = new Date();
            
            // تحديث الحالة
            this.updateSyncStatus('Synchronisation réussie', 'success');
            this.showNotification(`Synchronisation réussie: ${syncedItems} éléments`, 'success');
            
        } catch (syncError) {
            error = syncError.message;
            this.stats.failedSyncs++;
            this.retryCount++;
            
            console.error('Erreur synchronisation:', syncError);
            this.updateSyncStatus('Erreur de synchronisation', 'error');
            this.showNotification('Erreur de synchronisation', 'error');
            
            // المحاولة مرة أخرى إذا لم نتجاوز الحد الأقصى
            if (this.retryCount < this.maxRetries) {
                setTimeout(() => this.syncAllData(), 5000 * this.retryCount);
            }
            
        } finally {
            this.isSyncing = false;
            
            // تسجيل المزامنة في التاريخ
            this.recordSync({
                timestamp: syncStartTime,
                duration: new Date() - syncStartTime,
                success: success,
                error: error,
                itemsSynced: syncedItems,
                retryCount: this.retryCount
            });
            
            // حفظ الإحصائيات
            this.saveSyncHistory();
            
            // تحديث الواجهات إذا كان المستخدم مسجلاً
            if (Auth.currentUser) {
                this.updateUIAfterSync();
            }
        }
    }
    
    // المزامنة من Supabase
    async syncFromSupabase() {
        if (!window.supabaseClient || !window.supabaseClient.isInitialized) {
            throw new Error('Client Supabase non initialisé');
        }
        
        let syncedItems = 0;
        
        try {
            // 1. مزامنة المستخدمين
            const usersResult = await window.supabaseClient.getUsers();
            if (usersResult.success && usersResult.data) {
                await this.processUsersData(usersResult.data);
                syncedItems += usersResult.data.length;
            }
            
            // 2. مزامنة المناطق
            const areasResult = await window.supabaseClient.getAssignedAreas();
            if (areasResult.success && areasResult.data) {
                await this.processAreasData(areasResult.data);
                syncedItems += areasResult.data.length;
            }
            
            // 3. مزامنة التقارير
            const reportsResult = await window.supabaseClient.getReports({ limit: 1000 });
            if (reportsResult.success && reportsResult.data) {
                await this.processReportsData(reportsResult.data);
                syncedItems += reportsResult.data.length;
            }
            
            console.log(`Sync FROM Supabase: ${syncedItems} éléments`);
            return { success: true, syncedItems };
            
        } catch (error) {
            console.error('Erreur sync FROM Supabase:', error);
            throw error;
        }
    }
    
    // معالجة بيانات المستخدمين
    async processUsersData(users) {
        try {
            const localUsers = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS) || '{}'
            );
            
            users.forEach(user => {
                localUsers[user.username] = {
                    password: user.password,
                    role: user.role,
                    name: user.name,
                    assignedAreas: user.assigned_areas || []
                };
            });
            
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.USERS,
                JSON.stringify(localUsers)
            );
            
        } catch (error) {
            console.error('Erreur traitement utilisateurs:', error);
            throw error;
        }
    }
    
    // معالجة بيانات المناطق
    async processAreasData(areas) {
        try {
            const localAreas = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.AREAS) || '[]'
            );
            
            // دمج المناطق
            areas.forEach(area => {
                const existingIndex = localAreas.findIndex(a => a.id === area.id);
                
                if (existingIndex === -1) {
                    // إضافة جديدة
                    localAreas.push({
                        id: area.id,
                        employee: area.employee,
                        name: area.name,
                        code: area.code,
                        date: area.created_at,
                        isActive: area.is_active
                    });
                } else {
                    // تحديث موجود
                    localAreas[existingIndex] = {
                        ...localAreas[existingIndex],
                        ...area
                    };
                }
            });
            
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.AREAS,
                JSON.stringify(localAreas)
            );
            
        } catch (error) {
            console.error('Erreur traitement zones:', error);
            throw error;
        }
    }
    
    // معالجة بيانات التقارير
    async processReportsData(reports) {
        try {
            const localReports = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.REPORTS) || '[]'
            );
            
            // دمج التقارير
            reports.forEach(report => {
                const existingIndex = localReports.findIndex(r => r.id === report.id);
                
                if (existingIndex === -1) {
                    // إضافة جديدة
                    localReports.push({
                        id: report.id,
                        employee: report.employee,
                        employeeName: report.employee_name,
                        numberBefore: report.number_before,
                        numberAfter: report.number_after,
                        date: report.created_at,
                        location: report.location,
                        area: report.area,
                        areaCode: report.area_code,
                        noteCode: report.note_code,
                        status: report.status,
                        step: report.step,
                        completionDate: report.completion_date,
                        photos: report.photos || []
                    });
                } else {
                    // تحديث موجود
                    localReports[existingIndex] = {
                        ...localReports[existingIndex],
                        ...report
                    };
                }
            });
            
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.REPORTS,
                JSON.stringify(localReports)
            );
            
        } catch (error) {
            console.error('Erreur traitement rapports:', error);
            throw error;
        }
    }
    
    // المزامنة إلى Supabase
    async syncToSupabase() {
        if (!window.supabaseClient || !window.supabaseClient.isInitialized) {
            throw new Error('Client Supabase non initialisé');
        }
        
        let syncedItems = 0;
        
        try {
            // الحصول على البيانات المحلية التي لم تتم مزامنتها بعد
            const unsyncedData = this.getUnsyncedData();
            
            // 1. مزامنة المستخدمين الجدد
            for (const user of unsyncedData.users) {
                try {
                    await window.supabaseClient.createUser(user);
                    syncedItems++;
                } catch (error) {
                    console.error(`Erreur sync user ${user.username}:`, error);
                }
            }
            
            // 2. مزامنة المناطق الجديدة
            for (const area of unsyncedData.areas) {
                try {
                    await window.supabaseClient.assignArea(area);
                    syncedItems++;
                } catch (error) {
                    console.error(`Erreur sync area ${area.code}:`, error);
                }
            }
            
            // 3. مزامنة التقارير الجديدة
            for (const report of unsyncedData.reports) {
                try {
                    await window.supabaseClient.createReport(report);
                    syncedItems++;
                } catch (error) {
                    console.error(`Erreur sync report ${report.id}:`, error);
                }
            }
            
            console.log(`Sync TO Supabase: ${syncedItems} éléments`);
            return { success: true, syncedItems };
            
        } catch (error) {
            console.error('Erreur sync TO Supabase:', error);
            throw error;
        }
    }
    
    // الحصول على البيانات غير المزامنة
    getUnsyncedData() {
        const unsyncedData = {
            users: [],
            areas: [],
            reports: []
        };
        
        try {
            // تحميل البيانات المحلية
            const localUsers = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS) || '{}'
            );
            
            const localAreas = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.AREAS) || '[]'
            );
            
            const localReports = JSON.parse(
                localStorage.getItem(Config.LOCAL_STORAGE_KEYS.REPORTS) || '[]'
            );
            
            // الحصول على آخر وقت مزامنة
            const lastSyncTime = this.lastSyncTime || new Date(0);
            
            // تصفية البيانات الجديدة
            Object.entries(localUsers).forEach(([username, user]) => {
                // هنا يمكن إضافة منطق للتحقق إذا كان المستخدم جديداً
                unsyncedData.users.push({
                    username: username,
                    ...user
                });
            });
            
            localAreas.forEach(area => {
                if (new Date(area.date) > lastSyncTime) {
                    unsyncedData.areas.push(area);
                }
            });
            
            localReports.forEach(report => {
                if (new Date(report.date) > lastSyncTime) {
                    unsyncedData.reports.push(report);
                }
            });
            
        } catch (error) {
            console.error('Erreur récupération données non synchronisées:', error);
        }
        
        return unsyncedData;
    }
    
    // معالجة قائمة انتظار المزامنة
    async processSyncQueue() {
        if (this.syncQueue.length === 0) {
            return { success: true, syncedItems: 0 };
        }
        
        let syncedItems = 0;
        const failedItems = [];
        
        try {
            // معالجة العناصر بالترتيب
            while (this.syncQueue.length > 0) {
                const item = this.syncQueue[0];
                
                try {
                    await this.processSyncItem(item);
                    syncedItems++;
                    this.syncQueue.shift(); // إزالة من قائمة الانتظار بعد النجاح
                } catch (error) {
                    console.error(`Erreur traitement item ${item.type}:`, error);
                    failedItems.push(item);
                    this.syncQueue.shift();
                    
                    // إضافة للقائمة مرة أخرى للمحاولة لاحقاً
                    setTimeout(() => {
                        this.addToSyncQueue(item);
                    }, 5000);
                }
            }
            
            console.log(`Sync queue: ${syncedItems} éléments traités, ${failedItems.length} échecs`);
            return { success: true, syncedItems, failedItems };
            
        } catch (error) {
            console.error('Erreur traitement queue sync:', error);
            throw error;
        }
    }
    
    // معالجة عنصر مزامنة
    async processSyncItem(item) {
        if (!window.supabaseClient || !window.supabaseClient.isInitialized) {
            throw new Error('Client Supabase non disponible');
        }
        
        switch (item.type) {
            case 'user':
                await window.supabaseClient.createUser(item.data);
                break;
                
            case 'area':
                await window.supabaseClient.assignArea(item.data);
                break;
                
            case 'report':
                await window.supabaseClient.createReport(item.data);
                break;
                
            case 'photo':
                await window.supabaseClient.uploadPhoto(item.data.file, item.data.options);
                break;
                
            default:
                console.warn(`Type d'élément non supporté: ${item.type}`);
        }
    }
    
    // إضافة عنصر لقائمة انتظار المزامنة
    addToSyncQueue(item) {
        this.syncQueue.push({
            ...item,
            timestamp: new Date().toISOString(),
            attempts: (item.attempts || 0) + 1
        });
        
        // حفظ قائمة الانتظار
        this.saveSyncQueue();
        
        // بدء المزامنة إذا لم تكن جارية
        if (!this.isSyncing && navigator.onLine) {
            this.processSyncQueue();
        }
    }
    
    // حفظ قائمة انتظار المزامنة
    saveSyncQueue() {
        try {
            localStorage.setItem('notecam_sync_queue', JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('Erreur sauvegarde queue sync:', error);
        }
    }
    
    // تحميل قائمة انتظار المزامنة
    loadSyncQueue() {
        try {
            const queue = localStorage.getItem('notecam_sync_queue');
            if (queue) {
                this.syncQueue = JSON.parse(queue);
            }
        } catch (error) {
            console.error('Erreur chargement queue sync:', error);
        }
    }
    
    // تحديث حالة المزامنة في الواجهة
    updateSyncStatus(message, type = 'info') {
        // تحديث شريط الحالة
        const syncStatus = document.getElementById('syncStatus') || 
                          document.getElementById('adminSyncStatus') ||
                          document.getElementById('employeeSyncStatus');
        
        if (syncStatus) {
            const icon = syncStatus.querySelector('i');
            const text = syncStatus.querySelector('span');
            
            if (icon && text) {
                switch (type) {
                    case 'success':
                        icon.className = 'fas fa-check-circle';
                        icon.style.color = '#2ea043';
                        break;
                    case 'warning':
                        icon.className = 'fas fa-sync fa-spin';
                        icon.style.color = '#ffa500';
                        break;
                    case 'error':
                        icon.className = 'fas fa-exclamation-circle';
                        icon.style.color = '#ff6b6b';
                        break;
                    default:
                        icon.className = 'fas fa-sync';
                        icon.style.color = '#1a5fb4';
                }
                
                text.textContent = message;
                
                // تحديث وقت المزامنة الأخير
                if (type === 'success' && this.lastSyncTime) {
                    const timeElement = syncStatus.querySelector('.sync-time');
                    if (!timeElement) {
                        const timeSpan = document.createElement('span');
                        timeSpan.className = 'sync-time';
                        timeSpan.style.fontSize = '11px';
                        timeSpan.style.marginLeft = '5px';
                        syncStatus.appendChild(timeSpan);
                    }
                    
                    syncStatus.querySelector('.sync-time').textContent = 
                        this.formatTimeAgo(this.lastSyncTime);
                }
            }
        }
    }
    
    // تنسيق الوقت المنقضي
    formatTimeAgo(date) {
        if (!date) return '';
        
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'à l\'instant';
        if (diffMins < 60) return `il y a ${diffMins} min`;
        if (diffMins < 1440) return `il y a ${Math.floor(diffMins / 60)} h`;
        
        return new Date(date).toLocaleDateString('fr-FR');
    }
    
    // تسجيل المزامنة في التاريخ
    recordSync(syncData) {
        this.syncHistory.push(syncData);
        
        // الحفاظ على آخر 50 مزامنة فقط
        if (this.syncHistory.length > 50) {
            this.syncHistory.shift();
        }
        
        // تحديث الإحصائيات
        if (syncData.success) {
            this.stats.successfulSyncs++;
        } else {
            this.stats.failedSyncs++;
            this.stats.lastError = syncData.error;
        }
    }
    
    // المزامنة القسرية
    async forceSync() {
        if (this.isSyncing) {
            this.showNotification('Synchronisation déjà en cours', 'warning');
            return;
        }
        
        this.showNotification('Synchronisation forcée démarrée', 'info');
        await this.syncAllData();
    }
    
    // تحديث الواجهة بعد المزامنة
    updateUIAfterSync() {
        if (!Auth.currentUser) return;
        
        const user = Auth.currentUser;
        
        if (user.role === 'admin') {
            // تحديث لوحة المشرف
            if (window.adminPanel) {
                window.adminPanel.updateEmployeeList();
                window.adminPanel.updateAreaList();
                window.adminPanel.updateReportsList();
                window.adminPanel.updateStatistics();
            }
        } else {
            // تحديث لوحة الموظف
            if (window.employeePanel) {
                window.employeePanel.updateEmployeeReportsList();
                window.employeePanel.updateAreaSelection();
            }
        }
        
        // تحديث مدير التقارير
        if (window.reportsManager) {
            window.reportsManager.loadReports();
        }
    }
    
    // الحصول على حالة المزامنة
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            retryCount: this.retryCount,
            queueLength: this.syncQueue.length,
            stats: { ...this.stats },
            connection: navigator.onLine ? 'online' : 'offline',
            supabaseConnected: window.supabaseClient?.isInitialized || false
        };
    }
    
    // الحصول على تاريخ المزامنة
    getSyncHistory(limit = 10) {
        return this.syncHistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
    
    // تصدير تاريخ المزامنة
    exportSyncHistory() {
        const exportData = {
            exportDate: new Date().toISOString(),
            stats: this.stats,
            history: this.syncHistory,
            queue: this.syncQueue,
            status: this.getSyncStatus()
        };
        
        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Historique_Sync_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        this.showNotification('Historique de synchronisation exporté', 'success');
    }
    
    // إعادة تعيين المزامنة
    resetSync() {
        this.syncQueue = [];
        this.syncHistory = [];
        this.retryCount = 0;
        this.lastSyncTime = null;
        
        // إعادة تعيين الإحصائيات
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastError: null,
            totalDataSynced: 0
        };
        
        // حذف البيانات المحفوظة
        localStorage.removeItem('notecam_sync_history');
        localStorage.removeItem('notecam_sync_stats');
        localStorage.removeItem('notecam_sync_queue');
        localStorage.removeItem('notecam_last_sync');
        
        this.showNotification('Synchronisation réinitialisée', 'info');
    }
    
    // التحقق من اتصال Supabase
    async checkSupabaseConnection() {
        if (!window.supabaseClient) {
            return { connected: false, error: 'Client non initialisé' };
        }
        
        try {
            const result = await window.supabaseClient.testConnection();
            return { connected: true, result };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
    
    // إظهار إشعار
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// إنشاء وتصدير نسخة واحدة
const syncManager = new SyncManager();
window.syncManager = syncManager;
