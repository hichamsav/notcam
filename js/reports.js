import { supabaseClient, TABLES } from './config.js';
import { photoStorage } from './storage.js';
import { showNotification } from '../utils/notifications.js';

class ReportsManager {
    constructor() {
        this.currentReport = null;
        this.reportsCache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 دقائق
    }

    // إنشاء تقرير جديد
    async createReport(reportData) {
        try {
            const report = {
                user_id: reportData.userId,
                area_code: reportData.areaCode,
                number_before: reportData.numberBefore,
                number_after: reportData.numberAfter,
                location: reportData.location,
                status: reportData.status || 'pending',
                step: reportData.step || 'first',
                metadata: {
                    device_info: navigator.userAgent,
                    app_version: '3.0.0',
                    user_agent: navigator.userAgent,
                    ...reportData.metadata
                },
                created_at: new Date().toISOString()
            };

            // إرسال إلى Supabase
            const { data, error } = await supabaseClient
                .from(TABLES.REPORTS)
                .insert([report])
                .select()
                .single();

            if (error) throw error;

            this.currentReport = data;
            this.cacheReport(data);
            
            showNotification('تم إنشاء التقرير بنجاح', 'success');
            return data;

        } catch (error) {
            console.error('خطأ في إنشاء التقرير:', error);
            showNotification('خطأ في إنشاء التقرير', 'error');
            
            // حفظ محلي في حالة فشل الاتصال
            this.saveReportLocally(reportData);
            throw error;
        }
    }

    // تحديث التقرير
    async updateReport(reportId, updates) {
        try {
            const { data, error } = await supabaseClient
                .from(TABLES.REPORTS)
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reportId)
                .select()
                .single();

            if (error) throw error;

            // تحديث الكاش
            this.cacheReport(data);
            
            showNotification('تم تحديث التقرير', 'success');
            return data;

        } catch (error) {
            console.error('خطأ في تحديث التقرير:', error);
            showNotification('خطأ في تحديث التقرير', 'error');
            throw error;
        }
    }

    // إكمال التقرير (بعد التقاط الصور)
    async completeReport(reportId, afterNumber, afterPhotos) {
        try {
            // تحديث التقرير
            const report = await this.updateReport(reportId, {
                number_after: afterNumber,
                status: 'complete',
                step: 'complete',
                completed_at: new Date().toISOString()
            });

            // رفع صور "بعد"
            const uploadPromises = afterPhotos.map((photo, index) => 
                photoStorage.uploadPhoto(photo, {
                    reportId: reportId,
                    type: 'after',
                    index: index,
                    userId: report.user_id,
                    zoneCode: report.area_code,
                    location: photo.location,
                    timestamp: photo.timestamp
                })
            );

            await Promise.all(uploadPromises);
            
            showNotification('تم إكمال التقرير بنجاح', 'success');
            return report;

        } catch (error) {
            console.error('خطأ في إكمال التقرير:', error);
            showNotification('خطأ في إكمال التقرير', 'error');
            throw error;
        }
    }

    // جلب التقرير بواسطة المعرف
    async getReport(reportId, forceRefresh = false) {
        // التحقق من الكاش أولاً
        if (!forceRefresh) {
            const cached = this.getCachedReport(reportId);
            if (cached) return cached;
        }

        try {
            const { data, error } = await supabaseClient
                .from(TABLES.REPORTS)
                .select(`
                    *,
                    user:users(name, username),
                    area:assigned_areas(name, code),
                    photos:photos_metadata(*)
                `)
                .eq('id', reportId)
                .single();

            if (error) throw error;

            // حفظ في الكاش
            this.cacheReport(data);
            
            return data;

        } catch (error) {
            console.error('خطأ في جلب التقرير:', error);
            return null;
        }
    }

    // جلب تقارير المستخدم
    async getUserReports(userId, limit = 50, offset = 0) {
        try {
            const { data, error } = await supabaseClient
                .from(TABLES.REPORTS)
                .select(`
                    *,
                    area:assigned_areas(name, code)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // حفظ في الكاش
            data.forEach(report => this.cacheReport(report));
            
            return data || [];

        } catch (error) {
            console.error('خطأ في جلب تقارير المستخدم:', error);
            return [];
        }
    }

    // جلب جميع التقارير (للمشرف)
    async getAllReports(filters = {}) {
        try {
            let query = supabaseClient
                .from(TABLES.REPORTS)
                .select(`
                    *,
                    user:users(name, username),
                    area:assigned_areas(name, code)
                `)
                .order('created_at', { ascending: false });

            // تطبيق الفلاتر
            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.areaCode) {
                query = query.eq('area_code', filters.areaCode);
            }

            if (filters.startDate && filters.endDate) {
                query = query.gte('created_at', filters.startDate)
                           .lte('created_at', filters.endDate);
            }

            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // حفظ في الكاش
            data.forEach(report => this.cacheReport(report));
            
            return data || [];

        } catch (error) {
            console.error('خطأ في جلب جميع التقارير:', error);
            return [];
        }
    }

    // جلب إحصائيات التقارير
    async getReportsStatistics(timeRange = 'month') {
        try {
            const now = new Date();
            let startDate = new Date();

            switch (timeRange) {
                case 'day':
                    startDate.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
            }

            const { data, error } = await supabaseClient
                .from(TABLES.REPORTS)
                .select('*')
                .gte('created_at', startDate.toISOString());

            if (error) throw error;

            // تحليل البيانات
            const stats = {
                total: data.length,
                completed: data.filter(r => r.status === 'complete').length,
                pending: data.filter(r => r.status === 'pending').length,
                beforeOnly: data.filter(r => r.status === 'before_only').length,
                byDay: this.groupByDay(data),
                byArea: this.groupByArea(data),
                byUser: this.groupByUser(data)
            };

            return stats;

        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
            return null;
        }
    }

    // تصدير التقارير
    async exportReports(format = 'json', filters = {}) {
        try {
            const reports = await this.getAllReports(filters);
            
            let exportData;
            
            switch (format) {
                case 'json':
                    exportData = JSON.stringify(reports, null, 2);
                    break;
                    
                case 'csv':
                    exportData = this.convertToCSV(reports);
                    break;
                    
                case 'excel':
                    // يمكن إضافة مكتبة لإنشاء Excel
                    exportData = this.convertToExcel(reports);
                    break;
                    
                default:
                    throw new Error('تنسيق غير مدعوم');
            }

            return exportData;

        } catch (error) {
            console.error('خطأ في تصدير التقارير:', error);
            throw error;
        }
    }

    // حذف التقرير
    async deleteReport(reportId) {
        try {
            // حذف الصور أولاً
            const { data: photos, error: photosError } = await supabaseClient
                .from('photos_metadata')
                .select('id')
                .eq('report_id', reportId);

            if (!photosError && photos.length > 0) {
                const deletePromises = photos.map(photo => 
                    photoStorage.deletePhoto(photo.id)
                );
                await Promise.all(deletePromises);
            }

            // حذف التقرير
            const { error } = await supabaseClient
                .from(TABLES.REPORTS)
                .delete()
                .eq('id', reportId);

            if (error) throw error;

            // إزالة من الكاش
            this.reportsCache.delete(reportId);
            
            showNotification('تم حذف التقرير بنجاح', 'success');
            return true;

        } catch (error) {
            console.error('خطأ في حذف التقرير:', error);
            showNotification('خطأ في حذف التقرير', 'error');
            throw error;
        }
    }

    // أدوات مساعدة

    // حفظ التقرير محلياً
    saveReportLocally(reportData) {
        try {
            const localReports = JSON.parse(localStorage.getItem('local_reports') || '[]');
            const report = {
                ...reportData,
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                synced: false,
                created_at: new Date().toISOString()
            };
            
            localReports.push(report);
            localStorage.setItem('local_reports', JSON.stringify(localReports));
            
            showNotification('تم حفظ التقرير محلياً', 'warning');
            return report;
            
        } catch (error) {
            console.error('خطأ في الحفظ المحلي:', error);
        }
    }

    // مزامنة التقارير المحلية
    async syncLocalReports() {
        try {
            const localReports = JSON.parse(localStorage.getItem('local_reports') || '[]');
            const unsynced = localReports.filter(r => !r.synced);
            
            if (unsynced.length === 0) return [];

            const syncedReports = [];
            
            for (const report of unsynced) {
                try {
                    const syncedReport = await this.createReport(report);
                    report.synced = true;
                    syncedReports.push(syncedReport);
                } catch (error) {
                    console.error(`فشل مزامنة التقرير ${report.id}:`, error);
                }
            }

            // تحديث localStorage
            localStorage.setItem('local_reports', JSON.stringify(localReports));
            
            if (syncedReports.length > 0) {
                showNotification(`تمت مزامنة ${syncedReports.length} تقرير`, 'success');
            }
            
            return syncedReports;

        } catch (error) {
            console.error('خطأ في مزامنة التقارير المحلية:', error);
            return [];
        }
    }

    // تجميع البيانات حسب اليوم
    groupByDay(reports) {
        const grouped = {};
        
        reports.forEach(report => {
            const date = new Date(report.created_at).toLocaleDateString('ar-SA');
            if (!grouped[date]) grouped[date] = 0;
            grouped[date]++;
        });
        
        return grouped;
    }

    // تجميع البيانات حسب المنطقة
    groupByArea(reports) {
        const grouped = {};
        
        reports.forEach(report => {
            const area = report.area_code || 'غير معروف';
            if (!grouped[area]) grouped[area] = 0;
            grouped[area]++;
        });
        
        return grouped;
    }

    // تجميع البيانات حسب المستخدم
    groupByUser(reports) {
        const grouped = {};
        
        reports.forEach(report => {
            const user = report.user_id || 'غير معروف';
            if (!grouped[user]) grouped[user] = 0;
            grouped[user]++;
        });
        
        return grouped;
    }

    // التحويل إلى CSV
    convertToCSV(reports) {
        if (reports.length === 0) return '';
        
        const headers = ['ID', 'المستخدم', 'المنطقة', 'رقم قبل', 'رقم بعد', 'الحالة', 'التاريخ'];
        const rows = reports.map(report => [
            report.id,
            report.user?.name || 'غير معروف',
            report.area?.name || report.area_code,
            report.number_before || '',
            report.number_after || '',
            report.status,
            new Date(report.created_at).toLocaleString('ar-SA')
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    // التحويل إلى Excel (JSON مبسط)
    convertToExcel(reports) {
        return {
            metadata: {
                generated: new Date().toISOString(),
                total: reports.length,
                format: 'excel-json'
            },
            reports: reports.map(report => ({
                id: report.id,
                user: report.user?.name || 'غير معروف',
                username: report.user?.username || '',
                area: report.area?.name || report.area_code,
                area_code: report.area_code,
                number_before: report.number_before,
                number_after: report.number_after,
                status: report.status,
                step: report.step,
                created_at: report.created_at,
                completed_at: report.completed_at,
                location: report.location,
                photos_count: report.photos?.length || 0
            }))
        };
    }

    // إدارة الكاش
    cacheReport(report) {
        if (!report?.id) return;
        
        this.reportsCache.set(report.id, {
            data: report,
            timestamp: Date.now()
        });
        
        // تنظيف الكاش القديم
        this.cleanupCache();
    }

    getCachedReport(reportId) {
        const cached = this.reportsCache.get(reportId);
        if (!cached) return null;
        
        // التحقق من انتهاء الصلاحية
        if (Date.now() - cached.timestamp > this.cacheDuration) {
            this.reportsCache.delete(reportId);
            return null;
        }
        
        return cached.data;
    }

    cleanupCache() {
        const now = Date.now();
        for (const [id, cached] of this.reportsCache.entries()) {
            if (now - cached.timestamp > this.cacheDuration) {
                this.reportsCache.delete(id);
            }
        }
    }

    // تنزيل ملف التقرير
    downloadReport(reportId, format = 'json') {
        this.getReport(reportId).then(report => {
            if (!report) {
                showNotification('التقرير غير موجود', 'error');
                return;
            }

            let content, filename, mimeType;
            
            switch (format) {
                case 'json':
                    content = JSON.stringify(report, null, 2);
                    filename = `تقرير_${report.area_code}_${report.id}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'csv':
                    content = this.convertToCSV([report]);
                    filename = `تقرير_${report.area_code}_${report.id}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                default:
                    content = JSON.stringify(report, null, 2);
                    filename = `تقرير_${report.area_code}_${report.id}.json`;
                    mimeType = 'application/json';
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('تم تنزيل التقرير', 'success');
        });
    }
}

// إنشاء نسخة وحيدة من مدير التقارير
export const reportsManager = new ReportsManager();

// تعريض للاستخدام العالمي
window.reportsManager = reportsManager;
