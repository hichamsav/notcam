// إعدادات Supabase - يجب تعبئتها بمعلوماتك
const SUPABASE_CONFIG = {
    URL: 'https://jxvnmcgfwlbswtkiglmh.supabase.co', // ضع رابط مشروعك
    ANON_KEY: 'sb_publishable_2NInsIOwZjO8LurZUdI2wA_ljsWkESw', // ضع مفتاحك
    STORAGE_BUCKET: 'notecam-photos'
};

// تهيئة Supabase Client
let supabaseClient = null;

async function initializeSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('Supabase SDK غير محمل');
            return null;
        }
        
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.URL, 
            SUPABASE_CONFIG.ANON_KEY
        );
        
        console.log('Supabase متصل بنجاح');
        return supabaseClient;
        
    } catch (error) {
        console.error('خطأ في تهيئة Supabase:', error);
        return null;
    }
}

// تعريض للاستخدام العام
window.supabaseClient = supabaseClient;
window.initializeSupabase = initializeSupabase;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
