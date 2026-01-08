// نظام المصادقة مع Supabase

class AuthSystem {
    constructor() {
        this.currentUser = null;
    }

    // تسجيل الدخول مع Supabase
    async login(username, password) {
        try {
            // البحث في Supabase أولاً
            if (window.supabaseClient) {
                const { data: users, error } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .single();
                
                if (!error && users) {
                    if (users.password === password) {
                        this.currentUser = {
                            username: users.username,
                            role: users.role,
                            name: users.name,
                            assignedAreas: users.assigned_areas || []
                        };
                        
                        // تحديث البيانات المحلية
                        window.currentUser = this.currentUser;
                        window.usersData[username] = {
                            password: password,
                            role: users.role,
                            name: users.name,
                            assignedAreas: users.assigned_areas || []
                        };
                        
                        window.saveToLocalStorage();
                        return true;
                    }
                }
            }
            
            // إذا فشل في Supabase، حاول بالمستخدمين المحليين
            const user = window.usersData[username];
            if (user && user.password === password) {
                this.currentUser = {
                    username: username,
                    role: user.role,
                    name: user.name,
                    assignedAreas: user.assignedAreas || []
                };
                
                window.currentUser = this.currentUser;
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            
            // استخدام النظام المحلي كبديل
            const user = window.usersData[username];
            if (user && user.password === password) {
                this.currentUser = {
                    username: username,
                    role: user.role,
                    name: user.name,
                    assignedAreas: user.assignedAreas || []
                };
                
                window.currentUser = this.currentUser;
                return true;
            }
            
            return false;
        }
    }

    // تسجيل الخروج
    logout() {
        this.currentUser = null;
        window.currentUser = null;
        window.saveToLocalStorage();
    }

    // التحقق من الجلسة
    async checkSession() {
        const savedUser = localStorage.getItem('currentUser');
        if (!savedUser) return false;
        
        try {
            const user = JSON.parse(savedUser);
            
            // التحقق من Supabase
            if (window.supabaseClient) {
                const { data: remoteUser } = await supabaseClient
                    .from('users')
                    .select('username, role, name')
                    .eq('username', user.username)
                    .single();
                
                if (remoteUser) {
                    this.currentUser = {
                        ...user,
                        role: remoteUser.role,
                        name: remoteUser.name
                    };
                    window.currentUser = this.currentUser;
                    return true;
                }
            }
            
            // استخدام المحلي
            if (window.usersData[user.username]) {
                this.currentUser = user;
                window.currentUser = user;
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('خطأ في التحقق من الجلسة:', error);
            return false;
        }
    }
}

// إنشاء نسخة عالمية
window.authSystem = new AuthSystem();

// تعديل دالة login الأصلية
const originalLogin = window.login;
window.login = async function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const success = await window.authSystem.login(username, password);
    
    if (success) {
        originalLogin();
    } else {
        showNotification("Nom d'utilisateur ou mot de passe incorrect", "error");
    }
};
