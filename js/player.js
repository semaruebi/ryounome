/**
 * RyounoMe - Player Module
 * 動画プレイヤーの管理（YouTube / ローカルファイル対応）
 */

class VideoPlayer {
    constructor(key, options = {}) {
        this.key = key; // 'A' or 'B'
        this.type = null; // 'youtube' or 'local'
        this.videoElement = null;
        this.youtubePlayer = null;
        this.videoUrl = null;
        this.isReady = false;
        this.frameRate = options.frameRate || 30; // デフォルト30fps
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onReady = options.onReady || (() => {});
        
        this.initElements();
        this.bindEvents();
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
            speedSelect: document.getElementById(`${prefix}Speed`),
            seekbar: document.getElementById(`${prefix}Seek`),
            timeDisplay: document.getElementById(`${prefix}Time`)
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

        // 再生速度
        this.elements.speedSelect.addEventListener('change', (e) => {
            this.setPlaybackRate(parseFloat(e.target.value));
        });

        // シークバー
        this.elements.seekbar.addEventListener('input', (e) => {
            const duration = this.getDuration();
            if (duration > 0) {
                const time = (parseFloat(e.target.value) / 100) * duration;
                this.seekTo(time);
            }
        });

        // ローカルビデオのイベント
        this.elements.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.elements.video.addEventListener('play', () => this.handleStateChange('playing'));
        this.elements.video.addEventListener('pause', () => this.handleStateChange('paused'));
        this.elements.video.addEventListener('ended', () => this.handleStateChange('ended'));
        this.elements.video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
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

        // YouTube Player APIが読み込まれていることを確認
        if (typeof YT === 'undefined' || !YT.Player) {
            Toast.show('YouTube API を読み込み中...', 'warning');
            // APIの読み込みを待つ
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
        // 既存のプレイヤーを破棄
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
                playsinline: 1
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
        this.onReady(this);
        Toast.show(`プレイヤー${this.key}: YouTube動画を読み込みました`, 'success');
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
    }

    handleVideoLoaded() {
        this.isReady = true;
        this.onReady(this);
        Toast.show(`プレイヤー${this.key}: ローカル動画を読み込みました`, 'success');
    }

    handleTimeUpdate() {
        const currentTime = this.getCurrentTime();
        const duration = this.getDuration();
        
        // 時間表示更新
        this.elements.timeDisplay.textContent = this.formatTime(currentTime);
        
        // シークバー更新
        if (duration > 0) {
            this.elements.seekbar.value = (currentTime / duration) * 100;
        }

        this.onTimeUpdate(currentTime, this);
    }

    handleStateChange(state) {
        // 再生ボタンのアイコン更新
        const icon = this.elements.playPauseBtn.querySelector('.play-icon');
        if (state === 'playing') {
            icon.textContent = '⏸️';
        } else {
            icon.textContent = '▶️';
        }

        this.onStateChange(state, this);
    }

    startTimeUpdateLoop() {
        // YouTube用のタイムアップデートループ
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

