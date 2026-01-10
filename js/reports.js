// إدارة التقارير
class ReportsManager {
    constructor() {
        this.allReports = [];
        this.filteredReports = [];
        this.currentFilters = {
            dateFrom: null,
            dateTo: null,
            employee: null,
            zone: null,
            status: null
        };
        this.stats = {
            total: 0,
            complete: 0,
            pending: 0,
            byEmployee: {},
            byZone: {}
        };
    }
    
    // تهيئة المدير
    async initialize() {
        try {
            console.log('Initialisation du gestionnaire de rapports...');
            await this.loadReports();
            this.calculateStats();
            console.log('Gestionnaire de rapports initialisé');
            return true;
        } catch (error) {
            console.error('Erreur initialisation rapports:', error);
            return false;
        }
    }
    
    // تحميل التقارير
    async loadReports() {
        try {
            // من التخزين المحلي
            const reportsData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.REPORTS);
            if (reportsData) {
                this.allReports = JSON.parse(reportsData);
            }
            
            // من Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                const result = await window.supabaseClient.getReports({ limit: 1000 });
                if (result.success && result.data) {
                    // دمج التقارير
                    this.allReports = result.data.map(report => ({
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
                    
                    // حفظ محلياً
                    localStorage.setItem(
                        Config.LOCAL_STORAGE_KEYS.REPORTS,
                        JSON.stringify(this.allReports)
                    );
                }
            }
            
            // تطبيق الفلاتر الحالية
            this.applyFilters();
            
        } catch (error) {
            console.error('Erreur chargement rapports:', error);
        }
    }
    
    // تطبيق الفلاتر
    applyFilters() {
        this.filteredReports = [...this.allReports];
        
        // فلترة حسب التاريخ
        if (this.currentFilters.dateFrom) {
            const fromDate = new Date(this.currentFilters.dateFrom);
            this.filteredReports = this.filteredReports.filter(report => 
                new Date(report.date) >= fromDate
            );
        }
        
        if (this.currentFilters.dateTo) {
            const toDate = new Date(this.currentFilters.dateTo);
            this.filteredReports = this.filteredReports.filter(report => 
                new Date(report.date) <= toDate
            );
        }
        
        // فلترة حسب الموظف
        if (this.currentFilters.employee) {
            this.filteredReports = this.filteredReports.filter(report => 
                report.employee === this.currentFilters.employee
            );
        }
        
        // فلترة حسب المنطقة
        if (this.currentFilters.zone) {
            this.filteredReports = this.filteredReports.filter(report => 
                report.areaCode === this.currentFilters.zone
            );
        }
        
        // فلترة حسب الحالة
        if (this.currentFilters.status) {
            this.filteredReports = this.filteredReports.filter(report => 
                report.status === this.currentFilters.status
            );
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        this.filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // تحديث الإحصائيات
        this.calculateStats();
    }
    
    // حساب الإحصائيات
    calculateStats() {
        this.stats.total = this.allReports.length;
        this.stats.complete = this.allReports.filter(r => r.status === 'complete').length;
        this.stats.pending = this.allReports.filter(r => r.status === 'before_only').length;
        
        // حسب الموظف
        this.stats.byEmployee = {};
        this.allReports.forEach(report => {
            if (!this.stats.byEmployee[report.employee]) {
                this.stats.byEmployee[report.employee] = {
                    name: report.employeeName,
                    total: 0,
                    complete: 0,
                    pending: 0
                };
            }
            
            this.stats.byEmployee[report.employee].total++;
            if (report.status === 'complete') {
                this.stats.byEmployee[report.employee].complete++;
            } else {
                this.stats.byEmployee[report.employee].pending++;
            }
        });
        
        // حسب المنطقة
        this.stats.byZone = {};
        this.allReports.forEach(report => {
            if (!this.stats.byZone[report.areaCode]) {
                this.stats.byZone[report.areaCode] = {
                    name: report.area,
                    total: 0,
                    complete: 0,
                    pending: 0
                };
            }
            
            this.stats.byZone[report.areaCode].total++;
            if (report.status === 'complete') {
                this.stats.byZone[report.areaCode].complete++;
            } else {
                this.stats.byZone[report.areaCode].pending++;
            }
        });
    }
    
    // عرض لوحة التقارير
    showReportsPanel() {
        const app = document.getElementById('app');
        app.innerHTML = this.getReportsPanelHTML();
        
        // تحديث البيانات
        this.updateReportsList();
        this.updateFilters();
        this.updateStatsDisplay();
    }
    
    // HTML لوحة التقارير
    getReportsPanelHTML() {
        return `
            <div class="app-container">
                <div class="status-bar">
                    <div>Gestion des Rapports • ${Config.APP_NAME}</div>
                    <div class="sync-status" id="reportsSyncStatus">
                        <i class="fas fa-sync"></i>
                        <span>${this.allReports.length} rapports</span>
                    </div>
                </div>
                
                <div class="reports-panel">
                    <!-- رأس اللوحة -->
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fas fa-file-alt"></i> Gestion des Rapports
                        </div>
                        <div>
                            <button class="control-btn" onclick="reportsManager.exportAllReports()">
                                <i class="fas fa-download"></i> Exporter
                            </button>
                            <button class="back-btn" onclick="reportsManager.goBack()">
                                <i class="fas fa-arrow-left"></i> Retour
                            </button>
                        </div>
                    </div>
                    
                    <!-- الإحصائيات -->
                    <div class="reports-stats">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="totalReports">0</div>
                                <div class="stat-label">Total Rapports</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #2ea043;">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="completeReports">0</div>
                                <div class="stat-label">Complets</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #ffa500;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="pendingReports">0</div>
                                <div class="stat-label">En Attente</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #1a5fb4;">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="completionRate">0%</div>
                                <div class="stat-label">Taux Complétion</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- الفلاتر -->
                    <div class="dashboard-section">
                        <h3><i class="fas fa-filter"></i> Filtres de Recherche</h3>
                        <div class="filters-grid">
                            <div class="filter-group">
                                <label>Date de début</label>
                                <input type="date" id="filterDateFrom" class="filter-input">
                            </div>
                            
                            <div class="filter-group">
                                <label>Date de fin</label>
                                <input type="date" id="filterDateTo" class="filter-input">
                            </div>
                            
                            <div class="filter-group">
                                <label>Employé</label>
                                <select id="filterEmployee" class="filter-input">
                                    <option value="">Tous les employés</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label>Zone</label>
                                <select id="filterZone" class="filter-input">
                                    <option value="">Toutes les zones</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label>Statut</label>
                                <select id="filterStatus" class="filter-input">
                                    <option value="">Tous les statuts</option>
                                    <option value="complete">Complet</option>
                                    <option value="before_only">En attente</option>
                                </select>
                            </div>
                            
                            <div class="filter-actions">
                                <button class="action-btn" onclick="reportsManager.applyFiltersUI()">
                                    <i class="fas fa-search"></i> Appliquer
                                </button>
                                <button class="control-btn" onclick="reportsManager.resetFilters()">
                                    <i class="fas fa-redo"></i> Réinitialiser
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- قائمة التقارير -->
                    <div class="dashboard-section">
                        <div class="section-header">
                            <h3>Liste des Rapports (${this.filteredReports.length})</h3>
                            <div class="section-actions">
                                <button class="control-btn" onclick="reportsManager.refreshReports()">
                                    <i class="fas fa-sync-alt"></i> Actualiser
                                </button>
                                <button class="control-btn primary" onclick="reportsManager.showStatsModal()">
                                    <i class="fas fa-chart-bar"></i> Statistiques
                                </button>
                            </div>
                        </div>
                        
                        <div class="reports-table-container">
                            <table class="reports-table" id="reportsTable">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Employé</th>
                                        <th>Zone</th>
                                        <th>AVANT</th>
                                        <th>APRÈS</th>
                                        <th>Statut</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="reportsTableBody">
                                    <!-- التقارير ستظهر هنا -->
                                </tbody>
                            </table>
                        </div>
                        
                        <!-- الترقيم -->
                        <div class="pagination" id="reportsPagination">
                            <button class="page-btn" onclick="reportsManager.prevPage()">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span class="page-info" id="pageInfo">Page 1 sur 1</span>
                            <button class="page-btn" onclick="reportsManager.nextPage()">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- مودال التفاصيل -->
            <div id="reportDetailsModal" class="modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h2><i class="fas fa-file-alt"></i> Détails du Rapport</h2>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="modal-body" id="reportDetailsContent">
                        <!-- محتوى التفاصيل -->
                    </div>
                </div>
            </div>
            
            <!-- مودال الإحصائيات -->
            <div id="reportsStatsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-chart-bar"></i> Statistiques Détaillées</h2>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="modal-body" id="reportsStatsContent">
                        <!-- محتوى الإحصائيات -->
                    </div>
                </div>
            </div>
        `;
    }
    
    // تحديث قائمة التقارير
    updateReportsList() {
        const tableBody = document.getElementById('reportsTableBody');
        if (!tableBody) return;
        
        if (this.filteredReports.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table">
                        <i class="fas fa-inbox"></i>
                        <p>Aucun rapport trouvé</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // الترقيم
        const itemsPerPage = 10;
        const currentPage = this.currentPage || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageReports = this.filteredReports.slice(startIndex, endIndex);
        
        // إنشاء الصفوف
        tableBody.innerHTML = pageReports.map(report => `
            <tr class="report-row ${report.status}">
                <td>${this.formatDateShort(report.date)}</td>
                <td>
                    <div class="employee-cell">
                        <div class="employee-name">${report.employeeName}</div>
                        <div class="employee-id">${report.employee}</div>
                    </div>
                </td>
                <td>
                    <div class="zone-cell">
                        <div class="zone-name">${report.area}</div>
                        <div class="zone-code">${report.areaCode}</div>
                    </div>
                </td>
                <td>${report.numberBefore || 'N/A'}</td>
                <td>${report.numberAfter || 'N/A'}</td>
                <td>
                    <span class="status-badge ${report.status}">
                        ${report.status === 'complete' ? 'Complet' : 'En attente'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="reportsManager.viewReportDetails(${report.id})" title="Voir détails">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="reportsManager.downloadReport(${report.id})" title="Télécharger">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="reportsManager.deleteReport(${report.id})" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // تحديث الترقيم
        this.updatePagination();
    }
    
    // تحديث الترقيم
    updatePagination() {
        const itemsPerPage = 10;
        const totalPages = Math.ceil(this.filteredReports.length / itemsPerPage);
        const currentPage = this.currentPage || 1;
        
        document.getElementById('pageInfo').textContent = 
            `Page ${currentPage} sur ${totalPages} (${this.filteredReports.length} rapports)`;
    }
    
    // الصفحة التالية
    nextPage() {
        const itemsPerPage = 10;
        const totalPages = Math.ceil(this.filteredReports.length / itemsPerPage);
        
        if (!this.currentPage) this.currentPage = 1;
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateReportsList();
        }
    }
    
    // الصفحة السابقة
    prevPage() {
        if (!this.currentPage) this.currentPage = 1;
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateReportsList();
        }
    }
    
    // تحديث الفلاتر
    updateFilters() {
        // تحديث قائمة الموظفين
        const employeeFilter = document.getElementById('filterEmployee');
        if (employeeFilter) {
            const employees = [...new Set(this.allReports.map(r => r.employee))];
            employeeFilter.innerHTML = '<option value="">Tous les employés</option>';
            
            employees.forEach(emp => {
                const report = this.allReports.find(r => r.employee === emp);
                const option = document.createElement('option');
                option.value = emp;
                option.textContent = report ? report.employeeName : emp;
                employeeFilter.appendChild(option);
            });
        }
        
        // تحديث قائمة المناطق
        const zoneFilter = document.getElementById('filterZone');
        if (zoneFilter) {
            const zones = [...new Set(this.allReports.map(r => r.areaCode))];
            zoneFilter.innerHTML = '<option value="">Toutes les zones</option>';
            
            zones.forEach(zoneCode => {
                const report = this.allReports.find(r => r.areaCode === zoneCode);
                const option = document.createElement('option');
                option.value = zoneCode;
                option.textContent = report ? `${report.area} (${zoneCode})` : zoneCode;
                zoneFilter.appendChild(option);
            });
        }
        
        // تعيين القيم الحالية
        if (this.currentFilters.dateFrom) {
            document.getElementById('filterDateFrom').value = this.currentFilters.dateFrom;
        }
        
        if (this.currentFilters.dateTo) {
            document.getElementById('filterDateTo').value = this.currentFilters.dateTo;
        }
        
        if (this.currentFilters.employee) {
            document.getElementById('filterEmployee').value = this.currentFilters.employee;
        }
        
        if (this.currentFilters.zone) {
            document.getElementById('filterZone').value = this.currentFilters.zone;
        }
        
        if (this.currentFilters.status) {
            document.getElementById('filterStatus').value = this.currentFilters.status;
        }
    }
    
    // تطبيق الفلاتر من الواجهة
    applyFiltersUI() {
        this.currentFilters = {
            dateFrom: document.getElementById('filterDateFrom').value || null,
            dateTo: document.getElementById('filterDateTo').value || null,
            employee: document.getElementById('filterEmployee').value || null,
            zone: document.getElementById('filterZone').value || null,
            status: document.getElementById('filterStatus').value || null
        };
        
        this.currentPage = 1;
        this.applyFilters();
        this.updateReportsList();
        this.updateStatsDisplay();
    }
    
    // إعادة تعيين الفلاتر
    resetFilters() {
        this.currentFilters = {
            dateFrom: null,
            dateTo: null,
            employee: null,
            zone: null,
            status: null
        };
        
        this.currentPage = 1;
        this.applyFilters();
        this.updateReportsList();
        this.updateFilters();
        this.updateStatsDisplay();
    }
    
    // تحديث عرض الإحصائيات
    updateStatsDisplay() {
        const total = this.filteredReports.length;
        const complete = this.filteredReports.filter(r => r.status === 'complete').length;
        const pending = this.filteredReports.filter(r => r.status === 'before_only').length;
        const rate = total > 0 ? Math.round((complete / total) * 100) : 0;
        
        document.getElementById('totalReports').textContent = total;
        document.getElementById('completeReports').textContent = complete;
        document.getElementById('pendingReports').textContent = pending;
        document.getElementById('completionRate').textContent = `${rate}%`;
    }
    
    // عرض تفاصيل التقرير
    async viewReportDetails(reportId) {
        const report = this.allReports.find(r => r.id === reportId);
        if (!report) {
            alert('Rapport non trouvé');
            return;
        }
        
        // جلب الصور من Supabase إذا كانت مفقودة
        if ((!report.photos || report.photos.length === 0) && window.supabaseClient) {
            const result = await window.supabaseClient.getReports();
            if (result.success && result.data) {
                const fullReport = result.data.find(r => r.id === reportId);
                if (fullReport) {
                    report.photos = fullReport.photos || [];
                }
            }
        }
        
        const detailsHTML = this.getReportDetailsHTML(report);
        
        // عرض المودال
        const modal = document.getElementById('reportDetailsModal');
        const content = document.getElementById('reportDetailsContent');
        
        if (modal && content) {
            content.innerHTML = detailsHTML;
            modal.style.display = 'block';
            
            // إضافة مستمع لإغلاق المودال
            modal.querySelector('.close-modal').onclick = () => {
                modal.style.display = 'none';
            };
        }
    }
    
    // HTML تفاصيل التقرير
    getReportDetailsHTML(report) {
        const beforePhotos = report.photos?.filter(p => p.type === 'before') || [];
        const afterPhotos = report.photos?.filter(p => p.type === 'after') || [];
        
        return `
            <div class="report-details-view">
                <!-- معلومات التقرير -->
                <div class="details-section">
                    <h3><i class="fas fa-info-circle"></i> Informations Générales</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">ID du rapport:</span>
                            <span class="detail-value">${report.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Employé:</span>
                            <span class="detail-value">${report.employeeName} (${report.employee})</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Date de création:</span>
                            <span class="detail-value">${this.formatDate(report.date)}</span>
                        </div>
                        ${report.completionDate ? `
                            <div class="detail-item">
                                <span class="detail-label">Date de complétion:</span>
                                <span class="detail-value">${this.formatDate(report.completionDate)}</span>
                            </div>
                        ` : ''}
                        <div class="detail-item">
                            <span class="detail-label">Zone:</span>
                            <span class="detail-value">${report.area} (${report.areaCode})</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Code Note:</span>
                            <span class="detail-value">${report.noteCode}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Statut:</span>
                            <span class="detail-value">
                                <span class="status-badge ${report.status}">
                                    ${report.status === 'complete' ? 'Complet' : 'En attente'}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- بيانات الأرقام -->
                <div class="details-section">
                    <h3><i class="fas fa-hashtag"></i> Données Numériques</h3>
                    <div class="numbers-grid">
                        <div class="number-card">
                            <div class="number-label">Nombre AVANT</div>
                            <div class="number-value">${report.numberBefore || 'N/A'}</div>
                        </div>
                        ${report.numberAfter ? `
                            <div class="number-card">
                                <div class="number-label">Nombre APRÈS</div>
                                <div class="number-value">${report.numberAfter}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- الموقع -->
                <div class="details-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Localisation</h3>
                    <div class="details-grid">
                        ${report.location ? `
                            <div class="detail-item">
                                <span class="detail-label">Latitude:</span>
                                <span class="detail-value">${report.location.lat?.toFixed(6) || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Longitude:</span>
                                <span class="detail-value">${report.location.lng?.toFixed(6) || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Élévation:</span>
                                <span class="detail-value">${report.location.elev || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Précision:</span>
                                <span class="detail-value">${report.location.prec ? report.location.prec + ' m' : 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Heure:</span>
                                <span class="detail-value">${report.location.time || 'N/A'}</span>
                            </div>
                        ` : '<p class="no-data">Aucune information de localisation disponible</p>'}
                    </div>
                </div>
                
                <!-- الصور -->
                <div class="details-section">
                    <h3><i class="fas fa-images"></i> Photos (${beforePhotos.length + afterPhotos.length})</h3>
                    
                    ${beforePhotos.length > 0 ? `
                        <div class="photos-section">
                            <h4>Photos AVANT (${beforePhotos.length})</h4>
                            <div class="photos-grid">
                                ${beforePhotos.map((photo, index) => `
                                    <div class="photo-detail">
                                        <div class="photo-preview" onclick="reportsManager.viewPhoto('${photo.url || ''}', 'Photo AVANT ${index + 1}')">
                                            <img src="${photo.url || '#'}" alt="Photo AVANT ${index + 1}" 
                                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9IiNlMWU4ZWQiPjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiPlBob3RvIEFWQU5UIDIke2luZGV4KzF9PC90ZXh0Pjwvc3ZnPj4='">
                                            <div class="photo-overlay">
                                                <i class="fas fa-search-plus"></i>
                                            </div>
                                        </div>
                                        <div class="photo-info">
                                            <div class="photo-type before">AVANT ${index + 1}</div>
                                            <div class="photo-time">${this.formatDate(photo.timestamp)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${afterPhotos.length > 0 ? `
                        <div class="photos-section">
                            <h4>Photos APRÈS (${afterPhotos.length})</h4>
                            <div class="photos-grid">
                                ${afterPhotos.map((photo, index) => `
                                    <div class="photo-detail">
                                        <div class="photo-preview" onclick="reportsManager.viewPhoto('${photo.url || ''}', 'Photo APRÈS ${index + 1}')">
                                            <img src="${photo.url || '#'}" alt="Photo APRÈS ${index + 1}" 
                                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9IiNlMWU4ZWQiPjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiPlBob3RvIEFQUkVTICR7aW5kZXgrMX08L3RleHQ+PC9zdmc+'>
                                            <div class="photo-overlay">
                                                <i class="fas fa-search-plus"></i>
                                            </div>
                                        </div>
                                        <div class="photo-info">
                                            <div class="photo-type after">APRÈS ${index + 1}</div>
                                            <div class="photo-time">${this.formatDate(photo.timestamp)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${beforePhotos.length === 0 && afterPhotos.length === 0 ? 
                        '<p class="no-data">Aucune photo disponible</p>' : ''}
                </div>
                
                <!-- الإجراءات -->
                <div class="details-actions">
                    <button class="action-btn primary" onclick="reportsManager.downloadReport(${report.id})">
                        <i class="fas fa-download"></i> Télécharger le rapport
                    </button>
                    <button class="action-btn" onclick="reportsManager.printReport(${report.id})">
                        <i class="fas fa-print"></i> Imprimer
                    </button>
                    ${Auth.currentUser?.role === 'admin' ? `
                        <button class="action-btn danger" onclick="reportsManager.deleteReport(${report.id}, true)">
                            <i class="fas fa-trash"></i> Supprimer
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // عرض الصورة
    viewPhoto(imageUrl, title) {
        if (!imageUrl || imageUrl === '#') return;
        
        const modal = document.createElement('div');
        modal.className = 'photo-viewer-modal';
        modal.innerHTML = `
            <div class="photo-viewer">
                <button class="close-viewer" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
                <img src="${imageUrl}" alt="${title}" class="full-size-photo">
                <div class="photo-title">${title}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // تحميل التقرير
    downloadReport(reportId) {
        const report = this.allReports.find(r => r.id === reportId);
        if (!report) return;
        
        const reportData = {
            ...report,
            exportDate: new Date().toISOString(),
            exportedBy: Auth.currentUser?.username || 'system'
        };
        
        const jsonData = JSON.stringify(reportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rapport_${report.areaCode}_${report.id}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Rapport téléchargé avec succès', 'success');
    }
    
    // طباعة التقرير
    printReport(reportId) {
        const report = this.allReports.find(r => r.id === reportId);
        if (!report) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Rapport ${report.areaCode} - ${report.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                    h1 { color: #1a5fb4; border-bottom: 2px solid #e1e8ed; padding-bottom: 10px; }
                    .section { margin: 20px 0; }
                    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
                    .info-item { margin: 5px 0; }
                    .label { font-weight: bold; color: #666; min-width: 150px; display: inline-block; }
                    .value { color: #333; }
                    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
                    .photo-item { text-align: center; }
                    .photo-label { font-size: 12px; color: #666; margin-top: 5px; }
                    @media print {
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>Rapport NoteCam</h1>
                
                <div class="section">
                    <h2>Informations Générales</h2>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">ID:</span> <span class="value">${report.id}</span></div>
                        <div class="info-item"><span class="label">Employé:</span> <span class="value">${report.employeeName}</span></div>
                        <div class="info-item"><span class="label">Date:</span> <span class="value">${this.formatDate(report.date)}</span></div>
                        <div class="info-item"><span class="label">Zone:</span> <span class="value">${report.area} (${report.areaCode})</span></div>
                        <div class="info-item"><span class="label">Statut:</span> <span class="value">${report.status === 'complete' ? 'Complet' : 'En attente'}</span></div>
                    </div>
                </div>
                
                <div class="section">
                    <h2>Données Numériques</h2>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">Nombre AVANT:</span> <span class="value">${report.numberBefore || 'N/A'}</span></div>
                        ${report.numberAfter ? `
                            <div class="info-item"><span class="label">Nombre APRÈS:</span> <span class="value">${report.numberAfter}</span></div>
                        ` : ''}
                        <div class="info-item"><span class="label">Code Note:</span> <span class="value">${report.noteCode}</span></div>
                    </div>
                </div>
                
                ${report.location ? `
                    <div class="section">
                        <h2>Localisation</h2>
                        <div class="info-grid">
                            <div class="info-item"><span class="label">Latitude:</span> <span class="value">${report.location.lat?.toFixed(6) || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Longitude:</span> <span class="value">${report.location.lng?.toFixed(6) || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Élévation:</span> <span class="value">${report.location.elev || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Précision:</span> <span class="value">${report.location.prec ? report.location.prec + ' m' : 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Heure:</span> <span class="value">${report.location.time || 'N/A'}</span></div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="section">
                    <h2>Photos</h2>
                    <p>Total photos: ${report.photos?.length || 0}</p>
                </div>
                
                <div class="section">
                    <p>Généré le: ${new Date().toLocaleString()}</p>
                    <p>Système NoteCam - ${Config.APP_NAME}</p>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
    
    // حذف التقرير
    async deleteReport(reportId, fromModal = false) {
        if (!confirm('Voulez-vous vraiment supprimer ce rapport ? Cette action est irréversible.')) {
            return;
        }
        
        try {
            // حذف محلياً
            this.allReports = this.allReports.filter(r => r.id !== reportId);
            this.filteredReports = this.filteredReports.filter(r => r.id !== reportId);
            
            // حذف من Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                await window.supabaseClient.deleteReport(reportId);
            }
            
            // حفظ محلياً
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.REPORTS,
                JSON.stringify(this.allReports)
            );
            
            // تحديث الواجهة
            this.updateReportsList();
            this.updateStatsDisplay();
            
            // إغلاق المودال إذا كان مفتوحاً
            if (fromModal) {
                const modal = document.getElementById('reportDetailsModal');
                if (modal) modal.style.display = 'none';
            }
            
            showNotification('Rapport supprimé avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur suppression rapport:', error);
            showNotification('Erreur lors de la suppression du rapport', 'error');
        }
    }
    
    // تحديث التقارير
    async refreshReports() {
        const syncStatus = document.getElementById('reportsSyncStatus');
        syncStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Actualisation...';
        
        try {
            await this.loadReports();
            this.updateReportsList();
            this.updateStatsDisplay();
            
            syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${this.allReports.length} rapports`;
            showNotification('Liste des rapports actualisée', 'success');
            
        } catch (error) {
            syncStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Erreur';
            showNotification('Erreur lors de l\'actualisation', 'error');
        }
    }
    
    // تصدير جميع التقارير
    exportAllReports() {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalReports: this.allReports.length,
            filteredReports: this.filteredReports.length,
            filters: this.currentFilters,
            reports: this.allReports,
            stats: this.stats
        };
        
        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Export_Rapports_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Tous les rapports exportés', 'success');
    }
    
    // عرض مودال الإحصائيات
    showStatsModal() {
        const statsHTML = this.getStatsModalHTML();
        
        const modal = document.getElementById('reportsStatsModal');
        const content = document.getElementById('reportsStatsContent');
        
        if (modal && content) {
            content.innerHTML = statsHTML;
            modal.style.display = 'block';
            
            // إضافة مستمع لإغلاق المودال
            modal.querySelector('.close-modal').onclick = () => {
                modal.style.display = 'none';
            };
            
            // رسم المخططات البيانية
            setTimeout(() => {
                this.drawCharts();
            }, 100);
        }
    }
    
    // HTML مودال الإحصائيات
    getStatsModalHTML() {
        return `
            <div class="stats-view">
                <!-- الإحصائيات الرئيسية -->
                <div class="stats-summary">
                    <div class="stat-item-large">
                        <div class="stat-value-large">${this.stats.total}</div>
                        <div class="stat-label-large">Total Rapports</div>
                    </div>
                    <div class="stat-item-large">
                        <div class="stat-value-large" style="color: #2ea043;">${this.stats.complete}</div>
                        <div class="stat-label-large">Complets</div>
                    </div>
                    <div class="stat-item-large">
                        <div class="stat-value-large" style="color: #ffa500;">${this.stats.pending}</div>
                        <div class="stat-label-large">En Attente</div>
                    </div>
                    <div class="stat-item-large">
                        <div class="stat-value-large" style="color: #1a5fb4;">
                            ${this.stats.total > 0 ? Math.round((this.stats.complete / this.stats.total) * 100) : 0}%
                        </div>
                        <div class="stat-label-large">Taux Complétion</div>
                    </div>
                </div>
                
                <!-- المخططات -->
                <div class="charts-container">
                    <div class="chart-card">
                        <h4>Répartition par Statut</h4>
                        <canvas id="statusChart" width="400" height="200"></canvas>
                    </div>
                    
                    <div class="chart-card">
                        <h4>Top 5 Employés</h4>
                        <canvas id="employeesChart" width="400" height="200"></canvas>
                    </div>
                    
                    <div class="chart-card">
                        <h4>Top 5 Zones</h4>
                        <canvas id="zonesChart" width="400" height="200"></canvas>
                    </div>
                    
                    <div class="chart-card">
                        <h4>Évolution Temporelle</h4>
                        <canvas id="timelineChart" width="400" height="200"></canvas>
                    </div>
                </div>
                
                <!-- جداول البيانات -->
                <div class="data-tables">
                    <div class="data-table">
                        <h4>Par Employé</h4>
                        <table class="stats-table">
                            <thead>
                                <tr>
                                    <th>Employé</th>
                                    <th>Total</th>
                                    <th>Complets</th>
                                    <th>En Attente</th>
                                    <th>Taux</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(this.stats.byEmployee)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .slice(0, 10)
                                    .map(([emp, data]) => `
                                    <tr>
                                        <td>${data.name}</td>
                                        <td>${data.total}</td>
                                        <td>${data.complete}</td>
                                        <td>${data.pending}</td>
                                        <td>${data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="data-table">
                        <h4>Par Zone</h4>
                        <table class="stats-table">
                            <thead>
                                <tr>
                                    <th>Zone</th>
                                    <th>Total</th>
                                    <th>Complets</th>
                                    <th>En Attente</th>
                                    <th>Taux</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(this.stats.byZone)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .slice(0, 10)
                                    .map(([zone, data]) => `
                                    <tr>
                                        <td>${data.name}</td>
                                        <td>${data.total}</td>
                                        <td>${data.complete}</td>
                                        <td>${data.pending}</td>
                                        <td>${data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- إجراءات التصدير -->
                <div class="export-actions">
                    <button class="action-btn primary" onclick="reportsManager.exportStats()">
                        <i class="fas fa-download"></i> Exporter Statistiques
                    </button>
                </div>
            </div>
        `;
    }
    
    // رسم المخططات البيانية
    drawCharts() {
        // مخطط حالة التقارير
        const statusCtx = document.getElementById('statusChart')?.getContext('2d');
        if (statusCtx) {
            new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Complets', 'En Attente'],
                    datasets: [{
                        data: [this.stats.complete, this.stats.pending],
                        backgroundColor: ['#2ea043', '#ffa500'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // مخطط أفضل الموظفين
        const employeesCtx = document.getElementById('employeesChart')?.getContext('2d');
        if (employeesCtx) {
            const topEmployees = Object.entries(this.stats.byEmployee)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5);
            
            new Chart(employeesCtx, {
                type: 'bar',
                data: {
                    labels: topEmployees.map(([_, data]) => data.name.substring(0, 10) + '...'),
                    datasets: [{
                        label: 'Rapports',
                        data: topEmployees.map(([_, data]) => data.total),
                        backgroundColor: '#1a5fb4'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // مخطط أفضل المناطق
        const zonesCtx = document.getElementById('zonesChart')?.getContext('2d');
        if (zonesCtx) {
            const topZones = Object.entries(this.stats.byZone)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5);
            
            new Chart(zonesCtx, {
                type: 'bar',
                data: {
                    labels: topZones.map(([_, data]) => data.name.substring(0, 10) + '...'),
                    datasets: [{
                        label: 'Rapports',
                        data: topZones.map(([_, data]) => data.total),
                        backgroundColor: '#2ea043'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // مخطط الخط الزمني
        const timelineCtx = document.getElementById('timelineChart')?.getContext('2d');
        if (timelineCtx) {
            // تجميع التقارير حسب اليوم
            const reportsByDay = {};
            this.allReports.forEach(report => {
                const date = report.date.split('T')[0];
                reportsByDay[date] = (reportsByDay[date] || 0) + 1;
            });
            
            // تحويل إلى مصفوفات
            const dates = Object.keys(reportsByDay).sort();
            const counts = dates.map(date => reportsByDay[date]);
            
            new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: dates.map(date => new Date(date).toLocaleDateString('fr-FR')),
                    datasets: [{
                        label: 'Rapports par jour',
                        data: counts,
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }
    
    // تصدير الإحصائيات
    exportStats() {
        const statsData = {
            ...this.stats,
            exportDate: new Date().toISOString(),
            totalReports: this.allReports.length,
            filteredReports: this.filteredReports.length,
            filters: this.currentFilters
        };
        
        const jsonData = JSON.stringify(statsData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Statistiques_Rapports_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Statistiques exportées', 'success');
    }
    
    // العودة للوحة الرئيسية
    goBack() {
        if (Auth.currentUser?.role === 'admin') {
            window.adminPanel.renderDashboard();
        } else {
            window.employeePanel.renderDashboard();
        }
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
    
    // تنسيق التاريخ المختصر
    formatDateShort(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hier';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('fr-FR', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        }
    }
}

// إنشاء وتصدير نسخة واحدة
const reportsManager = new ReportsManager();
window.reportsManager = reportsManager;

// إضافة أنماط إضافية للتقارير
const reportsStyles = document.createElement('style');
reportsStyles.textContent = `
    .reports-panel {
        min-height: 100vh;
    }
    
    .reports-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        padding: 20px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 100%);
    }
    
    .stat-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        gap: 15px;
        transition: all 0.3s ease;
    }
    
    .stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
    
    .stat-icon {
        font-size: 32px;
        color: #1a5fb4;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e3f2fd;
        border-radius: 50%;
    }
    
    .stat-content {
        flex: 1;
    }
    
    .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1a5fb4;
        line-height: 1;
    }
    
    .stat-label {
        font-size: 14px;
        color: #666;
        margin-top: 5px;
    }
    
    .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .filter-group {
        display: flex;
        flex-direction: column;
    }
    
    .filter-group label {
        font-size: 14px;
        color: #666;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .filter-input {
        padding: 10px;
        border: 2px solid #e1e8ed;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    
    .filter-input:focus {
        border-color: #1a5fb4;
        outline: none;
        box-shadow: 0 0 0 3px rgba(26, 95, 180, 0.1);
    }
    
    .filter-actions {
        grid-column: 1 / -1;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        align-items: flex-end;
    }
    
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .section-actions {
        display: flex;
        gap: 10px;
    }
    
    .reports-table-container {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e1e8ed;
        background: white;
    }
    
    .reports-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 800px;
    }
    
    .reports-table th {
        background: #f8f9fa;
        padding: 12px 15px;
        text-align: left;
        font-weight: 600;
        color: #1a5fb4;
        border-bottom: 2px solid #e1e8ed;
        font-size: 14px;
    }
    
    .reports-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #e1e8ed;
        vertical-align: middle;
    }
    
    .reports-table tr:hover {
        background: #f8f9fa;
    }
    
    .reports-table tr.complete {
        background: #f0fff4;
    }
    
    .reports-table tr.before_only {
        background: #fff3cd;
    }
    
    .employee-cell, .zone-cell {
        display: flex;
        flex-direction: column;
    }
    
    .employee-name, .zone-name {
        font-weight: 600;
        color: #333;
        font-size: 14px;
    }
    
    .employee-id, .zone-code {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
    }
    
    .status-badge {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
    }
    
    .status-badge.complete {
        background: #f0fff4;
        color: #2ea043;
    }
    
    .status-badge.before_only {
        background: #fff3cd;
        color: #856404;
    }
    
    .action-buttons {
        display: flex;
        gap: 5px;
    }
    
    .btn-icon {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        background: #e3f2fd;
        color: #1a5fb4;
    }
    
    .btn-icon:hover {
        background: #1a5fb4;
        color: white;
        transform: translateY(-2px);
    }
    
    .btn-icon.btn-danger {
        background: #ffe6e6;
        color: #ff6b6b;
    }
    
    .btn-icon.btn-danger:hover {
        background: #ff6b6b;
        color: white;
    }
    
    .empty-table {
        text-align: center;
        padding: 40px !important;
    }
    
    .empty-table i {
        font-size: 48px;
        color: #e1e8ed;
        margin-bottom: 15px;
        display: block;
    }
    
    .empty-table p {
        color: #666;
        margin: 0;
    }
    
    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .page-btn {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: white;
        color: #1a5fb4;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    .page-btn:hover:not(:disabled) {
        background: #1a5fb4;
        color: white;
        transform: translateY(-2px);
    }
    
    .page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .page-info {
        color: #666;
        font-size: 14px;
    }
    
    .modal.large .modal-content {
        max-width: 90%;
        max-height: 90vh;
    }
    
    .report-details-view {
        max-width: 1000px;
        margin: 0 auto;
    }
    
    .details-section {
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid #e1e8ed;
    }
    
    .details-section h3 {
        color: #1a5fb4;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e1e8ed;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
    }
    
    .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .detail-item:last-child {
        border-bottom: none;
    }
    
    .detail-label {
        color: #666;
        font-weight: 500;
        min-width: 150px;
    }
    
    .detail-value {
        color: #333;
        font-weight: 600;
        text-align: right;
    }
    
    .no-data {
        text-align: center;
        color: #666;
        font-style: italic;
        padding: 20px;
    }
    
    .numbers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
    }
    
    .number-card {
        text-align: center;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 2px solid #e1e8ed;
    }
    
    .number-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
    }
    
    .number-value {
        font-size: 32px;
        font-weight: 700;
        color: #1a5fb4;
    }
    
    .photos-section {
        margin-top: 20px;
    }
    
    .photos-section h4 {
        color: #333;
        margin-bottom: 15px;
        padding-left: 10px;
        border-left: 4px solid #1a5fb4;
    }
    
    .photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
    }
    
    .photo-detail {
        border: 1px solid #e1e8ed;
        border-radius: 8px;
        overflow: hidden;
        background: white;
    }
    
    .photo-preview {
        position: relative;
        cursor: pointer;
        height: 120px;
        overflow: hidden;
    }
    
    .photo-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
    }
    
    .photo-preview:hover img {
        transform: scale(1.1);
    }
    
    .photo-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .photo-preview:hover .photo-overlay {
        opacity: 1;
    }
    
    .photo-overlay i {
        color: white;
        font-size: 24px;
    }
    
    .photo-info {
        padding: 10px;
    }
    
    .photo-type {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 5px;
    }
    
    .photo-type.before {
        background: #e3f2fd;
        color: #1a5fb4;
    }
    
    .photo-type.after {
        background: #ffe6e6;
        color: #ff6b6b;
    }
    
    .photo-time {
        font-size: 10px;
        color: #666;
    }
    
    .details-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 2px solid #e1e8ed;
    }
    
    .photo-viewer-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    }
    
    .photo-viewer {
        position: relative;
        max-width: 90%;
        max-height: 90%;
    }
    
    .close-viewer {
        position: absolute;
        top: -40px;
        right: 0;
        background: #ff6b6b;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
    }
    
    .full-size-photo {
        max-width: 100%;
        max-height: 80vh;
        border: 3px solid white;
        border-radius: 5px;
    }
    
    .photo-title {
        text-align: center;
        color: white;
        margin-top: 10px;
        font-size: 14px;
    }
    
    .stats-view {
        max-width: 1200px;
    }
    
    .stats-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .stat-item-large {
        text-align: center;
        padding: 30px 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
    }
    
    .stat-value-large {
        font-size: 48px;
        font-weight: 700;
        color: #1a5fb4;
        line-height: 1;
        margin-bottom: 10px;
    }
    
    .stat-label-large {
        font-size: 16px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .charts-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .chart-card {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
    }
    
    .chart-card h4 {
        color: #1a5fb4;
        margin-bottom: 15px;
        text-align: center;
    }
    
    .data-tables {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .data-table {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
    }
    
    .data-table h4 {
        color: #1a5fb4;
        margin-bottom: 15px;
    }
    
    .stats-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .stats-table th {
        background: #f8f9fa;
        padding: 10px;
        text-align: left;
        font-weight: 600;
        color: #666;
        border-bottom: 2px solid #e1e8ed;
        font-size: 12px;
    }
    
    .stats-table td {
        padding: 10px;
        border-bottom: 1px solid #e1e8ed;
        font-size: 12px;
    }
    
    .stats-table tr:hover {
        background: #f8f9fa;
    }
    
    .export-actions {
        text-align: center;
        margin-top: 30px;
    }
`;
document.head.appendChild(reportsStyles);
