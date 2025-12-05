/**
 * RyounoMe - Main Application
 * アプリケーションのエントリーポイント
 */

// Toast通知ユーティリティ
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
    },

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        this.container.appendChild(toast);

        // 自動削除
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// グローバルに公開
window.Toast = Toast;

// メインアプリケーション
class App {
    constructor() {
        this.playerA = null;
        this.playerB = null;
        this.syncController = null;
        this.commentsController = null;
        
        // YouTube API Ready callback
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube IFrame API Ready');
        };
    }

    init() {
        Toast.init();
        this.initPlayers();
        this.initSync();
        this.initComments();
        this.initUI();
        this.bindKeyboardShortcuts();

        console.log('RyounoMe initialized');
        Toast.show('RyounoMe へようこそ！🎮', 'success');
    }

    initPlayers() {
        // プレイヤーAの初期化
        this.playerA = new VideoPlayer('A', {
            onTimeUpdate: (time, player) => this.handleTimeUpdate(time, player),
            onStateChange: (state, player) => this.handleStateChange(state, player),
            onReady: (player) => this.handlePlayerReady(player)
        });

        // プレイヤーBの初期化
        this.playerB = new VideoPlayer('B', {
            onTimeUpdate: (time, player) => this.handleTimeUpdate(time, player),
            onStateChange: (state, player) => this.handleStateChange(state, player),
            onReady: (player) => this.handlePlayerReady(player)
        });
    }

    initSync() {
        this.syncController = new SyncController(this.playerA, this.playerB, {
            onSyncStateChange: (enabled) => {
                console.log('Sync state:', enabled);
            }
        });
    }

    initComments() {
        this.commentsController = new CommentsController({
            onCommentClick: (comment) => this.handleCommentClick(comment),
            getPlayerTime: (playerKey) => this.getPlayerTime(playerKey)
        });
    }

    initUI() {
        // ヘルプモーダル
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeHelpModal = document.getElementById('closeHelpModal');
        const modalBackdrop = helpModal.querySelector('.modal-backdrop');

        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('active');
        });

        closeHelpModal.addEventListener('click', () => {
            helpModal.classList.remove('active');
        });

        modalBackdrop.addEventListener('click', () => {
            helpModal.classList.remove('active');
        });

        // エクスポート
        document.getElementById('exportBtn').addEventListener('click', () => {
            if (Storage.exportData()) {
                Toast.show('データをエクスポートしました', 'success');
            } else {
                Toast.show('エクスポートに失敗しました', 'error');
            }
        });

        // インポート
        const importBtn = document.getElementById('importBtn');
        const importFileInput = document.getElementById('importFileInput');

        importBtn.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;

            const file = e.target.files[0];
            const mode = confirm('既存のデータとマージしますか？\n（キャンセルで上書き）') ? 'merge' : 'overwrite';

            try {
                const result = await Storage.importData(file, mode);
                Toast.show(`${result.imported}件のコメントをインポートしました`, 'success');
                this.commentsController.loadComments();
            } catch (error) {
                Toast.show(`インポートエラー: ${error.message}`, 'error');
            }

            // ファイル入力をリセット
            e.target.value = '';
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 入力フォーカス中は無視
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.playerA.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.playerA.frameStep(-1);
                    if (this.syncController.enabled) {
                        this.playerB.frameStep(-1);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.playerA.frameStep(1);
                    if (this.syncController.enabled) {
                        this.playerB.frameStep(1);
                    }
                    break;
                case 'KeyS':
                    e.preventDefault();
                    this.syncController.toggle();
                    break;
            }
        });
    }

    handleTimeUpdate(time, player) {
        // プレイヤーAの場合、同期処理
        if (player.key === 'A') {
            this.syncController.syncFromA();
            
            // コメントのタイムスタンプ更新
            const selectedPlayer = document.querySelector('input[name="commentPlayer"]:checked').value;
            if (selectedPlayer === 'A') {
                this.commentsController.setCurrentTimestamp(time);
            }
            
            // コメントハイライト更新
            this.commentsController.highlightActiveComments(time, 'A');
        } else if (player.key === 'B') {
            const selectedPlayer = document.querySelector('input[name="commentPlayer"]:checked').value;
            if (selectedPlayer === 'B') {
                this.commentsController.setCurrentTimestamp(time);
            }
        }
    }

    handleStateChange(state, player) {
        // プレイヤーAの状態変更時に同期
        if (player.key === 'A') {
            this.syncController.syncPlayState(state);
        }
    }

    handlePlayerReady(player) {
        console.log(`Player ${player.key} is ready`);
    }

    handleCommentClick(comment) {
        const player = comment.playerKey === 'A' ? this.playerA : this.playerB;
        player.seekTo(comment.timestamp);
        
        // 同期が有効な場合、もう一方のプレイヤーも同期
        if (this.syncController.enabled && comment.playerKey === 'A') {
            this.syncController.handleSeek(comment.timestamp);
        }
        
        Toast.show(`${this.formatTime(comment.timestamp)} にジャンプしました`, 'success');
    }

    getPlayerTime(playerKey) {
        const player = playerKey === 'A' ? this.playerA : this.playerB;
        return player ? player.getCurrentTime() : 0;
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    
    // グローバルに公開（デバッグ用）
    window.app = app;
});

