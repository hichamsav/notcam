// Offline Database باستخدام IndexedDB
class OfflineDatabase {
    constructor() {
        this.db = null;
        this.dbName = 'NoteCamDB';
        this.dbVersion = 1;
        this.initialized = false;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            if (this.initialized) {
                resolve(true);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                console.log('IndexedDB initialized');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // إنشاء جداول
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('role', 'role', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('reports')) {
                    const reportStore = db.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
                    reportStore.createIndex('employee_id', 'employee_id', { unique: false });
                    reportStore.createIndex('zone_id', 'zone_id', { unique: false });
                    reportStore.createIndex('status', 'status', { unique: false });
                    reportStore.createIndex('synced', 'synced', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photoStore.createIndex('report_id', 'report_id', { unique: false });
                    photoStore.createIndex('photo_type', 'photo_type', { unique: false });
                    photoStore.createIndex('synced', 'synced', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('zones')) {
                    db.createObjectStore('zones', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // CRUD Operations للمستخدمين
    async saveUser(user) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUser(id) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserByEmail(email) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('email');
            const request = index.get(email);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // CRUD Operations للتقارير
    async saveReport(report) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports'], 'readwrite');
            const store = transaction.objectStore('reports');
            const request = store.put({
                ...report,
                created_at: new Date().toISOString(),
                synced: false
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getReport(id) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports'], 'readonly');
            const store = transaction.objectStore('reports');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingReports() {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports'], 'readonly');
            const store = transaction.objectStore('reports');
            const index = store.index('synced');
            const request = index.getAll(false);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async markReportAsSynced(id) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['reports'], 'readwrite');
            const store = transaction.objectStore('reports');
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const report = getRequest.result;
                if (report) {
                    report.synced = true;
                    report.synced_at = new Date().toISOString();
                    
                    const updateRequest = store.put(report);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // CRUD Operations للصور
    async savePhoto(photo) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.put({
                ...photo,
                created_at: new Date().toISOString(),
                synced: false
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPhotosByReport(reportId) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const index = store.index('report_id');
            const request = index.getAll(reportId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingPhotos() {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const index = store.index('synced');
            const request = index.getAll(false);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async markPhotoAsSynced(id) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const photo = getRequest.result;
                if (photo) {
                    photo.synced = true;
                    photo.synced_at = new Date().toISOString();
                    
                    const updateRequest = store.put(photo);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // إدارة صف المزامنة
    async addToSyncQueue(item) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.put({
                ...item,
                created_at: new Date().toISOString(),
                attempts: 0,
                status: 'pending'
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSyncQueue() {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromSyncQueue(id) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // أدوات مساعدة
    async getAllData() {
        await this.initialize();
        const reports = await this.getPendingReports();
        const photos = await this.getPendingPhotos();
        const queue = await this.getSyncQueue();
        
        return {
            reports,
            photos,
            queue,
            timestamp: new Date().toISOString()
        };
    }

    async clearAllData() {
        await this.initialize();
        const stores = ['users', 'reports', 'photos', 'zones', 'sync_queue'];
        
        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        console.log('All offline data cleared');
    }
}

// Export كـ Singleton
window.offlineDB = new OfflineDatabase();