import { supabaseClient, SUPABASE_CONFIG } from './config.js';
import { showNotification } from '../utils/notifications.js';

class PhotoStorage {
    constructor() {
        this.bucketName = SUPABASE_CONFIG.STORAGE_BUCKET;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
    }

    // تحميل صورة إلى Supabase Storage
    async uploadPhoto(file, metadata) {
        try {
            // التحقق من حجم الملف
            if (file.size > this.maxFileSize) {
                throw new Error('حجم الصورة كبير جداً (الحد الأقصى 5MB)');
            }

            // إنشاء اسم فريد للملف
            const fileName = `${metadata.reportId}_${metadata.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const filePath = `${metadata.userId}/${metadata.zoneCode}/${fileName}`;

            // رفع الملف إلى Supabase Storage
            const { data, error } = await supabaseClient.storage
                .from(this.bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/jpeg'
                });

            if (error) throw error;

            // الحصول على رابط عام للصورة
            const { data: urlData } = supabaseClient.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            // حفظ بيانات الصورة في قاعدة البيانات
            const photoRecord = {
                file_path: filePath,
                public_url: urlData.publicUrl,
                user_id: metadata.userId,
                report_id: metadata.reportId,
                zone_code: metadata.zoneCode,
                photo_type: metadata.type,
                photo_index: metadata.index,
                location: metadata.location,
                timestamp: metadata.timestamp,
                file_size: file.size,
                uploaded_at: new Date().toISOString()
            };

            const { data: dbData, error: dbError } = await supabaseClient
                .from('photos_metadata')
                .insert([photoRecord])
                .select()
                .single();

            if (dbError) throw dbError;

            showNotification('تم رفع الصورة بنجاح', 'success');
            return dbData;

        } catch (error) {
            console.error('خطأ في رفع الصورة:', error);
            showNotification('خطأ في رفع الصورة', 'error');
            throw error;
        }
    }

    // جلب الصور الخاصة بتقرير معين
    async getReportPhotos(reportId) {
        try {
            const { data, error } = await supabaseClient
                .from('photos_metadata')
                .select('*')
                .eq('report_id', reportId)
                .order('photo_index', { ascending: true });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('خطأ في جلب الصور:', error);
            return [];
        }
    }

    // حذف صورة
    async deletePhoto(photoId) {
        try {
            // جلب معلومات الصورة أولاً
            const { data: photo, error: fetchError } = await supabaseClient
                .from('photos_metadata')
                .select('file_path')
                .eq('id', photoId)
                .single();

            if (fetchError) throw fetchError;

            // حذف من Storage
            const { error: storageError } = await supabaseClient.storage
                .from(this.bucketName)
                .remove([photo.file_path]);

            if (storageError) throw storageError;

            // حذف من قاعدة البيانات
            const { error: dbError } = await supabaseClient
                .from('photos_metadata')
                .delete()
                .eq('id', photoId);

            if (dbError) throw dbError;

            showNotification('تم حذف الصورة بنجاح', 'success');
            return true;

        } catch (error) {
            console.error('خطأ في حذف الصورة:', error);
            showNotification('خطأ في حذف الصورة', 'error');
            throw error;
        }
    }

    // تحويل Blob إلى File
    blobToFile(blob, fileName) {
        return new File([blob], fileName, { 
            type: 'image/jpeg',
            lastModified: Date.now()
        });
    }

    // ضغط الصورة
    async compressImage(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // تحديد الأبعاد
                    const maxWidth = 1280;
                    const maxHeight = 720;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // رسم الصورة مع الضغط
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob(
                        (blob) => resolve(blob),
                        'image/jpeg',
                        quality
                    );
                };
                
                img.onerror = reject;
            };
            
            reader.onerror = reject;
        });
    }
}

export const photoStorage = new PhotoStorage();
