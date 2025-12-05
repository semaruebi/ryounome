/**
 * RyounoMe - Sync Module
 * 動画同期機能の管理
 */

class SyncController {
    constructor(playerA, playerB, options = {}) {
        this.playerA = playerA;
        this.playerB = playerB;
        this.enabled = false;
        this.offset = 0; // 秒単位
        this.masterKey = 'A'; // 'A' or 'B' - which player is the master
        this.syncThreshold = 0.1; // 同期のずれ許容値（秒）
        this.loopMode = 'loop'; // 'loop', 'continue', 'stop'
        this.playerAReachedEnd = false;
        this.playerBReachedEnd = false;
        this.onSyncStateChange = options.onSyncStateChange || (() => {});
        
        this.initElements();
        this.bindEvents();
        this.loadSettings();
    }

    initElements() {
        this.elements = {
            syncToggle: document.getElementById('syncToggle'),
            syncStatus: document.getElementById('syncStatus'),
            masterBtnA: document.getElementById('masterA'),
            masterBtnB: document.getElementById('masterB'),
            playerAContainer: document.getElementById('playerAContainer'),
            playerBContainer: document.getElementById('playerBContainer'),
            // Start positions
            playerAStartPos: document.getElementById('playerAStartPos'),
            playerBStartPos: document.getElementById('playerBStartPos'),
            // Action buttons
            syncPlayBtn: document.getElementById('syncPlayBtn'),
            syncPauseBtn: document.getElementById('syncPauseBtn'),
            syncResetBtn: document.getElementById('syncResetBtn'),
            // Loop mode buttons
            loopModeLoop: document.getElementById('loopModeLoop'),
            loopModeContinue: document.getElementById('loopModeContinue'),
            loopModeStop: document.getElementById('loopModeStop')
        };
    }

    bindEvents() {
        // 同期ON/OFF
        this.elements.syncToggle?.addEventListener('click', () => this.toggle());

        // マスター選択ボタン
        this.elements.masterBtnA?.addEventListener('click', () => this.setMaster('A'));
        this.elements.masterBtnB?.addEventListener('click', () => this.setMaster('B'));

        // Start position inputs
        this.elements.playerAStartPos?.addEventListener('change', () => this.saveStartPositions());
        this.elements.playerBStartPos?.addEventListener('change', () => this.saveStartPositions());

        // Action buttons
        this.elements.syncPlayBtn?.addEventListener('click', () => this.playBoth());
        this.elements.syncPauseBtn?.addEventListener('click', () => this.pauseBoth());
        this.elements.syncResetBtn?.addEventListener('click', () => this.resetToStart());
        
        // Loop mode buttons
        this.elements.loopModeLoop?.addEventListener('click', () => this.setLoopMode('loop'));
        this.elements.loopModeContinue?.addEventListener('click', () => this.setLoopMode('continue'));
        this.elements.loopModeStop?.addEventListener('click', () => this.setLoopMode('stop'));
    }

    setLoopMode(mode) {
        this.loopMode = mode;
        
        // Update button states
        this.elements.loopModeLoop?.classList.toggle('active', mode === 'loop');
        this.elements.loopModeContinue?.classList.toggle('active', mode === 'continue');
        this.elements.loopModeStop?.classList.toggle('active', mode === 'stop');
        
        Storage.saveSettings({ loopMode: mode });
        
        const labels = { loop: 'ループ', continue: '継続', stop: '停止' };
        Toast.show(`End到達時: ${labels[mode]}`, 'info');
    }

    // Called when a player reaches its end marker
    handleEndReached(playerKey) {
        if (!this.enabled) {
            // Sync OFF: handle individually
            this.handleSinglePlayerEnd(playerKey);
            return;
        }
        
        // Sync ON: wait for both players
        if (playerKey === 'A') {
            this.playerAReachedEnd = true;
        } else {
            this.playerBReachedEnd = true;
        }
        
        // Check if both reached end
        if (this.playerAReachedEnd && this.playerBReachedEnd) {
            this.handleBothPlayersEnd();
        }
    }

    handleSinglePlayerEnd(playerKey) {
        const player = playerKey === 'A' ? this.playerA : this.playerB;
        
        switch (this.loopMode) {
            case 'loop':
                if (player.startMarker !== null) {
                    player.seekTo(player.startMarker);
                    // Continue playing
                }
                break;
            case 'continue':
                // Clear end marker and continue
                player.endMarker = null;
                player.updateMarkerDisplay();
                break;
            case 'stop':
                player.pause();
                Toast.show(`${playerKey} End到達`, 'info');
                break;
        }
    }

    handleBothPlayersEnd() {
        // Reset flags
        this.playerAReachedEnd = false;
        this.playerBReachedEnd = false;
        
        switch (this.loopMode) {
            case 'loop':
                // Both loop back to start
                this.resetToStart();
                this.playBoth();
                break;
            case 'continue':
                // Clear end markers and continue
                this.playerA.endMarker = null;
                this.playerB.endMarker = null;
                this.playerA.updateMarkerDisplay();
                this.playerB.updateMarkerDisplay();
                Toast.show('End到達 - 継続再生中', 'info');
                break;
            case 'stop':
                this.pauseBoth();
                Toast.show('両方End到達 - 停止', 'info');
                break;
        }
    }

    parseTimeInput(value) {
        if (!value) return 0;
        const parts = value.split(':').map(p => parseFloat(p) || 0);
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    getStartPositionA() {
        return this.parseTimeInput(this.elements.playerAStartPos?.value || '0:00');
    }

    getStartPositionB() {
        return this.parseTimeInput(this.elements.playerBStartPos?.value || '0:00');
    }

    saveStartPositions() {
        // Save to player data in project
        Storage.savePlayerData('A', {
            startPos: this.elements.playerAStartPos?.value || '0:00'
        });
        Storage.savePlayerData('B', {
            startPos: this.elements.playerBStartPos?.value || '0:00'
        });
    }

    playBoth() {
        const startA = this.getStartPositionA();
        const startB = this.getStartPositionB();

        if (this.playerA.isReady) {
            this.playerA.seekTo(startA);
            this.playerA.play();
        }
        if (this.playerB.isReady) {
            this.playerB.seekTo(startB);
            this.playerB.play();
        }
        Toast.show('両方再生開始', 'success');
    }

    pauseBoth() {
        if (this.playerA.isReady) this.playerA.pause();
        if (this.playerB.isReady) this.playerB.pause();
        Toast.show('両方停止', 'info');
    }

    resetToStart() {
        const startA = this.getStartPositionA();
        const startB = this.getStartPositionB();

        if (this.playerA.isReady) {
            this.playerA.pause();
            this.playerA.seekTo(startA);
        }
        if (this.playerB.isReady) {
            this.playerB.pause();
            this.playerB.seekTo(startB);
        }
        Toast.show('開始位置へ移動', 'info');
    }

    setMaster(key) {
        this.masterKey = key;
        
        // Update button states
        this.elements.masterBtnA?.classList.toggle('active', key === 'A');
        this.elements.masterBtnB?.classList.toggle('active', key === 'B');
        
        // Update player container focus
        this.elements.playerAContainer?.classList.toggle('is-master', key === 'A');
        this.elements.playerBContainer?.classList.toggle('is-master', key === 'B');
        
        this.updateOffsetHint();
        this.saveSettings();
        Toast.show(`${key}を基準に設定`, 'success');
    }

    updateMasterUI() {
        // Update button states
        this.elements.masterBtnA?.classList.toggle('active', this.masterKey === 'A');
        this.elements.masterBtnB?.classList.toggle('active', this.masterKey === 'B');
        
        // Update player container focus
        this.elements.playerAContainer?.classList.toggle('is-master', this.masterKey === 'A');
        this.elements.playerBContainer?.classList.toggle('is-master', this.masterKey === 'B');
    }

    getMaster() {
        return this.masterKey === 'A' ? this.playerA : this.playerB;
    }

    getSlave() {
        return this.masterKey === 'A' ? this.playerB : this.playerA;
    }

    loadSettings() {
        const settings = Storage.loadSettings();
        if (settings.syncMaster) {
            this.masterKey = settings.syncMaster;
        }
        // Load start positions
        if (settings.startPosA && this.elements.playerAStartPos) {
            this.elements.playerAStartPos.value = settings.startPosA;
        }
        if (settings.startPosB && this.elements.playerBStartPos) {
            this.elements.playerBStartPos.value = settings.startPosB;
        }
        // Load loop mode
        if (settings.loopMode) {
            this.loopMode = settings.loopMode;
            this.elements.loopModeLoop?.classList.toggle('active', this.loopMode === 'loop');
            this.elements.loopModeContinue?.classList.toggle('active', this.loopMode === 'continue');
            this.elements.loopModeStop?.classList.toggle('active', this.loopMode === 'stop');
        }
        this.updateMasterUI();
        if (settings.syncEnabled) {
            this.enable();
        }
    }

    saveSettings() {
        Storage.saveSettings({
            syncEnabled: this.enabled,
            syncMaster: this.masterKey
        });
    }

    reset() {
        // Reset to default state
        this.enabled = false;
        this.masterKey = 'A';
        this.loopMode = 'loop';
        this.playerAReachedEnd = false;
        this.playerBReachedEnd = false;
        
        // Reset UI
        this.elements.syncToggle?.classList.remove('active');
        if (this.elements.syncStatus) this.elements.syncStatus.textContent = 'OFF';
        if (this.elements.playerAStartPos) this.elements.playerAStartPos.value = '0:00';
        if (this.elements.playerBStartPos) this.elements.playerBStartPos.value = '0:00';
        
        // Reset loop mode buttons
        this.elements.loopModeLoop?.classList.add('active');
        this.elements.loopModeContinue?.classList.remove('active');
        this.elements.loopModeStop?.classList.remove('active');
        
        this.updateMasterUI();
    }

    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    enable() {
        this.enabled = true;
        this.elements.syncToggle.classList.add('active');
        this.elements.syncStatus.textContent = 'ON';
        this.saveSettings();
        this.onSyncStateChange(true);
        Toast.show('同期を有効にしました', 'success');
    }

    disable() {
        this.enabled = false;
        this.elements.syncToggle.classList.remove('active');
        this.elements.syncStatus.textContent = 'OFF';
        this.saveSettings();
        this.onSyncStateChange(false);
        Toast.show('同期を無効にしました', 'warning');
    }

    /**
     * マスタープレイヤーの再生/一時停止状態にスレーブを追従させる
     * @param {string} state - 'playing' or 'paused'
     */
    syncPlayState(state) {
        const slave = this.getSlave();
        
        if (!this.enabled || !slave.isReady) {
            return;
        }

        if (state === 'playing') {
            slave.play();
        } else if (state === 'paused') {
            slave.pause();
        }
    }

    /**
     * マスタープレイヤーのシーク時にスレーブも追従（同期ON時のみ）
     */
    handleSeek(time) {
        // 同期ONの場合、スレーブも同じ相対位置に移動
        if (!this.enabled) return;
        
        const slave = this.getSlave();
        const master = this.getMaster();
        if (!slave.isReady || !master.isReady) return;
        
        // 開始位置からの相対位置を計算
        const masterStart = this.masterKey === 'A' ? this.getStartPositionA() : this.getStartPositionB();
        const slaveStart = this.masterKey === 'A' ? this.getStartPositionB() : this.getStartPositionA();
        const relativeTime = time - masterStart;
        const slaveTime = slaveStart + relativeTime;
        
        slave.seekTo(Math.max(0, slaveTime));
    }
}

// グローバルに公開
window.SyncController = SyncController;

