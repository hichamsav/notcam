// لوحة تحكم المشرف
class AdminPanel {
    constructor() {
        this.users = {};
        this.assignedAreas = [];
        this.reports = [];
        this.stats = {
            totalEmployees: 0,
            totalAreas: 0,
            totalReports: 0,
            completeReports: 0,
            pendingReports: 0
        };
    }
    
    // تهيئة اللوحة
    async initialize() {
        try {
            console.log('Initialisation du panneau administrateur...');
            
            // تحميل البيانات
            await this.loadData();
            
            // عرض الواجهة
            this.renderDashboard();
            
            // إعداد المستمعين للأحداث
            this.setupEventListeners();
            
            console.log('Panneau administrateur initialisé');
            return true;
        } catch (error) {
            console.error('Erreur initialisation panneau admin:', error);
            return false;
        }
    }
    
    // تحميل البيانات
    async loadData() {
        try {
            // تحميل من التخزين المحلي أولاً
            this.loadFromLocalStorage();
            
            // محاولة المزامنة مع Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                await this.syncWithSupabase();
            }
            
            // تحديث الإحصائيات
            this.updateStats();
            
        } catch (error) {
            console.error('Erreur chargement données admin:', error);
        }
    }
    
    // تحميل من التخزين المحلي
    loadFromLocalStorage() {
        try {
            // تحميل المستخدمين
            const usersData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.USERS);
            if (usersData) {
                this.users = JSON.parse(usersData);
            } else {
                this.users = Config.DEFAULT_USERS;
            }
            
            // تحميل المناطق
            const areasData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.AREAS);
            if (areasData) {
                this.assignedAreas = JSON.parse(areasData);
            }
            
            // تحميل التقارير
            const reportsData = localStorage.getItem(Config.LOCAL_STORAGE_KEYS.REPORTS);
            if (reportsData) {
                this.reports = JSON.parse(reportsData);
            }
            
        } catch (error) {
            console.error('Erreur chargement local:', error);
        }
    }
    
    // المزامنة مع Supabase
    async syncWithSupabase() {
        try {
            // جلب المستخدمين
            const usersResult = await window.supabaseClient.getUsers();
            if (usersResult.success && usersResult.data) {
                // دمج المستخدمين
                usersResult.data.forEach(user => {
                    this.users[user.username] = {
                        password: user.password,
                        role: user.role,
                        name: user.name,
                        assignedAreas: user.assigned_areas || []
                    };
                });
            }
            
            // جلب المناطق
            const areasResult = await window.supabaseClient.getAssignedAreas();
            if (areasResult.success && areasResult.data) {
                this.assignedAreas = areasResult.data.map(area => ({
                    id: area.id,
                    employee: area.employee,
                    name: area.name,
                    code: area.code,
                    date: area.created_at,
                    isActive: area.is_active
                }));
            }
            
            // جلب التقارير
            const reportsResult = await window.supabaseClient.getReports({ limit: 1000 });
            if (reportsResult.success && reportsResult.data) {
                this.reports = reportsResult.data.map(report => ({
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
            
            // حفظ محلياً
            this.saveToLocalStorage();
            
            console.log('Synchronisation admin terminée');
            
        } catch (error) {
            console.error('Erreur synchronisation admin:', error);
        }
    }
    
    // حفظ في التخزين المحلي
    saveToLocalStorage() {
        try {
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.USERS,
                JSON.stringify(this.users)
            );
            
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.AREAS,
                JSON.stringify(this.assignedAreas)
            );
            
            localStorage.setItem(
                Config.LOCAL_STORAGE_KEYS.REPORTS,
                JSON.stringify(this.reports)
            );
            
        } catch (error) {
            console.error('Erreur sauvegarde local:', error);
        }
    }
    
    // تحديث الإحصائيات
    updateStats() {
        // حساب عدد الموظفين
        this.stats.totalEmployees = Object.values(this.users)
            .filter(user => user.role === 'employee').length;
        
        // حساب عدد المناطق
        this.stats.totalAreas = this.assignedAreas.length;
        
        // حساب عدد التقارير
        this.stats.totalReports = this.reports.length;
        
        // حساب التقارير المكتملة
        this.stats.completeReports = this.reports
            .filter(report => report.status === 'complete').length;
        
        // حساب التقارير المعلقة
        this.stats.pendingReports = this.reports
            .filter(report => report.status === 'before_only').length;
    }
    
    // عرض لوحة التحكم
    renderDashboard() {
        const app = document.getElementById('app');
        app.innerHTML = this.getDashboardHTML();
        
        // تحديث البيانات
        this.updateEmployeeList();
        this.updateAreaList();
        this.updateReportsList();
        this.updateStatistics();
    }
    
    // HTML للوحة التحكم
    getDashboardHTML() {
        return `
            <div class="app-container">
                <div class="status-bar">
                    <div>Panneau Administrateur • ${Config.APP_NAME}</div>
                    <div class="sync-status" id="adminSyncStatus">
                        <i class="fas fa-sync"></i>
                        <span>Prêt</span>
                    </div>
                </div>
                
                <div class="admin-panel">
                    <!-- رأس اللوحة -->
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fas fa-user-shield"></i> Administration du Système
                        </div>
                        <div>
                            <button class="control-btn" onclick="adminPanel.showStatsModal()">
                                <i class="fas fa-chart-bar"></i> Statistiques
                            </button>
                            <button class="logout-btn" onclick="logout()">
                                <i class="fas fa-sign-out-alt"></i> Déconnexion
                            </button>
                        </div>
                    </div>
                    
                    <!-- إحصائيات سريعة -->
                    <div class="quick-stats">
                        <div class="stat-card" id="statEmployees">
                            <i class="fas fa-users"></i>
                            <div class="stat-value">0</div>
                            <div class="stat-label">Employés</div>
                        </div>
                        <div class="stat-card" id="statAreas">
                            <i class="fas fa-map-marker-alt"></i>
                            <div class="stat-value">0</div>
                            <div class="stat-label">Zones</div>
                        </div>
                        <div class="stat-card" id="statReports">
                            <i class="fas fa-file-alt"></i>
                            <div class="stat-value">0</div>
                            <div class="stat-label">Rapports</div>
                        </div>
                        <div class="stat-card" id="statPending">
                            <i class="fas fa-clock"></i>
                            <div class="stat-value">0</div>
                            <div class="stat-label">En attente</div>
                        </div>
                    </div>
                    
                    <!-- التحكم في المزامنة -->
                    <div class="dashboard-section">
                        <h3><i class="fas fa-sync"></i> Contrôle de Synchronisation</h3>
                        <div class="sync-controls">
                            <button class="sync-btn" onclick="adminPanel.forceSync()">
                                <i class="fas fa-sync-alt"></i> Synchroniser Maintenant
                            </button>
                            <button class="sync-btn" onclick="adminPanel.exportData()">
                                <i class="fas fa-download"></i> Exporter Données
                            </button>
                            <button class="sync-btn" onclick="adminPanel.importData()">
                                <i class="fas fa-upload"></i> Importer Données
                            </button>
                            <div class="sync-info">
                                Dernière sync: <span id="lastSyncTimeAdmin">Jamais</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- إدارة الموظفين -->
                    <div class="dashboard-section">
                        <h3>Gestion des Employés</h3>
                        <div class="employee-form">
                            <input type="text" id="newEmpUsername" class="form-input" placeholder="Nom d'utilisateur">
                            <input type="password" id="newEmpPassword" class="form-input" placeholder="Mot de passe">
                            <input type="text" id="newEmpName" class="form-input" placeholder="Nom complet">
                            <select id="newEmpRole" class="form-input">
                                <option value="employee">Employé</option>
                                <option value="supervisor">Superviseur</option>
                            </select>
                            <button class="action-btn" onclick="adminPanel.addEmployee()">
                                <i class="fas fa-plus"></i> Ajouter Employé
                            </button>
                        </div>
                        <div class="employee-list" id="adminEmployeeList">
                            <!-- قائمة الموظفين ستظهر هنا -->
                        </div>
                    </div>
                    
                    <!-- إدارة المناطق -->
                    <div class="dashboard-section">
                        <h3>Attribution des Zones</h3>
                        <div class="employee-form">
                            <select id="areaEmployeeSelect" class="form-input">
                                <option value="">Sélectionner un employé</option>
                            </select>
                            <input type="text" id="newAreaName" class="form-input" placeholder="Nom de la zone">
                            <input type="text" id="newAreaCode" class="form-input" placeholder="Code de la zone">
                            <button class="action-btn" onclick="adminPanel.assignArea()">
                                <i class="fas fa-map-marker-alt"></i> Attribuer Zone
                            </button>
                        </div>
                        <div class="areas-list" id="adminAreasList">
                            <!-- قائمة المناطق ستظهر هنا -->
                        </div>
                    </div>
                    
                    <!-- التقارير الحديثة -->
                    <div class="dashboard-section">
                        <h3>Rapports Récents</h3>
                        <div class="reports-actions">
                            <button class="control-btn" onclick="adminPanel.viewAllReports()">
                                <i class="fas fa-list"></i> Voir Tous
                            </button>
                            <button class="control-btn primary" onclick="adminPanel.generateDailyReport()">
                                <i class="fas fa-file-pdf"></i> Rapport Journalier
                            </button>
                        </div>
                        <div class="reports-container" id="recentReports">
                            <!-- التقارير الحديثة ستظهر هنا -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- مودال الإحصائيات -->
            <div id="statsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-chart-bar"></i> Statistiques Détaillées</h2>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="modal-body" id="statsModalContent">
                        <!-- محتوى الإحصائيات -->
                    </div>
                </div>
            </div>
        `;
    }
    
    // تحديث قائمة الموظفين
    updateEmployeeList() {
        const employeeList = document.getElementById('adminEmployeeList');
        if (!employeeList) return;
        
        const employees = Object.entries(this.users)
            .filter(([username, data]) => data.role !== 'admin')
            .map(([username, data]) => ({ username, ...data }));
        
        if (employees.length === 0) {
            employeeList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Aucun employé enregistré</p>
                </div>
            `;
            return;
        }
        
        employeeList.innerHTML = employees.map(emp => `
            <div class="employee-card">
                <div class="employee-header">
                    <div class="employee-info">
                        <div class="employee-name">${emp.name}</div>
                        <div class="employee-username">@${emp.username}</div>
                    </div>
                    <span class="employee-role ${emp.role}">${emp.role}</span>
                </div>
                
                <div class="employee-details">
                    <div class="detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Zones: ${emp.assignedAreas?.length || 0}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-file-alt"></i>
                        <span>Rapports: ${this.getEmployeeReportCount(emp.username)}</span>
                    </div>
                </div>
                
                <div class="employee-actions">
                    <button class="btn-small" onclick="adminPanel.editEmployee('${emp.username}')">
                        <i class="fas fa-edit"></i> Modifier
                    </button>
                    <button class="btn-small btn-danger" onclick="adminPanel.deleteEmployee('${emp.username}')">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                    <button class="btn-small btn-info" onclick="adminPanel.resetPassword('${emp.username}')">
                        <i class="fas fa-key"></i> Réinitialiser MDP
                    </button>
                </div>
            </div>
        `).join('');
        
        // تحديث قائمة اختيار الموظفين للمناطق
        this.updateEmployeeSelect();
    }
    
    // تحديث قائمة المناطق
    updateAreaList() {
        const areaList = document.getElementById('adminAreasList');
        if (!areaList) return;
        
        if (this.assignedAreas.length === 0) {
            areaList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-map-marked-alt"></i>
                    <p>Aucune zone attribuée</p>
                </div>
            `;
            return;
        }
        
        // تجميع المناطق حسب الموظف
        const areasByEmployee = {};
        this.assignedAreas.forEach(area => {
            if (!areasByEmployee[area.employee]) {
                areasByEmployee[area.employee] = [];
            }
            areasByEmployee[area.employee].push(area);
        });
        
        areaList.innerHTML = Object.entries(areasByEmployee).map(([employee, areas]) => {
            const employeeData = this.users[employee];
            const employeeName = employeeData ? employeeData.name : employee;
            
            return `
                <div class="employee-area-group">
                    <div class="group-header">
                        <i class="fas fa-user"></i>
                        <span class="group-title">${employeeName}</span>
                        <span class="group-count">${areas.length} zones</span>
                    </div>
                    
                    <div class="areas-grid">
                        ${areas.map(area => `
                            <div class="area-card ${area.isActive ? 'active' : 'inactive'}">
                                <div class="area-header">
                                    <div class="area-name">${area.name}</div>
                                    <div class="area-code">${area.code}</div>
                                </div>
                                
                                <div class="area-details">
                                    <div class="detail-item">
                                        <i class="fas fa-calendar"></i>
                                        <span>${this.formatDate(area.date)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-file-alt"></i>
                                        <span>Rapports: ${this.getAreaReportCount(area.code)}</span>
                                    </div>
                                </div>
                                
                                <div class="area-actions">
                                    <button class="btn-icon" onclick="adminPanel.viewAreaReports('${area.code}')" title="Voir rapports">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn-icon" onclick="adminPanel.editArea('${area.id}')" title="Modifier">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon btn-danger" onclick="adminPanel.deleteArea('${area.id}')" title="Supprimer">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // تحديث قائمة التقارير
    updateReportsList() {
        const reportsList = document.getElementById('recentReports');
        if (!reportsList) return;
        
        // الحصول على آخر 5 تقارير
        const recentReports = [...this.reports]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        if (recentReports.length === 0) {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun rapport reçu</p>
                </div>
            `;
            return;
        }
        
        reportsList.innerHTML = recentReports.map(report => `
            <div class="report-card">
                <div class="report-header">
                    <div class="report-employee">${report.employeeName}</div>
                    <div class="report-date">${this.formatDate(report.date)}</div>
                </div>
                
                <div class="report-details">
                    <div class="detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${report.area} (${report.areaCode})</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-hashtag"></i>
                        <span>AVANT: ${report.numberBefore || 'N/A'}</span>
                    </div>
                    ${report.numberAfter ? `
                        <div class="detail-item">
                            <i class="fas fa-hashtag"></i>
                            <span>APRÈS: ${report.numberAfter}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="report-status">
                    <span class="status-badge ${report.status}">
                        ${report.status === 'complete' ? 'Complet' : 'En attente'}
                    </span>
                </div>
                
                <div class="report-actions">
                    <button class="btn-small" onclick="adminPanel.viewReportDetails('${report.areaCode}', ${report.id})">
                        <i class="fas fa-eye"></i> Détails
                    </button>
                    <button class="btn-small btn-primary" onclick="adminPanel.downloadReport('${report.areaCode}', ${report.id})">
                        <i class="fas fa-download"></i> Télécharger
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // تحديث الإحصائيات
    updateStatistics() {
        document.getElementById('statEmployees').querySelector('.stat-value').textContent = 
            this.stats.totalEmployees;
        document.getElementById('statAreas').querySelector('.stat-value').textContent = 
            this.stats.totalAreas;
        document.getElementById('statReports').querySelector('.stat-value').textContent = 
            this.stats.totalReports;
        document.getElementById('statPending').querySelector('.stat-value').textContent = 
            this.stats.pendingReports;
    }
    
    // تحديث قائمة اختيار الموظفين
    updateEmployeeSelect() {
        const select = document.getElementById('areaEmployeeSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Sélectionner un employé</option>';
        
        Object.entries(this.users)
            .filter(([username, data]) => data.role === 'employee')
            .forEach(([username, data]) => {
                const option = document.createElement('option');
                option.value = username;
                option.textContent = `${data.name} (${username})`;
                select.appendChild(option);
            });
    }
    
    // ========== الوظائف العامة ==========
    
    // إضافة موظف جديد
    async addEmployee() {
        const username = document.getElementById('newEmpUsername').value;
        const password = document.getElementById('newEmpPassword').value;
        const name = document.getElementById('newEmpName').value;
        const role = document.getElementById('newEmpRole').value;
        
        if (!username || !password || !name) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        if (this.users[username]) {
            alert('Ce nom d\'utilisateur existe déjà');
            return;
        }
        
        // إنشاء الموظف
        this.users[username] = {
            password: password,
            role: role,
            name: name,
            assignedAreas: []
        };
        
        // محاولة الحفظ في Supabase
        if (window.supabaseClient && window.supabaseClient.isInitialized) {
            await window.supabaseClient.createUser({
                username: username,
                password: password,
                name: name,
                role: role
            });
        }
        
        // حفظ محلياً
        this.saveToLocalStorage();
        
        // تحديث الواجهة
        this.updateEmployeeList();
        this.updateStatistics();
        
        // إعادة تعيين الحقول
        document.getElementById('newEmpUsername').value = '';
        document.getElementById('newEmpPassword').value = '';
        document.getElementById('newEmpName').value = '';
        
        // إشعار
        showNotification('Employé ajouté avec succès', 'success');
    }
    
    // حذف موظف
    async deleteEmployee(username) {
        if (!confirm(`Voulez-vous vraiment supprimer l'employé ${username} ?`)) {
            return;
        }
        
        // حذف محلياً
        delete this.users[username];
        
        // حذف من Supabase
        if (window.supabaseClient && window.supabaseClient.isInitialized) {
            await window.supabaseClient.deleteUser(username);
        }
        
        // حذف المناطق المرتبطة
        this.assignedAreas = this.assignedAreas.filter(area => area.employee !== username);
        
        // حفظ محلياً
        this.saveToLocalStorage();
        
        // تحديث الواجهة
        this.updateEmployeeList();
        this.updateAreaList();
        this.updateStatistics();
        
        // إشعار
        showNotification('Employé supprimé avec succès', 'success');
    }
    
    // تعديل موظف
    editEmployee(username) {
        const user = this.users[username];
        if (!user) return;
        
        const newName = prompt('Nouveau nom:', user.name);
        if (newName) {
            user.name = newName;
            
            // تحديث في Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                window.supabaseClient.updateUser(username, { name: newName });
            }
            
            // حفظ محلياً
            this.saveToLocalStorage();
            
            // تحديث الواجهة
            this.updateEmployeeList();
            this.updateAreaList();
            
            showNotification('Employé modifié avec succès', 'success');
        }
    }
    
    // إعادة تعيين كلمة المرور
    async resetPassword(username) {
        const newPassword = prompt('Nouveau mot de passe:');
        if (newPassword && newPassword.length >= 6) {
            this.users[username].password = newPassword;
            
            // تحديث في Supabase
            if (window.supabaseClient && window.supabaseClient.isInitialized) {
                await window.supabaseClient.updateUser(username, { password: newPassword });
            }
            
            // حفظ محلياً
            this.saveToLocalStorage();
            
            showNotification('Mot de passe réinitialisé avec succès', 'success');
        } else {
            alert('Le mot de passe doit contenir au moins 6 caractères');
        }
    }
    
    // تعيين منطقة جديدة
    async assignArea() {
        const employee = document.getElementById('areaEmployeeSelect').value;
        const name = document.getElementById('newAreaName').value;
        const code = document.getElementById('newAreaCode').value;
        
        if (!employee || !name || !code) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        // التحقق من عدم وجود الكود مسبقاً
        if (this.assignedAreas.some(area => area.code === code)) {
            alert('Ce code de zone existe déjà');
            return;
        }
        
        const areaData = {
            id: Date.now(),
            employee: employee,
            name: name,
            code: code,
            date: new Date().toISOString(),
            isActive: true
        };
        
        // إضافة محلياً
        this.assignedAreas.push(areaData);
        
        // تحديث بيانات الموظف
        if (this.users[employee]) {
            if (!this.users[employee].assignedAreas) {
                this.users[employee].assignedAreas = [];
            }
            this.users[employee].assignedAreas.push(areaData);
        }
        
        // إرسال إلى Supabase
        if (window.supabaseClient && window.supabaseClient.isInitialized) {
            await window.supabaseClient.assignArea({
                employee: employee,
                name: name,
                code: code,
                isActive: true
            });
        }
        
        // حفظ محلياً
        this.saveToLocalStorage();
        
        // تحديث الواجهة
        this.updateAreaList();
        this.updateStatistics();
        
        // إعادة تعيين الحقول
        document.getElementById('newAreaName').value = '';
        document.getElementById('newAreaCode').value = '';
        
        // إشعار
        showNotification('Zone attribuée avec succès', 'success');
    }
    
    // حذف منطقة
    async deleteArea(areaId) {
        if (!confirm('Voulez-vous vraiment supprimer cette zone ?')) {
            return;
        }
        
        const areaIndex = this.assignedAreas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return;
        
        const area = this.assignedAreas[areaIndex];
        
        // حذف محلياً
        this.assignedAreas.splice(areaIndex, 1);
        
        // تحديث بيانات الموظف
        if (this.users[area.employee]) {
            this.users[area.employee].assignedAreas = 
                this.users[area.employee].assignedAreas?.filter(a => a.id !== areaId) || [];
        }
        
        // حذف من Supabase
        if (window.supabaseClient && window.supabaseClient.isInitialized) {
            await window.supabaseClient.deleteArea(areaId);
        }
        
        // حفظ محلياً
        this.saveToLocalStorage();
        
        // تحديث الواجهة
        this.updateAreaList();
        this.updateStatistics();
        
        // إشعار
        showNotification('Zone supprimée avec succès', 'success');
    }
    
    // عرض تقارير منطقة
    viewAreaReports(areaCode) {
        const areaReports = this.reports.filter(r => r.areaCode === areaCode);
        
        if (areaReports.length === 0) {
            alert('Aucun rapport pour cette zone');
            return;
        }
        
        let reportsHTML = `
            <h3>Rapports de la zone ${areaCode}</h3>
            <div class="reports-list">
        `;
        
        areaReports.forEach(report => {
            reportsHTML += `
                <div class="report-summary">
                    <div><strong>Employé:</strong> ${report.employeeName}</div>
                    <div><strong>Date:</strong> ${this.formatDate(report.date)}</div>
                    <div><strong>Statut:</strong> ${report.status === 'complete' ? 'Complet' : 'En attente'}</div>
                    <button class="btn-small" onclick="adminPanel.viewReportDetails('${areaCode}', ${report.id})">
                        Voir détails
                    </button>
                </div>
            `;
        });
        
        reportsHTML += '</div>';
        
        // عرض في مودال
        this.showModal('Rapports de zone', reportsHTML);
    }
    
    // عرض تفاصيل التقرير
    viewReportDetails(areaCode, reportId) {
        const report = this.reports.find(r => r.areaCode === areaCode && r.id === reportId);
        if (!report) {
            alert('Rapport non trouvé');
            return;
        }
        
        const photosCount = report.photos?.length || 0;
        
        const detailsHTML = `
            <div class="report-details-modal">
                <div class="detail-section">
                    <h4>Informations Générales</h4>
                    <div class="detail-grid">
                        <div><strong>Employé:</strong> ${report.employeeName}</div>
                        <div><strong>Zone:</strong> ${report.area} (${report.areaCode})</div>
                        <div><strong>Date:</strong> ${this.formatDate(report.date)}</div>
                        <div><strong>Statut:</strong> ${report.status === 'complete' ? 'Complet' : 'En attente'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Données de Terrain</h4>
                    <div class="detail-grid">
                        <div><strong>Nombre AVANT:</strong> ${report.numberBefore || 'N/A'}</div>
                        ${report.numberAfter ? `<div><strong>Nombre APRÈS:</strong> ${report.numberAfter}</div>` : ''}
                        <div><strong>Code Note:</strong> ${report.noteCode || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Localisation</h4>
                    <div class="detail-grid">
                        ${report.location ? `
                            <div><strong>Latitude:</strong> ${report.location.lat?.toFixed(6) || 'N/A'}</div>
                            <div><strong>Longitude:</strong> ${report.location.lng?.toFixed(6) || 'N/A'}</div>
                            <div><strong>Élévation:</strong> ${report.location.elev || 'N/A'}</div>
                        ` : '<div>Aucune information de localisation</div>'}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Photos (${photosCount})</h4>
                    ${photosCount > 0 ? `
                        <div class="photos-preview">
                            ${report.photos.map((photo, index) => `
                                <div class="photo-thumbnail">
                                    <img src="${photo.url || '#'}" alt="Photo ${index + 1}" 
                                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNlMWU4ZWQiPjx0ZXh0IHg9IjUwIiB5PSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NiI+UGhvdG8gJHtpbmRleCsxfTwvdGV4dD48L3N2Zz4='">
                                    <div class="photo-label">Photo ${index + 1}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Aucune photo disponible</p>'}
                </div>
                
                <div class="modal-actions">
                    <button class="btn-primary" onclick="adminPanel.downloadReport('${areaCode}', ${reportId})">
                        <i class="fas fa-download"></i> Télécharger
                    </button>
                    <button class="btn-danger" onclick="adminPanel.deleteReport('${areaCode}', ${reportId})">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                    <button class="btn-secondary" onclick="adminPanel.closeModal()">
                        Fermer
                    </button>
                </div>
            </div>
        `;
        
        this.showModal('Détails du rapport', detailsHTML);
    }
    
    // تحميل التقرير
    downloadReport(areaCode, reportId) {
        const report = this.reports.find(r => r.areaCode === areaCode && r.id === reportId);
        if (!report) return;
        
        const reportData = {
            ...report,
            exportDate: new Date().toISOString(),
            exportedBy: 'admin'
        };
        
        const jsonData = JSON.stringify(reportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rapport_${areaCode}_${reportId}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Rapport téléchargé avec succès', 'success');
    }
    
    // حذف التقرير
    async deleteReport(areaCode, reportId) {
        if (!confirm('Voulez-vous vraiment supprimer ce rapport ? Cette action est irréversible.')) {
            return;
        }
        
        const reportIndex = this.reports.findIndex(r => r.areaCode === areaCode && r.id === reportId);
        if (reportIndex === -1) return;
        
        // حذف محلياً
        this.reports.splice(reportIndex, 1);
        
        // حذف من Supabase
        if (window.supabaseClient && window.supabaseClient.isInitialized) {
            await window.supabaseClient.deleteReport(reportId);
        }
        
        // حفظ محلياً
        this.saveToLocalStorage();
        
        // تحديث الواجهة
        this.updateReportsList();
        this.updateStatistics();
        
        // إغلاق المودال
        this.closeModal();
        
        showNotification('Rapport supprimé avec succès', 'success');
    }
    
    // عرض جميع التقارير
    viewAllReports() {
        window.location.hash = '#reports';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    
    // توليد تقرير يومي
    generateDailyReport() {
        const today = new Date().toISOString().split('T')[0];
        const todayReports = this.reports.filter(report => 
            report.date.split('T')[0] === today
        );
        
        if (todayReports.length === 0) {
            alert('Aucun rapport aujourd\'hui');
            return;
        }
        
        const reportData = {
            date: today,
            totalReports: todayReports.length,
            completeReports: todayReports.filter(r => r.status === 'complete').length,
            pendingReports: todayReports.filter(r => r.status === 'before_only').length,
            employees: [...new Set(todayReports.map(r => r.employeeName))],
            zones: [...new Set(todayReports.map(r => r.area))],
            reports: todayReports
        };
        
        const jsonData = JSON.stringify(reportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rapport_Journalier_${today}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Rapport journalier généré', 'success');
    }
    
    // عرض مودال الإحصائيات
    showStatsModal() {
        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">Employés Actifs</div>
                    <div class="stat-value">${this.stats.totalEmployees}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">Zones Attribuées</div>
                    <div class="stat-value">${this.stats.totalAreas}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">Total Rapports</div>
                    <div class="stat-value">${this.stats.totalReports}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">Rapports Complets</div>
                    <div class="stat-value">${this.stats.completeReports}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">Rapports En Attente</div>
                    <div class="stat-value">${this.stats.pendingReports}</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-label">Taux de Complétion</div>
                    <div class="stat-value">
                        ${this.stats.totalReports > 0 ? 
                            Math.round((this.stats.completeReports / this.stats.totalReports) * 100) : 0}%
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <canvas id="reportsChart" width="400" height="200"></canvas>
            </div>
            
            <div class="export-actions">
                <button class="btn-primary" onclick="adminPanel.exportStatistics()">
                    <i class="fas fa-download"></i> Exporter Statistiques
                </button>
            </div>
        `;
        
        this.showModal('Statistiques du Système', statsHTML);
        
        // رسم المخطط البياني
        setTimeout(() => {
            this.drawReportsChart();
        }, 100);
    }
    
    // رسم مخطط التقارير
    drawReportsChart() {
        const canvas = document.getElementById('reportsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // بيانات المثال
        const data = {
            labels: ['Complets', 'En Attente'],
            datasets: [{
                data: [this.stats.completeReports, this.stats.pendingReports],
                backgroundColor: ['#2ea043', '#ff6b6b'],
                borderWidth: 1
            }]
        };
        
        new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Répartition des Rapports'
                    }
                }
            }
        });
    }
    
    // تصدير الإحصائيات
    exportStatistics() {
        const statsData = {
            ...this.stats,
            exportDate: new Date().toISOString(),
            details: {
                employees: Object.keys(this.users).length,
                zonesByEmployee: this.getZonesByEmployee(),
                reportsByDay: this.getReportsByDay()
            }
        };
        
        const jsonData = JSON.stringify(statsData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Statistiques_NoteCam_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Statistiques exportées', 'success');
    }
    
    // المزامنة القسرية
    async forceSync() {
        const syncStatus = document.getElementById('adminSyncStatus');
        syncStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Synchronisation...';
        
        try {
            await this.syncWithSupabase();
            
            syncStatus.innerHTML = '<i class="fas fa-check-circle"></i> Synchronisé';
            showNotification('Synchronisation réussie', 'success');
            
            // تحديث آخر وقت مزامنة
            document.getElementById('lastSyncTimeAdmin').textContent = 
                this.formatTime(new Date());
                
        } catch (error) {
            syncStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Erreur';
            showNotification('Erreur de synchronisation', 'error');
        }
    }
    
    // تصدير البيانات
    exportData() {
        const exportData = {
            users: this.users,
            areas: this.assignedAreas,
            reports: this.reports,
            exportDate: new Date().toISOString(),
            version: Config.VERSION
        };
        
        const jsonData = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Backup_NoteCam_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Données exportées avec succès', 'success');
    }
    
    // استيراد البيانات
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (confirm(`Voulez-vous importer ${data.users ? Object.keys(data.users).length : 0} utilisateurs, 
                    ${data.areas?.length || 0} zones et ${data.reports?.length || 0} rapports ?`)) {
                    
                    // استيراد البيانات
                    if (data.users) this.users = data.users;
                    if (data.areas) this.assignedAreas = data.areas;
                    if (data.reports) this.reports = data.reports;
                    
                    // حفظ محلياً
                    this.saveToLocalStorage();
                    
                    // تحديث الواجهة
                    this.updateEmployeeList();
                    this.updateAreaList();
                    this.updateReportsList();
                    this.updateStatistics();
                    
                    showNotification('Données importées avec succès', 'success');
                }
            } catch (error) {
                alert('Erreur lors de l\'importation des données');
                console.error(error);
            }
        };
        
        input.click();
    }
    
    // ========== دوال مساعدة ==========
    
    // عدد تقارير الموظف
    getEmployeeReportCount(username) {
        return this.reports.filter(r => r.employee === username).length;
    }
    
    // عدد تقارير المنطقة
    getAreaReportCount(areaCode) {
        return this.reports.filter(r => r.areaCode === areaCode).length;
    }
    
    // الحصول على المناطق حسب الموظف
    getZonesByEmployee() {
        const result = {};
        Object.keys(this.users).forEach(username => {
            result[username] = this.assignedAreas
                .filter(area => area.employee === username)
                .length;
        });
        return result;
    }
    
    // الحصول على التقارير حسب اليوم
    getReportsByDay() {
        const result = {};
        this.reports.forEach(report => {
            const date = report.date.split('T')[0];
            result[date] = (result[date] || 0) + 1;
        });
        return result;
    }
    
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
    
    // تنسيق الوقت
    formatTime(date) {
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // عرض مودال
    showModal(title, content) {
        const modal = document.getElementById('statsModal');
        const modalContent = document.getElementById('statsModalContent');
        
        if (modal && modalContent) {
            modalContent.innerHTML = `
                <h2>${title}</h2>
                ${content}
            `;
            modal.style.display = 'block';
        }
    }
    
    // إغلاق المودال
    closeModal() {
        const modal = document.getElementById('statsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // إعداد المستمعين للأحداث
    setupEventListeners() {
        // إغلاق المودال عند النقر على X
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        
        // إغلاق المودال عند النقر خارج المحتوى
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('statsModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
}

// إنشاء وتصدير نسخة واحدة
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;

// إضافة أنماط إضافية للوحة المشرف
const style = document.createElement('style');
style.textContent = `
    .quick-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        padding: 20px;
        background: linear-gradient(90deg, #f8f9fa 0%, #e3f2fd 100%);
        border-bottom: 2px solid #e1e8ed;
    }
    
    .stat-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
        transition: all 0.3s ease;
    }
    
    .stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
    
    .stat-card i {
        font-size: 32px;
        color: #1a5fb4;
        margin-bottom: 10px;
    }
    
    .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: #1a5fb4;
        margin: 10px 0;
    }
    
    .stat-label {
        font-size: 14px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .empty-state i {
        font-size: 48px;
        margin-bottom: 15px;
        color: #e1e8ed;
    }
    
    .employee-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .employee-info {
        flex: 1;
    }
    
    .employee-name {
        font-weight: 700;
        color: #1a5fb4;
        font-size: 16px;
    }
    
    .employee-username {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
    }
    
    .employee-role {
        padding: 4px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
    }
    
    .employee-role.employee {
        background: #e3f2fd;
        color: #1a5fb4;
    }
    
    .employee-role.supervisor {
        background: #f0fff4;
        color: #2ea043;
    }
    
    .employee-details {
        display: flex;
        gap: 15px;
        margin-bottom: 15px;
    }
    
    .detail-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #666;
    }
    
    .employee-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    
    .btn-small {
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.3s ease;
    }
    
    .btn-small:hover {
        transform: translateY(-2px);
    }
    
    .btn-danger {
        background: #ff6b6b;
        color: white;
    }
    
    .btn-info {
        background: #17a2b8;
        color: white;
    }
    
    .employee-area-group {
        margin-bottom: 20px;
    }
    
    .group-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e1e8ed;
    }
    
    .group-title {
        font-weight: 700;
        color: #1a5fb4;
    }
    
    .group-count {
        margin-left: auto;
        background: #e3f2fd;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 12px;
        color: #1a5fb4;
    }
    
    .areas-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
    }
    
    .area-card {
        background: white;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #1a5fb4;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
    }
    
    .area-card.active {
        border-left-color: #2ea043;
    }
    
    .area-card.inactive {
        border-left-color: #ff6b6b;
    }
    
    .area-header {
        margin-bottom: 10px;
    }
    
    .area-name {
        font-weight: 700;
        color: #333;
    }
    
    .area-code {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
    }
    
    .area-actions {
        display: flex;
        gap: 5px;
        justify-content: flex-end;
        margin-top: 10px;
    }
    
    .btn-icon {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .btn-icon:hover {
        transform: scale(1.1);
    }
    
    .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .report-employee {
        font-weight: 700;
        color: #1a5fb4;
    }
    
    .report-date {
        font-size: 12px;
        color: #666;
    }
    
    .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
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
    
    .reports-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    }
    
    .modal-content {
        background-color: white;
        margin: 5% auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        max-width: 900px;
        border-radius: 10px;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e1e8ed;
    }
    
    .report-details-modal {
        max-width: 800px;
    }
    
    .detail-section {
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 10px;
        margin-top: 10px;
    }
    
    .photos-preview {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 10px;
    }
    
    .photo-thumbnail {
        width: 100px;
        height: 100px;
        border: 2px solid #e1e8ed;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
    }
    
    .photo-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .photo-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 10px;
        padding: 2px;
        text-align: center;
    }
    
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .btn-primary, .btn-secondary {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .btn-primary {
        background: #1a5fb4;
        color: white;
    }
    
    .btn-secondary {
        background: #6c757d;
        color: white;
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .stat-item {
        text-align: center;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 10px;
    }
`;
document.head.appendChild(style);
