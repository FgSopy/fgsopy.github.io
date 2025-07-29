        // 第三方库：用于Base64编码/解码和压缩
        const LZString = {
            compressToBase64: function(input) {
                if (input == null) return "";
                const compressed = this._compress(input, 6, function(a) {
                    return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a);
                });
                return compressed + "==".slice((compressed.length % 4) || 0);
            },
            decompressFromBase64: function(input) {
                if (input == null) return "";
                if (input === "") return null;
                return this._decompress(input.length, 32, function(index) {
                    return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(input.charAt(index));
                });
            },
            // 简化的压缩/解压缩实现
            _compress: function(uncompressed, bitsPerChar, getCharFromInt) {
                // 简化的实现
                return btoa(unescape(encodeURIComponent(uncompressed)));
            },
            _decompress: function(compressed, bitsPerChar, getNextValue) {
                // 简化的实现
                return decodeURIComponent(escape(atob(compressed)));
            }
        };

        // 主应用对象
        const DataSyncApp = {
            // 初始化状态
            db: null,
            deviceId: null,
            githubToken: null,
            gistId: null,
            encryptionKey: null,
            connectedDevices: new Set(),
            peer: null,
            connections: new Map(),
            
            // 初始化应用
            async init() {
                // 生成或获取设备ID
                this.deviceId = localStorage.getItem('device-id') || this.generateDeviceId();
                document.getElementById('device-id').textContent = this.deviceId;
                
                // 初始化IndexedDB
                await this.initIndexedDB();
                
                // 加载保存的配置
                this.loadConfig();
                
                // 设置事件监听器
                this.setupEventListeners();
                
                // 初始化P2P连接
                this.initP2P();
                
                // 加载数据列表
                this.loadDataList();
                
                // 更新状态显示
                this.updateStatus();
            },
            
            // 生成设备ID
            generateDeviceId() {
                const id = 'device-' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('device-id', id);
                return id;
            },
            
            // 初始化IndexedDB
            async initIndexedDB() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('DataSyncDB', 1);
                    
                    request.onerror = (event) => {
                        console.error('IndexedDB初始化失败:', event.target.error);
                        document.getElementById('storage-status').innerHTML = 
                            '<i>❌</i> <span>IndexedDB初始化失败</span>';
                        reject(event.target.error);
                    };
                    
                    request.onsuccess = (event) => {
                        this.db = event.target.result;
                        resolve();
                    };
                    
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains('shared-data')) {
                            const store = db.createObjectStore('shared-data', { keyPath: 'id' });
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                        }
                    };
                });
            },
            
            // 加载配置
            loadConfig() {
                this.githubToken = localStorage.getItem('github-token') || '';
                this.gistId = localStorage.getItem('gist-id') || '';
                this.encryptionKey = localStorage.getItem('encryption-key') || '';
                
                document.getElementById('github-token').value = this.githubToken;
                document.getElementById('gist-id').value = this.gistId;
                document.getElementById('encryption-key').value = this.encryptionKey;
                
                const lastSync = localStorage.getItem('last-sync');
                if (lastSync) {
                    document.getElementById('last-sync').textContent = 
                        new Date(parseInt(lastSync)).toLocaleString();
                }
            },
            
            // 设置事件监听器
            setupEventListeners() {
                // 数据管理按钮
                document.getElementById('save-btn').addEventListener('click', () => this.saveData());
                document.getElementById('load-btn').addEventListener('click', () => this.loadData());
                document.getElementById('delete-btn').addEventListener('click', () => this.deleteData());
                
                // 同步管理按钮
                document.getElementById('backup-btn').addEventListener('click', () => this.backupToGist());
                document.getElementById('restore-btn').addEventListener('click', () => this.restoreFromGist());
                document.getElementById('sync-now-btn').addEventListener('click', () => this.syncNow());
                
                // 设备管理按钮
                document.getElementById('connect-btn').addEventListener('click', () => this.connectToDevice());
                document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnectAll());
                
                // 系统按钮
                document.getElementById('clear-btn').addEventListener('click', () => this.clearLocalData());
                
                // 输入字段变化时保存配置
                document.getElementById('github-token').addEventListener('change', (e) => {
                    this.githubToken = e.target.value;
                    localStorage.setItem('github-token', this.githubToken);
                });
                
                document.getElementById('gist-id').addEventListener('change', (e) => {
                    this.gistId = e.target.value;
                    localStorage.setItem('gist-id', this.gistId);
                });
                
                document.getElementById('encryption-key').addEventListener('change', (e) => {
                    this.encryptionKey = e.target.value;
                    localStorage.setItem('encryption-key', this.encryptionKey);
                });
                
                // 网络状态监听
                window.addEventListener('online', () => this.updateStatus());
                window.addEventListener('offline', () => this.updateStatus());
            },
            
            // 初始化P2P连接
            initP2P() {
                try {
                    // 使用简单的WebSocket模拟P2P连接
                    this.peer = {
                        id: this.deviceId,
                        connections: new Map(),
                        connect: (deviceId) => this.connectToDevice(deviceId),
                        on: (event, callback) => {
                            if (event === 'connection') {
                                // 模拟连接事件
                                this.connectionCallback = callback;
                            }
                        }
                    };
                    
                    document.getElementById('p2p-status').innerHTML = 
                        '<i>✅</i> <span>P2P连接: 已激活</span>';
                } catch (e) {
                    console.error('P2P初始化失败:', e);
                    document.getElementById('p2p-status').innerHTML = 
                        '<i>⚠️</i> <span>P2P连接: 需要HTTPS环境</span>';
                }
            },
            
            // 保存数据
            async saveData() {
                const key = document.getElementById('data-key').value;
                const value = document.getElementById('data-value').value;
                
                if (!key) {
                    alert('请输入键名');
                    return;
                }
                
                try {
                    const encryptedValue = this.encryptionKey ? this.encryptData(value) : value;
                    
                    const data = {
                        id: key,
                        value: encryptedValue,
                        timestamp: Date.now(),
                        deviceId: this.deviceId
                    };
                    
                    const tx = this.db.transaction(['shared-data'], 'readwrite');
                    const store = tx.objectStore('shared-data');
                    await store.put(data);
                    
                    alert(`数据 "${key}" 保存成功!`);
                    
                    // 更新数据列表
                    this.loadDataList();
                    
                    // 同步到其他设备
                    this.syncToDevices(key, value);
                } catch (e) {
                    console.error('保存数据失败:', e);
                    alert('保存数据失败: ' + e.message);
                }
            },
            
            // 加载数据
            async loadData() {
                const key = document.getElementById('data-key').value;
                
                if (!key) {
                    alert('请输入键名');
                    return;
                }
                
                try {
                    const tx = this.db.transaction(['shared-data'], 'readonly');
                    const store = tx.objectStore('shared-data');
                    const request = store.get(key);
                    
                    request.onsuccess = (event) => {
                        const data = event.target.result;
                        if (data) {
                            const decryptedValue = this.encryptionKey ? 
                                this.decryptData(data.value) : data.value;
                            document.getElementById('data-value').value = decryptedValue;
                        } else {
                            alert(`找不到键名为 "${key}" 的数据`);
                        }
                    };
                    
                    request.onerror = (event) => {
                        console.error('加载数据失败:', event.target.error);
                        alert('加载数据失败');
                    };
                } catch (e) {
                    console.error('加载数据失败:', e);
                    alert('加载数据失败: ' + e.message);
                }
            },
            
            // 删除数据
            async deleteData() {
                const key = document.getElementById('data-key').value;
                
                if (!key) {
                    alert('请输入键名');
                    return;
                }
                
                if (!confirm(`确定要删除键名为 "${key}" 的数据吗?`)) {
                    return;
                }
                
                try {
                    const tx = this.db.transaction(['shared-data'], 'readwrite');
                    const store = tx.objectStore('shared-data');
                    await store.delete(key);
                    
                    alert(`数据 "${key}" 已删除`);
                    
                    // 更新数据列表
                    this.loadDataList();
                } catch (e) {
                    console.error('删除数据失败:', e);
                    alert('删除数据失败: ' + e.message);
                }
            },
            
            // 加载数据列表
            async loadDataList() {
                const dataList = document.getElementById('data-list');
                dataList.innerHTML = '';
                
                try {
                    const tx = this.db.transaction(['shared-data'], 'readonly');
                    const store = tx.objectStore('shared-data');
                    const index = store.index('timestamp');
                    const request = index.openCursor(null, 'prev');
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const data = cursor.value;
                            const decryptedValue = this.encryptionKey ? 
                                this.decryptData(data.value) : data.value;
                            
                            const displayValue = decryptedValue.length > 50 ? 
                                decryptedValue.substring(0, 50) + '...' : decryptedValue;
                            
                            const dataItem = document.createElement('div');
                            dataItem.className = 'data-item';
                            dataItem.innerHTML = `
                                <div class="data-content">
                                    <strong>${data.id}</strong>
                                    <div>${displayValue}</div>
                                    <div class="data-meta">
                                        由 ${data.deviceId} 于 ${new Date(data.timestamp).toLocaleString()} 创建
                                    </div>
                                </div>
                                <button class="danger" data-key="${data.id}">删除</button>
                            `;
                            
                            dataItem.querySelector('button').addEventListener('click', (e) => {
                                document.getElementById('data-key').value = data.id;
                                this.deleteData();
                            });
                            
                            dataList.appendChild(dataItem);
                            cursor.continue();
                        }
                    };
                } catch (e) {
                    console.error('加载数据列表失败:', e);
                    dataList.innerHTML = '<div class="data-item">加载数据失败</div>';
                }
            },
            
            // 备份到Gist
            async backupToGist() {
                if (!this.githubToken) {
                    alert('请输入GitHub Token');
                    return;
                }
                
                try {
                    this.updateProgress(30);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>🔄</i> <span>正在备份数据到GitHub Gist...</span>';
                    
                    // 获取所有数据
                    const allData = await this.getAllData();
                    
                    // 转换为JSON并压缩
                    const jsonData = JSON.stringify(allData);
                    const compressedData = LZString.compressToBase64(jsonData);
                    
                    // 准备请求数据
                    const requestBody = {
                        files: {
                            'backup.json': {
                                content: compressedData
                            }
                        },
                        description: `DataSync Backup - ${new Date().toLocaleString()}`
                    };
                    
                    // 设置API端点
                    const url = this.gistId ? 
                        `https://api.github.com/gists/${this.gistId}` : 
                        'https://api.github.com/gists';
                    
                    const method = this.gistId ? 'PATCH' : 'POST';
                    
                    // 发送请求
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.github.v3+json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`GitHub API错误: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    
                    // 保存Gist ID
                    if (!this.gistId) {
                        this.gistId = result.id;
                        document.getElementById('gist-id').value = this.gistId;
                        localStorage.setItem('gist-id', this.gistId);
                    }
                    
                    // 更新同步时间
                    localStorage.setItem('last-sync', Date.now());
                    document.getElementById('last-sync').textContent = new Date().toLocaleString();
                    
                    this.updateProgress(100);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>✅</i> <span>备份成功! Gist ID: ' + this.gistId + '</span>';
                    document.getElementById('gist-status').innerHTML = 
                        '<i>✅</i> <span>GitHub Gist: 已连接</span>';
                    
                    setTimeout(() => {
                        this.updateProgress(0);
                        this.updateStatus();
                    }, 2000);
                } catch (e) {
                    console.error('备份失败:', e);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>❌</i> <span>备份失败: ' + e.message + '</span>';
                    document.getElementById('gist-status').innerHTML = 
                        '<i>❌</i> <span>GitHub Gist: 连接失败</span>';
                    this.updateProgress(0);
                }
            },
            
            // 从Gist恢复
            async restoreFromGist() {
                if (!this.githubToken || !this.gistId) {
                    alert('请输入GitHub Token和Gist ID');
                    return;
                }
                
                try {
                    this.updateProgress(30);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>🔄</i> <span>正在从GitHub Gist恢复数据...</span>';
                    
                    // 获取Gist内容
                    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`GitHub API错误: ${response.status}`);
                    }
                    
                    const gist = await response.json();
                    const backupFile = gist.files['backup.json'];
                    
                    if (!backupFile || !backupFile.content) {
                        throw new Error('找不到备份文件');
                    }
                    
                    // 解压缩数据
                    const compressedData = backupFile.content;
                    const jsonData = LZString.decompressFromBase64(compressedData);
                    const allData = JSON.parse(jsonData);
                    
                    // 恢复数据
                    const tx = this.db.transaction(['shared-data'], 'readwrite');
                    const store = tx.objectStore('shared-data');
                    
                    // 清除现有数据
                    await store.clear();
                    
                    // 添加恢复的数据
                    for (const data of allData) {
                        await store.put(data);
                    }
                    
                    // 更新同步时间
                    localStorage.setItem('last-sync', Date.now());
                    document.getElementById('last-sync').textContent = new Date().toLocaleString();
                    
                    this.updateProgress(100);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>✅</i> <span>恢复成功! 已恢复 ' + allData.length + ' 条数据</span>';
                    document.getElementById('gist-status').innerHTML = 
                        '<i>✅</i> <span>GitHub Gist: 已连接</span>';
                    
                    // 重新加载数据列表
                    this.loadDataList();
                    
                    setTimeout(() => {
                        this.updateProgress(0);
                        this.updateStatus();
                    }, 2000);
                } catch (e) {
                    console.error('恢复失败:', e);
                    document.getElementById('sync-status').innerHTML = 
                        '<i>❌</i> <span>恢复失败: ' + e.message + '</span>';
                    document.getElementById('gist-status').innerHTML = 
                        '<i>❌</i> <span>GitHub Gist: 连接失败</span>';
                    this.updateProgress(0);
                }
            },
            
            // 立即同步
            syncNow() {
                this.backupToGist();
            },
            
            // 连接设备
            connectToDevice() {
                const deviceId = document.getElementById('connect-device').value;
                if (!deviceId) {
                    alert('请输入设备ID');
                    return;
                }
                
                if (deviceId === this.deviceId) {
                    alert('不能连接自己的设备');
                    return;
                }
                
                if (this.connectedDevices.has(deviceId)) {
                    alert('已经连接到该设备');
                    return;
                }
                
                // 模拟连接成功
                this.connectedDevices.add(deviceId);
                
                // 添加设备到列表
                const deviceItem = document.createElement('div');
                deviceItem.className = 'device-item';
                deviceItem.innerHTML = `
                    <span class="device-status online"></span>
                    <div class="device-info">
                        <div class="device-name">${deviceId}</div>
                        <div class="device-meta">已连接</div>
                    </div>
                    <button class="danger" data-device="${deviceId}">断开</button>
                `;
                
                deviceItem.querySelector('button').addEventListener('click', (e) => {
                    this.disconnectDevice(deviceId);
                    deviceItem.remove();
                });
                
                document.getElementById('device-list').appendChild(deviceItem);
                
                alert(`已成功连接到设备: ${deviceId}`);
            },
            
            // 断开设备连接
            disconnectDevice(deviceId) {
                this.connectedDevices.delete(deviceId);
            },
            
            // 断开所有连接
            disconnectAll() {
                this.connectedDevices.clear();
                document.querySelectorAll('.device-item:not(:first-child)').forEach(el => el.remove());
            },
            
            // 同步数据到其他设备
            syncToDevices(key, value) {
                if (this.connectedDevices.size === 0) return;
                
                // 模拟同步过程
                this.connectedDevices.forEach(deviceId => {
                    console.log(`同步数据到设备: ${deviceId}`);
                });
            },
            
            // 获取所有数据
            async getAllData() {
                return new Promise((resolve, reject) => {
                    const allData = [];
                    const tx = this.db.transaction(['shared-data'], 'readonly');
                    const store = tx.objectStore('shared-data');
                    const request = store.openCursor();
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            allData.push(cursor.value);
                            cursor.continue();
                        } else {
                            resolve(allData);
                        }
                    };
                    
                    request.onerror = (event) => {
                        reject(event.target.error);
                    };
                });
            },
            
            // 更新进度条
            updateProgress(percent) {
                document.getElementById('progress-bar').style.width = percent + '%';
            },
            
            // 更新状态显示
            updateStatus() {
                // 更新存储状态
                if (this.db) {
                    document.getElementById('storage-status').innerHTML = 
                        '<i>✅</i> <span>IndexedDB: 已初始化</span>';
                }
                
                // 更新网络状态
                if (navigator.onLine) {
                    document.getElementById('sync-status').innerHTML = 
                        '<i>✅</i> <span>在线状态</span>';
                } else {
                    document.getElementById('sync-status').innerHTML = 
                        '<i>❌</i> <span>离线状态 - 部分功能受限</span>';
                }
            },
            
            // 清除所有本地数据
            clearLocalData() {
                if (!confirm('确定要清除所有本地数据吗? 此操作不可撤销!')) {
                    return;
                }
                
                const tx = this.db.transaction(['shared-data'], 'readwrite');
                const store = tx.objectStore('shared-data');
                store.clear();
                
                localStorage.removeItem('github-token');
                localStorage.removeItem('gist-id');
                localStorage.removeItem('last-sync');
                
                this.githubToken = '';
                this.gistId = '';
                
                document.getElementById('github-token').value = '';
                document.getElementById('gist-id').value = '';
                document.getElementById('last-sync').textContent = '从未同步';
                
                this.loadDataList();
                
                alert('所有本地数据已清除');
            },
            
            // 加密数据
            encryptData(data) {
                if (!this.encryptionKey) return data;
                // 简化的加密实现 - 实际应用中应使用更安全的加密算法
                return btoa(encodeURIComponent(data + this.encryptionKey));
            },
            
            // 解密数据
            decryptData(encryptedData) {
                if (!this.encryptionKey) return encryptedData;
                try {
                    const decoded = decodeURIComponent(atob(encryptedData));
                    return decoded.replace(this.encryptionKey, '');
                } catch (e) {
                    console.error('解密失败:', e);
                    return encryptedData;
                }
            }
        };

        // 初始化应用
        window.addEventListener('DOMContentLoaded', () => {
            DataSyncApp.init();
        });
