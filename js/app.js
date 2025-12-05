/**
 * RyounoMe - Main Application
 */

const Toast = {
    container: null,
    init() {
        this.container = document.getElementById('toastContainer');
    },
    show(message, type = 'info', duration = 2000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

window.Toast = Toast;

class App {
    constructor() {
        this.playerA = null;
        this.playerB = null;
        this.syncController = null;
        this.commentsController = null;
        this.sidebarOpen = true;
        
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube API Ready');
        };
    }

    init() {
        Toast.init();
        this.initPlayers();
        this.initSync();
        this.initComments();
        this.initUI();
        this.initSidebar();
        this.bindKeyboardShortcuts();
        
        console.log('RyounoMe initialized');
        Toast.show('RyounoMe 起動', 'success');
    }

    initPlayers() {
        this.playerA = new VideoPlayer('A', {
            onTimeUpdate: (time, player) => this.handleTimeUpdate(time, player),
            onStateChange: (state, player) => this.handleStateChange(state, player),
            onReady: (player) => this.handlePlayerReady(player)
        });

        this.playerB = new VideoPlayer('B', {
            onTimeUpdate: (time, player) => this.handleTimeUpdate(time, player),
            onStateChange: (state, player) => this.handleStateChange(state, player),
            onReady: (player) => this.handlePlayerReady(player)
        });
    }

    initSync() {
        this.syncController = new SyncController(this.playerA, this.playerB, {
            onSyncStateChange: (enabled) => console.log('Sync:', enabled)
        });
    }

    initComments() {
        this.commentsController = new CommentsController({
            onCommentClick: (comment) => this.handleCommentClick(comment),
            getPlayerTime: (key) => this.getPlayerTime(key)
        });
    }

    initUI() {
        // Help modal
        const helpModal = document.getElementById('helpModal');
        document.getElementById('helpBtn')?.addEventListener('click', () => helpModal.classList.add('active'));
        document.getElementById('closeHelpModal')?.addEventListener('click', () => helpModal.classList.remove('active'));
        helpModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => helpModal.classList.remove('active'));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') helpModal?.classList.remove('active');
        });

        // Export
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            Storage.exportData() ? Toast.show('エクスポート完了', 'success') : Toast.show('エクスポート失敗', 'error');
        });

        // Import
        const importInput = document.getElementById('importFileInput');
        document.getElementById('importBtn')?.addEventListener('click', () => importInput?.click());
        
        importInput?.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            const mode = confirm('マージしますか？（キャンセルで上書き）') ? 'merge' : 'overwrite';
            try {
                const result = await Storage.importData(e.target.files[0], mode);
                Toast.show(`${result.imported}件インポート`, 'success');
                this.commentsController.loadComments();
            } catch (err) {
                Toast.show(`インポートエラー`, 'error');
            }
            e.target.value = '';
        });
    }

    initSidebar() {
        const sidebar = document.getElementById('commentsSidebar');
        const toggle = () => {
            this.sidebarOpen = !this.sidebarOpen;
            sidebar?.classList.toggle('open', this.sidebarOpen);
            sidebar?.classList.toggle('collapsed', !this.sidebarOpen);
        };

        document.getElementById('sidebarToggleBtn')?.addEventListener('click', toggle);
        document.getElementById('mobileSidebarToggle')?.addEventListener('click', toggle);

        if (window.innerWidth <= 1200) {
            this.sidebarOpen = false;
            sidebar?.classList.add('collapsed');
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1200) {
                sidebar?.classList.remove('collapsed', 'open');
                this.sidebarOpen = true;
            }
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            const shift = e.shiftKey;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.playerA.togglePlayPause();
                    break;
                    
                // Arrow keys: seconds
                case 'ArrowLeft':
                    e.preventDefault();
                    this.playerA.pause();
                    if (shift) {
                        // Shift + Left: -5 seconds
                        this.playerA.seekTo(this.playerA.getCurrentTime() - 5);
                        if (this.syncController.enabled) this.playerB.seekTo(this.playerB.getCurrentTime() - 5);
                    } else {
                        // Left: -1 second
                        this.playerA.seekTo(this.playerA.getCurrentTime() - 1);
                        if (this.syncController.enabled) this.playerB.seekTo(this.playerB.getCurrentTime() - 1);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.playerA.pause();
                    if (shift) {
                        // Shift + Right: +5 seconds
                        this.playerA.seekTo(this.playerA.getCurrentTime() + 5);
                        if (this.syncController.enabled) this.playerB.seekTo(this.playerB.getCurrentTime() + 5);
                    } else {
                        // Right: +1 second
                        this.playerA.seekTo(this.playerA.getCurrentTime() + 1);
                        if (this.syncController.enabled) this.playerB.seekTo(this.playerB.getCurrentTime() + 1);
                    }
                    break;
                    
                // , . keys: frames (VidTimer style)
                case 'Comma':
                    e.preventDefault();
                    this.playerA.frameStep(shift ? -5 : -1);
                    if (this.syncController.enabled) this.playerB.frameStep(shift ? -5 : -1);
                    break;
                case 'Period':
                    e.preventDefault();
                    this.playerA.frameStep(shift ? 5 : 1);
                    if (this.syncController.enabled) this.playerB.frameStep(shift ? 5 : 1);
                    break;
                    
                case 'KeyS':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.syncController.toggle();
                    }
                    break;
                case 'KeyR':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.playerA.goToStart();
                        if (this.syncController.enabled) this.playerB.goToStart();
                    }
                    break;
            }
        });
    }

    handleTimeUpdate(time, player) {
        if (player.key === 'A') {
            this.syncController.syncFromA();
            
            const selected = document.querySelector('input[name="commentPlayer"]:checked')?.value;
            if (selected === 'A') this.commentsController.setCurrentTimestamp(time);
            this.commentsController.highlightActiveComments(time, 'A');
        } else if (player.key === 'B') {
            const selected = document.querySelector('input[name="commentPlayer"]:checked')?.value;
            if (selected === 'B') this.commentsController.setCurrentTimestamp(time);
        }
    }

    handleStateChange(state, player) {
        if (player.key === 'A') this.syncController.syncPlayState(state);
    }

    handlePlayerReady(player) {
        console.log(`Player ${player.key} ready`);
    }

    handleCommentClick(comment) {
        const player = comment.playerKey === 'A' ? this.playerA : this.playerB;
        player.seekTo(comment.timestamp);
        
        if (this.syncController.enabled && comment.playerKey === 'A') {
            this.syncController.handleSeek(comment.timestamp);
        }
        
        Toast.show(`${this.formatTime(comment.timestamp)} へジャンプ`, 'success');
    }

    getPlayerTime(key) {
        return key === 'A' ? this.playerA?.getCurrentTime() : this.playerB?.getCurrentTime();
    }

    formatTime(s) {
        if (isNaN(s)) s = 0;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 1000);
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    window.app = app;
});
