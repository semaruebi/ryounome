/**
 * RyounoMe - Playback Controller
 * 両プレイヤーの再生制御
 */

class SyncController {
    constructor(playerA, playerB, options = {}) {
        this.playerA = playerA;
        this.playerB = playerB;
        this.loopMode = 'stop'; // 'loop', 'continue', 'stop' - default: stop
        this.playerAReachedEnd = false;
        this.playerBReachedEnd = false;
        
        this.initElements();
        this.bindEvents();
        this.loadSettings();
    }

    initElements() {
        this.elements = {
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
        const player = playerKey === 'A' ? this.playerA : this.playerB;
        
        switch (this.loopMode) {
            case 'loop':
                // Loop back to start marker
                if (player.startMarker !== null) {
                    player.seekTo(player.startMarker);
                    player.play();
                }
                break;
            case 'continue':
                // Just continue playing
                break;
            case 'stop':
                player.pause();
                break;
        }
    }

    parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        return parseFloat(timeStr) || 0;
    }

    playBoth() {
        // Get start positions
        const startA = this.parseTimeToSeconds(this.elements.playerAStartPos?.value);
        const startB = this.parseTimeToSeconds(this.elements.playerBStartPos?.value);
        
        // Seek to start positions if not already there
        if (this.playerA.isReady) {
            const currentA = this.playerA.getCurrentTime();
            if (Math.abs(currentA - startA) > 0.5) {
                this.playerA.seekTo(startA);
            }
            this.playerA.play();
        }
        
        if (this.playerB.isReady) {
            const currentB = this.playerB.getCurrentTime();
            if (Math.abs(currentB - startB) > 0.5) {
                this.playerB.seekTo(startB);
            }
            this.playerB.play();
        }
        
        Toast.show('両方再生', 'success');
    }

    pauseBoth() {
        if (this.playerA.isReady) this.playerA.pause();
        if (this.playerB.isReady) this.playerB.pause();
        Toast.show('両方停止', 'info');
    }

    resetToStart() {
        const startA = this.parseTimeToSeconds(this.elements.playerAStartPos?.value);
        const startB = this.parseTimeToSeconds(this.elements.playerBStartPos?.value);
        
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

    saveStartPositions() {
        Storage.saveSettings({
            startPosA: this.elements.playerAStartPos?.value || '0:00',
            startPosB: this.elements.playerBStartPos?.value || '0:00'
        });
    }

    loadSettings() {
        const settings = Storage.loadSettings();
        
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
    }

    saveSettings() {
        Storage.saveSettings({
            loopMode: this.loopMode
        });
    }

    reset() {
        // Reset to default state
        this.loopMode = 'stop';
        this.playerAReachedEnd = false;
        this.playerBReachedEnd = false;
        
        // Reset UI
        if (this.elements.playerAStartPos) this.elements.playerAStartPos.value = '0:00';
        if (this.elements.playerBStartPos) this.elements.playerBStartPos.value = '0:00';
        
        // Reset loop mode buttons
        this.elements.loopModeLoop?.classList.remove('active');
        this.elements.loopModeContinue?.classList.remove('active');
        this.elements.loopModeStop?.classList.add('active');
    }
}

window.SyncController = SyncController;
