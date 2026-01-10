// نظام المصادقة الآمن
const Auth = {
    // حالة النظام
    currentUser: null,
    isAuthenticated: false,
    
    // تسجيل الدخول
    async login(username, password) {
        try {
            // التحقق من بيانات الدخول
            const user = await this.verifyCredentials(username, password);
            
            if (user) {
                this.currentUser = user;
                this.isAuthenticated = true;
                
                // حفظ جلسة المستخدم
                this.saveSession();
                
                // تسجيل الحدث
                await this.logLoginEvent(username, true);
                
                return { success: true, user: user };
            } else {
                await this.logLoginEvent(username, false);
                return { success: false, message: "Nom d'utilisateur ou mot de passe incorrect" };
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            return { success: false, message: "Erreur système lors de la connexion" };
        }
    },
    
    // التحقق من بيانات الدخول
    async verifyCredentials(username, password) {
        try {
            // أولاً: التحقق من المستخدمين المحليين
            const localData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS);
            if (localData) {
                const users = JSON.parse(localData);
                if (users[username] && users[username].password === password) {
                    return { 
                        username: username, 
                        ...users[username] 
                    };
                }
            }
            
            // ثانياً: التحقق من Supabase (إذا كان متصلاً)
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .single();
                    
                if (!error && data && data.password === password) {
                    const userData = {
                        username: data.username,
                        password: data.password,
                        role: data.role,
                        name: data.name,
                        assignedAreas: data.assigned_areas || []
                    };
                    
                    // حفظ محلياً للمستقبل
                    this.saveUserLocally(username, userData);
                    
                    return userData;
                }
            }
            
            // ثالثاً: التحقق من المستخدمين الافتراضيين
            if (Config.DEFAULT_USERS[username] && 
                Config.DEFAULT_USERS[username].password === password) {
                return { 
                    username: username, 
                    ...Config.DEFAULT_USERS[username] 
                };
            }
            
            return null;
        } catch (error) {
            console.error('Erreur vérification:', error);
            return null;
        }
    },
    
    // تسجيل الخروج
    logout() {
        // حفظ تقدم الموظف قبل الخروج
        if (this.currentUser && this.currentUser.role === 'employee') {
            const progress = {
                selectedArea: window.selectedArea,
                selectedNumber: window.selectedNumber,
                selectedNumberAfter: window.selectedNumberAfter,
                currentStep: window.currentStep,
                beforePhotosCount: window.beforePhotos ? window.beforePhotos.filter(p => p !== null).length : 0,
                afterPhotosCount: window.afterPhotos ? window.afterPhotos.filter(p => p !== null).length : 0,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem(
                `userProgress_${this.currentUser.username}`, 
                JSON.stringify(progress)
            );
        }
        
        // إغلاق الكاميرا إن كانت مفتوحة
        if (window.videoStream) {
            window.videoStream.getTracks().forEach(track => track.stop());
            window.videoStream = null;
        }
        
        // مسح الجلسة
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem(Config.LOCAL_STORAGE_KEYS.CURRENT_USER);
        
        // تسجيل حدث الخروج
        this.logLogoutEvent();
        
        return true;
    },
    
    // التحقق من الجلسة
    checkSession() {
        try {
            const sessionData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.CURRENT_USER);
            if (sessionData) {
                const user = JSON.parse(sessionData);
                this.currentUser = user;
                this.isAuthenticated = true;
                return user;
            }
            return null;
        } catch (error) {
            console.error('Erreur vérification session:', error);
            return null;
        }
    },
    
    // حفظ الجلسة
    saveSession() {
        if (this.currentUser) {
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.CURRENT_USER, 
                JSON.stringify(this.currentUser)
            );
        }
    },
    
    // حفظ المستخدم محلياً
    saveUserLocally(username, userData) {
        try {
            const localData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS);
            const users = localData ? JSON.parse(localData) : {};
            users[username] = userData;
            localStorage.setItem(Config.LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));
        } catch (error) {
            console.error('Erreur sauvegarde locale:', error);
        }
    },
    
    // تسجيل أحداث الدخول
    async logLoginEvent(username, success) {
        const event = {
            type: 'login',
            username: username,
            success: success,
            timestamp: new Date().toISOString(),
            ip: await this.getClientIP(),
            userAgent: navigator.userAgent
        };
        
        // حفظ محلياً
        this.saveEventLog(event);
        
        // إرسال إلى Supabase إن أمكن
        if (window.supabaseClient && success) {
            try {
                await window.supabaseClient
                    .from('audit_logs')
                    .insert([{
                        event_type: 'login',
                        user_id: username,
                        success: success,
                        details: JSON.stringify(event)
                    }]);
            } catch (error) {
                console.error('Erreur envoi log:', error);
            }
        }
    },
    
    // تسجيل أحداث الخروج
    logLogoutEvent() {
        if (!this.currentUser) return;
        
        const event = {
            type: 'logout',
            username: this.currentUser.username,
            timestamp: new Date().toISOString()
        };
        
        this.saveEventLog(event);
    },
    
    // حفظ سجل الأحداث
    saveEventLog(event) {
        try {
            const logs = JSON.parse(localStorage.getItem('notecam_audit_logs') || '[]');
            logs.push(event);
            
            // حفظ آخر 100 حدث فقط
            if (logs.length > 100) {
                logs.shift();
            }
            
            localStorage.setItem('notecam_audit_logs', JSON.stringify(logs));
        } catch (error) {
            console.error('Erreur sauvegarde logs:', error);
        }
    },
    
    // الحصول على IP العميل
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    },
    
    // التحقق من الصلاحيات
    hasPermission(requiredRole) {
        if (!this.isAuthenticated || !this.currentUser) return false;
        
        if (requiredRole === 'admin') {
            return this.currentUser.role === 'admin';
        } else if (requiredRole === 'employee') {
            return this.currentUser.role === 'employee' || this.currentUser.role === 'admin';
        }
        
        return false;
    },
    
    // تغيير كلمة المرور
    async changePassword(username, oldPassword, newPassword) {
        try {
            // التحقق من كلمة المرور القديمة
            const user = await this.verifyCredentials(username, oldPassword);
            if (!user) {
                return { success: false, message: "Ancien mot de passe incorrect" };
            }
            
            // تحديث محلياً
            const localData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS);
            if (localData) {
                const users = JSON.parse(localData);
                if (users[username]) {
                    users[username].password = newPassword;
                    localStorage.setItem(Config.LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));
                }
            }
            
            // تحديث في Supabase
            if (window.supabaseClient) {
                await window.supabaseClient
                    .from('users')
                    .update({ password: newPassword })
                    .eq('username', username);
            }
            
            // تسجيل الحدث
            this.saveEventLog({
                type: 'password_change',
                username: username,
                timestamp: new Date().toISOString()
            });
            
            return { success: true, message: "Mot de passe changé avec succès" };
        } catch (error) {
            console.error('Erreur changement mot de passe:', error);
            return { success: false, message: "Erreur lors du changement du mot de passe" };
        }
    },
    
    // إعادة تعيين كلمة المرور (للمشرف فقط)
    async resetPassword(username, newPassword) {
        try {
            // تحديث محلياً
            const localData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS);
            if (localData) {
                const users = JSON.parse(localData);
                if (users[username]) {
                    users[username].password = newPassword;
                    localStorage.setItem(Config.LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));
                }
            }
            
            // تحديث في Supabase
            if (window.supabaseClient) {
                await window.supabaseClient
                    .from('users')
                    .update({ password: newPassword })
                    .eq('username', username);
            }
            
            // تسجيل الحدث
            this.saveEventLog({
                type: 'password_reset',
                username: username,
                resetBy: this.currentUser?.username,
                timestamp: new Date().toISOString()
            });
            
            return { success: true, message: "Mot de passe réinitialisé avec succès" };
        } catch (error) {
            console.error('Erreur réinitialisation mot de passe:', error);
            return { success: false, message: "Erreur lors de la réinitialisation du mot de passe" };
        }
    }
};

// جعل الوظيفة متاحة عالمياً
window.Auth = Auth;
