// データ管理
class InventoryManager {
    constructor() {
        this.locations = this.loadLocations();
        this.items = this.loadItems();
        this.currentLocation = null;
        this.html5QrCode = null;
        this.isScanning = false;
    }
    
    // ロケーション管理
    loadLocations() {
        const data = localStorage.getItem('inventory_locations');
        return data ? JSON.parse(data) : [];
    }
    
    saveLocations() {
        localStorage.setItem('inventory_locations', JSON.stringify(this.locations));
    }
    
    addLocation(name) {
        if (!name || name.trim() === '') {
            alert('ロケーション名を入力してください');
            return false;
        }
        
        if (this.locations.includes(name)) {
            alert('このロケーションは既に登録されています');
            return false;
        }
        
        this.locations.push(name);
        this.saveLocations();
        return true;
    }
    
    deleteLocation(name) {
        this.locations = this.locations.filter(loc => loc !== name);
        this.saveLocations();
    }
    
    // 在庫アイテム管理
    loadItems() {
        const data = localStorage.getItem('inventory_items');
        return data ? JSON.parse(data) : [];
    }
    
    saveItems() {
        localStorage.setItem('inventory_items', JSON.stringify(this.items));
    }
    
    addItem(code, location, quantity) {
        const item = {
            id: Date.now(),
            code: code,
            location: location,
            quantity: parseInt(quantity),
            date: new Date().toISOString()
        };
        
        this.items.unshift(item);
        this.saveItems();
    }
    
    deleteItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveItems();
    }
    
    // CSV出力
    exportCSV(location = null) {
        let items = this.items;
        
        if (location) {
            items = items.filter(item => item.location === location);
        }
        
        if (items.length === 0) {
            alert('データがありません');
            return;
        }
        
        let csv = '品番,ロケーション,数量,日時\n';
        
        items.forEach(item => {
            const date = new Date(item.date);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            csv += `${item.code},${item.location},${item.quantity},${dateStr}\n`;
        });
        
        const now = new Date();
        const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const filename = location ? `棚卸_${yymm}_${location}.csv` : `棚卸_全データ.csv`;
        
        this.downloadCSV(csv, filename);
    }
    
    downloadCSV(content, filename) {
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// グローバルインスタンス
const manager = new InventoryManager();

// UI更新
function updateUI() {
    const locationList = document.getElementById('location-list');
    const emptyState = document.getElementById('empty-state');
    
    if (manager.locations.length === 0) {
        emptyState.style.display = 'block';
        locationList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        locationList.style.display = 'flex';
        
        locationList.innerHTML = manager.locations.map(location => `
            <div class="location-item">
                <div class="location-item-left" onclick="openScanScreen('${location}')">
                    <div class="location-icon">📍</div>
                    <div class="location-name">${location}</div>
                </div>
                <button class="location-delete" onclick="event.stopPropagation(); deleteLocation('${location}')">削除</button>
            </div>
        `).join('');
    }
}

// ロケーション追加モーダル
function showAddLocationModal() {
    document.getElementById('add-location-modal').classList.add('active');
    document.getElementById('new-location-input').value = '';
    setTimeout(() => {
        document.getElementById('new-location-input').focus();
    }, 100);
}

function closeAddLocationModal() {
    document.getElementById('add-location-modal').classList.remove('active');
}

function addLocation() {
    const input = document.getElementById('new-location-input');
    const name = input.value.trim();
    
    if (manager.addLocation(name)) {
        closeAddLocationModal();
        updateUI();
    }
}

function deleteLocation(name) {
    if (confirm(`「${name}」を削除しますか？`)) {
        manager.deleteLocation(name);
        updateUI();
    }
}

// スキャン画面
function openScanScreen(location) {
    manager.currentLocation = location;
    document.getElementById('current-location').textContent = location;
    document.getElementById('scan-screen').classList.add('active');
    document.getElementById('home-screen').style.display = 'none';
    
    // QRスキャナー開始
    startQRScanner();
}

function closeScanScreen() {
    stopQRScanner();
    document.getElementById('scan-screen').classList.remove('active');
    document.getElementById('home-screen').style.display = 'block';
    manager.currentLocation = null;
}

function startQRScanner() {
    if (manager.isScanning) return;
    
    const qrReader = document.getElementById('qr-reader');
    qrReader.style.display = 'block';
    document.getElementById('manual-input-screen').classList.remove('active');
    
    manager.html5QrCode = new Html5Qrcode("qr-reader");
    
    manager.html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
            // QRコード読み取り成功
            manager.html5QrCode.stop();
            manager.isScanning = false;
            showQuantityModal(decodedText);
        },
        (errorMessage) => {
            // エラーは無視（スキャン中は常にエラーが出る）
        }
    ).then(() => {
        manager.isScanning = true;
    }).catch((err) => {
        console.error('QRスキャナー起動エラー:', err);
        alert('カメラの起動に失敗しました。ブラウザの設定でカメラの権限を許可してください。');
    });
}

function stopQRScanner() {
    if (manager.html5QrCode && manager.isScanning) {
        manager.html5QrCode.stop().then(() => {
            manager.isScanning = false;
        }).catch((err) => {
            console.error('QRスキャナー停止エラー:', err);
        });
    }
}

function toggleScanMode() {
    const modeIcon = document.getElementById('mode-icon');
    const modeText = document.getElementById('mode-text');
    const qrReader = document.getElementById('qr-reader');
    const manualInput = document.getElementById('manual-input-screen');
    
    if (manualInput.classList.contains('active')) {
        // 手入力 → QR
        manualInput.classList.remove('active');
        modeIcon.textContent = '⌨️';
        modeText.textContent = '手入力';
        startQRScanner();
    } else {
        // QR → 手入力
        stopQRScanner();
        qrReader.style.display = 'none';
        manualInput.classList.add('active');
        modeIcon.textContent = '📷';
        modeText.textContent = 'QR';
        setTimeout(() => {
            document.getElementById('manual-code-input').focus();
        }, 100);
    }
}

function submitManualCode() {
    const code = document.getElementById('manual-code-input').value.trim();
    if (code) {
        document.getElementById('manual-code-input').value = '';
        showQuantityModal(code);
    }
}

// 数量入力モーダル
function showQuantityModal(code) {
    document.getElementById('modal-code').textContent = code;
    document.getElementById('modal-location').textContent = manager.currentLocation;
    document.getElementById('quantity-input').value = '';
    document.getElementById('quantity-modal').classList.add('active');
    
    setTimeout(() => {
        document.getElementById('quantity-input').focus();
    }, 300);
}

function closeQuantityModal() {
    document.getElementById('quantity-modal').classList.remove('active');
    
    // QRモードの場合は再開
    if (!document.getElementById('manual-input-screen').classList.contains('active')) {
        startQRScanner();
    }
}

function saveInventoryItem() {
    const code = document.getElementById('modal-code').textContent;
    const location = document.getElementById('modal-location').textContent;
    const quantity = document.getElementById('quantity-input').value;
    
    if (!quantity || quantity <= 0) {
        alert('正しい数量を入力してください');
        return;
    }
    
    manager.addItem(code, location, parseInt(quantity));
    closeQuantityModal();
    
    // 保存完了の通知
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        font-weight: 700;
        z-index: 9999;
        animation: slideDown 0.3s;
    `;
    notification.textContent = '✓ 保存しました';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// 履歴画面
function showHistory() {
    const historyScreen = document.getElementById('history-screen');
    const historyList = document.getElementById('history-list');
    const historyCount = document.getElementById('history-count');
    
    historyScreen.classList.add('active');
    historyCount.textContent = manager.items.length;
    
    if (manager.items.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><p>データがありません</p></div>';
    } else {
        historyList.innerHTML = manager.items.map(item => {
            const date = new Date(item.date);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            return `
                <div class="history-item">
                    <div class="history-item-header">
                        <div class="history-item-code">${item.code}</div>
                        <div class="history-item-quantity">${item.quantity}個</div>
                    </div>
                    <div class="history-item-footer">
                        <div class="history-item-location">
                            📍 ${item.location}
                        </div>
                        <div>${dateStr}</div>
                    </div>
                    <button class="history-delete-btn" onclick="deleteHistoryItem(${item.id})">削除</button>
                </div>
            `;
        }).join('');
    }
}

function closeHistory() {
    document.getElementById('history-screen').classList.remove('active');
}

function deleteHistoryItem(id) {
    if (confirm('このデータを削除しますか?')) {
        manager.deleteItem(id);
        showHistory(); // 再描画
    }
}

// CSV出力画面
function showCSVScreen() {
    const csvScreen = document.getElementById('csv-screen');
    const csvLocationList = document.getElementById('csv-location-list');
    
    csvScreen.classList.add('active');
    
    if (manager.locations.length === 0) {
        csvLocationList.innerHTML = '<div class="empty-state"><p>ロケーションが登録されていません</p></div>';
    } else {
        csvLocationList.innerHTML = manager.locations.map(location => `
            <div class="csv-item" onclick="exportLocationCSV('${location}')">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-size: 1.5rem;">📄</div>
                    <div style="font-weight: 600; font-size: 1.125rem;">${location}</div>
                </div>
                <div style="color: var(--gray-500); font-size: 0.875rem;">CSV出力 ›</div>
            </div>
        `).join('');
    }
}

function closeCSVScreen() {
    document.getElementById('csv-screen').classList.remove('active');
}

function exportLocationCSV(location) {
    manager.exportCSV(location);
}

function exportAllCSV() {
    manager.exportCSV();
}

// 初期化
updateUI();

// Enterキーでモーダル送信
document.getElementById('new-location-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addLocation();
});

document.getElementById('manual-code-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitManualCode();
});

document.getElementById('quantity-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveInventoryItem();
});

// PWA用 Service Worker登録
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker登録失敗:', err);
    });
}
