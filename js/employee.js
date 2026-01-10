// لوحة الموظف
class EmployeePanel {
    constructor() {
        this.currentUser = null;
        this.assignedAreas = [];
        this.reports = [];
        this.progress = {
            selectedArea: null,
            selectedNumber: null,
            selectedNumberAfter: null,
            currentStep: 1,
            beforePhotos: [null, null, null, null, null],
            afterPhotos: [null, null, null, null, null],
            tempReport: null
        };
        
        // حالة الكاميرا
        this.camera = {
            isActive: false,
            videoStream: null,
            hasPermission: false
        };
        
        // الموقع
        this.location = {
            lat: null,
            lng: null,
            elev: null,
            prec: null,
            time: null,
            isUpdating: false
        };
    }
    
    // تهيئة اللوحة
    async initialize(user) {
        try {
            console.log('Initialisation du panneau employé...');
            
            this.currentUser = user;
            
            // تحميل البيانات
            await this.loadData();
            
            // تحميل التقدم المحفوظ
            this.loadProgress();
            
            // عرض الواجهة
            this.renderDashboard();
            
            // إعداد المستمعين للأحداث
            this.setupEventListeners();
            
            // بدء تحديث الموقع
            this.startLocationUpdates();
            
            // محاولة تفعيل الكاميرا
            setTimeout(() => this.initializeCamera(), 1000);
            
            console.log('Panneau employé initialisé');
            return true;
        } catch (error) {
            console.error('Erreur initialisation panneau employé:', error);
            return false;
        }
    }
    
    // تحميل البيانات
    async loadData() {
        try {
            // تحميل المناطق المخصصة للموظف
            this.assignedAreas = this.currentUser.assignedAreas || [];
            
            // تحميل تقارير الموظف
            await this.loadUserReports();
            
            // تحميل آخر تقدم
            const progressData = localStorage.getItem(`userProgress_${this.currentUser.username}`);
            if (progressData) {
                this.progress = JSON.parse(progressData);
            }
            
        } catch (error) {
            console.error('Erreur chargement données employé:', error);
        }
    }
    
    // تحميل تقارير الموظف
    async loadUserReports() {
        try {
            // من التخزين المحلي أولاً
            const reportsData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.REPORTS);
            if (reportsData) {
                const allReports = JSON.parse(reportsData);
                this.reports = allReports.filter(r => r.employee === this.currentUser.username);
            }
            
            // من Supabase إن أمكن
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                const result = await window.supabaseClient.getReports({
                    employee: this.currentUser.username
                });
                
                if (result.success && result.data) {
                    this.reports = result.data.map(report => ({
                        id: report.id,
                        employee: report.employee,
                        employeeName: report.employee_name,
                        numberBefore: report.number_before,
                        numberAfter: report.number_after,
                        date: report.created_at,
                        location: report.location,
                        area: report.area,
                        areaCode: report.area_code,
                        noteCode: report.note_code,
                        status: report.status,
                        step: report.step,
                        completionDate: report.completion_date,
                        photos: report.photos || []
                    }));
                }
            }
            
        } catch (error) {
            console.error('Erreur chargement rapports employé:', error);
        }
    }
    
    // تحميل التقدم المحفوظ
    loadProgress() {
        try {
            const savedProgress = localStorage.getItem(`userProgress_${this.currentUser.username}`);
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                
                // تطبيق التقدم
                if (progress.selectedArea) {
                    this.progress.selectedArea = progress.selectedArea;
                }
                if (progress.selectedNumber !== undefined) {
                    this.progress.selectedNumber = progress.selectedNumber;
                }
                if (progress.selectedNumberAfter !== undefined) {
                    this.progress.selectedNumberAfter = progress.selectedNumberAfter;
                }
                if (progress.currentStep) {
                    this.progress.currentStep = progress.currentStep;
                }
                
                // تحميل التقرير المؤقت
                const savedTempReport = localStorage.getItem(`tempReport_${this.currentUser.username}`);
                if (savedTempReport) {
                    this.progress.tempReport = JSON.parse(savedTempReport);
                }
            }
        } catch (error) {
            console.error('Erreur chargement progression:', error);
        }
    }
    
    // حفظ التقدم
    saveProgress() {
        try {
            const progressData = {
                selectedArea: this.progress.selectedArea,
                selectedNumber: this.progress.selectedNumber,
                selectedNumberAfter: this.progress.selectedNumberAfter,
                currentStep: this.progress.currentStep,
                beforePhotosCount: this.progress.beforePhotos.filter(p => p !== null).length,
                afterPhotosCount: this.progress.afterPhotos.filter(p => p !== null).length,
                hasTempReport: this.progress.tempReport !== null,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem(
                `userProgress_${this.currentUser.username}`,
                JSON.stringify(progressData)
            );
            
            // حفظ التقرير المؤقت إن وجد
            if (this.progress.tempReport) {
                localStorage.setItem(
                    `tempReport_${this.currentUser.username}`,
                    JSON.stringify(this.progress.tempReport)
                );
            }
            
        } catch (error) {
            console.error('Erreur sauvegarde progression:', error);
        }
    }
    
    // عرض لوحة التحكم
    renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = this.getDashboardHTML();
        
        // تحديث البيانات
        this.updateAreaSelection();
        this.updatePhotoBoxes();
        this.updateProgressIndicator();
        this.updateSendButtons();
        this.updateLocationDisplay();
        
        // عرض الخطوة الحالية
        this.showCurrentStep();
    }
    
    // HTML للوحة الموظف
    getDashboardHTML() {
        return `
            <div class="app-container">
                <div class="status-bar">
                    <div>Employé • ${this.currentUser.name}</div>
                    <div class="sync-status" id="employeeSyncStatus">
                        <i class="fas fa-sync"></i>
                        <span>Prêt</span>
                    </div>
                </div>
                
                <div class="employee-panel">
                    <!-- رأس اللوحة -->
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fas fa-user"></i> ${this.currentUser.name}
                            <span class="badge badge-blue">Employé</span>
                        </div>
                        <button class="logout-btn" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i> Déconnexion
                        </button>
                    </div>
                    
                    <!-- منطقة المزامنة -->
                    <div class="dashboard-section">
                        <h3><i class="fas fa-sync"></i> Synchronisation</h3>
                        <div class="sync-controls">
                            <button class="sync-btn" onclick="employeePanel.syncData()">
                                <i class="fas fa-sync-alt"></i> Synchroniser
                            </button>
                            <div class="sync-info">
                                Votre progression est sauvegardée automatiquement
                                <div id="employeeSyncDetail" class="sync-success">Connecté</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- اختيار المنطقة -->
                    <div class="employee-area">
                        <div class="area-selection">
                            <label><i class="fas fa-map-marker-alt"></i> Sélectionnez votre zone de travail :</label>
                            <select class="area-select" id="areaSelectEmployee">
                                <option value="">Choisissez une zone</option>
                            </select>
                            
                            <div class="selected-area-display" id="selectedAreaInfo" style="display: none;">
                                <div class="area-info-header">
                                    <h4><i class="fas fa-map-marker-alt"></i> Zone sélectionnée</h4>
                                    <span class="badge badge-green" id="areaStatusBadge">Active</span>
                                </div>
                                <div class="area-details-grid">
                                    <div class="area-detail">
                                        <span class="detail-label">Nom:</span>
                                        <span class="detail-value" id="selectedAreaName">-</span>
                                    </div>
                                    <div class="area-detail">
                                        <span class="detail-label">Code:</span>
                                        <span class="detail-value" id="selectedAreaCode">-</span>
                                    </div>
                                    <div class="area-detail">
                                        <span class="detail-label">Assignée le:</span>
                                        <span class="detail-value" id="areaAssignedDate">-</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- حالة الكاميرا -->
                        <div class="camera-status" id="cameraStatus">
                            <div class="camera-icon">
                                <i class="fas fa-video"></i>
                            </div>
                            <div class="camera-text" id="cameraStatusText">Initialisation de la caméra...</div>
                        </div>
                        
                        <!-- عناصر التحكم -->
                        <div class="controls-under-area">
                            <button class="control-btn primary" id="toggleCameraBtn" style="display: none;">
                                <i class="fas fa-video"></i> Activer la caméra
                            </button>
                            <button class="control-btn" id="refreshLocationBtn">
                                <i class="fas fa-sync-alt"></i> Actualiser localisation
                            </button>
                            <button class="control-btn danger" id="clearPhotosBtn">
                                <i class="fas fa-trash"></i> Effacer photos
                            </button>
                            <button class="control-btn" id="backToStep1Btn" style="display: none;">
                                <i class="fas fa-arrow-left"></i> Retour aux photos AVANT
                            </button>
                        </div>
                        
                        <!-- مؤشر التقدم -->
                        <div class="progress-indicator">
                            <div class="progress-step" id="step1Indicator">1</div>
                            <div class="progress-step" id="step2Indicator">2</div>
                        </div>
                        <div class="progress-labels">
                            <span class="progress-label" id="step1Label">Photos AVANT</span>
                            <span class="progress-label" id="step2Label">Photos APRÈS</span>
                        </div>
                        
                        <!-- معلومات الموقع -->
                        <div class="location-info" id="locationInfo">
                            <div class="location-grid">
                                <div class="location-item">
                                    <span class="location-label">Latitude:</span>
                                    <span class="location-value" id="locationLat">-</span>
                                </div>
                                <div class="location-item">
                                    <span class="location-label">Longitude:</span>
                                    <span class="location-value" id="locationLng">-</span>
                                </div>
                                <div class="location-item">
                                    <span class="location-label">Précision:</span>
                                    <span class="location-value" id="locationPrec">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- الخطوة 1: صور AVANT -->
                        <div id="step1Container">
                            <div class="photos-container" id="beforePhotosContainer">
                                <div class="photos-title">
                                    <span><i class="fas fa-camera"></i> PHOTOS AVANT</span>
                                    <span class="badge badge-blue" id="beforePhotosCount">0/5</span>
                                </div>
                                
                                <div class="photos-status">
                                    <div class="status-item">
                                        <div class="status-label">Nombre</div>
                                        <div class="status-value" id="statusNumberBefore">-</div>
                                    </div>
                                    <div class="status-item">
                                        <div class="status-label">Zone</div>
                                        <div class="status-value" id="statusZoneBefore">-</div>
                                    </div>
                                    <div class="status-item">
                                        <div class="status-label">Photos AVANT</div>
                                        <div class="status-value" id="statusBeforeCount">0/5</div>
                                    </div>
                                </div>
                                
                                <div class="photo-boxes-container" id="beforePhotoBoxes"></div>
                            </div>
                            
                            <!-- اختيار العدد -->
                            <div class="number-selection" id="numberSelectionBefore">
                                <label><i class="fas fa-keyboard"></i> Sélectionnez un nombre de 0 à 8 :</label>
                                <div class="number-buttons" id="beforeNumberButtons"></div>
                                <div class="selected-number-display">
                                    Nombre sélectionné : <span id="selectedNumberDisplayBefore">Aucun</span>
                                </div>
                            </div>
                            
                            <!-- إرسال صور AVANT -->
                            <div class="send-report-container" id="sendBeforeContainer">
                                <div class="report-summary" id="beforeReportSummary">
                                    <div class="summary-grid">
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-hashtag"></i> Nombre:</span>
                                            <span class="summary-value" id="summaryNumberBefore">-</span>
                                        </div>
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-map-marker-alt"></i> Zone:</span>
                                            <span class="summary-value" id="summaryZoneBefore">-</span>
                                        </div>
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-image"></i> Photos:</span>
                                            <span class="summary-value" id="summaryPhotosBefore">0/5</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <button class="send-report-btn send-before-btn" id="sendBeforeBtn" onclick="employeePanel.sendBeforePhotos()" disabled>
                                    <i class="fas fa-paper-plane"></i> Envoyer les photos AVANT
                                </button>
                            </div>
                        </div>
                        
                        <!-- زر الانتقال للخطوة 2 -->
                        <div class="section-divider" id="step1ToStep2Divider" style="display: none;">
                            <button class="apres-button" id="apresButton" onclick="employeePanel.showAfterPhotos()">
                                <i class="fas fa-arrow-right"></i> PASSER AUX PHOTOS APRÈS
                            </button>
                        </div>
                        
                        <!-- الخطوة 2: صور APRÈS -->
                        <div id="step2Container" style="display: none;">
                            <div class="photos-container" id="afterPhotosContainer">
                                <div class="photos-title">
                                    <span><i class="fas fa-camera-retro"></i> PHOTOS APRÈS</span>
                                    <span class="badge badge-red" id="afterPhotosCount">0/5</span>
                                </div>
                                
                                <div class="photos-status">
                                    <div class="status-item">
                                        <div class="status-label">Nombre</div>
                                        <div class="status-value" id="statusNumberAfter">-</div>
                                    </div>
                                    <div class="status-item">
                                        <div class="status-label">Zone</div>
                                        <div class="status-value" id="statusZoneAfter">-</span>
                                    </div>
                                    <div class="status-item">
                                        <div class="status-label">Photos APRÈS</div>
                                        <div class="status-value" id="statusAfterCount">0/5</span>
                                    </div>
                                </div>
                                
                                <div class="photo-boxes-container" id="afterPhotoBoxes"></div>
                            </div>
                            
                            <!-- اختيار العدد لـ APRÈS -->
                            <div class="number-selection" id="numberSelectionAfter">
                                <label><i class="fas fa-keyboard"></i> Sélectionnez un nombre de 0 à 8 pour APRÈS :</label>
                                <div class="number-buttons" id="afterNumberButtons"></div>
                                <div class="selected-number-display">
                                    Nombre sélectionné : <span id="selectedNumberDisplayAfter">Aucun</span>
                                </div>
                            </div>
                            
                            <!-- ملخص الخطوة 1 المكتملة -->
                            <div class="completed-step-info" id="completedStep1Info">
                                <div class="completed-step-header">
                                    <i class="fas fa-check-circle"></i>
                                    <h4>Photos AVANT envoyées</h4>
                                </div>
                                <div class="completed-step-details">
                                    <div class="completed-detail">
                                        <span class="detail-label">Nombre AVANT:</span>
                                        <span class="detail-value" id="completedBeforeNumber">-</span>
                                    </div>
                                    <div class="completed-detail">
                                        <span class="detail-label">Date d'envoi:</span>
                                        <span class="detail-value" id="completedBeforeDate">-</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- إرسال صور APRÈS -->
                            <div class="send-report-container" id="sendAfterContainer">
                                <div class="report-summary" id="afterReportSummary">
                                    <div class="summary-grid">
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-hashtag"></i> Nombre:</span>
                                            <span class="summary-value" id="summaryNumberAfter">-</span>
                                        </div>
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-map-marker-alt"></i> Zone:</span>
                                            <span class="summary-value" id="summaryZoneAfter">-</span>
                                        </div>
                                        <div class="summary-item">
                                            <span class="summary-label"><i class="fas fa-image"></i> Photos:</span>
                                            <span class="summary-value" id="summaryPhotosAfter">0/5</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <button class="send-report-btn send-after-btn" id="sendAfterBtn" onclick="employeePanel.sendAfterPhotos()" disabled>
                                    <i class="fas fa-paper-plane"></i> Envoyer les photos APRÈS
                                </button>
                            </div>
                        </div>
                        
                        <!-- التقارير السابقة -->
                        <div class="dashboard-section" id="previousReportsSection">
                            <h3><i class="fas fa-history"></i> Mes Rapports Précédents</h3>
                            <div class="reports-container" id="employeeReportsList"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- فلاش التقاط الصورة -->
            <div class="capture-flash" id="captureFlash"></div>
        `;
    }
    
    // تحديث اختيار المنطقة
    updateAreaSelection() {
        const areaSelect = document.getElementById('areaSelectEmployee');
        const areaInfo = document.getElementById('selectedAreaInfo');
        
        if (!areaSelect) return;
        
        // إعادة تعيين القائمة
        areaSelect.innerHTML = '<option value="">Choisissez une zone</option>';
        
        if (this.assignedAreas.length === 0) {
            areaSelect.innerHTML += '<option value="" disabled>Aucune zone attribuée</option>';
            areaInfo.style.display = 'none';
            return;
        }
        
        // إضافة المناطق المخصصة
        this.assignedAreas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.id;
            option.textContent = `${area.name} (${area.code})`;
            
            // تحديد المنطقة المختارة حالياً
            if (this.progress.selectedArea && this.progress.selectedArea.id === area.id) {
                option.selected = true;
            }
            
            areaSelect.appendChild(option);
        });
        
        // تحديث معلومات المنطقة المختارة
        if (this.progress.selectedArea) {
            this.updateSelectedAreaInfo();
            areaInfo.style.display = 'block';
        } else {
            areaInfo.style.display = 'none';
        }
        
        // إضافة مستمع للحدث
        areaSelect.onchange = (e) => {
            const areaId = parseInt(e.target.value);
            if (areaId) {
                const area = this.assignedAreas.find(a => a.id === areaId);
                if (area) {
                    this.selectArea(area);
                }
            } else {
                this.deselectArea();
            }
        };
    }
    
    // اختيار منطقة
    selectArea(area) {
        this.progress.selectedArea = area;
        
        // تحديث الواجهة
        this.updateSelectedAreaInfo();
        this.updateStatusDisplay();
        this.updateSendButtons();
        
        // حفظ التقدم
        this.saveProgress();
        
        // إشعار
        showNotification(`Zone "${area.name}" sélectionnée`, 'success');
    }
    
    // إلغاء اختيار منطقة
    deselectArea() {
        this.progress.selectedArea = null;
        
        // تحديث الواجهة
        document.getElementById('selectedAreaInfo').style.display = 'none';
        this.updateStatusDisplay();
        this.updateSendButtons();
        
        // حفظ التقدم
        this.saveProgress();
    }
    
    // تحديث معلومات المنطقة المختارة
    updateSelectedAreaInfo() {
        if (!this.progress.selectedArea) return;
        
        const area = this.progress.selectedArea;
        
        document.getElementById('selectedAreaName').textContent = area.name;
        document.getElementById('selectedAreaCode').textContent = area.code;
        document.getElementById('areaAssignedDate').textContent = this.formatDate(area.date);
        
        // تحديث الحقول الأخرى
        document.getElementById('statusZoneBefore').textContent = area.name;
        document.getElementById('statusZoneAfter').textContent = area.name;
        document.getElementById('summaryZoneBefore').textContent = area.name;
        document.getElementById('summaryZoneAfter').textContent = area.name;
    }
    
    // تحديث صناديق الصور
    updatePhotoBoxes() {
        this.createPhotoBoxes('before');
        this.createPhotoBoxes('after');
        this.updatePhotoCounts();
    }
    
    // إنشاء صناديق الصور
    createPhotoBoxes(type) {
        const containerId = type === 'before' ? 'beforePhotoBoxes' : 'afterPhotoBoxes';
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            const photoBox = document.createElement('div');
            photoBox.className = 'photo-box';
            photoBox.dataset.index = i;
            photoBox.dataset.type = type;
            
            // التحقق إذا كانت الصورة موجودة
            const photo = type === 'before' ? 
                this.progress.beforePhotos[i] : 
                this.progress.afterPhotos[i];
            
            if (photo) {
                photoBox.classList.add('captured');
            }
            
            photoBox.innerHTML = `
                <div class="photo-icon">
                    <i class="fas fa-camera"></i>
                </div>
                <div class="photo-box-label">${type.toUpperCase()} ${i + 1}</div>
                ${photo ? `<img class="photo-preview" src="${photo.url}" alt="Photo ${type} ${i + 1}">` : ''}
            `;
            
            // إضافة مستمع الحدث
            photoBox.addEventListener('click', () => this.capturePhoto(i, type));
            
            container.appendChild(photoBox);
        }
    }
    
    // تحديث أزرار الأرقام
    updateNumberButtons() {
        this.createNumberButtons('before');
        this.createNumberButtons('after');
    }
    
    // إنشاء أزرار الأرقام
    createNumberButtons(type) {
        const containerId = type === 'before' ? 'beforeNumberButtons' : 'afterNumberButtons';
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i <= 8; i++) {
            const button = document.createElement('button');
            button.className = 'number-btn';
            button.dataset.number = i;
            button.textContent = i;
            
            // التحقق إذا كان الرقم مختاراً
            const selectedNumber = type === 'before' ? 
                this.progress.selectedNumber : 
                this.progress.selectedNumberAfter;
            
            if (selectedNumber === i) {
                button.classList.add('selected');
            }
            
            // إضافة مستمع الحدث
            button.addEventListener('click', () => this.selectNumber(i, type));
            
            container.appendChild(button);
        }
        
        // تحديث عرض الرقم المختار
        this.updateSelectedNumberDisplay(type);
    }
    
    // اختيار رقم
    selectNumber(number, type) {
        if (type === 'before') {
            this.progress.selectedNumber = number;
        } else {
            this.progress.selectedNumberAfter = number;
        }
        
        // تحديث الواجهة
        this.updateNumberButtons();
        this.updateStatusDisplay();
        this.updateSendButtons();
        
        // حفظ التقدم
        this.saveProgress();
        
        // إشعار
        showNotification(`Nombre ${type === 'before' ? 'AVANT' : 'APRÈS'} sélectionné: ${number}`, 'success');
    }
    
    // تحديث عرض الرقم المختار
    updateSelectedNumberDisplay(type) {
        const displayId = type === 'before' ? 'selectedNumberDisplayBefore' : 'selectedNumberDisplayAfter';
        const displayElement = document.getElementById(displayId);
        
        if (displayElement) {
            const selectedNumber = type === 'before' ? 
                this.progress.selectedNumber : 
                this.progress.selectedNumberAfter;
            
            displayElement.textContent = selectedNumber !== null ? selectedNumber : 'Aucun';
        }
    }
    
    // تحديث أعداد الصور
    updatePhotoCounts() {
        // صور AVANT
        const beforeCount = this.progress.beforePhotos.filter(p => p !== null).length;
        document.getElementById('beforePhotosCount').textContent = `${beforeCount}/5`;
        document.getElementById('statusBeforeCount').textContent = `${beforeCount}/5`;
        document.getElementById('summaryPhotosBefore').textContent = `${beforeCount}/5`;
        
        if (beforeCount === 5) {
            document.getElementById('statusBeforeCount').classList.add('completed');
        } else {
            document.getElementById('statusBeforeCount').classList.remove('completed');
        }
        
        // صور APRÈS
        const afterCount = this.progress.afterPhotos.filter(p => p !== null).length;
        document.getElementById('afterPhotosCount').textContent = `${afterCount}/5`;
        document.getElementById('statusAfterCount').textContent = `${afterCount}/5`;
        document.getElementById('summaryPhotosAfter').textContent = `${afterCount}/5`;
        
        if (afterCount === 5) {
            document.getElementById('statusAfterCount').classList.add('completed');
        } else {
            document.getElementById('statusAfterCount').classList.remove('completed');
        }
    }
    
    // تحديث مؤشر التقدم
    updateProgressIndicator() {
        const step1 = document.getElementById('step1Indicator');
        const step2 = document.getElementById('step2Indicator');
        
        if (this.progress.currentStep === 1) {
            step1.classList.add('active');
            step2.classList.remove('active');
            step1.classList.remove('completed');
        } else {
            step1.classList.remove('active');
            step1.classList.add('completed');
            step2.classList.add('active');
        }
    }
    
    // تحديث عرض الحالة
    updateStatusDisplay() {
        // تحديث الأرقام
        document.getElementById('statusNumberBefore').textContent = 
            this.progress.selectedNumber !== null ? this.progress.selectedNumber : '-';
        document.getElementById('statusNumberAfter').textContent = 
            this.progress.selectedNumberAfter !== null ? this.progress.selectedNumberAfter : '-';
        
        document.getElementById('summaryNumberBefore').textContent = 
            this.progress.selectedNumber !== null ? this.progress.selectedNumber : '-';
        document.getElementById('summaryNumberAfter').textContent = 
            this.progress.selectedNumberAfter !== null ? this.progress.selectedNumberAfter : '-';
    }
    
    // تحديث أزرار الإرسال
    updateSendButtons() {
        // زر إرسال صور AVANT
        const canSendBefore = 
            this.progress.selectedArea !== null &&
            this.progress.selectedNumber !== null &&
            this.progress.beforePhotos.filter(p => p !== null).length === 5;
        
        document.getElementById('sendBeforeBtn').disabled = !canSendBefore;
        
        // زر إرسال صور APRÈS
        const canSendAfter = 
            this.progress.selectedArea !== null &&
            this.progress.selectedNumberAfter !== null &&
            this.progress.afterPhotos.filter(p => p !== null).length === 5;
        
        document.getElementById('sendAfterBtn').disabled = !canSendAfter;
    }
    
    // عرض الخطوة الحالية
    showCurrentStep() {
        const step1Container = document.getElementById('step1Container');
        const step2Container = document.getElementById('step2Container');
        const stepDivider = document.getElementById('step1ToStep2Divider');
        const backButton = document.getElementById('backToStep1Btn');
        
        if (this.progress.currentStep === 1) {
            // عرض الخطوة 1
            step1Container.style.display = 'block';
            step2Container.style.display = 'none';
            
            // إظهار زر الانتقال إذا كانت الخطوة 1 مكتملة
            const beforeComplete = 
                this.progress.selectedArea !== null &&
                this.progress.selectedNumber !== null &&
                this.progress.beforePhotos.filter(p => p !== null).length === 5;
            
            stepDivider.style.display = beforeComplete ? 'block' : 'none';
            if (backButton) backButton.style.display = 'none';
            
        } else {
            // عرض الخطوة 2
            step1Container.style.display = 'none';
            step2Container.style.display = 'block';
            stepDivider.style.display = 'none';
            if (backButton) backButton.style.display = 'block';
            
            // تحديث معلومات الخطوة 1 المكتملة
            this.updateCompletedStep1Info();
        }
        
        // تحديث أزرار الأرقام
        this.updateNumberButtons();
    }
    
    // تحديث معلومات الخطوة 1 المكتملة
    updateCompletedStep1Info() {
        if (this.progress.tempReport) {
            document.getElementById('completedBeforeNumber').textContent = 
                this.progress.tempReport.numberBefore || '-';
            document.getElementById('completedBeforeDate').textContent = 
                this.formatDate(this.progress.tempReport.date);
        }
    }
    
    // ========== إدارة الكاميرا ==========
    
    // تهيئة الكاميرا
    async initializeCamera() {
        try {
            const cameraStatus = document.getElementById('cameraStatus');
            const cameraText = document.getElementById('cameraStatusText');
            
            cameraStatus.classList.remove('active');
            cameraText.textContent = 'Initialisation de la caméra...';
            
            // التحقق من إذن الكاميرا
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCamera = devices.some(device => device.kind === 'videoinput');
            
            if (!hasCamera) {
                cameraText.textContent = 'Caméra non disponible';
                document.getElementById('toggleCameraBtn').style.display = 'block';
                return;
            }
            
            // محاولة تفعيل الكاميرا تلقائياً
            await this.activateCamera();
            
        } catch (error) {
            console.error('Erreur initialisation caméra:', error);
            this.showCameraError();
        }
    }
    
    // تفعيل الكاميرا
    async activateCamera() {
        try {
            const cameraStatus = document.getElementById('cameraStatus');
            const cameraText = document.getElementById('cameraStatusText');
            
            // طلب إذن الكاميرا
            this.camera.videoStream = await navigator.mediaDevices.getUserMedia({
                video: Config.CAMERA_RESOLUTION,
                audio: false
            });
            
            this.camera.isActive = true;
            this.camera.hasPermission = true;
            
            // تحديث الواجهة
            cameraStatus.classList.add('active');
            cameraText.textContent = 'Caméra active ✓';
            
            // إخفاء زر التفعيل
            document.getElementById('toggleCameraBtn').style.display = 'none';
            
            showNotification('Caméra activée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur activation caméra:', error);
            this.showCameraError();
        }
    }
    
    // تعطيل الكاميرا
    deactivateCamera() {
        if (this.camera.videoStream) {
            this.camera.videoStream.getTracks().forEach(track => track.stop());
            this.camera.videoStream = null;
        }
        
        this.camera.isActive = false;
        
        const cameraStatus = document.getElementById('cameraStatus');
        const cameraText = document.getElementById('cameraStatusText');
        
        cameraStatus.classList.remove('active');
        cameraText.textContent = 'Caméra désactivée';
        
        document.getElementById('toggleCameraBtn').style.display = 'block';
        document.getElementById('toggleCameraBtn').innerHTML = '<i class="fas fa-video"></i> Activer la caméra';
        
        showNotification('Caméra désactivée', 'info');
    }
    
    // تبديل حالة الكاميرا
    toggleCamera() {
        if (this.camera.isActive) {
            this.deactivateCamera();
        } else {
            this.activateCamera();
        }
    }
    
    // عرض خطأ الكاميرا
    showCameraError() {
        const cameraStatus = document.getElementById('cameraStatus');
        const cameraText = document.getElementById('cameraStatusText');
        
        cameraStatus.style.background = '#ffe6e6';
        cameraStatus.style.borderColor = '#ff6b6b';
        cameraText.textContent = 'Erreur caméra - Cliquez pour activer';
        cameraText.style.color = '#ff6b6b';
        
        document.getElementById('toggleCameraBtn').style.display = 'block';
        document.getElementById('toggleCameraBtn').innerHTML = '<i class="fas fa-video"></i> Activer la caméra';
    }
    
    // ========== التقاط الصور ==========
    
    // التقاط صورة
    async capturePhoto(index, type) {
        // التحقق من الخطوة الصحيحة
        if (type === 'before' && this.progress.currentStep !== 1) {
            alert('Vous devez d\'abord envoyer les photos AVANT');
            return;
        }
        
        if (type === 'after' && this.progress.currentStep !== 2) {
            alert('Vous devez d\'abord passer à l\'étape APRÈS');
            return;
        }
        
        // التحقق من تفعيل الكاميرا
        if (!this.camera.isActive || !this.camera.videoStream) {
            alert('Veuillez activer la caméra d\'abord');
            return;
        }
        
        try {
            // عرض فلاش التقاط
            this.showCaptureFlash();
            
            // إنشاء عنصر فيديو مؤقت
            const video = document.createElement('video');
            video.srcObject = this.camera.videoStream;
            
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            // رسم الصورة على canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // إضافة المعلومات على الصورة
            this.addInfoToImage(context, canvas.width, canvas.height);
            
            // تحويل إلى blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.9);
            });
            
            // إنشاء رابط للصورة
            const imageUrl = URL.createObjectURL(blob);
            
            // حفظ الصورة
            const photoData = {
                url: imageUrl,
                blob: blob,
                timestamp: new Date().toISOString(),
                location: { ...this.location },
                noteCode: this.progress.selectedArea ? this.progress.selectedArea.code : 'N/A',
                index: index,
                type: type
            };
            
            if (type === 'before') {
                this.progress.beforePhotos[index] = photoData;
            } else {
                this.progress.afterPhotos[index] = photoData;
            }
            
            // تحديث الواجهة
            this.updatePhotoBoxes();
            this.updateSendButtons();
            this.saveProgress();
            
            // إشعار
            showNotification(`Photo ${type} ${index + 1} capturée avec succès`, 'success');
            
        } catch (error) {
            console.error('Erreur capture photo:', error);
            showNotification('Erreur lors de la capture de la photo', 'error');
        }
    }
    
    // إضافة المعلومات على الصورة
    addInfoToImage(context, width, height) {
        context.save();
        
        // إعداد الخط
        context.font = '14px Arial';
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 2;
        context.textAlign = 'left';
        
        // معلومات لإضافتها
        const infoLines = [
            `Date: ${new Date().toLocaleString()}`,
            `Zone: ${this.progress.selectedArea ? this.progress.selectedArea.code : 'N/A'}`,
            `Nombre: ${this.progress.currentStep === 1 ? 
                (this.progress.selectedNumber !== null ? this.progress.selectedNumber : 'N/A') : 
                (this.progress.selectedNumberAfter !== null ? this.progress.selectedNumberAfter : 'N/A')}`,
            `Lat: ${this.location.lat ? this.location.lat.toFixed(6) : 'N/A'}`,
            `Lng: ${this.location.lng ? this.location.lng.toFixed(6) : 'N/A'}`,
            `Précision: ${this.location.prec ? this.location.prec.toFixed(2) + 'm' : 'N/A'}`
        ];
        
        // إضافة خلفية للنص
        const textHeight = 20;
        const padding = 5;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(
            5, 
            height - (infoLines.length * textHeight) - padding * 2,
            300,
            (infoLines.length * textHeight) + padding * 2
        );
        
        // كتابة المعلومات
        context.fillStyle = 'white';
        infoLines.forEach((line, i) => {
            context.fillText(
                line,
                10,
                height - (infoLines.length - i - 1) * textHeight - padding - 5
            );
        });
        
        // إضافة علامة مائية
        context.font = 'bold 16px Arial';
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.textAlign = 'right';
        context.fillText('NoteCam System', width - 10, height - 10);
        
        context.restore();
    }
    
    // عرض فلاش التقاط
    showCaptureFlash() {
        const flash = document.getElementById('captureFlash');
        flash.style.animation = 'captureFlash 300ms ease-out';
        
        setTimeout(() => {
            flash.style.animation = '';
        }, 300);
    }
    
    // ========== إدارة الموقع ==========
    
    // بدء تحديث الموقع
    startLocationUpdates() {
        // تحديث أولي
        this.updateLocation();
        
        // تحديث دوري كل 30 ثانية
        setInterval(() => this.updateLocation(), 30000);
    }
    
    // تحديث الموقع
    async updateLocation() {
        if (this.location.isUpdating) return;
        
        this.location.isUpdating = true;
        
        try {
            // محاكاة الموقع (في بيئة الإنتاج، استخدم GPS حقيقي)
            this.location = {
                lat: 33.603016 + (Math.random() - 0.5) * 0.001,
                lng: -7.636873 + (Math.random() - 0.5) * 0.001,
                elev: (9.34 + Math.random() * 5).toFixed(2),
                prec: (10 + Math.random() * 20).toFixed(2),
                time: new Date().toLocaleTimeString(),
                isUpdating: false
            };
            
            // تحديث الواجهة
            this.updateLocationDisplay();
            
            // حفظ في التقدم
            this.saveProgress();
            
        } catch (error) {
            console.error('Erreur mise à jour localisation:', error);
            this.location.isUpdating = false;
        }
    }
    
    // تحديث عرض الموقع
    updateLocationDisplay() {
        document.getElementById('locationLat').textContent = 
            this.location.lat ? this.location.lat.toFixed(6) : '-';
        document.getElementById('locationLng').textContent = 
            this.location.lng ? this.location.lng.toFixed(6) : '-';
        document.getElementById('locationPrec').textContent = 
            this.location.prec ? this.location.prec + ' m' : '-';
    }
    
    // ========== إدارة التقارير ==========
    
    // إرسال صور AVANT
    async sendBeforePhotos() {
        if (!this.validateBeforeSubmission()) {
            return;
        }
        
        try {
            // إنشاء التقرير
            const report = {
                id: Date.now(),
                employee: this.currentUser.username,
                employeeName: this.currentUser.name,
                numberBefore: this.progress.selectedNumber,
                date: new Date().toISOString(),
                location: { ...this.location },
                beforePhotos: this.progress.beforePhotos.filter(p => p !== null),
                area: this.progress.selectedArea.name,
                areaCode: this.progress.selectedArea.code,
                noteCode: this.progress.selectedArea.code,
                status: 'before_only',
                step: 'first'
            };
            
            // حفظ كمؤقت
            this.progress.tempReport = report;
            
            // إرسال إلى Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                await window.supabaseClient.createReport(report);
            }
            
            // الانتقال إلى الخطوة 2
            this.progress.currentStep = 2;
            
            // تحديث الواجهة
            this.showCurrentStep();
            this.saveProgress();
            
            // إشعار
            showNotification('Photos AVANT envoyées avec succès! Prêt pour les photos APRÈS.', 'success');
            
        } catch (error) {
            console.error('Erreur envoi photos AVANT:', error);
            showNotification('Erreur lors de l\'envoi des photos', 'error');
        }
    }
    
    // التحقق من صحة إرسال صور AVANT
    validateBeforeSubmission() {
        if (!this.progress.selectedArea) {
            alert('Veuillez sélectionner une zone');
            return false;
        }
        
        if (this.progress.selectedNumber === null) {
            alert('Veuillez sélectionner un nombre');
            return false;
        }
        
        const beforeCount = this.progress.beforePhotos.filter(p => p !== null).length;
        if (beforeCount !== 5) {
            alert(`Veuillez capturer toutes les 5 photos AVANT (${beforeCount}/5)`);
            return false;
        }
        
        return true;
    }
    
    // عرض صور APRÈS
    showAfterPhotos() {
        this.progress.currentStep = 2;
        this.showCurrentStep();
        showNotification('Prêt à capturer les photos APRÈS', 'success');
    }
    
    // العودة إلى الخطوة 1
    goBackToStep1() {
        if (confirm('Voulez-vous vraiment retourner aux photos AVANT ? Les photos APRÈS seront perdues.')) {
            this.progress.currentStep = 1;
            this.progress.selectedNumberAfter = null;
            this.progress.afterPhotos = [null, null, null, null, null];
            this.showCurrentStep();
            this.saveProgress();
            showNotification('Retour aux photos AVANT', 'info');
        }
    }
    
    // إرسال صور APRÈS
    async sendAfterPhotos() {
        if (!this.validateAfterSubmission()) {
            return;
        }
        
        try {
            // تحديث التقرير المؤقت
            const completeReport = {
                ...this.progress.tempReport,
                numberAfter: this.progress.selectedNumberAfter,
                afterPhotos: this.progress.afterPhotos.filter(p => p !== null),
                status: 'complete',
                completionDate: new Date().toISOString(),
                step: 'complete'
            };
            
            // إرسال إلى Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                await window.supabaseClient.updateReport(completeReport.id, {
                    number_after: completeReport.numberAfter,
                    status: 'complete',
                    completion_date: completeReport.completionDate
                });
            }
            
            // إضافة إلى التقارير المحلية
            this.reports.push(completeReport);
            
            // توليد ملف المنطقة
            this.generateZoneFile(completeReport.areaCode);
            
            // إعادة تعيين التقدم
            this.resetProgress();
            
            // تحديث الواجهة
            this.updateEmployeeReportsList();
            showNotification('Rapport complet envoyé avec succès!', 'success');
            
        } catch (error) {
            console.error('Erreur envoi photos APRÈS:', error);
            showNotification('Erreur lors de l\'envoi du rapport complet', 'error');
        }
    }
    
    // التحقق من صحة إرسال صور APRÈS
    validateAfterSubmission() {
        if (!this.progress.tempReport) {
            alert('Aucun rapport AVANT trouvé');
            return false;
        }
        
        if (this.progress.selectedNumberAfter === null) {
            alert('Veuillez sélectionner un nombre pour APRÈS');
            return false;
        }
        
        const afterCount = this.progress.afterPhotos.filter(p => p !== null).length;
        if (afterCount !== 5) {
            alert(`Veuillez capturer toutes les 5 photos APRÈS (${afterCount}/5)`);
            return false;
        }
        
        return true;
    }
    
    // توليد ملف المنطقة
    generateZoneFile(areaCode) {
        const zoneReports = this.reports.filter(r => r.areaCode === areaCode);
        
        const zoneData = {
            zoneCode: areaCode,
            zoneName: this.progress.selectedArea?.name || 'Inconnue',
            generatedAt: new Date().toISOString(),
            employee: this.currentUser.name,
            totalReports: zoneReports.length,
            reports: zoneReports.map(report => ({
                id: report.id,
                numberBefore: report.numberBefore,
                numberAfter: report.numberAfter,
                date: this.formatDate(report.date),
                status: report.status
            }))
        };
        
        const jsonData = JSON.stringify(zoneData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Zone_${areaCode}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    // إعادة تعيين التقدم
    resetProgress() {
        this.progress = {
            selectedArea: null,
            selectedNumber: null,
            selectedNumberAfter: null,
            currentStep: 1,
            beforePhotos: [null, null, null, null, null],
            afterPhotos: [null, null, null, null, null],
            tempReport: null
        };
        
        // مسح التخزين المحلي
        localStorage.removeItem(`userProgress_${this.currentUser.username}`);
        localStorage.removeItem(`tempReport_${this.currentUser.username}`);
        
        // تحديث الواجهة
        this.updateAreaSelection();
        this.updatePhotoBoxes();
        this.updateNumberButtons();
        this.updateProgressIndicator();
        this.showCurrentStep();
        
        showNotification('Formulaire réinitialisé pour un nouveau rapport', 'info');
    }
    
    // تحديث قائمة تقارير الموظف
    updateEmployeeReportsList() {
        const reportsList = document.getElementById('employeeReportsList');
        if (!reportsList) return;
        
        if (this.reports.length === 0) {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun rapport envoyé</p>
                </div>
            `;
            return;
        }
        
        // عرض آخر 5 تقارير
        const recentReports = [...this.reports]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        reportsList.innerHTML = recentReports.map(report => `
            <div class="report-card mini">
                <div class="report-header">
                    <div class="report-zone">${report.area} (${report.areaCode})</div>
                    <div class="report-date">${this.formatDate(report.date)}</div>
                </div>
                <div class="report-details">
                    <span class="detail">AVANT: ${report.numberBefore || 'N/A'}</span>
                    ${report.numberAfter ? `<span class="detail">APRÈS: ${report.numberAfter}</span>` : ''}
                </div>
                <div class="report-status">
                    <span class="status ${report.status}">
                        ${report.status === 'complete' ? 'Complet' : 'En attente'}
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    // مزامنة البيانات
    async syncData() {
        const syncStatus = document.getElementById('employeeSyncStatus');
        const syncDetail = document.getElementById('employeeSyncDetail');
        
        syncStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Synchronisation...';
        syncDetail.textContent = 'Mise à jour des données';
        
        try {
            // تحميل التحديثات من Supabase
            await this.loadUserReports();
            
            // تحديث قائمة التقارير
            this.updateEmployeeReportsList();
            
            syncStatus.innerHTML = '<i class="fas fa-check-circle"></i> Synchronisé';
            syncDetail.textContent = 'Données à jour';
            syncDetail.className = 'sync-success';
            
            showNotification('Synchronisation réussie', 'success');
            
        } catch (error) {
            console.error('Erreur synchronisation:', error);
            syncStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Erreur';
            syncDetail.textContent = 'Échec de synchronisation';
            syncDetail.className = 'sync-error';
            
            showNotification('Erreur de synchronisation', 'error');
        }
    }
    
    // مسح جميع الصور
    clearAllPhotos() {
        if (!confirm('Voulez-vous vraiment effacer toutes les photos ? Cette action est irréversible.')) {
            return;
        }
        
        this.progress.beforePhotos = [null, null, null, null, null];
        this.progress.afterPhotos = [null, null, null, null, null];
        
        this.updatePhotoBoxes();
        this.updateSendButtons();
        this.saveProgress();
        
        showNotification('Toutes les photos ont été effacées', 'info');
    }
    
    // إعداد المستمعين للأحداث
    setupEventListeners() {
        // زر تبديل الكاميرا
        document.getElementById('toggleCameraBtn')?.addEventListener('click', () => this.toggleCamera());
        
        // زر تحديث الموقع
        document.getElementById('refreshLocationBtn')?.addEventListener('click', () => this.updateLocation());
        
        // زر مسح الصور
        document.getElementById('clearPhotosBtn')?.addEventListener('click', () => this.clearAllPhotos());
        
        // زر العودة للخطوة 1
        document.getElementById('backToStep1Btn')?.addEventListener('click', () => this.goBackToStep1());
    }
    
    // ========== دوال مساعدة ==========
    
    // تنسيق التاريخ
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// إنشاء وتصدير نسخة واحدة
const employeePanel = new EmployeePanel();
window.employeePanel = employeePanel;

// إضافة أنماط إضافية للوحة الموظف
const employeeStyles = document.createElement('style');
employeeStyles.textContent = `
    .employee-panel .panel-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .area-info-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .area-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
    }
    
    .area-detail {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid #e1e8ed;
    }
    
    .detail-label {
        color: #666;
        font-weight: 500;
    }
    
    .detail-value {
        color: #1a5fb4;
        font-weight: 600;
    }
    
    .location-info {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border: 1px solid #e1e8ed;
    }
    
    .location-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
    }
    
    .location-item {
        display: flex;
        justify-content: space-between;
    }
    
    .location-label {
        color: #666;
        font-size: 14px;
    }
    
    .location-value {
        color: #1a5fb4;
        font-weight: 600;
        font-size: 14px;
    }
    
    .progress-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        padding: 0 20px;
    }
    
    .progress-label {
        font-size: 12px;
        color: #666;
        font-weight: 500;
    }
    
    .report-summary {
        background: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        border: 1px solid #e1e8ed;
    }
    
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
    }
    
    .summary-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    
    .summary-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
    }
    
    .summary-value {
        font-size: 18px;
        font-weight: 700;
        color: #1a5fb4;
    }
    
    .selected-number-display {
        text-align: center;
        margin-top: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
        font-size: 14px;
        color: #666;
    }
    
    .selected-number-display span {
        font-weight: 700;
        color: #1a5fb4;
        font-size: 16px;
    }
    
    .completed-step-info {
        background: linear-gradient(135deg, #f0fff4 0%, #e3f2fd 100%);
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border: 2px solid #2ea043;
    }
    
    .completed-step-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .completed-step-header i {
        color: #2ea043;
        font-size: 20px;
    }
    
    .completed-step-header h4 {
        color: #2ea043;
        margin: 0;
    }
    
    .completed-step-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
    }
    
    .completed-detail {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
    }
    
    .report-card.mini {
        padding: 15px;
        margin: 10px 0;
    }
    
    .report-card.mini .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .report-card.mini .report-zone {
        font-weight: 600;
        color: #1a5fb4;
        font-size: 14px;
    }
    
    .report-card.mini .report-date {
        font-size: 11px;
        color: #666;
    }
    
    .report-card.mini .report-details {
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
    }
    
    .report-card.mini .detail {
        background: #e3f2fd;
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 11px;
        color: #1a5fb4;
    }
    
    .report-card.mini .report-status {
        text-align: right;
    }
    
    .report-card.mini .status {
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
    }
    
    .report-card.mini .status.complete {
        background: #f0fff4;
        color: #2ea043;
    }
    
    .report-card.mini .status.before_only {
        background: #fff3cd;
        color: #856404;
    }
    
    .capture-flash {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        pointer-events: none;
        z-index: 9999;
        opacity: 0;
    }
    
    @keyframes captureFlash {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(employeeStyles);
