import { supabaseClient, TABLES, appState } from './config.js';
import { showNotification, updateUIForUser } from '../utils/notifications.js';

class AuthSystem {
    constructor() {
        this.currentSession = null;
    }

    // تسجيل الدخول
    async login(username, password) {
        try {
            // البحث عن المستخدم في Supabase
            const { data: user, error } = await supabaseClient
                .from(TABLES.USERS)
                .select('*')
                .eq('username', username)
                .single();

            if (error || !user) {
                showNotification('اسم المستخدم غير صحيح', 'error');
                return false;
            }

            // التحقق من كلمة المرور (في production يجب استخدام hashing)
            if (user.password !== password) {
                showNotification('كلمة المرور غير صحيحة', 'error');
                return false;
            }

            // حفظ جلسة المستخدم
            this.currentSession = {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                lastLogin: new Date().toISOString()
            };

            appState.currentUser = this.currentSession;

            // حفظ في localStorage للجلسات
            localStorage.setItem('notecam_user', JSON.stringify(this.currentSession));
            localStorage.setItem('notecam_last_login', new Date().toISOString());

            showNotification(`مرحباً ${user.name}`, 'success');
            return true;

        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            showNotification('خطأ في النظام، حاول لاحقاً', 'error');
            return false;
        }
    }

    // تسجيل الخروج
    logout() {
        this.currentSession = null;
        appState.currentUser = null;
        localStorage.removeItem('notecam_user');
        localStorage.removeItem('notecam_last_login');
        showNotification('تم تسجيل الخروج بنجاح', 'success');
    }

    // التحقق من الجلسة النشطة
    async checkSession() {
        const savedUser = localStorage.getItem('notecam_user');
        if (!savedUser) return false;

        try {
            const user = JSON.parse(savedUser);
            const { data, error } = await supabaseClient
                .from(TABLES.USERS)
                .select('id, username, role, name')
                .eq('id', user.id)
                .single();

            if (error || !data) {
                this.logout();
                return false;
            }

            this.currentSession = { ...data, lastLogin: user.lastLogin };
            appState.currentUser = this.currentSession;
            return true;

        } catch (error) {
            console.error('خطأ في التحقق من الجلسة:', error);
            return false;
        }
    }

    // إنشاء مستخدم جديد (للمشرف فقط)
    async createUser(userData) {
        try {
            const { data, error } = await supabaseClient
                .from(TABLES.USERS)
                .insert([{
                    username: userData.username,
                    password: userData.password, // في production استخدم hashing
                    role: userData.role || 'employee',
                    name: userData.name,
                    created_at: new Date().toISOString(),
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;
            
            showNotification(`تم إنشاء المستخدم ${userData.name} بنجاح`, 'success');
            return data;

        } catch (error) {
            console.error('خطأ في إنشاء المستخدم:', error);
            showNotification('خطأ في إنشاء المستخدم', 'error');
            throw error;
        }
    }

    // تحديث بيانات المستخدم
    async updateUser(userId, updates) {
        try {
            const { data, error } = await supabaseClient
                .from(TABLES.USERS)
                .update(updates)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            
            showNotification('تم تحديث بيانات المستخدم', 'success');
            return data;

        } catch (error) {
            console.error('خطأ في تحديث المستخدم:', error);
            showNotification('خطأ في تحديث المستخدم', 'error');
            throw error;
        }
    }

    // حذف المستخدم
    async deleteUser(userId) {
        try {
            const { error } = await supabaseClient
                .from(TABLES.USERS)
                .delete()
                .eq('id', userId);

            if (error) throw error;
            
            showNotification('تم حذف المستخدم بنجاح', 'success');
            return true;

        } catch (error) {
            console.error('خطأ في حذف المستخدم:', error);
            showNotification('خطأ في حذف المستخدم', 'error');
            throw error;
        }
    }

    // جلب جميع المستخدمين
    async getAllUsers() {
        try {
            const { data, error } = await supabaseClient
                .from(TABLES.USERS)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('خطأ في جلب المستخدمين:', error);
            return [];
        }
    }
}

// تصدير نسخة واحدة من النظام
export const authSystem = new AuthSystem();
