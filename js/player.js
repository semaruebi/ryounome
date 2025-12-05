/**
 * RyounoMe - Player Module
 * 動画プレイヤーの管理（YouTube / ローカルファイル対応）
 * Netflix/YouTube style seekbar with thumbnail preview
 */

class VideoPlayer {
    constructor(key, options = {}) {
        this.key = key; // 'A' or 'B'
        this.type = null; // 'youtube' or 'local'
        this.videoElement = null;
        this.youtubePlayer = null;
        this.videoUrl = null;
        this.youtubeVideoId = null;
        this.isReady = false;
        this.frameRate = options.frameRate || 30;
        this.startTime = 0;
        this.zoomLevel = 1;
        this.isDragging = false;
        
        // Callbacks
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onReady = options.onReady || (() => {});
        
        // Performance: Throttle time updates
        this.lastTimeUpdate = 0;
        this.timeUpdateThrottle = 50;
        
        // Thumbnail generation
        this.thumbnailCanvas = null;
        this.thumbnailCtx = null;
        this.thumbnailVideo = null; // Hidden video for thumbnail generation
        
        this.initElements();
        this.bindEvents();
        this.loadSavedName();
    }

    initElements() {
        const prefix = `player${this.key}`;
        
        this.elements = {
            container: document.getElementById(`${prefix}Container`),
            screen: document.getElementById(`${prefix}Screen`),
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
            zoomSlider: document.getElementById(`${prefix}Zoom`),
            zoomIndicator: document.getElementById(`${prefix}ZoomIndicator`),
            timeDisplay: document.getElementById(`${prefix}Time`),
            nameInput: document.getElementById(`${prefix}Name`),
            startTimeInput: document.getElementById(`${prefix}StartTime`),
            setStartBtn: document.getElementById(`${prefix}SetStart`),
            // Overlay elements
            overlay: document.getElementById(`${prefix}Overlay`),
            seekWrapper: document.getElementById(`${prefix}SeekWrapper`),
            progress: document.getElementById(`${prefix}Progress`),
            thumb: document.getElementById(`${prefix}Thumb`),
            thumbnail: document.getElementById(`${prefix}Thumbnail`),
            thumbnailCanvas: document.getElementById(`${prefix}ThumbnailCanvas`),
            thumbnailTime: document.getElementById(`${prefix}ThumbnailTime`),
            currentTimeDisplay: document.getElementById(`${prefix}CurrentTime`),
            durationDisplay: document.getElementById(`${prefix}Duration`)
        };
        
        // Initialize thumbnail canvas
        this.thumbnailCanvas = this.elements.thumbnailCanvas;
        this.thumbnailCtx = this.thumbnailCanvas.getContext('2d');
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
        
        // 動画クリックで再生/一時停止
        this.elements.screen.addEventListener('click', (e) => {
            // シークバー操作中は無視
            if (e.target.closest('.overlay-seekbar-wrapper')) return;
            this.togglePlayPause();
        });

        // 音量
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(parseInt(e.target.value) / 100);
        });
        
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

        // オーバーレイシークバー
        this.setupOverlaySeekbar();

        // ズームレベル
        this.elements.zoomSlider.addEventListener('input', (e) => {
            this.zoomLevel = parseInt(e.target.value);
            this.updateZoomIndicator();
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

        // ローカルビデオのイベント
        this.elements.video.addEventListener('timeupdate', () => {
            this.throttledTimeUpdate();
        });
        this.elements.video.addEventListener('play', () => this.handleStateChange('playing'));
        this.elements.video.addEventListener('pause', () => this.handleStateChange('paused'));
        this.elements.video.addEventListener('ended', () => this.handleStateChange('ended'));
        this.elements.video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
        
        this.elements.video.addEventListener('seeking', () => {
            this.elements.container.classList.add('seeking');
        });
        this.elements.video.addEventListener('seeked', () => {
            this.elements.container.classList.remove('seeking');
        });
    }

    setupOverlaySeekbar() {
        const wrapper = this.elements.seekWrapper;
        const track = wrapper.querySelector('.overlay-seekbar-track');
        
        // マウスムーブでサムネイルプレビュー
        wrapper.addEventListener('mousemove', (e) => {
            if (!this.isReady) return;
            
            const rect = track.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            
            // サムネイルプレビューを更新
            this.updateThumbnailPreview(time, e.clientX - rect.left, rect.width);
            
            // ドラッグ中はシーク
            if (this.isDragging) {
                this.seekTo(time);
                this.updateProgressBar(percent);
            }
        });
        
        // マウスダウンでドラッグ開始
        wrapper.addEventListener('mousedown', (e) => {
            if (!this.isReady) return;
            
            this.isDragging = true;
            this.elements.overlay.classList.add('active');
            
            const rect = track.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            
            this.seekTo(time);
            this.updateProgressBar(percent);
        });
        
        // マウスアップでドラッグ終了
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.elements.overlay.classList.remove('active');
            }
        });
        
        // マウスがドキュメント上を移動中もドラッグを追跡
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.isReady) return;
            
            const rect = track.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            
            this.seekTo(time);
            this.updateProgressBar(percent);
            this.updateThumbnailPreview(time, e.clientX - rect.left, rect.width);
        });
        
        // タッチサポート
        wrapper.addEventListener('touchstart', (e) => {
            if (!this.isReady) return;
            e.preventDefault();
            
            this.isDragging = true;
            this.elements.overlay.classList.add('active');
            
            const rect = track.getBoundingClientRect();
            const touch = e.touches[0];
            const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            
            this.seekTo(time);
            this.updateProgressBar(percent);
        }, { passive: false });
        
        wrapper.addEventListener('touchmove', (e) => {
            if (!this.isDragging || !this.isReady) return;
            e.preventDefault();
            
            const rect = track.getBoundingClientRect();
            const touch = e.touches[0];
            const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            
            this.seekTo(time);
            this.updateProgressBar(percent);
        }, { passive: false });
        
        wrapper.addEventListener('touchend', () => {
            this.isDragging = false;
            this.elements.overlay.classList.remove('active');
        });
    }

    updateProgressBar(percent) {
        this.elements.progress.style.width = `${percent * 100}%`;
        this.elements.thumb.style.left = `${percent * 100}%`;
    }

    updateThumbnailPreview(time, x, containerWidth) {
        // サムネイル位置を更新
        const thumbnail = this.elements.thumbnail;
        const thumbnailWidth = 160;
        
        // 画面端からはみ出ないように調整
        let left = x;
        if (left < thumbnailWidth / 2) {
            left = thumbnailWidth / 2;
        } else if (left > containerWidth - thumbnailWidth / 2) {
            left = containerWidth - thumbnailWidth / 2;
        }
        
        thumbnail.style.left = `${left}px`;
        this.elements.thumbnailTime.textContent = this.formatTimeShort(time);
        
        // ローカル動画の場合、サムネイルを生成
        if (this.type === 'local' && this.elements.video) {
            this.generateThumbnail(time);
        } else if (this.type === 'youtube' && this.youtubeVideoId) {
            // YouTubeはサムネイル画像を使用
            this.showYoutubeThumbnail(time);
        }
    }

    generateThumbnail(time) {
        // 非同期でサムネイルを生成（パフォーマンス最適化）
        if (this.thumbnailGenerating) return;
        this.thumbnailGenerating = true;
        
        requestAnimationFrame(() => {
            try {
                // 現在の動画からフレームをキャプチャ
                const video = this.elements.video;
                if (video.readyState >= 2) {
                    // 一時的に別の位置に移動せず、現在の再生位置からの相対位置でサムネイルを表示
                    // 実際のサムネイル生成は重いので、現在のフレームを使用
                    this.thumbnailCtx.drawImage(video, 0, 0, 160, 90);
                }
            } catch (e) {
                // Cross-origin issues等を無視
            }
            this.thumbnailGenerating = false;
        });
    }

    showYoutubeThumbnail(time) {
        // YouTubeのサムネイルは動的に取得できないため、
        // ビデオのサムネイル画像を表示
        if (!this.youtubeVideoId) return;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // YouTubeのサムネイルURL（複数の解像度から選択）
        img.src = `https://img.youtube.com/vi/${this.youtubeVideoId}/mqdefault.jpg`;
        
        img.onload = () => {
            this.thumbnailCtx.drawImage(img, 0, 0, 160, 90);
        };
    }

    throttledTimeUpdate() {
        const now = Date.now();
        if (now - this.lastTimeUpdate >= this.timeUpdateThrottle) {
            this.lastTimeUpdate = now;
            this.handleTimeUpdate();
        }
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

    captureStartTime() {
        const currentTime = this.getCurrentTime();
        this.startTime = currentTime;
        this.elements.startTimeInput.value = this.formatTimeInput(currentTime);
        Toast.show('開始位置を設定しました', 'success');
    }

    parseTimeInput(value) {
        if (!value) return 0;
        
        const parts = value.split(':').map(p => parseFloat(p) || 0);
        
        if (parts.length === 1) {
            return parts[0];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length >= 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
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
        this.youtubeVideoId = videoId;

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
                disablekb: 1
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
        
        // 再生時間を表示
        const duration = this.getDuration();
        this.elements.durationDisplay.textContent = `/ ${this.formatTimeShort(duration)}`;
        
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
        this.elements.video.preload = 'auto';
    }

    handleVideoLoaded() {
        this.isReady = true;
        
        // 再生時間を表示
        const duration = this.getDuration();
        this.elements.durationDisplay.textContent = `/ ${this.formatTimeShort(duration)}`;
        
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
        this.elements.currentTimeDisplay.textContent = this.formatTimeShort(currentTime);
        
        // プログレスバー更新（ドラッグ中でなければ）
        if (duration > 0 && !this.isDragging) {
            const percent = currentTime / duration;
            this.updateProgressBar(percent);
        }
        
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

        // ズームレベルに応じてステップ量を調整
        let frameTime = 1 / this.frameRate;
        
        // ズームレベルが高いほど細かく
        if (this.zoomLevel >= 75) {
            frameTime = 0.001; // 1ms
        } else if (this.zoomLevel >= 50) {
            frameTime = 0.01; // 10ms
        } else if (this.zoomLevel >= 25) {
            frameTime = 0.1; // 100ms
        }
        
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
        this.youtubeVideoId = null;
    }
}

// グローバルに公開
window.VideoPlayer = VideoPlayer;
