        // 修复后的主应用对象
        const DataSyncApp = {
            // 初始化状态
            db: null,
            deviceId: null,
            githubToken: null,
            gistId: null,
            encryptionKey: null,
            connectedDevices: new Set(),
            channels: new Map(),
            
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
                
                // 恢复连接状态
                this.restoreConnections();
                
                // 加载数据列表
                this.loadDataList();
                
                // 更新状态显示
                this.updateStatus();
                
                // 设置存储事件监听器
                window.addEventListener('storage', this.handleStorageEvent.bind(this));
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
                
                // 恢复连接设备列表
                const savedDevices = localStorage.getItem('connected-devices');
                if (savedDevices) {
                    this.connectedDevices = new Set(JSON.parse(savedDevices));
                }
                
                document.getElementById('github-token').value = this.githubToken;
                document.getElementById('gist-id').value = this.gistId;
                document.getElementById('encryption-key').value = this.encryptionKey;
                
                const lastSync = localStorage.getItem('last-sync');
                if (lastSync) {
                    document.getElementById('last-sync').textContent = 
                        new Date(parseInt(lastSync)).toLocaleString();
                }
            },
            
            // 保存配置
            saveConfig() {
                localStorage.setItem('github-token', this.githubToken);
                localStorage.setItem('gist-id', this.gistId);
                localStorage.setItem('encryption-key', this.encryptionKey);
                localStorage.setItem('connected-devices', JSON.stringify([...this.connectedDevices]));
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
                document.getElementById('refresh-btn').addEventListener('click', () => this.updateDeviceList());
                
                // 系统按钮
                document.getElementById('clear-btn').addEventListener('click', () => this.clearLocalData());
                document.getElementById('reset-btn').addEventListener('click', () => this.resetConnections());
                
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
            
            // 恢复连接
            restoreConnections() {
                this.connectedDevices.forEach(deviceId => {
                    if (deviceId !== this.deviceId) {
                        this.setupChannel(deviceId);
                    }
                });
                this.updateDeviceList();
            },
            
            // 设置通信通道
            setupChannel(deviceId) {
                // 使用storage事件模拟通信
                console.log(`设置与设备 ${deviceId} 的通信通道`);
            },
            
            // 连接设备
            connectToDevice() {
                const deviceId = document.getElementById('connect-device').value;
                if (!deviceId) {
                    this.showNotification('请输入设备ID', 'error');
                    return;
                }
                
                if (deviceId === this.deviceId) {
                    this.showNotification('不能连接自己的设备', 'error');
                    return;
                }
                
                if (this.connectedDevices.has(deviceId)) {
                    this.showNotification('已经连接到该设备', 'error');
                    return;
                }
                
                // 添加到连接设备集
                this.connectedDevices.add(deviceId);
                this.saveConfig();
                
                // 设置通信通道
                this.setupChannel(deviceId);
                
                // 发送握手信号
                this.sendMessage(deviceId, {
                    type: 'handshake',
                    from: this.deviceId,
                    timestamp: Date.now()
                });
                
                this.showNotification(`已连接到设备: ${deviceId}`);
                this.updateDeviceList();
            },
            
            // 发送消息
            sendMessage(deviceId, message) {
                // 使用localStorage模拟消息传递
                const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                const messageData = {
                    to: deviceId,
                    from: this.deviceId,
                    message: message
                };
                
                localStorage.setItem(messageId, JSON.stringify(messageData));
                setTimeout(() => localStorage.removeItem(messageId), 1000);
            },
            
            // 处理存储事件
            handleStorageEvent(event) {
                if (!event.key || !event.key.startsWith('msg-')) return;
                
                try {
                    const messageData = JSON.parse(event.newValue);
                    if (messageData.to === this.deviceId) {
                        this.handleDeviceMessage(messageData.from, messageData.message);
                    }
                } catch (e) {
                    console.error('处理消息失败:', e);
                }
            },
            
            // 处理设备消息
            handleDeviceMessage(fromDeviceId, message) {
                console.log(`收到来自 ${fromDeviceId} 的消息:`, message);
                
                switch (message.type) {
                    case 'handshake':
                        // 确认连接
                        this.sendMessage(fromDeviceId, {
                            type: 'handshake-ack',
                            from: this.deviceId
                        });
                        break;
                        
                    case 'handshake-ack':
                        this.showNotification(`与设备 ${fromDeviceId} 的握手成功`);
                        break;
                        
                    case 'data-update':
                        // 处理数据更新
                        this.saveRemoteData(message.key, message.value, fromDeviceId);
                        break;
                        
                    case 'sync-request':
                        // 响应同步请求
                        this.sendFullSync(fromDeviceId);
                        break;
                }
            },
            
            // 保存数据
            async saveData() {
                const key = document.getElementById('data-key').value;
                const value = document.getElementById('data-value').value;
                
                if (!key) {
                    this.showNotification('请输入键名', 'error');
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
                    
                    this.showNotification(`数据 "${key}" 保存成功!`);
                    
                    // 更新数据列表
                    this.loadDataList();
                    
                    // 同步到其他设备
                    this.syncToDevices(key, value);
                } catch (e) {
                    console.error('保存数据失败:', e);
                    this.showNotification('保存数据失败: ' + e.message, 'error');
                }
            },
            
            // 同步数据到其他设备
            syncToDevices(key, value) {
                if (this.connectedDevices.size === 0) return;
                
                this.connectedDevices.forEach(deviceId => {
                    if (deviceId !== this.deviceId) {
                        this.sendMessage(deviceId, {
                            type: 'data-update',
                            key: key,
                            value: value
                        });
                    }
                });
            },
            
            // 保存远程数据
            async saveRemoteData(key, value, fromDeviceId) {
                const encryptedValue = this.encryptionKey ? this.encryptData(value) : value;
                
                const data = {
                    id: key,
                    value: encryptedValue,
                    timestamp: Date.now(),
                    deviceId: fromDeviceId
                };
                
                const tx = this.db.transaction(['shared-data'], 'readwrite');
                const store = tx.objectStore('shared-data');
                await store.put(data);
                
                this.showNotification(`已接收来自 ${fromDeviceId} 的数据: ${key}`);
                this.loadDataList();
            },
            
            // 加载数据
            async loadData() {
                const key = document.getElementById('data-key').value;
                
                if (!key) {
                    this.showNotification('请输入键名', 'error');
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
                            this.showNotification(`数据 "${key}" 加载成功`);
                        } else {
                            this.showNotification(`找不到键名为 "${key}" 的数据`, 'error');
                        }
                    };
                    
                    request.onerror = (event) => {
                        console.error('加载数据失败:', event.target.error);
                        this.showNotification('加载数据失败', 'error');
                    };
                } catch (e) {
                    console.error('加载数据失败:', e);
                    this.showNotification('加载数据失败: ' + e.message, 'error');
                }
            },
            
            // 删除数据
            async deleteData() {
                const key = document.getElementById('data-key').value;
                
                if (!key) {
                    this.showNotification('请输入键名', 'error');
                    return;
                }
                
                if (!confirm(`确定要删除键名为 "${key}" 的数据吗?`)) {
                    return;
                }
                
                try {
                    const tx = this.db.transaction(['shared-data'], 'readwrite');
                    const store = tx.objectStore('shared-data');
                    await store.delete(key);
                    
                    this.showNotification(`数据 "${key}" 已删除`);
                    
                    // 更新数据列表
                    this.loadDataList();
                    
                    // 同步到其他设备
                    this.syncDeleteToDevices(key);
                } catch (e) {
                    console.error('删除数据失败:', e);
                    this.showNotification('删除数据失败: ' + e.message, 'error');
                }
            },
            
            // 同步删除操作到其他设备
            syncDeleteToDevices(key) {
                if (this.connectedDevices.size === 0) return;
                
                this.connectedDevices.forEach(deviceId => {
                    if (deviceId !== this.deviceId) {
                        this.sendMessage(deviceId, {
                            type: 'data-delete',
                            key: key
                        });
                    }
                });
            },
            
            // 加载数据列表
            async loadDataList() {
                const dataList = document.getElementById('data-list');
                dataList.innerHTML = '';
                
                try {
                    const allData = await this.getAllData();
                    
                    if (allData.length === 0) {
                        dataList.innerHTML = '<div class="data-item">暂无数据</div>';
                        return;
                    }
                    
                    allData.forEach(data => {
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
                    });
                } catch (e) {
                    console.error('加载数据列表失败:', e);
                    dataList.innerHTML = '<div class="data-item">加载数据失败</div>';
                }
            },
            
            // 更新设备列表
            updateDeviceList() {
                const deviceList = document.getElementById('device-list');
                deviceList.innerHTML = '';
                
                // 添加当前设备
                const currentDevice = document.createElement('div');
                currentDevice.className = 'device-item';
                currentDevice.innerHTML = `
                    <span class="device-status online"></span>
                    <div class="device-info">
                        <div class="device-name">当前设备</div>
                        <div class="device-meta">${this.deviceId}</div>
                    </div>
                `;
                deviceList.appendChild(currentDevice);
                
                // 添加已连接设备
                this.connectedDevices.forEach(deviceId => {
                    if (deviceId !== this.deviceId) {
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
                        
                        deviceList.appendChild(deviceItem);
                    }
                });
                
                // 更新状态点
                document.getElementById('local-status-dot').className = 'status-dot online';
                document.getElementById('sync-status-dot').className = 
                    this.connectedDevices.size > 1 ? 'status-dot online' : 'status-dot';
            },
            
            // 断开设备连接
            disconnectDevice(deviceId) {
                this.connectedDevices.delete(deviceId);
                this.saveConfig();
                this.showNotification(`已断开与设备 ${deviceId} 的连接`);
                this.updateDeviceList();
            },
            
            // 断开所有连接
            disconnectAll() {
                if (this.connectedDevices.size === 0) {
                    this.showNotification('没有已连接的设备', 'error');
                    return;
                }
                
                if (confirm('确定要断开所有设备连接吗?')) {
                    this.connectedDevices.clear();
                    this.saveConfig();
                    this.showNotification('已断开所有设备连接');
                    this.updateDeviceList();
                }
            },
            
            // 重置连接
            resetConnections() {
                localStorage.removeItem('connected-devices');
                this.connectedDevices.clear();
                this.saveConfig();
                this.showNotification('连接状态已重置');
                this.updateDeviceList();
            },
            
            // 备份到Gist
            async backupToGist() {
                // 实现保持不变
            },
            
            // 从Gist恢复
            async restoreFromGist() {
                // 实现保持不变
            },
            
            // 立即同步
            syncNow() {
                this.backupToGist();
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
            
            // 更新状态显示
            updateStatus() {
                // 更新存储状态
                if (this.db) {
                    document.getElementById('storage-status').innerHTML = 
                        '<i>✅</i> <span>IndexedDB: 已初始化</span>';
                }
                
                // 更新设备连接状态
                document.getElementById('p2p-status').innerHTML = 
                    this.connectedDevices.size > 1 ? 
                    '<i>✅</i> <span>设备连接: 已激活 (' + (this.connectedDevices.size - 1) + '个设备)</span>' :
                    '<i>❌</i> <span>设备连接: 未激活</span>';
                
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
                localStorage.removeItem('connected-devices');
                
                this.githubToken = '';
                this.gistId = '';
                this.connectedDevices.clear();
                
                document.getElementById('github-token').value = '';
                document.getElementById('gist-id').value = '';
                document.getElementById('last-sync').textContent = '从未同步';
                
                this.loadDataList();
                this.updateDeviceList();
                
                this.showNotification('所有本地数据已清除');
            },
            
            // 加密数据
            encryptData(data) {
                if (!this.encryptionKey) return data;
                // 简化的加密实现
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
            },
            
            // 显示通知
            showNotification(message, type = 'success') {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.className = 'notification';
                
                if (type === 'error') {
                    notification.classList.add('error');
                }
                
                notification.classList.add('show');
                
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
        };

        // 初始化应用
        window.addEventListener('DOMContentLoaded', () => {
            DataSyncApp.init();
        });
