// إعدادات Supabase
const SUPABASE_CONFIG = {
    URL: 'https://jxvnmcgfwlbswtkiglmh.supabase.co',
    ANON_KEY: 'sb_publishable_2NInsIOwZjO8LurZUdI2wA_ljsWkESw',
    STORAGE_BUCKET: 'notecam-photos'
};

// جداول قاعدة البيانات
const TABLES = {
    USERS: 'users',
    AREAS: 'assigned_areas',
    REPORTS: 'reports',
    PHOTOS: 'photos_metadata'
};

// حالة التطبيق
let appState = {
    currentUser: null,
    isOnline: navigator.onLine,
    lastSync: null,
    isSyncing: false
};

// تهيئة Supabase
let supabaseClient = null;

async function initializeSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('Supabase SDK غير محمل');
            return null;
        }
        
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.URL, 
            SUPABASE_CONFIG.ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                },
                global: {
                    headers: { 'x-application-name': 'NoteCam-System' }
                }
            }
        );
        
        // اختبار الاتصال
        const { data, error } = await supabaseClient
            .from(TABLES.USERS)
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        console.log('Supabase متصل بنجاح');
        return supabaseClient;
        
    } catch (error) {
        console.error('خطأ في تهيئة Supabase:', error);
        return null;
    }
}

// تصدير المتغيرات والدوال
export {
    SUPABASE_CONFIG,
    TABLES,
    appState,
    supabaseClient,
    initializeSupabase
};
