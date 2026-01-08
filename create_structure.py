import os

# هيكل النظام
structure = {
    'css': ['style.css', 'admin.css', 'employee.css', 'login.css'],
    'js': ['config.js', 'auth.js', 'sync.js', 'admin.js', 'employee.js', 'camera.js', 'reports.js', 'storage.js'],
    'utils': ['helpers.js', 'notifications.js'],
    '': ['index.html', 'login.html', 'admin.html', 'employee.html', 'reports.html', 'sync.html',
         'package.json', 'README.md', '.gitignore']
}

def create_structure():
    print("🚀 إنشاء هيكل نظام NoteCam...")
    
    for folder, files in structure.items():
        if folder:
            os.makedirs(folder, exist_ok=True)
            print(f"📁 تم إنشاء مجلد: {folder}")
        
        for file in files:
            filepath = os.path.join(folder, file) if folder else file
            with open(filepath, 'w', encoding='utf-8') as f:
                # إضافة محتوى أساسي للملفات المهمة
                if file == 'package.json':
                    f.write('''{
  "name": "notecam-system",
  "version": "1.0.0",
  "description": "نظام NoteCam متعدد المستخدمين",
  "main": "index.html",
  "scripts": {
    "start": "live-server"
  }
}''')
                elif file == 'README.md':
                    f.write('# نظام NoteCam\n\nنظام متكامل لإدارة التقارير والصور.\n')
                elif file == '.gitignore':
                    f.write('node_modules/\n.DS_Store\n*.log\n')
                else:
                    f.write(f'// ملف {file}\n')
            print(f"📄 تم إنشاء ملف: {filepath}")
    
    print("✅ تم إنشاء الهيكل بنجاح!")

if __name__ == "__main__":
    create_structure()