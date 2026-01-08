import { showNotification } from '../utils/notifications.js';

class CameraManager {
    constructor() {
        this.videoStream = null;
        this.isCameraActive = false;
        this.cameraPermission = false;
        this.videoDevices = [];
        this.selectedDeviceId = null;
        this.cameraConstraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment',
                frameRate: { ideal: 30 }
            },
            audio: false
        };
    }

    // طلب إذن الكاميرا
    async requestCameraPermission() {
        try {
            // التحقق من دعم API
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('الكاميرا غير مدعومة في هذا المتصفح');
            }

            // طلب الإذن
            const stream = await navigator.mediaDevices.getUserMedia(this.cameraConstraints);
            
            // إيقاف التدفق فوراً بعد الحصول على الإذن
            stream.getTracks().forEach(track => track.stop());
            
            this.cameraPermission = true;
            showNotification('تم منح إذن الكاميرا', 'success');
            return true;
            
        } catch (error) {
            console.error('خطأ في إذن الكاميرا:', error);
            this.handleCameraError(error);
            return false;
        }
    }

    // بدء الكاميرا
    async startCamera(videoElement, deviceId = null) {
        try {
            if (!this.cameraPermission) {
                const hasPermission = await this.requestCameraPermission();
                if (!hasPermission) return false;
            }

            // تحديث القيود بناءً على الجهاز المحدد
            const constraints = { ...this.cameraConstraints };
            if (deviceId) {
                constraints.video.deviceId = { exact: deviceId };
            }

            // بدء التدفق
            this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // عرض الفيديو
            if (videoElement) {
                videoElement.srcObject = this.videoStream;
                videoElement.play();
            }

            this.isCameraActive = true;
            this.updateCameraStatus(true);
            showNotification('تم تشغيل الكاميرا بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error('خطأ في تشغيل الكاميرا:', error);
            this.handleCameraError(error);
            return false;
        }
    }

    // إيقاف الكاميرا
    stopCamera(videoElement = null) {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => {
                track.stop();
            });
            this.videoStream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }

        this.isCameraActive = false;
        this.updateCameraStatus(false);
        showNotification('تم إيقاف الكاميرا', 'info');
    }

    // تبديل حالة الكاميرا
    async toggleCamera(videoElement) {
        if (this.isCameraActive) {
            this.stopCamera(videoElement);
        } else {
            await this.startCamera(videoElement);
        }
    }

    // التقاط صورة
    capturePhoto(videoElement, addMetadata = true) {
        return new Promise((resolve, reject) => {
            if (!this.isCameraActive || !this.videoStream) {
                reject(new Error('الكاميرا غير نشطة'));
                return;
            }

            try {
                // إنشاء canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // تعيين أبعاد Canvas لتتناسب مع الفيديو
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                
                // رسم الفيديو على Canvas
                context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                // إضافة البيانات التعريفية إذا طلب
                if (addMetadata) {
                    this.addMetadataToImage(context, canvas);
                }

                // تحويل إلى Blob
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('خطأ في إنشاء الصورة'));
                        return;
                    }

                    // إنشاء URL للصورة
                    const imageUrl = URL.createObjectURL(blob);
                    
                    // إضافة فلاش مرئي
                    this.showCaptureFlash();
                    
                    resolve({
                        blob: blob,
                        url: imageUrl,
                        width: canvas.width,
                        height: canvas.height,
                        timestamp: new Date().toISOString()
                    });
                    
                }, 'image/jpeg', 0.85);
                
            } catch (error) {
                console.error('خطأ في التقاط الصورة:', error);
                reject(error);
            }
        });
    }

    // إضافة بيانات التعريف للصورة
    addMetadataToImage(context, canvas) {
        const metadata = {
            timestamp: new Date().toLocaleString('ar-SA'),
            system: 'NoteCam v3.0',
            location: window.currentLocation || {}
        };

        context.save();
        
        // إعداد نص البيانات
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(10, canvas.height - 100, 250, 90);
        
        context.font = '12px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'right';
        
        // كتابة البيانات
        const lines = [
            `الوقت: ${metadata.timestamp}`,
            `النظام: ${metadata.system}`,
            `المكان: ${metadata.location.lat?.toFixed(6) || 'غير معروف'}, ${metadata.location.lng?.toFixed(6) || 'غير معروف'}`
        ];
        
        lines.forEach((line, index) => {
            context.fillText(line, 240, canvas.height - 80 + (index * 20));
        });
        
        context.restore();
    }

    // عرض فلاش التقاط الصورة
    showCaptureFlash() {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            opacity: 0;
            pointer-events: none;
            z-index: 9999;
            animation: flash 300ms ease-out;
        `;
        
        document.body.appendChild(flash);
        
        // إضافة animation CSS
        if (!document.querySelector('#flash-animation')) {
            const style = document.createElement('style');
            style.id = 'flash-animation';
            style.textContent = `
                @keyframes flash {
                    0% { opacity: 0; }
                    50% { opacity: 0.8; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // إزالة العنصر بعد انتهاء العرض
        setTimeout(() => {
            flash.remove();
        }, 300);
    }

    // جلب قائمة أجهزة الكاميرا
    async getCameraDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(device => device.kind === 'videoinput');
            return this.videoDevices;
        } catch (error) {
            console.error('خطأ في جلب أجهزة الكاميرا:', error);
            return [];
        }
    }

    // تغيير جهاز الكاميرا
    async switchCamera(deviceId, videoElement) {
        try {
            // إيقاف الكاميرا الحالية
            this.stopCamera(videoElement);
            
            // الانتظار قليلاً
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // تشغيل الكاميرا الجديدة
            const success = await this.startCamera(videoElement, deviceId);
            
            if (success) {
                this.selectedDeviceId = deviceId;
                showNotification('تم تغيير الكاميرا', 'success');
            }
            
            return success;
            
        } catch (error) {
            console.error('خطأ في تغيير الكاميرا:', error);
            showNotification('خطأ في تغيير الكاميرا', 'error');
            return false;
        }
    }

    // تحديث حالة الكاميرا في الواجهة
    updateCameraStatus(isActive) {
        const statusElement = document.getElementById('cameraStatus');
        const toggleButton = document.getElementById('toggleCameraBtn');
        
        if (statusElement) {
            if (isActive) {
                statusElement.className = 'camera-status active';
                statusElement.innerHTML = `
                    <div class="camera-icon">
                        <i class="fas fa-video"></i>
                    </div>
                    <div class="camera-text">الكاميرا نشطة</div>
                `;
            } else {
                statusElement.className = 'camera-status';
                statusElement.innerHTML = `
                    <div class="camera-icon">
                        <i class="fas fa-video-slash"></i>
                    </div>
                    <div class="camera-text">الكاميرا غير نشطة</div>
                `;
            }
        }
        
        if (toggleButton) {
            if (isActive) {
                toggleButton.innerHTML = '<i class="fas fa-video-slash"></i> إيقاف الكاميرا';
                toggleButton.classList.add('danger');
            } else {
                toggleButton.innerHTML = '<i class="fas fa-video"></i> تشغيل الكاميرا';
                toggleButton.classList.remove('danger');
                toggleButton.classList.add('primary');
            }
        }
    }

    // التعامل مع أخطاء الكاميرا
    handleCameraError(error) {
        let message = 'خطأ غير معروف في الكاميرا';
        
        switch (error.name) {
            case 'NotAllowedError':
                message = 'تم رفض إذن الكاميرا. يرجى التحقق من إعدادات المتصفح.';
                break;
            case 'NotFoundError':
                message = 'لم يتم العثور على كاميرا.';
                break;
            case 'NotReadableError':
                message = 'الكاميرا قيد الاستخدام من قبل تطبيق آخر.';
                break;
            case 'OverconstrainedError':
                message = 'الكاميرا لا تدعم الإعدادات المطلوبة.';
                break;
            case 'SecurityError':
                message = 'الكاميرا غير متاحة بسبب إعدادات الأمان.';
                break;
        }
        
        showNotification(message, 'error');
        console.error('خطأ الكاميرا:', error);
    }

    // تنظيف الموارد
    cleanup() {
        this.stopCamera();
        this.videoStream = null;
        this.isCameraActive = false;
        this.cameraPermission = false;
    }

    // التحقق من دعم الكاميرا
    checkCameraSupport() {
        const support = {
            getUserMedia: !!navigator.mediaDevices?.getUserMedia,
            enumerateDevices: !!navigator.mediaDevices?.enumerateDevices,
            facingMode: true,
            resolution: true
        };
        
        return support;
    }

    // التقاط صورة مع ضغط
    async captureCompressedPhoto(videoElement, quality = 0.8, maxWidth = 1280) {
        const photo = await this.capturePhoto(videoElement, false);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // تغيير الحجم إذا كان أكبر من الحد الأقصى
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // إضافة البيانات التعريفية
                this.addMetadataToImage(ctx, canvas);
                
                canvas.toBlob((blob) => {
                    resolve({
                        ...photo,
                        blob: blob,
                        compressed: true,
                        originalSize: photo.blob.size,
                        compressedSize: blob.size
                    });
                }, 'image/jpeg', quality);
            };
            img.src = photo.url;
        });
    }
}

// إنشاء نسخة وحيدة من مدير الكاميرا
export const cameraManager = new CameraManager();

// تعريض للاستخدام العالمي (للتوافق مع الكود القديم)
window.cameraManager = cameraManager;
