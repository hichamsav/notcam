// تخزين الصور في Supabase Storage

class PhotoStorage {
    constructor() {
        this.bucketName = 'notecam-photos';
    }

    // تحويل Blob إلى File
    blobToFile(blob, filename) {
        return new File([blob], filename, { 
            type: 'image/jpeg',
            lastModified: Date.now()
        });
    }

    // رفع صورة إلى Supabase
    async uploadPhoto(photoBlob, metadata) {
        if (!window.supabaseClient) {
            // حفظ محلي في حالة عدم الاتصال
            return this.savePhotoLocally(photoBlob, metadata);
        }
        
        try {
            // إنشاء اسم فريد للصورة
            const filename = `photo_${metadata.userId}_${metadata.zoneCode}_${Date.now()}.jpg`;
            const filepath = `${metadata.userId}/${metadata.zoneCode}/${filename}`;
            
            // تحويل Blob إلى File
            const file = this.blobToFile(photoBlob, filename);
            
            // رفع إلى Supabase Storage
            const { data, error } = await supabaseClient.storage
                .from(this.bucketName)
                .upload(filepath, file);
            
            if (error) throw error;
            
            // الحصول على الرابط العام
            const { data: urlData } = supabaseClient.storage
                .from(this.bucketName)
                .getPublicUrl(filepath);
            
            // حفظ بيانات الصورة في قاعدة البيانات
            const photoData = {
                user_id: metadata.userId,
                report_id: metadata.reportId,
                zone_code: metadata.zoneCode,
                photo_type: metadata.type,
                photo_index: metadata.index,
                file_path: filepath,
                public_url: urlData.publicUrl,
                location: metadata.location,
                timestamp: new Date().toISOString()
            };
            
            await supabaseClient
                .from('photos_metadata')
                .insert([photoData]);
            
            return urlData.publicUrl;
            
        } catch (error) {
            console.error('خطأ في رفع الصورة:', error);
            // حفظ محلي
            return this.savePhotoLocally(photoBlob, metadata);
        }
    }

    // حفظ الصورة محلياً (في حالة عدم الاتصال)
    savePhotoLocally(photoBlob, metadata) {
        const localPhotos = JSON.parse(localStorage.getItem('local_photos') || '[]');
        const photoId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // تحويل Blob إلى Base64 للحفظ
        const reader = new FileReader();
        reader.readAsDataURL(photoBlob);
        
        reader.onloadend = () => {
            localPhotos.push({
                id: photoId,
                data: reader.result,
                metadata: metadata,
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('local_photos', JSON.stringify(localPhotos));
        };
        
        return `local://${photoId}`;
    }

    // مزامنة الصور المحلية
    async syncLocalPhotos() {
        if (!window.supabaseClient) return;
        
        const localPhotos = JSON.parse(localStorage.getItem('local_photos') || '[]');
        
        for (const photo of localPhotos) {
            try {
                // تحويل Base64 إلى Blob
                const response = await fetch(photo.data);
                const blob = await response.blob();
                
                // رفع الصورة
                const url = await this.uploadPhoto(blob, photo.metadata);
                
                if (url && !url.startsWith('local://')) {
                    // إزالة من القائمة المحلية بعد النجاح
                    localPhotos.splice(localPhotos.indexOf(photo), 1);
                }
            } catch (error) {
                console.error('فشل في مزامنة الصورة:', error);
            }
        }
        
        localStorage.setItem('local_photos', JSON.stringify(localPhotos));
    }
}

// إنشاء نسخة عالمية
window.photoStorage = new PhotoStorage();
