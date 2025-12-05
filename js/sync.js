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
        this.syncThreshold = 0.1; // 同期のずれ許容値（秒）
        this.onSyncStateChange = options.onSyncStateChange || (() => {});
        
        this.initElements();
        this.bindEvents();
        this.loadSettings();
    }

    initElements() {
        this.elements = {
            syncToggle: document.getElementById('syncToggle'),
            syncStatus: document.getElementById('syncStatus'),
            offsetInput: document.getElementById('syncOffsetInput'),
            offsetMinus1: document.getElementById('offsetMinus1'),
            offsetMinus01: document.getElementById('offsetMinus01'),
            offsetPlus01: document.getElementById('offsetPlus01'),
            offsetPlus1: document.getElementById('offsetPlus1'),
            syncNowBtn: document.getElementById('syncNowBtn'),
            resetOffsetBtn: document.getElementById('resetOffsetBtn')
        };
    }

    bindEvents() {
        // 同期ON/OFF
        this.elements.syncToggle.addEventListener('click', () => this.toggle());

        // オフセット調整ボタン
        this.elements.offsetMinus1.addEventListener('click', () => this.adjustOffset(-1));
        this.elements.offsetMinus01.addEventListener('click', () => this.adjustOffset(-0.1));
        this.elements.offsetPlus01.addEventListener('click', () => this.adjustOffset(0.1));
        this.elements.offsetPlus1.addEventListener('click', () => this.adjustOffset(1));

        // オフセット入力
        this.elements.offsetInput.addEventListener('change', (e) => {
            this.setOffset(parseFloat(e.target.value) || 0);
        });

        // 今すぐ同期
        this.elements.syncNowBtn.addEventListener('click', () => this.syncNow());

        // オフセットリセット
        this.elements.resetOffsetBtn.addEventListener('click', () => {
            this.setOffset(0);
            Toast.show('オフセットをリセットしました', 'success');
        });
    }

    loadSettings() {
        const settings = Storage.loadSettings();
        if (settings.syncOffset !== undefined) {
            this.setOffset(settings.syncOffset, false);
        }
        if (settings.syncEnabled) {
            this.enable();
        }
    }

    saveSettings() {
        Storage.saveSettings({
            syncEnabled: this.enabled,
            syncOffset: this.offset
        });
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

    setOffset(value, showToast = true) {
        this.offset = Math.round(value * 1000) / 1000; // 小数点3桁まで
        this.elements.offsetInput.value = this.offset;
        this.saveSettings();
        
        if (showToast) {
            Toast.show(`オフセットを ${this.offset}秒 に設定しました`, 'success');
        }
    }

    adjustOffset(delta) {
        this.setOffset(this.offset + delta);
    }

    /**
     * プレイヤーAの操作にプレイヤーBを同期させる
     */
    syncFromA() {
        if (!this.enabled || !this.playerA.isReady || !this.playerB.isReady) {
            return;
        }

        const timeA = this.playerA.getCurrentTime();
        const targetTimeB = timeA + this.offset;
        const currentTimeB = this.playerB.getCurrentTime();

        // 現在位置と目標位置の差が閾値を超えている場合のみシーク
        if (Math.abs(currentTimeB - targetTimeB) > this.syncThreshold) {
            this.playerB.seekTo(Math.max(0, targetTimeB));
        }
    }

    /**
     * プレイヤーAの再生/一時停止状態にプレイヤーBを追従させる
     * @param {string} state - 'playing' or 'paused'
     */
    syncPlayState(state) {
        if (!this.enabled || !this.playerB.isReady) {
            return;
        }

        if (state === 'playing') {
            this.syncFromA(); // まず位置を同期
            this.playerB.play();
        } else if (state === 'paused') {
            this.playerB.pause();
            this.syncFromA(); // 一時停止後に位置を微調整
        }
    }

    /**
     * 今すぐ同期を実行
     */
    syncNow() {
        if (!this.playerA.isReady || !this.playerB.isReady) {
            Toast.show('両方のプレイヤーに動画をロードしてください', 'warning');
            return;
        }

        const timeA = this.playerA.getCurrentTime();
        const targetTimeB = timeA + this.offset;
        this.playerB.seekTo(Math.max(0, targetTimeB));

        // 再生状態も同期
        if (this.playerA.isPlaying()) {
            this.playerB.play();
        } else {
            this.playerB.pause();
        }

        Toast.show('同期を実行しました', 'success');
    }

    /**
     * プレイヤーAのシーク時にプレイヤーBも追従
     * @param {number} time - シーク先の時間
     */
    handleSeek(time) {
        if (!this.enabled || !this.playerB.isReady) {
            return;
        }

        const targetTimeB = time + this.offset;
        this.playerB.seekTo(Math.max(0, targetTimeB));
    }
}

// グローバルに公開
window.SyncController = SyncController;

