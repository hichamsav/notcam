// إدارة الكاميرا
class CameraManager {
    constructor() {
        this.videoStream = null;
        this.isActive = false;
        this.hasPermission = false;
        this.cameraDevices = [];
        this.selectedCamera = null;
        this.cameraSettings = {
            resolution: { width: 1280, height: 720 },
            facingMode: 'environment',
            frameRate: 30
        };
        
        // عناصر DOM
        this.videoElement = null;
        this.canvasElement = null;
        this.overlayCanvas = null;
    }
    
    // تهيئة المدير
    async initialize() {
        try {
            console.log('Initialisation du gestionnaire de caméra...');
            
            // إنشاء عناصر DOM
            this.createDOMElements();
            
            // اكتشاف أجهزة الكاميرا
            await this.detectCameras();
            
            // طلب إذن الكاميرا
            await this.requestPermission();
            
            console.log('Gestionnaire de caméra initialisé');
            return true;
        } catch (error) {
            console.error('Erreur initialisation caméra:', error);
            this.showError('Impossible d\'initialiser la caméra');
            return false;
        }
    }
    
    // إنشاء عناصر DOM
    createDOMElements() {
        // عنصر الفيديو
        if (!this.videoElement) {
            this.videoElement = document.createElement('video');
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            this.videoElement.style.display = 'none';
            document.body.appendChild(this.videoElement);
        }
        
        // عنصر Canvas للرسم
        if (!this.canvasElement) {
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.style.display = 'none';
            document.body.appendChild(this.canvasElement);
        }
        
        // عنصر Canvas للتراكبات
        if (!this.overlayCanvas) {
            this.overlayCanvas = document.createElement('canvas');
            this.overlayCanvas.style.display = 'none';
            document.body.appendChild(this.overlayCanvas);
        }
    }
    
    // اكتشاف أجهزة الكاميرا
    async detectCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.cameraDevices = devices.filter(device => 
                device.kind === 'videoinput'
            );
            
            console.log(`${this.cameraDevices.length} caméras détectées`);
            
            // اختيار الكاميرا الخلفية إذا كانت متوفرة
            const backCamera = this.cameraDevices.find(device => 
                device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('arrière')
            );
            
            this.selectedCamera = backCamera || this.cameraDevices[0];
            
        } catch (error) {
            console.error('Erreur détection caméras:', error);
            this.cameraDevices = [];
        }
    }
    
    // طلب إذن الكاميرا
    async requestPermission() {
        try {
            // التحقق من دعم API
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('API caméra non supportée');
            }
            
            // طلب الإذن
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.cameraSettings.facingMode,
                    width: { ideal: this.cameraSettings.resolution.width },
                    height: { ideal: this.cameraSettings.resolution.height },
                    frameRate: { ideal: this.cameraSettings.frameRate }
                },
                audio: false
            });
            
            this.videoStream = stream;
            this.isActive = true;
            this.hasPermission = true;
            
            // تعيين مصدر الفيديو
            this.videoElement.srcObject = stream;
            
            // انتظار تحميل البيانات الوصفية
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
            
            // تحديث حجم Canvas
            this.updateCanvasSize();
            
            console.log('Permission caméra accordée');
            return true;
            
        } catch (error) {
            console.error('Erreur permission caméra:', error);
            this.hasPermission = false;
            this.showError(error.message);
            return false;
        }
    }
    
    // تحديث حجم Canvas
    updateCanvasSize() {
        if (!this.videoElement || !this.canvasElement) return;
        
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        
        if (videoWidth && videoHeight) {
            this.canvasElement.width = videoWidth;
            this.canvasElement.height = videoHeight;
            this.overlayCanvas.width = videoWidth;
            this.overlayCanvas.height = videoHeight;
        }
    }
    
    // تبديل حالة الكاميرا
    async toggleCamera() {
        if (this.isActive) {
            await this.stopCamera();
        } else {
            await this.startCamera();
        }
    }
    
    // بدء الكاميرا
    async startCamera() {
        try {
            if (!this.hasPermission) {
                await this.requestPermission();
            }
            
            if (this.videoStream) {
                this.isActive = true;
                this.videoElement.play();
                this.showSuccess('Caméra activée');
            }
            
        } catch (error) {
            console.error('Erreur démarrage caméra:', error);
            this.showError('Erreur d\'activation de la caméra');
        }
    }
    
    // إيقاف الكاميرا
    async stopCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
            this.isActive = false;
            this.showInfo('Caméra désactivée');
        }
    }
    
    // تبديل الكاميرا
    async switchCamera() {
        try {
            // إيقاف الكاميرا الحالية
            await this.stopCamera();
            
            // تغيير وضع الكاميرا
            this.cameraSettings.facingMode = 
                this.cameraSettings.facingMode === 'environment' ? 
                'user' : 'environment';
            
            // إعادة التشغيل
            await this.startCamera();
            
            this.showSuccess('Caméra changée');
            
        } catch (error) {
            console.error('Erreur changement caméra:', error);
            this.showError('Erreur de changement de caméra');
        }
    }
    
    // التقاط صورة
    async capturePhoto() {
        try {
            if (!this.isActive || !this.videoStream) {
                throw new Error('Caméra non active');
            }
            
            // عرض فلاش التقاط
            this.showCaptureFlash();
            
            // الانتظار لضمان استقرار الصورة
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // رسم الصورة على Canvas
            const context = this.canvasElement.getContext('2d');
            context.drawImage(
                this.videoElement, 
                0, 0, 
                this.canvasElement.width, 
                this.canvasElement.height
            );
            
            // إضافة المعلومات على الصورة
            this.addInfoOverlay(context);
            
            // تحويل إلى blob
            const blob = await new Promise(resolve => {
                this.canvasElement.toBlob(resolve, 'image/jpeg', 0.9);
            });
            
            // إنشاء رابط للصورة
            const imageUrl = URL.createObjectURL(blob);
            
            // إرجاع بيانات الصورة
            return {
                blob: blob,
                url: imageUrl,
                timestamp: new Date().toISOString(),
                resolution: {
                    width: this.canvasElement.width,
                    height: this.canvasElement.height
                }
            };
            
        } catch (error) {
            console.error('Erreur capture photo:', error);
            this.showError('Erreur de capture de photo');
            return null;
        }
    }
    
    // التقاط صورة مع معلومات إضافية
    async capturePhotoWithInfo(additionalInfo = {}) {
        const photoData = await this.capturePhoto();
        if (!photoData) return null;
        
        // إضافة المعلومات الإضافية
        return {
            ...photoData,
            info: {
                ...additionalInfo,
                cameraSettings: { ...this.cameraSettings },
                deviceInfo: this.getDeviceInfo()
            }
        };
    }
    
    // إضافة معلومات تراكبية
    addInfoOverlay(context) {
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;
        
        context.save();
        
        // إعداد الخط
        context.font = 'bold 16px Arial, sans-serif';
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 3;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        
        // معلومات الوقت والتاريخ
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');
        
        // معلومات الموقع (إن وجدت)
        const locationInfo = window.employeePanel?.location || {};
        const lat = locationInfo.lat ? locationInfo.lat.toFixed(6) : 'N/A';
        const lng = locationInfo.lng ? locationInfo.lng.toFixed(6) : 'N/A';
        
        // معلومات إضافية
        const zoneInfo = window.employeePanel?.progress?.selectedArea || {};
        const zoneName = zoneInfo.name || 'N/A';
        const zoneCode = zoneInfo.code || 'N/A';
        
        // إنشاء نص المعلومات
        const infoLines = [
            `Date: ${dateStr} ${timeStr}`,
            `Zone: ${zoneName} (${zoneCode})`,
            `Coords: ${lat}, ${lng}`,
            `App: ${Config.APP_NAME} v${Config.VERSION}`
        ];
        
        // إضافة خلفية للنص
        const lineHeight = 20;
        const padding = 10;
        const textWidth = Math.max(...infoLines.map(line => context.measureText(line).width));
        
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(
            padding,
            height - (infoLines.length * lineHeight) - padding * 2,
            textWidth + padding * 2,
            (infoLines.length * lineHeight) + padding * 2
        );
        
        // كتابة المعلومات
        context.fillStyle = 'white';
        infoLines.forEach((line, index) => {
            const y = height - (infoLines.length - index) * lineHeight + padding - 5;
            // نص الظل
            context.strokeText(line, padding + 5, y);
            // النص الرئيسي
            context.fillText(line, padding + 5, y);
        });
        
        // إضافة علامة مائية في الزاوية
        context.textAlign = 'right';
        context.font = 'bold 20px Arial, sans-serif';
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillText('NoteCam', width - 15, height - 15);
        
        context.restore();
    }
    
    // عرض معاينة الكاميرا
    showPreview(elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        
        // تنظيف الحاوية
        container.innerHTML = '';
        
        // إنشاء عنصر فيديو للمعاينة
        const previewVideo = document.createElement('video');
        previewVideo.autoplay = true;
        previewVideo.playsInline = true;
        previewVideo.style.width = '100%';
        previewVideo.style.height = '100%';
        previewVideo.style.objectFit = 'cover';
        previewVideo.style.borderRadius = '10px';
        
        // تعيين مصدر الفيديو
        if (this.videoStream) {
            previewVideo.srcObject = this.videoStream;
        }
        
        container.appendChild(previewVideo);
        
        // تحديث عندما يتغير مصدر الفيديو
        this.videoElement.onloadeddata = () => {
            previewVideo.srcObject = this.videoStream;
        };
    }
    
    // التقاط معاينة
    capturePreview(elementId) {
        const container = document.getElementById(elementId);
        if (!container || !this.canvasElement) return null;
        
        // إنشاء صورة من Canvas
        const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.9);
        
        // عرض المعاينة
        container.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.src = dataUrl;
        previewImg.style.width = '100%';
        previewImg.style.height = '100%';
        previewImg.style.objectFit = 'cover';
        previewImg.style.borderRadius = '10px';
        
        container.appendChild(previewImg);
        
        return dataUrl;
    }
    
    // تحسين الصورة
    enhanceImage(imageData) {
        // تطبيق تحسينات بسيطة على الصورة
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                
                // رسم الصورة الأصلية
                ctx.drawImage(img, 0, 0);
                
                // تطبيق تحسين التباين
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // تحسين بسيط للتباين
                for (let i = 0; i < data.length; i += 4) {
                    // زيادة التباين
                    const contrast = 1.2;
                    data[i] = ((data[i] / 255 - 0.5) * contrast + 0.5) * 255;
                    data[i + 1] = ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255;
                    data[i + 2] = ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255;
                }
                
                ctx.putImageData(imageData, 0, 0);
                
                // تحويل إلى blob
                canvas.toBlob(resolve, 'image/jpeg', 0.9);
            };
            
            img.src = imageData.url || imageData;
        });
    }
    
    // ضغط الصورة
    compressImage(blob, maxSizeKB = 500) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // حساب الأبعاد الجديدة
                    let width = img.width;
                    let height = img.height;
                    let quality = 0.9;
                    
                    // تقليل الجودة تدريجياً حتى الوصول للحجم المطلوب
                    const compress = () => {
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        canvas.toBlob((compressedBlob) => {
                            if (compressedBlob.size / 1024 <= maxSizeKB || quality <= 0.1) {
                                resolve(compressedBlob);
                            } else {
                                quality -= 0.1;
                                compress();
                            }
                        }, 'image/jpeg', quality);
                    };
                    
                    compress();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(blob);
        });
    }
    
    // الحصول على معلومات الجهاز
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: {
                width: window.screen.width,
                height: window.screen.height
            },
            cameras: this.cameraDevices.length,
            selectedCamera: this.selectedCamera?.label || 'default'
        };
    }
    
    // التحقق من دعم الكاميرا
    checkCameraSupport() {
        const supports = {
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            enumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
            canvas: !!window.HTMLCanvasElement,
            webGL: this.checkWebGLSupport()
        };
        
        return {
            supported: supports.getUserMedia && supports.canvas,
            details: supports
        };
    }
    
    // التحقق من دعم WebGL
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
    
    // إظهار فلاش التقاط
    showCaptureFlash() {
        const flash = document.getElementById('captureFlash');
        if (!flash) return;
        
        flash.style.animation = 'captureFlash 300ms ease-out';
        
        setTimeout(() => {
            flash.style.animation = '';
        }, 300);
    }
    
    // إظهار رسالة نجاح
    showSuccess(message) {
        showNotification(message, 'success');
    }
    
    // إظهار رسالة خطأ
    showError(message) {
        showNotification(message, 'error');
    }
    
    // إظهار رسالة معلومات
    showInfo(message) {
        showNotification(message, 'info');
    }
    
    // تنظيف الموارد
    cleanup() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        this.isActive = false;
        
        // إزالة عناصر DOM
        if (this.videoElement && this.videoElement.parentNode) {
            this.videoElement.parentNode.removeChild(this.videoElement);
        }
        
        if (this.canvasElement && this.canvasElement.parentNode) {
            this.canvasElement.parentNode.removeChild(this.canvasElement);
        }
        
        if (this.overlayCanvas && this.overlayCanvas.parentNode) {
            this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
        }
    }
    
    // الحصول على حالة الكاميرا
    getStatus() {
        return {
            isActive: this.isActive,
            hasPermission: this.hasPermission,
            devicesCount: this.cameraDevices.length,
            currentCamera: this.selectedCamera?.label || 'default',
            resolution: this.cameraSettings.resolution,
            facingMode: this.cameraSettings.facingMode
        };
    }
    
    // تحديث إعدادات الكاميرا
    updateSettings(settings) {
        if (settings.resolution) {
            this.cameraSettings.resolution = settings.resolution;
        }
        
        if (settings.facingMode) {
            this.cameraSettings.facingMode = settings.facingMode;
        }
        
        if (settings.frameRate) {
            this.cameraSettings.frameRate = settings.frameRate;
        }
        
        // إعادة تشغيل الكاميرا إذا كانت نشطة
        if (this.isActive) {
            this.stopCamera().then(() => this.startCamera());
        }
    }
}

// إنشاء وتصدير نسخة واحدة
const cameraManager = new CameraManager();
window.cameraManager = cameraManager;
