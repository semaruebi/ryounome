/**
 * RyounoMe - Player Module
 * 動画プレイヤーの管理（YouTube / ローカルファイル対応）
 * Performance optimized version
 */

class VideoPlayer {
    constructor(key, options = {}) {
        this.key = key; // 'A' or 'B'
        this.type = null; // 'youtube' or 'local'
        this.videoElement = null;
        this.youtubePlayer = null;
        this.videoUrl = null;
        this.isReady = false;
        this.frameRate = options.frameRate || 30;
        this.startTime = 0; // 開始位置
        this.zoomLevel = 1; // シークバーの精度（1-100）
        
        // Callbacks
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onReady = options.onReady || (() => {});
        
        // Performance: Throttle time updates
        this.lastTimeUpdate = 0;
        this.timeUpdateThrottle = 50; // ms
        
        this.initElements();
        this.bindEvents();
        this.loadSavedName();
    }

    initElements() {
        const prefix = `player${this.key}`;
        
        this.elements = {
            container: document.getElementById(`${prefix}Container`),
            placeholder: document.getElementById(`${prefix}Placeholder`),
            video: document.getElementById(`${prefix}Video`),
            youtubeContainer: document.getElementById(`${prefix}Youtube`),
            dropzone: document.getElementById(`${prefix}Dropzone`),
            urlInput: document.getElementById(`${prefix}Url`),
            loadBtn: document.getElementById(`${prefix}LoadBtn`),
            fileInput: document.getElementById(`${prefix}File`),
            playPauseBtn: document.getElementById(`${prefix}PlayPause`),
            frameBackBtn: document.getElementById(`${prefix}FrameBack`),
            frameForwardBtn: document.getElementById(`${prefix}FrameForward`),
            volumeSlider: document.getElementById(`${prefix}Volume`),
            volumeIcon: document.getElementById(`${prefix}VolumeIcon`),
            speedSelect: document.getElementById(`${prefix}Speed`),
            seekbar: document.getElementById(`${prefix}Seek`),
            seekWrapper: document.getElementById(`${prefix}SeekWrapper`),
            seekPreview: document.getElementById(`${prefix}SeekPreview`),
            zoomSlider: document.getElementById(`${prefix}Zoom`),
            zoomIndicator: document.getElementById(`${prefix}ZoomIndicator`),
            timeDisplay: document.getElementById(`${prefix}Time`),
            nameInput: document.getElementById(`${prefix}Name`),
            startTimeInput: document.getElementById(`${prefix}StartTime`),
            setStartBtn: document.getElementById(`${prefix}SetStart`)
        };
    }

    bindEvents() {
        // URL読み込み
        this.elements.loadBtn.addEventListener('click', () => this.loadFromUrl());
        this.elements.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadFromUrl();
        });

        // ファイル選択
        this.elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadLocalFile(e.target.files[0]);
            }
        });

        // ドラッグ&ドロップ
        this.setupDragDrop();

        // 再生コントロール
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.elements.frameBackBtn.addEventListener('click', () => this.frameStep(-1));
        this.elements.frameForwardBtn.addEventListener('click', () => this.frameStep(1));

        // 音量
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(parseInt(e.target.value) / 100);
        });
        
        // 音量アイコンでミュート切り替え
        this.elements.volumeIcon.addEventListener('click', () => {
            const current = parseInt(this.elements.volumeSlider.value);
            if (current > 0) {
                this.elements.volumeSlider.dataset.prevVolume = current;
                this.elements.volumeSlider.value = 0;
                this.setVolume(0);
            } else {
                const prev = this.elements.volumeSlider.dataset.prevVolume || 100;
                this.elements.volumeSlider.value = prev;
                this.setVolume(prev / 100);
            }
        });

        // 再生速度
        this.elements.speedSelect.addEventListener('change', (e) => {
            this.setPlaybackRate(parseFloat(e.target.value));
        });

        // シークバー - リアルタイムプレビュー
        this.elements.seekbar.addEventListener('input', (e) => {
            const duration = this.getDuration();
            if (duration > 0) {
                const time = (parseFloat(e.target.value) / 100) * duration;
                this.updateSeekPreview(time, e);
                // リアルタイムでシーク
                this.seekTo(time);
            }
        });
        
        // シークバーホバー時のプレビュー
        this.elements.seekWrapper.addEventListener('mousemove', (e) => {
            if (!this.isReady) return;
            const rect = this.elements.seekbar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const time = percent * this.getDuration();
            this.updateSeekPreview(time, e);
        });

        // ズームレベル（精度）
        this.elements.zoomSlider.addEventListener('input', (e) => {
            this.zoomLevel = parseInt(e.target.value);
            this.updateZoomIndicator();
            this.updateSeekbarStep();
        });

        // 開始位置設定
        this.elements.setStartBtn.addEventListener('click', () => {
            this.captureStartTime();
        });
        
        this.elements.startTimeInput.addEventListener('change', (e) => {
            this.startTime = this.parseTimeInput(e.target.value);
        });

        // 名前入力
        this.elements.nameInput.addEventListener('change', (e) => {
            this.saveName(e.target.value);
        });

        // ローカルビデオのイベント - パフォーマンス最適化
        this.elements.video.addEventListener('timeupdate', () => {
            this.throttledTimeUpdate();
        });
        this.elements.video.addEventListener('play', () => this.handleStateChange('playing'));
        this.elements.video.addEventListener('pause', () => this.handleStateChange('paused'));
        this.elements.video.addEventListener('ended', () => this.handleStateChange('ended'));
        this.elements.video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
        
        // パフォーマンス: seeking中はUIを軽量化
        this.elements.video.addEventListener('seeking', () => {
            this.elements.container.classList.add('seeking');
        });
        this.elements.video.addEventListener('seeked', () => {
            this.elements.container.classList.remove('seeking');
        });
    }

    throttledTimeUpdate() {
        const now = Date.now();
        if (now - this.lastTimeUpdate >= this.timeUpdateThrottle) {
            this.lastTimeUpdate = now;
            this.handleTimeUpdate();
        }
    }

    updateSeekPreview(time, event) {
        const preview = this.elements.seekPreview;
        preview.textContent = this.formatTimeShort(time);
        
        // Position preview above cursor
        const rect = this.elements.seekWrapper.getBoundingClientRect();
        const x = event ? event.clientX - rect.left : this.elements.seekbar.offsetWidth / 2;
        preview.style.left = `${Math.max(30, Math.min(rect.width - 30, x))}px`;
    }

    updateZoomIndicator() {
        const indicators = [
            { level: 1, label: '1分単位' },
            { level: 10, label: '10秒単位' },
            { level: 25, label: '5秒単位' },
            { level: 50, label: '1秒単位' },
            { level: 75, label: '100ms単位' },
            { level: 100, label: 'ミリ秒単位' }
        ];
        
        let label = '1分単位';
        for (const ind of indicators) {
            if (this.zoomLevel >= ind.level) {
                label = ind.label;
            }
        }
        this.elements.zoomIndicator.textContent = label;
    }

    updateSeekbarStep() {
        // Zoomレベルに応じてステップを変更
        const steps = {
            1: 1,        // 1%
            10: 0.1,     // 0.1%
            25: 0.05,    // 0.05%
            50: 0.01,    // 0.01%
            75: 0.001,   // 0.001%
            100: 0.0001  // 0.0001%
        };
        
        let step = 1;
        for (const [level, s] of Object.entries(steps)) {
            if (this.zoomLevel >= parseInt(level)) {
                step = s;
            }
        }
        this.elements.seekbar.step = step;
    }

    captureStartTime() {
        const currentTime = this.getCurrentTime();
        this.startTime = currentTime;
        this.elements.startTimeInput.value = this.formatTimeInput(currentTime);
        Toast.show('開始位置を設定しました', 'success');
    }

    parseTimeInput(value) {
        // "1:30", "1:30:00", "90", "90.5" などをパース
        if (!value) return 0;
        
        const parts = value.split(':').map(p => parseFloat(p) || 0);
        
        if (parts.length === 1) {
            return parts[0]; // 秒のみ
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1]; // 分:秒
        } else if (parts.length >= 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2]; // 時:分:秒
        }
        return 0;
    }

    formatTimeInput(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    goToStart() {
        this.seekTo(this.startTime);
    }

    saveName(name) {
        const settings = Storage.loadSettings();
        settings[`player${this.key}Name`] = name;
        Storage.saveSettings(settings);
    }

    loadSavedName() {
        const settings = Storage.loadSettings();
        const name = settings[`player${this.key}Name`];
        if (name) {
            this.elements.nameInput.value = name;
        }
    }

    setupDragDrop() {
        const container = this.elements.container;
        const dropzone = this.elements.dropzone;

        container.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropzone.classList.add('active');
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                dropzone.classList.remove('active');
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('active');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('video/')) {
                this.loadLocalFile(files[0]);
            }
        });
    }

    loadFromUrl() {
        const url = this.elements.urlInput.value.trim();
        if (!url) return;

        const videoId = this.extractYoutubeId(url);
        if (videoId) {
            this.loadYoutubeVideo(videoId, url);
        } else {
            Toast.show('有効なYouTube URLを入力してください', 'error');
        }
    }

    extractYoutubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    loadYoutubeVideo(videoId, originalUrl) {
        this.cleanup();
        this.type = 'youtube';
        this.videoUrl = originalUrl;

        this.elements.placeholder.style.display = 'none';
        this.elements.video.style.display = 'none';
        this.elements.youtubeContainer.style.display = 'block';

        if (typeof YT === 'undefined' || !YT.Player) {
            Toast.show('YouTube API を読み込み中...', 'warning');
            const checkAPI = setInterval(() => {
                if (typeof YT !== 'undefined' && YT.Player) {
                    clearInterval(checkAPI);
                    this.createYoutubePlayer(videoId);
                }
            }, 100);
        } else {
            this.createYoutubePlayer(videoId);
        }
    }

    createYoutubePlayer(videoId) {
        if (this.youtubePlayer) {
            this.youtubePlayer.destroy();
        }

        this.youtubePlayer = new YT.Player(this.elements.youtubeContainer.id, {
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                playsinline: 1,
                disablekb: 1 // キーボード操作を無効化（自前で制御）
            },
            events: {
                onReady: (e) => this.handleYoutubeReady(e),
                onStateChange: (e) => this.handleYoutubeStateChange(e),
                onError: (e) => this.handleYoutubeError(e)
            }
        });
    }

    handleYoutubeReady(event) {
        this.isReady = true;
        this.elements.youtubeContainer.style.display = 'block';
        this.startTimeUpdateLoop();
        
        // 開始位置が設定されていれば移動
        if (this.startTime > 0) {
            this.seekTo(this.startTime);
        }
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput.value}: YouTube動画を読み込みました`, 'success');
    }

    handleYoutubeStateChange(event) {
        const states = {
            [-1]: 'unstarted',
            [0]: 'ended',
            [1]: 'playing',
            [2]: 'paused',
            [3]: 'buffering',
            [5]: 'cued'
        };
        this.handleStateChange(states[event.data] || 'unknown');
    }

    handleYoutubeError(event) {
        const errors = {
            2: '無効なパラメータ',
            5: 'HTMLプレイヤーエラー',
            100: '動画が見つかりません',
            101: '埋め込み再生が許可されていません',
            150: '埋め込み再生が許可されていません'
        };
        Toast.show(`YouTube エラー: ${errors[event.data] || '不明なエラー'}`, 'error');
    }

    loadLocalFile(file) {
        this.cleanup();
        this.type = 'local';
        this.videoUrl = file.name;

        this.elements.placeholder.style.display = 'none';
        this.elements.youtubeContainer.style.display = 'none';
        this.elements.video.style.display = 'block';

        const url = URL.createObjectURL(file);
        this.elements.video.src = url;
        this.videoElement = this.elements.video;
        
        // パフォーマンス最適化
        this.elements.video.preload = 'auto';
    }

    handleVideoLoaded() {
        this.isReady = true;
        
        // 開始位置が設定されていれば移動
        if (this.startTime > 0) {
            this.seekTo(this.startTime);
        }
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput.value}: ローカル動画を読み込みました`, 'success');
    }

    handleTimeUpdate() {
        const currentTime = this.getCurrentTime();
        const duration = this.getDuration();
        
        // 時間表示更新
        this.elements.timeDisplay.textContent = this.formatTime(currentTime);
        
        // シークバー更新（ドラッグ中でなければ）
        if (duration > 0 && !this.elements.seekbar.matches(':active')) {
            this.elements.seekbar.value = (currentTime / duration) * 100;
        }
        
        // 音量アイコン更新
        this.updateVolumeIcon();

        this.onTimeUpdate(currentTime, this);
    }

    updateVolumeIcon() {
        const volume = parseInt(this.elements.volumeSlider.value);
        let icon = '🔊';
        if (volume === 0) icon = '🔇';
        else if (volume < 50) icon = '🔉';
        this.elements.volumeIcon.textContent = icon;
    }

    handleStateChange(state) {
        const icon = this.elements.playPauseBtn.querySelector('.play-icon');
        if (state === 'playing') {
            icon.textContent = '⏸️';
        } else {
            icon.textContent = '▶️';
        }

        this.onStateChange(state, this);
    }

    startTimeUpdateLoop() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }

        // パフォーマンス最適化: 更新間隔を調整
        this.timeUpdateInterval = setInterval(() => {
            if (this.type === 'youtube' && this.youtubePlayer && this.isReady) {
                this.handleTimeUpdate();
            }
        }, 100);
    }

    // ========================================
    // プレイヤー制御メソッド
    // ========================================

    play() {
        if (!this.isReady) return;

        if (this.type === 'youtube' && this.youtubePlayer) {
            this.youtubePlayer.playVideo();
        } else if (this.type === 'local' && this.elements.video) {
            this.elements.video.play();
        }
    }

    pause() {
        if (!this.isReady) return;

        if (this.type === 'youtube' && this.youtubePlayer) {
            this.youtubePlayer.pauseVideo();
        } else if (this.type === 'local' && this.elements.video) {
            this.elements.video.pause();
        }
    }

    togglePlayPause() {
        if (this.isPlaying()) {
            this.pause();
        } else {
            this.play();
        }
    }

    isPlaying() {
        if (!this.isReady) return false;

        if (this.type === 'youtube' && this.youtubePlayer) {
            return this.youtubePlayer.getPlayerState() === 1;
        } else if (this.type === 'local' && this.elements.video) {
            return !this.elements.video.paused;
        }
        return false;
    }

    getCurrentTime() {
        if (!this.isReady) return 0;

        if (this.type === 'youtube' && this.youtubePlayer) {
            return this.youtubePlayer.getCurrentTime() || 0;
        } else if (this.type === 'local' && this.elements.video) {
            return this.elements.video.currentTime || 0;
        }
        return 0;
    }

    getDuration() {
        if (!this.isReady) return 0;

        if (this.type === 'youtube' && this.youtubePlayer) {
            return this.youtubePlayer.getDuration() || 0;
        } else if (this.type === 'local' && this.elements.video) {
            return this.elements.video.duration || 0;
        }
        return 0;
    }

    seekTo(time) {
        if (!this.isReady) return;

        time = Math.max(0, Math.min(time, this.getDuration()));

        if (this.type === 'youtube' && this.youtubePlayer) {
            this.youtubePlayer.seekTo(time, true);
        } else if (this.type === 'local' && this.elements.video) {
            this.elements.video.currentTime = time;
        }
    }

    frameStep(direction) {
        if (!this.isReady) return;

        const frameTime = 1 / this.frameRate;
        const currentTime = this.getCurrentTime();
        const newTime = currentTime + (direction * frameTime);
        
        this.pause();
        this.seekTo(newTime);
    }

    setVolume(volume) {
        if (!this.isReady) return;

        volume = Math.max(0, Math.min(1, volume));

        if (this.type === 'youtube' && this.youtubePlayer) {
            this.youtubePlayer.setVolume(volume * 100);
        } else if (this.type === 'local' && this.elements.video) {
            this.elements.video.volume = volume;
        }
        
        this.updateVolumeIcon();
    }

    setPlaybackRate(rate) {
        if (!this.isReady) return;

        if (this.type === 'youtube' && this.youtubePlayer) {
            this.youtubePlayer.setPlaybackRate(rate);
        } else if (this.type === 'local' && this.elements.video) {
            this.elements.video.playbackRate = rate;
        }
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    formatTimeShort(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    cleanup() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }

        if (this.youtubePlayer) {
            try {
                this.youtubePlayer.destroy();
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.youtubePlayer = null;
        }

        if (this.elements.video.src) {
            URL.revokeObjectURL(this.elements.video.src);
            this.elements.video.src = '';
        }

        this.isReady = false;
        this.type = null;
        this.videoUrl = null;
    }
}

// グローバルに公開
window.VideoPlayer = VideoPlayer;
