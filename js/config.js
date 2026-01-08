// إعدادات Supabase
const SUPABASE_SETTINGS = {
    URL: 'https://jxvnmcgfwlbswtkiglmh.supabase.co',
    KEY: 'sb_publishable_2NInsIOwZjO8LurZUdI2wA_ljsWkESw',
    BUCKET: 'notecam-photos'
};

// عميل Supabase
let notecamSupabase = null;

// دالة التهيئة
async function setupSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase SDK غير محمل');
            return null;
        }
        
        notecamSupabase = supabase.createClient(
            SUPABASE_SETTINGS.URL, 
            SUPABASE_SETTINGS.KEY
        );
        
        console.log('✅ Supabase جاهز للاستخدام');
        return notecamSupabase;
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة Supabase:', error);
        return null;
    }
}

// تصدير للاستخدام
window.notecamSupabase = notecamSupabase;
window.setupSupabase = setupSupabase;
window.SUPABASE_SETTINGS = SUPABASE_SETTINGS;
