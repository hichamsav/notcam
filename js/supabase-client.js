// عميل Supabase الآمن
class SupabaseClient {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = Config.MAX_RETRIES;
    }
    
    // تهيئة العميل
    async initialize() {
        try {
            if (this.isInitialized) return true;
            
            console.log('Initialisation du client Supabase...');
            
            // التحقق من وجود مفاتيح
            if (!Config.SUPABASE_URL || !Config.SUPABASE_ANON_KEY) {
                throw new Error('Clés Supabase non configurées');
            }
            
            // إنشاء العميل
            this.client = supabase.createClient(
                Config.SUPABASE_URL, 
                Config.SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false
                    },
                    global: {
                        headers: {
                            'x-application-name': Config.APP_NAME,
                            'x-application-version': Config.VERSION
                        }
                    }
                }
            );
            
            // اختبار الاتصال
            await this.testConnection();
            
            this.isInitialized = true;
            this.retryCount = 0;
            
            console.log('Client Supabase initialisé avec succès');
            return true;
            
        } catch (error) {
            console.error('Erreur initialisation Supabase:', error);
            this.retryCount++;
            
            if (this.retryCount < this.maxRetries) {
                console.log(`Nouvelle tentative dans 5 secondes... (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.initialize(), 5000);
            } else {
                console.warn('Mode hors ligne activé');
                this.isInitialized = false;
            }
            
            return false;
        }
    }
    
    // اختبار الاتصال
    async testConnection() {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('count')
                .limit(1);
                
            if (error) throw error;
            return true;
        } catch (error) {
            throw new Error(`Test de connexion échoué: ${error.message}`);
        }
    }
    
    // ========== إدارة المستخدمين ==========
    
    async getUsers() {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur récupération utilisateurs:', error);
            return { success: false, error: error.message };
        }
    }
    
    async createUser(userData) {
        try {
            const { data, error } = await this.client
                .from('users')
                .insert([{
                    username: userData.username,
                    password: userData.password,
                    name: userData.name,
                    role: userData.role,
                    assigned_areas: userData.assignedAreas || [],
                    created_at: new Date().toISOString()
                }]);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateUser(username, updates) {
        try {
            const { data, error } = await this.client
                .from('users')
                .update(updates)
                .eq('username', username);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur mise à jour utilisateur:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deleteUser(username) {
        try {
            const { data, error } = await this.client
                .from('users')
                .delete()
                .eq('username', username);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur suppression utilisateur:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== إدارة المناطق ==========
    
    async getAssignedAreas() {
        try {
            const { data, error } = await this.client
                .from('assigned_areas')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur récupération zones:', error);
            return { success: false, error: error.message };
        }
    }
    
    async assignArea(areaData) {
        try {
            const { data, error } = await this.client
                .from('assigned_areas')
                .insert([{
                    employee: areaData.employee,
                    name: areaData.name,
                    code: areaData.code,
                    is_active: areaData.isActive !== false,
                    created_at: new Date().toISOString()
                }]);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur attribution zone:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateArea(areaId, updates) {
        try {
            const { data, error } = await this.client
                .from('assigned_areas')
                .update(updates)
                .eq('id', areaId);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur mise à jour zone:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deleteArea(areaId) {
        try {
            const { data, error } = await this.client
                .from('assigned_areas')
                .delete()
                .eq('id', areaId);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur suppression zone:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== إدارة التقارير ==========
    
    async getReports(options = {}) {
        try {
            let query = this.client
                .from('reports')
                .select('*');
            
            // تطبيق الفلاتر
            if (options.employee) {
                query = query.eq('employee', options.employee);
            }
            
            if (options.areaCode) {
                query = query.eq('area_code', options.areaCode);
            }
            
            if (options.status) {
                query = query.eq('status', options.status);
            }
            
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            query = query.order('created_at', { ascending: false });
            
            const { data, error } = await query;
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur récupération rapports:', error);
            return { success: false, error: error.message };
        }
    }
    
    async createReport(reportData) {
        try {
            const reportToSend = {
                employee: reportData.employee,
                employee_name: reportData.employeeName,
                number_before: reportData.numberBefore,
                number_after: reportData.numberAfter,
                area: reportData.area,
                area_code: reportData.areaCode,
                note_code: reportData.noteCode,
                location: reportData.location,
                status: reportData.status,
                step: reportData.step,
                photos: reportData.photos || [],
                created_at: new Date().toISOString(),
                completion_date: reportData.completionDate || null
            };
            
            const { data, error } = await this.client
                .from('reports')
                .insert([reportToSend]);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur création rapport:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateReport(reportId, updates) {
        try {
            const { data, error } = await this.client
                .from('reports')
                .update(updates)
                .eq('id', reportId);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur mise à jour rapport:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deleteReport(reportId) {
        try {
            const { data, error } = await this.client
                .from('reports')
                .delete()
                .eq('id', reportId);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur suppression rapport:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== إدارة الصور ==========
    
    async uploadPhoto(file, options = {}) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${options.reportId || 'temp'}_${Date.now()}.${fileExt}`;
            const filePath = `photos/${fileName}`;
            
            const { data, error } = await this.client
                .storage
                .from('notecam-photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (error) throw error;
            
            // الحصول على رابط عام
            const { data: urlData } = this.client
                .storage
                .from('notecam-photos')
                .getPublicUrl(filePath);
            
            return { 
                success: true, 
                data: {
                    ...data,
                    publicUrl: urlData.publicUrl,
                    fileName: fileName
                }
            };
        } catch (error) {
            console.error('Erreur téléchargement photo:', error);
            return { success: false, error: error.message };
        }
    }
    
    async deletePhoto(filePath) {
        try {
            const { data, error } = await this.client
                .storage
                .from('notecam-photos')
                .remove([filePath]);
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur suppression photo:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== المزامنة ==========
    
    async syncFromSupabase() {
        try {
            console.log('Début synchronisation depuis Supabase...');
            
            // جلب جميع البيانات
            const [usersResult, areasResult, reportsResult] = await Promise.all([
                this.getUsers(),
                this.getAssignedAreas(),
                this.getReports({ limit: 1000 })
            ]);
            
            // معالجة النتائج
            const syncData = {};
            
            if (usersResult.success && usersResult.data) {
                syncData.users = usersResult.data;
            }
            
            if (areasResult.success && areasResult.data) {
                syncData.areas = areasResult.data;
            }
            
            if (reportsResult.success && reportsResult.data) {
                syncData.reports = reportsResult.data;
            }
            
            console.log('Synchronisation depuis Supabase terminée');
            return { success: true, data: syncData };
            
        } catch (error) {
            console.error('Erreur synchronisation depuis Supabase:', error);
            return { success: false, error: error.message };
        }
    }
    
    async syncToSupabase(localData) {
        try {
            console.log('Début synchronisation vers Supabase...');
            
            let syncedCount = 0;
            
            // مزامنة المستخدمين
            if (localData.users) {
                for (const user of localData.users) {
                    await this.createUser(user);
                    syncedCount++;
                }
            }
            
            // مزامنة المناطق
            if (localData.areas) {
                for (const area of localData.areas) {
                    await this.assignArea(area);
                    syncedCount++;
                }
            }
            
            // مزامنة التقارير
            if (localData.reports) {
                for (const report of localData.reports) {
                    await this.createReport(report);
                    syncedCount++;
                }
            }
            
            console.log(`Synchronisation vers Supabase terminée: ${syncedCount} éléments`);
            return { success: true, count: syncedCount };
            
        } catch (error) {
            console.error('Erreur synchronisation vers Supabase:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== التحقق من الحالة ==========
    
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            lastSync: localStorage.getItem('last_sync_time') || null
        };
    }
    
    // إعادة المحاولة
    async retryConnection() {
        if (this.retryCount >= this.maxRetries) {
            return { success: false, message: "Nombre maximum de tentatives atteint" };
        }
        
        this.retryCount++;
        console.log(`Nouvelle tentative de connexion... (${this.retryCount}/${this.maxRetries})`);
        
        return await this.initialize();
    }
    
    // إعادة التعيين
    reset() {
        this.client = null;
        this.isInitialized = false;
        this.retryCount = 0;
        console.log('Client Supabase réinitialisé');
    }
}

// إنشاء وتصدير نسخة واحدة
const supabaseClient = new SupabaseClient();
window.supabaseClient = supabaseClient;
