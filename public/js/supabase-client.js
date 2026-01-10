// Supabase Client Configuration
class SupabaseClient {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.config = window.SUPABASE_CONFIG;
    }

    async initialize() {
        try {
            // الحصول على الإعدادات من Netlify Environment
            const supabaseUrl = this.config.url || await this.fetchConfig();
            const supabaseKey = this.config.key || await this.fetchConfig();
            
            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase configuration missing');
            }
            
            this.client = window.supabase.createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false
                },
                global: {
                    headers: {
                        'X-Client-Info': 'notecam-web-v1'
                    }
                }
            });
            
            this.initialized = true;
            console.log('Supabase initialized');
            return true;
            
        } catch (error) {
            console.warn('Supabase initialization failed:', error);
            return false;
        }
    }

    async fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                return config;
            }
        } catch (error) {
            console.log('Config fetch failed, using localStorage');
        }
        
        // Fallback إلى localStorage
        return {
            url: localStorage.getItem('supabase_url'),
            key: localStorage.getItem('supabase_key')
        };
    }

    async login(email, password) {
        try {
            if (!this.client) await this.initialize();
            
            const { data, error } = await this.client.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            // جلب بيانات المستخدم
            const profile = await this.getUserProfile(data.user.id);
            
            return {
                success: true,
                user: {
                    ...data.user,
                    profile: profile
                }
            };
            
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getUserProfile(userId) {
        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('Profile fetch error:', error);
            return null;
        }
    }

    async createReport(reportData) {
        try {
            const { data, error } = await this.client
                .from('reports')
                .insert([reportData])
                .select()
                .single();
            
            if (error) throw error;
            return { success: true, data };
            
        } catch (error) {
            console.error('Create report error:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadPhoto(file, reportId, photoType) {
        try {
            const fileName = `photo_${Date.now()}_${photoType}.jpg`;
            const filePath = `reports/${reportId}/${fileName}`;
            
            // رفع الصورة إلى Storage
            const { data: uploadData, error: uploadError } = await this.client.storage
                .from('report-photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) throw uploadError;
            
            // حفظ المرجع في قاعدة البيانات
            const { error: dbError } = await this.client
                .from('photos')
                .insert([{
                    report_id: reportId,
                    photo_type: photoType,
                    storage_path: uploadData.path,
                    file_size: file.size,
                    mime_type: file.type
                }]);
            
            if (dbError) throw dbError;
            
            return { success: true, path: uploadData.path };
            
        } catch (error) {
            console.error('Upload photo error:', error);
            return { success: false, error: error.message };
        }
    }

    async getPhotoUrl(filePath) {
        const { data } = this.client.storage
            .from('report-photos')
            .getPublicUrl(filePath);
        
        return data.publicUrl;
    }

    async syncData(localData) {
        try {
            // مزامنة التقارير
            for (const report of localData.reports) {
                if (!report.synced) {
                    await this.createReport(report);
                    report.synced = true;
                }
            }
            
            // مزامنة الصور
            for (const photo of localData.photos) {
                if (!photo.synced) {
                    const file = await this.blobToFile(photo.blob, `photo_${photo.id}.jpg`);
                    await this.uploadPhoto(file, photo.reportId, photo.type);
                    photo.synced = true;
                }
            }
            
            return { success: true, synced: localData.reports.length + localData.photos.length };
            
        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }

    async blobToFile(blob, fileName) {
        return new File([blob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now()
        });
    }

    async logout() {
        try {
            await this.client.auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export كـ Singleton
window.supabaseClient = new SupabaseClient();