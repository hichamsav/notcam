// نظام مزامنة NoteCam مع Supabase
class NoteCamSync {
    constructor() {
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.pendingItems = [];
    }

    // بدء المزامنة
    async startSync() {
        if (this.syncInProgress || !window.notecamSupabase) return;
        
        this.syncInProgress = true;
        this.updateSyncUI('syncing');
        
        try {
            // 1. مزامنة المستخدمين
            await this.syncUsers();
            
            // 2. مزامنة المناطق
            await this.syncAreas();
            
            // 3. مزامنة التقارير
            await this.syncZoneReports();
            
            // 4. معالجة العناصر المنتظرة
            await this.processPending();
            
            this.lastSyncTime = new Date();
            this.updateSyncUI('success');
            
        } catch (error) {
            console.error('❌ خطأ في المزامنة:', error);
            this.updateSyncUI('error');
        } finally {
            this.syncInProgress = false;
        }
    }

    // مزامنة المستخدمين
    async syncUsers() {
        try {
            // جلب من Supabase
            const { data: remoteUsers } = await window.notecamSupabase
                .from('users')
                .select('*');
            
            if (remoteUsers && remoteUsers.length > 0) {
                remoteUsers.forEach(user => {
                    if (!window.usersData[user.username]) {
                        window.usersData[user.username] = {
                            password: user.password,
                            role: user.role,
                            name: user.name,
                            assignedAreas: user.assigned_areas || []
                        };
                    }
                });
            }
            
            // إرسال إلى Supabase
            for (const [username, userData] of Object.entries(window.usersData)) {
                await window.notecamSupabase
                    .from('users')
                    .upsert({
                        username: username,
                        password: userData.password,
                        role: userData.role,
                        name: userData.name,
                        assigned_areas: userData.assignedAreas || []
                    });
            }
            
        } catch (error) {
            console.error('❌ خطأ في مزامنة المستخدمين:', error);
        }
    }

    // مزامنة المناطق
    async syncAreas() {
        try {
            const { data: remoteAreas } = await window.notecamSupabase
                .from('assigned_areas')
                .select('*')
                .order('date', { ascending: false });
            
            if (remoteAreas && remoteAreas.length > 0) {
                window.assignedAreas = remoteAreas.map(area => ({
                    id: area.id,
                    employee: area.employee,
                    name: area.name,
                    code: area.code,
                    date: area.date,
                    isActive: area.is_active
                }));
            }
            
            // إرسال المناطق المحلية
            for (const area of window.assignedAreas) {
                await window.notecamSupabase
                    .from('assigned_areas')
                    .upsert({
                        id: area.id,
                        employee: area.employee,
                        name: area.name,
                        code: area.code,
                        date: area.date,
                        is_active: area.isActive
                    });
            }
            
        } catch (error) {
            console.error('❌ خطأ في مزامنة المناطق:', error);
        }
    }

    // مزامنة التقارير
    async syncZoneReports() {
        try {
            const { data: remoteReports } = await window.notecamSupabase
                .from('reports')
                .select('*')
                .order('date', { ascending: false })
                .limit(100);
            
            if (remoteReports) {
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
            
            // إرسال التقارير المحلية
            for (const [zoneCode, zoneData] of Object.entries(window.zoneReports)) {
                for (const report of zoneData.reports) {
                    await window.notecamSupabase
                        .from('reports')
                        .upsert({
                            id: report.id,
                            employee: report.employee,
                            employee_name: report.employeeName,
                            number_before: report.numberBefore,
                            number_after: report.numberAfter,
                            date: report.date,
                            location: report.location,
                            area: report.area,
                            area_code: report.areaCode,
                            note_code: report.noteCode,
                            status: report.status,
                            step: report.step,
                            completion_date: report.completionDate,
                            photos: report.photos || []
                        });
                }
            }
            
        } catch (error) {
            console.error('❌ خطأ في مزامنة التقارير:', error);
        }
    }

    // معالجة العناصر المنتظرة
    async processPending() {
        const pending = JSON.parse(localStorage.getItem('notecam_pending') || '[]');
        
        for (const item of pending) {
            try {
                if (item.type === 'user') {
                    await this.syncUsers();
                } else if (item.type === 'area') {
                    await this.syncAreas();
                } else if (item.type === 'report') {
                    await this.syncZoneReports();
                }
                
                pending.splice(pending.indexOf(item), 1);
            } catch (error) {
                console.error(`❌ فشل في معالجة ${item.type}:`, error);
            }
        }
        
        localStorage.setItem('notecam_pending', JSON.stringify(pending));
    }

    // تحديث واجهة المزامنة
    updateSyncUI(status) {
        const syncElement = document.getElementById('syncStatus');
        if (!syncElement) return;
        
        const icon = syncElement.querySelector('.sync-icon') || 
                     syncElement.querySelector('i') ||
                     syncElement;
        
        const text = syncElement.querySelector('#syncText') || 
                     syncElement.querySelector('span') ||
                     syncElement;
        
        switch(status) {
            case 'syncing':
                icon.className = 'fas fa-sync fa-spin';
                icon.style.animation = 'spin 1s linear infinite';
                text.textContent = 'Synchronisation...';
                break;
            case 'success':
                icon.className = 'fas fa-check-circle';
                icon.style.animation = 'none';
                text.textContent = `Synchro OK ${this.formatTime(this.lastSyncTime)}`;
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-circle';
                icon.style.animation = 'none';
                text.textContent = 'Erreur de sync';
                break;
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

    // حفظ عنصر في قائمة الانتظار
    addToPending(type, data) {
        const pending = JSON.parse(localStorage.getItem('notecam_pending') || '[]');
        pending.push({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('notecam_pending', JSON.stringify(pending));
    }
}

// إنشاء نسخة عالمية
window.notecamSync = new NoteCamSync();

// دالة المزامنة العامة
window.syncNotecamData = function() {
    return window.notecamSync.startSync();
};

// دالة التهيئة
window.initNotecamSync = async function() {
    await window.setupSupabase();
    if (window.notecamSupabase) {
        await window.notecamSync.startSync();
        
        // مزامنة تلقائية كل 30 ثانية
        setInterval(() => {
            if (navigator.onLine) {
                window.notecamSync.startSync();
            }
        }, 30000);
    }
};
