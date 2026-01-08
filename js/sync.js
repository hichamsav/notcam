// نظام المزامنة مع Supabase - يعمل مع الكود الأصلي
class SupabaseSync {
    constructor() {
        this.lastSync = null;
        this.isSyncing = false;
        this.syncQueue = [];
    }

    // حفظ بيانات في Supabase
    async saveToSupabase(table, data) {
        if (!window.supabaseClient) return null;
        
        try {
            const { data: result, error } = await supabaseClient
                .from(table)
                .upsert(data)
                .select();
            
            if (error) throw error;
            return result;
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
            // حفظ محلي في حالة فشل
            this.saveLocally(table, data);
            return null;
        }
    }

    // جلب بيانات من Supabase
    async fetchFromSupabase(table, query = {}) {
        if (!window.supabaseClient) return [];
        
        try {
            let supabaseQuery = supabaseClient.from(table).select('*');
            
            if (query.where) {
                Object.entries(query.where).forEach(([key, value]) => {
                    supabaseQuery = supabaseQuery.eq(key, value);
                });
            }
            
            if (query.orderBy) {
                supabaseQuery = supabaseQuery.order(query.orderBy, { ascending: query.ascending || false });
            }
            
            if (query.limit) {
                supabaseQuery = supabaseQuery.limit(query.limit);
            }
            
            const { data, error } = await supabaseQuery;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            return [];
        }
    }

    // رفع صورة إلى Supabase Storage
    async uploadPhoto(file, path) {
        if (!window.supabaseClient) return null;
        
        try {
            const { data, error } = await supabaseClient.storage
                .from(SUPABASE_CONFIG.STORAGE_BUCKET)
                .upload(path, file);
            
            if (error) throw error;
            
            // الحصول على رابط عام
            const { data: urlData } = supabaseClient.storage
                .from(SUPABASE_CONFIG.STORAGE_BUCKET)
                .getPublicUrl(path);
            
            return urlData.publicUrl;
        } catch (error) {
            console.error('خطأ في رفع الصورة:', error);
            return null;
        }
    }

    // مزامنة الكل
    async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        
        try {
            // 1. مزامنة المستخدمين
            await this.syncUsers();
            
            // 2. مزامنة المناطق
            await this.syncAreas();
            
            // 3. مزامنة التقارير
            await this.syncReports();
            
            // 4. معالجة قائمة الانتظار
            await this.processQueue();
            
            this.lastSync = new Date();
            this.updateSyncStatus('success');
            
        } catch (error) {
            console.error('خطأ في المزامنة:', error);
            this.updateSyncStatus('error');
        } finally {
            this.isSyncing = false;
        }
    }

    // مزامنة المستخدمين
    async syncUsers() {
        // جلب المستخدمين من Supabase
        const remoteUsers = await this.fetchFromSupabase('users');
        
        if (remoteUsers.length > 0) {
            // تحديث usersData المحلية
            remoteUsers.forEach(user => {
                window.usersData[user.username] = {
                    password: user.password,
                    role: user.role,
                    name: user.name,
                    assignedAreas: user.assigned_areas || []
                };
            });
            
            // حفظ محلياً
            window.saveToLocalStorage();
        }
        
        // إرسال المستخدمين المحليين إلى Supabase
        Object.entries(window.usersData).forEach(async ([username, data]) => {
            await this.saveToSupabase('users', {
                username: username,
                password: data.password,
                role: data.role,
                name: data.name,
                assigned_areas: data.assignedAreas || []
            });
        });
    }

    // مزامنة المناطق
    async syncAreas() {
        const remoteAreas = await this.fetchFromSupabase('assigned_areas', {
            orderBy: 'date',
            ascending: false
        });
        
        if (remoteAreas.length > 0) {
            window.assignedAreas = remoteAreas.map(area => ({
                id: area.id,
                employee: area.employee,
                name: area.name,
                code: area.code,
                date: area.date,
                isActive: area.is_active
            }));
        }
    }

    // مزامنة التقارير
    async syncReports() {
        const remoteReports = await this.fetchFromSupabase('reports', {
            orderBy: 'date',
            ascending: false,
            limit: 100
        });
        
        if (remoteReports.length > 0) {
            remoteReports.forEach(report => {
                const zoneCode = report.area_code;
                if (!window.zoneReports[zoneCode]) {
                    window.zoneReports[zoneCode] = {
                        name: report.area,
                        reports: [],
                        photos: []
                    };
                }
                
                window.zoneReports[zoneCode].reports.push({
                    id: report.id,
                    employee: report.employee,
                    employeeName: report.employee_name,
                    numberBefore: report.number_before,
                    numberAfter: report.number_after,
                    date: report.date,
                    location: report.location,
                    area: report.area,
                    areaCode: report.area_code,
                    noteCode: report.note_code,
                    status: report.status,
                    step: report.step,
                    completionDate: report.completion_date,
                    photos: report.photos || []
                });
            });
        }
    }

    // حفظ محلي في حالة فشل الاتصال
    saveLocally(table, data) {
        const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
        pending.push({
            table: table,
            data: data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('pending_sync', JSON.stringify(pending));
    }

    // معالجة قائمة الانتظار
    async processQueue() {
        const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
        
        for (const item of pending) {
            try {
                await this.saveToSupabase(item.table, item.data);
                
                // إزالة من قائمة الانتظار بعد النجاح
                pending.splice(pending.indexOf(item), 1);
            } catch (error) {
                console.error('فشل في معالجة:', item);
            }
        }
        
        localStorage.setItem('pending_sync', JSON.stringify(pending));
    }

    // تحديث حالة المزامنة في الواجهة
    updateSyncStatus(status) {
        const syncElement = document.getElementById('syncStatus');
        if (!syncElement) return;
        
        if (status === 'syncing') {
            syncElement.innerHTML = '<i class="fas fa-sync fa-spin"></i> مزامنة...';
        } else if (status === 'success') {
            syncElement.innerHTML = `<i class="fas fa-check"></i> متزامن ${this.formatTime(this.lastSync)}`;
        } else {
            syncElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ';
        }
    }

    // تنسيق الوقت
    formatTime(date) {
        if (!date) return '';
        return date.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// إنشاء نسخة عالمية
window.supabaseSync = new SupabaseSync();

// دالة المزامنة العامة
window.syncData = async function() {
    await window.supabaseSync.syncAll();
};

// دالة التهيئة
window.initSupabase = async function() {
    await initializeSupabase();
    await supabaseSync.syncAll();
    
    // بدء المزامنة التلقائية كل 30 ثانية
    setInterval(() => {
        if (navigator.onLine) {
            supabaseSync.syncAll();
        }
    }, 30000);
};
