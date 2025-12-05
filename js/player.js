/**
 * RyounoMe - Player Module
 * Advanced video player with thumbnail strip and caching
 */

class VideoPlayer {
    constructor(key, options = {}) {
        this.key = key;
        this.type = null;
        this.youtubePlayer = null;
        this.videoUrl = null;
        this.isReady = false;
        this.frameRate = options.frameRate || 30;
        this.startTime = 0;
        this.isSeeking = false;
        
        // Callbacks
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onReady = options.onReady || (() => {});
        
        // Throttle
        this.lastTimeUpdate = 0;
        this.timeUpdateThrottle = 33; // ~30fps UI update
        
        // Thumbnail generation
        this.thumbnails = [];
        this.thumbnailCount = 20;
        this.isGeneratingThumbnails = false;
        this.thumbnailWorkerVideo = null;
        
        // Cache status
        this.cacheReady = false;
        
        // YouTube container ID
        this.youtubeContainerId = `player${this.key}Youtube`;
        
        this.initElements();
        this.bindEvents();
        this.loadSavedName();
    }

    initElements() {
        const p = `player${this.key}`;
        
        this.elements = {
            container: document.getElementById(`${p}Container`),
            screen: document.getElementById(`${p}Screen`),
            placeholder: document.getElementById(`${p}Placeholder`),
            video: document.getElementById(`${p}Video`),
            youtubeContainer: document.getElementById(`${p}Youtube`),
            dropzone: document.getElementById(`${p}Dropzone`),
            urlInput: document.getElementById(`${p}Url`),
            loadBtn: document.getElementById(`${p}LoadBtn`),
            fileInput: document.getElementById(`${p}File`),
            playPauseBtn: document.getElementById(`${p}PlayPause`),
            frameBackBtn: document.getElementById(`${p}FrameBack`),
            frameForwardBtn: document.getElementById(`${p}FrameForward`),
            frameBack10Btn: document.getElementById(`${p}FrameBack10`),
            frameForward10Btn: document.getElementById(`${p}FrameForward10`),
            volumeSlider: document.getElementById(`${p}Volume`),
            volumeIcon: document.getElementById(`${p}VolumeIcon`),
            speedSelect: document.getElementById(`${p}Speed`),
            timeDisplay: document.getElementById(`${p}Time`),
            nameInput: document.getElementById(`${p}Name`),
            startTimeInput: document.getElementById(`${p}StartTime`),
            setStartBtn: document.getElementById(`${p}SetStart`),
            // Timeline elements
            timeline: document.getElementById(`${p}Timeline`),
            thumbnailStrip: document.getElementById(`${p}ThumbnailStrip`),
            thumbnailsContainer: document.getElementById(`${p}Thumbnails`),
            seekWrapper: document.getElementById(`${p}SeekWrapper`),
            seekPreview: document.getElementById(`${p}SeekPreview`),
            previewCanvas: document.getElementById(`${p}PreviewCanvas`),
            previewTime: document.getElementById(`${p}PreviewTime`),
            seekProgress: document.getElementById(`${p}Progress`),
            seekBuffer: document.getElementById(`${p}Buffer`),
            seekThumb: document.getElementById(`${p}Thumb`),
            currentTimeDisplay: document.getElementById(`${p}CurrentTime`),
            durationDisplay: document.getElementById(`${p}Duration`),
            cacheStatus: document.getElementById(`${p}CacheStatus`)
        };
        
        // Preview canvas context
        if (this.elements.previewCanvas) {
            this.previewCtx = this.elements.previewCanvas.getContext('2d');
        }
    }

    bindEvents() {
        // URL load
        this.elements.loadBtn?.addEventListener('click', () => this.loadFromUrl());
        this.elements.urlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadFromUrl();
        });

        // File input
        this.elements.fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadLocalFile(e.target.files[0]);
            }
        });

        // Drag & Drop
        this.setupDragDrop();

        // Playback controls
        this.elements.playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
        this.elements.frameBackBtn?.addEventListener('click', () => this.frameStep(-1));
        this.elements.frameForwardBtn?.addEventListener('click', () => this.frameStep(1));
        this.elements.frameBack10Btn?.addEventListener('click', () => this.frameStep(-10));
        this.elements.frameForward10Btn?.addEventListener('click', () => this.frameStep(10));

        // Volume
        this.elements.volumeSlider?.addEventListener('input', (e) => {
            this.setVolume(parseInt(e.target.value) / 100);
        });
        
        this.elements.volumeIcon?.addEventListener('click', () => {
            const current = parseInt(this.elements.volumeSlider.value);
            if (current > 0) {
                this.elements.volumeSlider.dataset.prev = current;
                this.elements.volumeSlider.value = 0;
                this.setVolume(0);
            } else {
                const prev = this.elements.volumeSlider.dataset.prev || 100;
                this.elements.volumeSlider.value = prev;
                this.setVolume(prev / 100);
            }
        });

        // Speed
        this.elements.speedSelect?.addEventListener('change', (e) => {
            this.setPlaybackRate(parseFloat(e.target.value));
        });

        // Seekbar
        this.setupSeekbar();

        // Start position
        this.elements.setStartBtn?.addEventListener('click', () => this.captureStartTime());
        this.elements.startTimeInput?.addEventListener('change', (e) => {
            this.startTime = this.parseTimeInput(e.target.value);
        });

        // Name
        this.elements.nameInput?.addEventListener('change', (e) => {
            this.saveName(e.target.value);
        });

        // Video events
        const video = this.elements.video;
        if (video) {
            video.addEventListener('timeupdate', () => this.throttledTimeUpdate());
            video.addEventListener('play', () => this.handleStateChange('playing'));
            video.addEventListener('pause', () => this.handleStateChange('paused'));
            video.addEventListener('ended', () => this.handleStateChange('ended'));
            video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
            video.addEventListener('progress', () => this.updateBuffer());
            video.addEventListener('canplaythrough', () => this.updateCacheStatus(true));
        }
        
        // Click to play/pause
        this.elements.screen?.addEventListener('click', (e) => {
            if (!e.target.closest('.timeline-container')) {
                this.togglePlayPause();
            }
        });
    }

    setupDragDrop() {
        const screen = this.elements.screen;
        const dropzone = this.elements.dropzone;
        const container = this.elements.container;

        [screen, container].forEach(el => {
            if (!el) return;
            
            el.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone?.classList.add('active');
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            el.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!el.contains(e.relatedTarget)) {
                    dropzone?.classList.remove('active');
                }
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone?.classList.remove('active');
                
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('video/')) {
                    this.loadLocalFile(file);
                } else if (file) {
                    Toast.show('動画ファイルをドロップしてください', 'error');
                }
            });
        });
    }

    setupSeekbar() {
        const wrapper = this.elements.seekWrapper;
        if (!wrapper) return;
        
        let isDragging = false;
        
        const getPercent = (e) => {
            const rect = wrapper.getBoundingClientRect();
            return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        };

        wrapper.addEventListener('mousemove', (e) => {
            if (!this.isReady) return;
            const percent = getPercent(e);
            const time = percent * this.getDuration();
            this.updatePreview(percent, time);
            
            if (isDragging) {
                this.seekTo(time);
                this.updateSeekbarUI(percent);
            }
        });
        
        wrapper.addEventListener('mousedown', (e) => {
            if (!this.isReady) return;
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            this.isSeeking = true;
            this.elements.seekPreview?.classList.add('active');
            
            const percent = getPercent(e);
            const time = percent * this.getDuration();
            this.seekTo(time);
            this.updateSeekbarUI(percent);
            this.updatePreview(percent, time);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isSeeking = false;
                this.elements.seekPreview?.classList.remove('active');
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.isReady) return;
            const percent = getPercent(e);
            const time = percent * this.getDuration();
            this.seekTo(time);
            this.updateSeekbarUI(percent);
            this.updatePreview(percent, time);
        });
        
        // Also handle thumbnail strip clicks
        this.elements.thumbnailStrip?.addEventListener('click', (e) => {
            if (!this.isReady) return;
            const rect = this.elements.thumbnailStrip.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = percent * this.getDuration();
            this.seekTo(time);
        });
    }
    
    updatePreview(percent, time) {
        const preview = this.elements.seekPreview;
        const wrapper = this.elements.seekWrapper;
        if (!preview || !wrapper) return;
        
        const rect = wrapper.getBoundingClientRect();
        const x = percent * rect.width;
        const clampedX = Math.max(60, Math.min(rect.width - 60, x));
        preview.style.left = `${clampedX}px`;
        
        if (this.elements.previewTime) {
            this.elements.previewTime.textContent = this.formatTimeShort(time);
        }
        
        // Draw preview thumbnail for local video
        if (this.type === 'local' && this.previewCtx && this.elements.video) {
            this.drawPreviewFrame(time);
        }
    }
    
    drawPreviewFrame(time) {
        // Use worker video for preview
        if (!this.thumbnailWorkerVideo) return;
        
        const video = this.thumbnailWorkerVideo;
        if (Math.abs(video.currentTime - time) > 0.5) {
            video.currentTime = time;
        }
        
        try {
            this.previewCtx.drawImage(video, 0, 0, 120, 68);
        } catch (e) {}
    }
    
    updateSeekbarUI(percent) {
        if (this.elements.seekProgress) {
            this.elements.seekProgress.style.width = `${percent * 100}%`;
        }
        if (this.elements.seekThumb) {
            this.elements.seekThumb.style.left = `${percent * 100}%`;
        }
    }
    
    updateBuffer() {
        if (!this.isReady || this.type !== 'local') return;
        
        const video = this.elements.video;
        if (video?.buffered.length > 0) {
            const buffered = video.buffered.end(video.buffered.length - 1);
            const percent = (buffered / video.duration) * 100;
            if (this.elements.seekBuffer) {
                this.elements.seekBuffer.style.width = `${percent}%`;
            }
        }
    }
    
    updateCacheStatus(ready) {
        this.cacheReady = ready;
        const status = this.elements.cacheStatus;
        if (status) {
            const indicator = status.querySelector('.cache-indicator');
            const text = status.querySelector('span:last-child');
            if (ready) {
                indicator?.classList.add('ready');
                if (text) text.textContent = 'キャッシュ: 完了';
            } else {
                indicator?.classList.remove('ready');
                if (text) text.textContent = 'キャッシュ: 読込中';
            }
        }
    }

    // Thumbnail Strip Generation
    async generateThumbnailStrip() {
        if (this.type !== 'local' || !this.elements.video || this.isGeneratingThumbnails) return;
        
        this.isGeneratingThumbnails = true;
        const container = this.elements.thumbnailsContainer;
        if (!container) return;
        
        container.innerHTML = '<div class="thumbnail-loading">サムネイル生成中...</div>';
        
        const video = this.elements.video;
        const duration = video.duration;
        if (!duration || duration === Infinity) {
            container.innerHTML = '<div class="thumbnail-loading">サムネイル生成不可</div>';
            this.isGeneratingThumbnails = false;
            return;
        }
        
        // Create worker video for thumbnail generation
        this.thumbnailWorkerVideo = document.createElement('video');
        this.thumbnailWorkerVideo.src = video.src;
        this.thumbnailWorkerVideo.muted = true;
        this.thumbnailWorkerVideo.preload = 'auto';
        
        await new Promise(resolve => {
            this.thumbnailWorkerVideo.onloadeddata = resolve;
            this.thumbnailWorkerVideo.onerror = resolve;
        });
        
        // Generate thumbnails
        const count = Math.min(this.thumbnailCount, Math.ceil(duration / 5)); // 1 per 5 sec max
        const interval = duration / count;
        const thumbWidth = Math.max(40, this.elements.thumbnailStrip.offsetWidth / count);
        
        container.innerHTML = '';
        this.thumbnails = [];
        
        const canvas = document.createElement('canvas');
        canvas.width = thumbWidth;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        
        for (let i = 0; i < count; i++) {
            const time = i * interval;
            
            try {
                this.thumbnailWorkerVideo.currentTime = time;
                await new Promise(resolve => {
                    this.thumbnailWorkerVideo.onseeked = resolve;
                    setTimeout(resolve, 200); // Fallback timeout
                });
                
                ctx.drawImage(this.thumbnailWorkerVideo, 0, 0, thumbWidth, 40);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'thumbnail-item';
                thumbDiv.style.width = `${thumbWidth}px`;
                thumbDiv.style.backgroundImage = `url(${dataUrl})`;
                container.appendChild(thumbDiv);
                
                this.thumbnails.push({ time, dataUrl });
            } catch (e) {
                console.warn('Thumbnail generation error:', e);
            }
        }
        
        this.isGeneratingThumbnails = false;
        Toast.show('サムネイル生成完了', 'success');
    }

    throttledTimeUpdate() {
        const now = Date.now();
        if (now - this.lastTimeUpdate >= this.timeUpdateThrottle) {
            this.lastTimeUpdate = now;
            this.handleTimeUpdate();
        }
    }

    captureStartTime() {
        this.startTime = this.getCurrentTime();
        if (this.elements.startTimeInput) {
            this.elements.startTimeInput.value = this.formatTimeInput(this.startTime);
        }
        Toast.show('開始位置を設定', 'success');
    }

    parseTimeInput(value) {
        if (!value) return 0;
        const parts = value.split(':').map(p => parseFloat(p) || 0);
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
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
        if (name && this.elements.nameInput) {
            this.elements.nameInput.value = name;
        }
    }

    loadFromUrl() {
        const url = this.elements.urlInput?.value.trim();
        if (!url) {
            Toast.show('URLを入力してください', 'warning');
            return;
        }

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
        for (const p of patterns) {
            const m = url.match(p);
            if (m) return m[1];
        }
        return null;
    }

    loadYoutubeVideo(videoId, originalUrl) {
        this.cleanup();
        this.type = 'youtube';
        this.videoUrl = originalUrl;

        this.elements.placeholder.style.display = 'none';
        this.elements.video.style.display = 'none';
        
        this.recreateYoutubeContainer();
        this.elements.youtubeContainer.style.display = 'block';
        
        // Hide thumbnail strip for YouTube
        if (this.elements.thumbnailsContainer) {
            this.elements.thumbnailsContainer.innerHTML = '<div class="thumbnail-loading">YouTube: サムネイル非対応</div>';
        }

        if (typeof YT === 'undefined' || !YT.Player) {
            Toast.show('YouTube API 読み込み中...', 'info');
            const check = setInterval(() => {
                if (typeof YT !== 'undefined' && YT.Player) {
                    clearInterval(check);
                    this.createYoutubePlayer(videoId);
                }
            }, 100);
        } else {
            this.createYoutubePlayer(videoId);
        }
    }

    recreateYoutubeContainer() {
        const old = this.elements.youtubeContainer;
        if (old) {
            const parent = old.parentElement;
            const newEl = document.createElement('div');
            newEl.id = this.youtubeContainerId;
            newEl.className = 'youtube-player';
            newEl.style.display = 'none';
            parent.insertBefore(newEl, old);
            old.remove();
            this.elements.youtubeContainer = newEl;
        }
    }

    createYoutubePlayer(videoId) {
        if (this.youtubePlayer) {
            try { this.youtubePlayer.destroy(); } catch (e) {}
            this.youtubePlayer = null;
        }

        this.youtubePlayer = new YT.Player(this.youtubeContainerId, {
            videoId,
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

    handleYoutubeReady() {
        this.isReady = true;
        this.startTimeUpdateLoop();
        
        const duration = this.getDuration();
        if (this.elements.durationDisplay) {
            this.elements.durationDisplay.textContent = this.formatTimeShort(duration);
        }
        
        this.updateCacheStatus(true);
        
        if (this.startTime > 0) this.seekTo(this.startTime);
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput?.value || 'Player'}: YouTube読込完了`, 'success');
    }

    handleYoutubeStateChange(event) {
        const states = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };
        this.handleStateChange(states[event.data] || 'unknown');
    }

    handleYoutubeError(event) {
        const errors = { 2: '無効なパラメータ', 100: '動画が見つかりません', 101: '埋め込み不可', 150: '埋め込み不可' };
        Toast.show(`YouTube: ${errors[event.data] || 'エラー'}`, 'error');
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
        this.elements.video.preload = 'auto';
        this.elements.video.load();
        
        this.updateCacheStatus(false);
        Toast.show(`${file.name} 読込中...`, 'info');
    }

    handleVideoLoaded() {
        this.isReady = true;
        
        const duration = this.getDuration();
        if (this.elements.durationDisplay) {
            this.elements.durationDisplay.textContent = this.formatTimeShort(duration);
        }
        
        if (this.startTime > 0) this.seekTo(this.startTime);
        
        // Generate thumbnail strip
        setTimeout(() => this.generateThumbnailStrip(), 500);
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput?.value || 'Player'}: 動画読込完了`, 'success');
    }

    handleTimeUpdate() {
        const time = this.getCurrentTime();
        const duration = this.getDuration();
        
        if (this.elements.timeDisplay) {
            this.elements.timeDisplay.textContent = this.formatTime(time);
        }
        if (this.elements.currentTimeDisplay) {
            this.elements.currentTimeDisplay.textContent = this.formatTimeShort(time);
        }
        
        if (duration > 0 && !this.isSeeking) {
            this.updateSeekbarUI(time / duration);
        }
        
        this.updateVolumeIcon();
        this.onTimeUpdate(time, this);
    }

    updateVolumeIcon() {
        const vol = parseInt(this.elements.volumeSlider?.value || 100);
        let icon = '🔊';
        if (vol === 0) icon = '🔇';
        else if (vol < 50) icon = '🔉';
        if (this.elements.volumeIcon) this.elements.volumeIcon.textContent = icon;
    }

    handleStateChange(state) {
        const icon = this.elements.playPauseBtn?.querySelector('.play-icon');
        if (icon) icon.textContent = state === 'playing' ? '⏸️' : '▶️';
        this.onStateChange(state, this);
    }

    startTimeUpdateLoop() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(() => {
            if (this.type === 'youtube' && this.youtubePlayer && this.isReady) {
                this.handleTimeUpdate();
            }
        }, 100);
    }

    // Player Controls
    play() {
        if (!this.isReady) return;
        if (this.type === 'youtube') this.youtubePlayer?.playVideo();
        else this.elements.video?.play();
    }

    pause() {
        if (!this.isReady) return;
        if (this.type === 'youtube') this.youtubePlayer?.pauseVideo();
        else this.elements.video?.pause();
    }

    togglePlayPause() {
        this.isPlaying() ? this.pause() : this.play();
    }

    isPlaying() {
        if (!this.isReady) return false;
        if (this.type === 'youtube') return this.youtubePlayer?.getPlayerState() === 1;
        return this.elements.video && !this.elements.video.paused;
    }

    getCurrentTime() {
        if (!this.isReady) return 0;
        try {
            if (this.type === 'youtube') return this.youtubePlayer?.getCurrentTime() || 0;
            return this.elements.video?.currentTime || 0;
        } catch { return 0; }
    }

    getDuration() {
        if (!this.isReady) return 0;
        try {
            if (this.type === 'youtube') return this.youtubePlayer?.getDuration() || 0;
            return this.elements.video?.duration || 0;
        } catch { return 0; }
    }

    seekTo(time) {
        if (!this.isReady) return;
        const dur = this.getDuration();
        if (dur === 0) return;
        time = Math.max(0, Math.min(time, dur));
        
        if (this.type === 'youtube') this.youtubePlayer?.seekTo(time, true);
        else if (this.elements.video) this.elements.video.currentTime = time;
    }

    frameStep(frames) {
        if (!this.isReady) return;
        const frameTime = 1 / this.frameRate;
        const newTime = this.getCurrentTime() + (frames * frameTime);
        this.pause();
        this.seekTo(newTime);
    }

    setVolume(vol) {
        vol = Math.max(0, Math.min(1, vol));
        if (this.type === 'youtube' && this.youtubePlayer && this.isReady) {
            this.youtubePlayer.setVolume(vol * 100);
        } else if (this.elements.video) {
            this.elements.video.volume = vol;
        }
        this.updateVolumeIcon();
    }

    setPlaybackRate(rate) {
        if (!this.isReady) return;
        if (this.type === 'youtube') this.youtubePlayer?.setPlaybackRate(rate);
        else if (this.elements.video) this.elements.video.playbackRate = rate;
    }

    formatTime(s) {
        if (isNaN(s)) s = 0;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 1000);
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;
    }

    formatTimeShort(s) {
        if (isNaN(s)) s = 0;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        return `${m}:${sec.toString().padStart(2,'0')}`;
    }

    cleanup() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }

        if (this.youtubePlayer) {
            try { this.youtubePlayer.destroy(); } catch {}
            this.youtubePlayer = null;
        }

        if (this.elements.video?.src) {
            this.elements.video.pause();
            URL.revokeObjectURL(this.elements.video.src);
            this.elements.video.src = '';
            this.elements.video.load();
        }
        
        if (this.thumbnailWorkerVideo) {
            this.thumbnailWorkerVideo.src = '';
            this.thumbnailWorkerVideo = null;
        }

        // Reset UI
        if (this.elements.seekProgress) this.elements.seekProgress.style.width = '0%';
        if (this.elements.seekBuffer) this.elements.seekBuffer.style.width = '0%';
        if (this.elements.seekThumb) this.elements.seekThumb.style.left = '0%';
        if (this.elements.currentTimeDisplay) this.elements.currentTimeDisplay.textContent = '0:00';
        if (this.elements.durationDisplay) this.elements.durationDisplay.textContent = '0:00';
        
        this.thumbnails = [];
        this.isGeneratingThumbnails = false;
        this.cacheReady = false;
        this.isReady = false;
        this.type = null;
        this.videoUrl = null;
    }
}

window.VideoPlayer = VideoPlayer;
