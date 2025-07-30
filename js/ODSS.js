        const DataSyncApp = {
            // 新增共享状态对象 (解决刷新丢失问题)
            sharedState: {
                connections: {},
                connectedDevices: new Set(),
                pendingMessages: {}
            },
            
            // 初始化 - 添加状态恢复
            async init() {
                // 恢复共享状态
                const savedState = localStorage.getItem('shared-state');
                if (savedState) {
                    this.sharedState = JSON.parse(savedState);
                    this.sharedState.connectedDevices = new Set(this.sharedState.connectedDevices);
                }
                
                // 原有初始化代码...
                
                // 启动状态自动保存
                setInterval(() => this.saveSharedState(), 5000);
            },
            
            // 保存共享状态 (新增方法)
            saveSharedState() {
                // 转换为可序列化格式
                const stateToSave = {
                    ...this.sharedState,
                    connectedDevices: [...this.sharedState.connectedDevices]
                };
                localStorage.setItem('shared-state', JSON.stringify(stateToSave));
            },
            
            // 完全重写设备连接系统
            async connectToDevice() {
                const deviceId = document.getElementById('connect-device').value;
                if (!deviceId) return alert('请输入设备ID');
                
                // 添加到连接设备集
                this.sharedState.connectedDevices.add(deviceId);
                this.updateDeviceList();
                
                // 创建通信通道
                const channel = new BroadcastChannel(`device_${deviceId}`);
                this.sharedState.connections[deviceId] = channel;
                
                // 消息处理
                channel.onmessage = (event) => {
                    this.handleDeviceMessage(deviceId, event.data);
                };
                
                // 发送握手信号
                channel.postMessage({
                    type: 'handshake',
                    from: this.deviceId,
                    timestamp: Date.now()
                });
                
                alert(`已连接到设备: ${deviceId}`);
                this.saveSharedState();
            },
            
            // 处理设备消息 (新增)
            handleDeviceMessage(deviceId, message) {
                console.log(`收到来自 ${deviceId} 的消息:`, message);
                
                switch (message.type) {
                    case 'handshake':
                        // 确认连接
                        this.sharedState.connections[deviceId].postMessage({
                            type: 'handshake-ack',
                            from: this.deviceId
                        });
                        break;
                        
                    case 'data-update':
                        // 处理数据更新
                        this.saveRemoteData(message.key, message.value);
                        break;
                        
                    case 'sync-request':
                        // 响应同步请求
                        this.sendFullSync(deviceId);
                        break;
                }
            },
            
            // 保存远程数据 (新增)
            async saveRemoteData(key, value) {
                const data = {
                    id: key,
                    value: this.encryptionKey ? this.encryptData(value) : value,
                    timestamp: Date.now(),
                    deviceId: 'remote:' + this.getSendingDeviceId()
                };
                
                const tx = this.db.transaction(['shared-data'], 'readwrite');
                const store = tx.objectStore('shared-data');
                await store.put(data);
                
                this.loadDataList();
                alert(`已接收远程更新: ${key}`);
            },
            
            // 获取发送设备ID (新增)
            getSendingDeviceId() {
                // 在实际应用中从消息中解析
                return 'remote-device';
            },
            
            // 发送完整同步 (新增)
            async sendFullSync(targetDeviceId) {
                const allData = await this.getAllData();
                this.sharedState.connections[targetDeviceId].postMessage({
                    type: 'full-sync',
                    data: allData
                });
            },
            
            // 同步数据到所有设备 (重写)
            async syncToDevices(key, value) {
                for (const deviceId of this.sharedState.connectedDevices) {
                    if (deviceId !== this.deviceId && this.sharedState.connections[deviceId]) {
                        this.sharedState.connections[deviceId].postMessage({
                            type: 'data-update',
                            key,
                            value: this.encryptionKey ? this.encryptData(value) : value
                        });
                    }
                }
            },
            
            // 更新设备列表显示 (新增)
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
                this.sharedState.connectedDevices.forEach(deviceId => {
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
                        
                        deviceItem.querySelector('button').addEventListener('click', () => {
                            this.disconnectDevice(deviceId);
                            deviceItem.remove();
                        });
                        
                        deviceList.appendChild(deviceItem);
                    }
                });
            },
            
            // 断开设备连接 (新增)
            disconnectDevice(deviceId) {
                this.sharedState.connectedDevices.delete(deviceId);
                if (this.sharedState.connections[deviceId]) {
                    this.sharedState.connections[deviceId].close();
                    delete this.sharedState.connections[deviceId];
                }
                this.saveSharedState();
            },
            
            // 初始化时恢复设备列表
            restoreConnections() {
                this.sharedState.connectedDevices.forEach(deviceId => {
                    if (deviceId !== this.deviceId) {
                        try {
                            const channel = new BroadcastChannel(`device_${deviceId}`);
                            this.sharedState.connections[deviceId] = channel;
                            
                            channel.onmessage = (event) => {
                                this.handleDeviceMessage(deviceId, event.data);
                            };
                            
                            // 重新握手
                            channel.postMessage({
                                type: 'reconnect',
                                from: this.deviceId
                            });
                        } catch (e) {
                            console.error(`恢复连接 ${deviceId} 失败:`, e);
                        }
                    }
                });
            }
        };

        // 初始化时恢复连接
        window.addEventListener('DOMContentLoaded', () => {
            DataSyncApp.init();
            setTimeout(() => {
                DataSyncApp.restoreConnections();
                DataSyncApp.updateDeviceList();
            }, 1000);
        });
