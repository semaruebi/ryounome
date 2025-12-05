/**
 * RyounoMe - Player Module
 * Advanced video player with playhead indicator and precision control
 */

class VideoPlayer {
    constructor(key, options = {}) {
        this.key = key;
        this.type = null;
        this.youtubePlayer = null;
        this.videoUrl = null;
        this.localFilePath = null; // User-entered file path for local videos
        this.isReady = false;
        this.frameRate = 60; // Default 60fps
        this.startTime = 0;
        this.isSeeking = false;
        this.precision = 50;
        
        // Frame markers
        this.startMarker = null; // Start frame time in seconds
        this.endMarker = null;   // End frame time in seconds
        
        // Callbacks
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onReady = options.onReady || (() => {});
        
        // Throttle
        this.lastTimeUpdate = 0;
        this.timeUpdateThrottle = 33;
        
        // Thumbnail generation
        this.thumbnails = [];
        this.thumbnailCount = 30;
        this.isGeneratingThumbnails = false;
        this.thumbnailWorkerVideo = null;
        
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
            fpsSelect: document.getElementById(`${p}Fps`),
            timeDisplay: document.getElementById(`${p}Time`),
            nameInput: document.getElementById(`${p}Name`),
            container: document.getElementById(`${p}Container`),
            // Marker elements
            setStartBtn: document.getElementById(`${p}SetStart`),
            setEndBtn: document.getElementById(`${p}SetEnd`),
            goStartBtn: document.getElementById(`${p}GoStart`),
            goEndBtn: document.getElementById(`${p}GoEnd`),
            clearStartBtn: document.getElementById(`${p}ClearStart`),
            clearEndBtn: document.getElementById(`${p}ClearEnd`),
            startValue: document.getElementById(`${p}StartValue`),
            endValue: document.getElementById(`${p}EndValue`),
            segmentValue: document.getElementById(`${p}Segment`),
            // Timeline
            timeline: document.getElementById(`${p}Timeline`),
            thumbnailStrip: document.getElementById(`${p}ThumbnailStrip`),
            thumbnailsContainer: document.getElementById(`${p}Thumbnails`),
            playhead: document.getElementById(`${p}Playhead`),
            seekWrapper: document.getElementById(`${p}SeekWrapper`),
            seekPreview: document.getElementById(`${p}SeekPreview`),
            previewCanvas: document.getElementById(`${p}PreviewCanvas`),
            previewTime: document.getElementById(`${p}PreviewTime`),
            seekProgress: document.getElementById(`${p}Progress`),
            seekBuffer: document.getElementById(`${p}Buffer`),
            seekThumb: document.getElementById(`${p}Thumb`),
            currentTimeDisplay: document.getElementById(`${p}CurrentTime`),
            durationDisplay: document.getElementById(`${p}Duration`),
            precisionSlider: document.getElementById(`${p}Precision`),
            precisionValue: document.getElementById(`${p}PrecisionValue`)
        };
        
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
            if (e.target.files.length > 0) this.loadLocalFile(e.target.files[0]);
        });

        // File picker button (for File System Access API) - removed, using reloadFile instead
        
        // Reload file button - opens file picker with path hint
        this.elements.reloadFileBtn = document.getElementById(`player${this.key}ReloadFile`);
        this.elements.reloadFileBtn?.addEventListener('click', () => this.promptFileSelection());

        // Drag & Drop
        this.setupDragDrop();

        // FPS select
        this.elements.fpsSelect?.addEventListener('change', (e) => {
            this.frameRate = parseInt(e.target.value);
            this.updateMarkerDisplay(); // Update frame display with new fps
            Toast.show(`${this.frameRate}fps に設定`, 'success');
        });

        // Marker controls
        this.elements.setStartBtn?.addEventListener('click', () => this.setStartMarker());
        this.elements.setEndBtn?.addEventListener('click', () => this.setEndMarker());
        this.elements.goStartBtn?.addEventListener('click', () => this.goToStartMarker());
        this.elements.goEndBtn?.addEventListener('click', () => this.goToEndMarker());
        this.elements.clearStartBtn?.addEventListener('click', () => this.clearStartMarker());
        this.elements.clearEndBtn?.addEventListener('click', () => this.clearEndMarker());

        // Playback controls
        this.elements.playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
        
        // Step buttons (VidTimer style)
        this.setupStepButtons();

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

        // Precision slider
        this.elements.precisionSlider?.addEventListener('input', (e) => {
            this.precision = parseInt(e.target.value);
            this.updatePrecisionDisplay();
        });
        this.updatePrecisionDisplay();

        // Seekbar & Thumbnail strip
        this.setupSeekbar();

        // Start position
        this.elements.setStartBtn?.addEventListener('click', () => this.captureStartTime());
        this.elements.startTimeInput?.addEventListener('change', (e) => {
            this.startTime = this.parseTimeInput(e.target.value);
        });

        // Name
        this.elements.nameInput?.addEventListener('change', (e) => this.saveName(e.target.value));

        // Video events
        const video = this.elements.video;
        if (video) {
            video.addEventListener('timeupdate', () => this.throttledTimeUpdate());
            video.addEventListener('play', () => this.handleStateChange('playing'));
            video.addEventListener('pause', () => this.handleStateChange('paused'));
            video.addEventListener('ended', () => this.handleStateChange('ended'));
            video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
            video.addEventListener('progress', () => this.updateBuffer());
        }
        
        // Click to play/pause
        this.elements.screen?.addEventListener('click', (e) => {
            if (!e.target.closest('.timeline-container')) this.togglePlayPause();
        });
    }

    updatePrecisionDisplay() {
        if (!this.elements.precisionValue) return;
        
        let label;
        if (this.precision <= 10) label = '1分';
        else if (this.precision <= 25) label = '10秒';
        else if (this.precision <= 50) label = '1秒';
        else if (this.precision <= 75) label = '100ms';
        else label = 'フレーム';
        
        this.elements.precisionValue.textContent = label;
    }

    getSeekStep() {
        // Based on precision, return step in percentage
        if (this.precision <= 10) return 1; // 1%
        if (this.precision <= 25) return 0.1;
        if (this.precision <= 50) return 0.01;
        if (this.precision <= 75) return 0.001;
        return 0.0001; // Frame level
    }

    setupStepButtons() {
        // Find all step buttons in this player's container
        const container = this.elements.container;
        if (!container) return;
        
        const stepBtns = container.querySelectorAll('.step-btn[data-step]');
        stepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const step = btn.dataset.step;
                this.handleStep(step);
            });
        });
    }

    handleStep(step) {
        if (!this.isReady) return;
        
        this.pause();
        
        // Parse step value
        if (step.includes('f')) {
            // Frame step: -1f, +1f, -10f, +10f
            const frames = parseInt(step.replace('f', '').replace('+', ''));
            this.frameStep(frames);
        } else {
            // Second step: -1, +1, -5, +5, -10, +10, -30, +30, -60, +60
            const seconds = parseFloat(step);
            const newTime = this.getCurrentTime() + seconds;
            this.seekTo(newTime);
        }
    }

    // ==================== Marker Methods ====================
    
    setStartMarker() {
        if (!this.isReady) return;
        this.startMarker = this.getCurrentTime();
        this.updateMarkerDisplay();
        
        // Also update sync panel start position
        const syncStartInput = document.getElementById(`player${this.key}StartPos`);
        if (syncStartInput) {
            syncStartInput.value = this.formatTimeInput(this.startMarker);
            // Trigger change event to save
            syncStartInput.dispatchEvent(new Event('change'));
        }
        
        // Save to project
        Storage.savePlayerData(this.key, { startMarker: this.startMarker });
        
        Toast.show('Start marker set', 'success');
    }
    
    setEndMarker() {
        if (!this.isReady) return;
        this.endMarker = this.getCurrentTime();
        this.updateMarkerDisplay();
        
        // Save to project
        Storage.savePlayerData(this.key, { endMarker: this.endMarker });
        
        Toast.show('End marker set', 'success');
    }
    
    goToStartMarker() {
        if (this.startMarker !== null) {
            this.seekTo(this.startMarker);
        }
    }
    
    goToEndMarker() {
        if (this.endMarker !== null) {
            this.seekTo(this.endMarker);
        }
    }
    
    clearStartMarker() {
        this.startMarker = null;
        this.updateMarkerDisplay();
        Storage.savePlayerData(this.key, { startMarker: null });
        Toast.show('Start cleared', 'info');
    }
    
    clearEndMarker() {
        this.endMarker = null;
        this.updateMarkerDisplay();
        Storage.savePlayerData(this.key, { endMarker: null });
        Toast.show('End cleared', 'info');
    }
    
    updateMarkerDisplay() {
        // Update start marker display
        if (this.elements.startValue) {
            if (this.startMarker !== null) {
                this.elements.startValue.textContent = this.formatTimeWithFrames(this.startMarker);
            } else {
                this.elements.startValue.textContent = '--:--:--';
            }
        }
        
        // Update end marker display
        if (this.elements.endValue) {
            if (this.endMarker !== null) {
                this.elements.endValue.textContent = this.formatTimeWithFrames(this.endMarker);
            } else {
                this.elements.endValue.textContent = '--:--:--';
            }
        }
        
        // Update segment duration
        if (this.elements.segmentValue) {
            if (this.startMarker !== null && this.endMarker !== null) {
                const diff = Math.abs(this.endMarker - this.startMarker);
                const frames = Math.round(diff * this.frameRate);
                this.elements.segmentValue.textContent = `${this.formatTimeWithFrames(diff)} (${frames}f)`;
            } else {
                this.elements.segmentValue.textContent = '--';
            }
        }
    }
    
    formatTimeWithFrames(seconds) {
        if (seconds === null || seconds === undefined) return '--:--:--:--';
        
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const frameInSecond = Math.round((seconds - totalSeconds) * this.frameRate);
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frameInSecond.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}:${frameInSecond.toString().padStart(2, '0')}`;
    }

    setupDragDrop() {
        const screen = this.elements.screen;
        const dropzone = this.elements.dropzone;
        const playerContainer = this.elements.container;

        [screen, playerContainer].forEach(el => {
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
                if (!el.contains(e.relatedTarget)) dropzone?.classList.remove('active');
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
        const strip = this.elements.thumbnailStrip;
        if (!wrapper) return;
        
        let isDragging = false;
        
        const getPercent = (e, el) => {
            const rect = el.getBoundingClientRect();
            return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        };

        const handleSeek = (e, el) => {
            if (!this.isReady) return;
            const percent = getPercent(e, el);
            const time = percent * this.getDuration();
            this.seekTo(time);
            this.updatePlayhead(percent);
            this.updateSeekbarUI(percent);
        };

        // Seekbar events
        wrapper.addEventListener('mousemove', (e) => {
            if (!this.isReady) return;
            const percent = getPercent(e, wrapper);
            const time = percent * this.getDuration();
            this.updatePreview(percent, time);
            if (isDragging) handleSeek(e, wrapper);
        });
        
        wrapper.addEventListener('mousedown', (e) => {
            if (!this.isReady) return;
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            this.isSeeking = true;
            this.elements.seekPreview?.classList.add('active');
            handleSeek(e, wrapper);
        });

        // Thumbnail strip click
        strip?.addEventListener('click', (e) => {
            if (!this.isReady) return;
            handleSeek(e, strip);
        });

        // Global mouse events for dragging
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isSeeking = false;
                this.elements.seekPreview?.classList.remove('active');
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.isReady) return;
            const percent = getPercent(e, wrapper);
            const time = percent * this.getDuration();
            this.seekTo(time);
            this.updatePlayhead(percent);
            this.updateSeekbarUI(percent);
            this.updatePreview(percent, time);
        });
    }

    updatePlayhead(percent) {
        if (this.elements.playhead) {
            this.elements.playhead.style.left = `${percent * 100}%`;
            this.elements.playhead.classList.add('active');
        }
        
        // Highlight active thumbnail and scroll strip
        const thumbs = this.elements.thumbnailsContainer?.querySelectorAll('.thumbnail-item');
        const container = this.elements.thumbnailsContainer;
        
        if (thumbs && thumbs.length > 0 && container) {
            const activeIndex = Math.floor(percent * thumbs.length);
            const clampedIndex = Math.max(0, Math.min(activeIndex, thumbs.length - 1));
            
            thumbs.forEach((thumb, i) => {
                thumb.classList.toggle('active', i === clampedIndex);
            });
            
            // Scroll thumbnail strip to keep active thumb visible
            const strip = this.elements.thumbnailStrip;
            if (strip && thumbs[clampedIndex]) {
                const thumbEl = thumbs[clampedIndex];
                const stripRect = strip.getBoundingClientRect();
                const thumbRect = thumbEl.getBoundingClientRect();
                
                // Center the active thumbnail
                const scrollLeft = thumbEl.offsetLeft - (stripRect.width / 2) + (thumbRect.width / 2);
                container.style.transform = `translateX(${-Math.max(0, scrollLeft)}px)`;
            }
        }
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
        
        // Draw preview for local video
        if (this.type === 'local' && this.previewCtx && this.thumbnailWorkerVideo) {
            const video = this.thumbnailWorkerVideo;
            if (Math.abs(video.currentTime - time) > 0.3) {
                video.currentTime = time;
            }
            try {
                this.previewCtx.drawImage(video, 0, 0, 120, 68);
            } catch (e) {}
        }
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
            container.innerHTML = '<div class="thumbnail-loading">生成不可</div>';
            this.isGeneratingThumbnails = false;
            return;
        }
        
        // Create worker video
        this.thumbnailWorkerVideo = document.createElement('video');
        this.thumbnailWorkerVideo.src = video.src;
        this.thumbnailWorkerVideo.muted = true;
        this.thumbnailWorkerVideo.preload = 'auto';
        
        await new Promise(resolve => {
            this.thumbnailWorkerVideo.onloadeddata = resolve;
            this.thumbnailWorkerVideo.onerror = resolve;
        });
        
        // Generate thumbnails
        const count = Math.min(this.thumbnailCount, Math.ceil(duration / 3));
        const interval = duration / count;
        const stripWidth = this.elements.thumbnailStrip?.offsetWidth || 400;
        const thumbWidth = stripWidth / count;
        
        container.innerHTML = '';
        this.thumbnails = [];
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(40, thumbWidth);
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        
        for (let i = 0; i < count; i++) {
            const time = i * interval;
            
            try {
                this.thumbnailWorkerVideo.currentTime = time;
                await new Promise(resolve => {
                    this.thumbnailWorkerVideo.onseeked = resolve;
                    setTimeout(resolve, 150);
                });
                
                ctx.drawImage(this.thumbnailWorkerVideo, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'thumbnail-item';
                thumbDiv.style.width = `${thumbWidth}px`;
                thumbDiv.style.backgroundImage = `url(${dataUrl})`;
                container.appendChild(thumbDiv);
                
                this.thumbnails.push({ time, dataUrl });
            } catch (e) {
                console.warn('Thumbnail error:', e);
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
            Toast.show('URLを入力', 'warning');
            return;
        }

        const videoId = this.extractYoutubeId(url);
        if (videoId) {
            this.loadYoutubeVideo(videoId, url);
        } else {
            Toast.show('無効なURL', 'error');
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

        // Save to project
        Storage.savePlayerData(this.key, {
            source: originalUrl,
            sourceType: 'youtube'
        });

        this.elements.placeholder.style.display = 'none';
        this.elements.video.style.display = 'none';
        
        this.recreateYoutubeContainer();
        this.elements.youtubeContainer.style.display = 'block';
        
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
            try { this.youtubePlayer.destroy(); } catch {}
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
                onReady: () => this.handleYoutubeReady(),
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
        
        if (this.startTime > 0) this.seekTo(this.startTime);
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput?.value || 'Player'}: YouTube読込完了`, 'success');
    }

    handleYoutubeStateChange(event) {
        const states = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };
        this.handleStateChange(states[event.data] || 'unknown');
    }

    handleYoutubeError(event) {
        const errors = { 2: '無効なパラメータ', 100: '動画なし', 101: '埋め込み不可', 150: '埋め込み不可' };
        Toast.show(`YouTube: ${errors[event.data] || 'エラー'}`, 'error');
    }

    // Prompt user to select file (with path hint from saved project)
    promptFileSelection() {
        const savedPath = this.elements.urlInput?.value.trim();
        
        if (savedPath && !savedPath.startsWith('http')) {
            // Show hint about which file to select
            const fileName = savedPath.split(/[\\\/]/).pop(); // Get filename from path
            Toast.show(`"${fileName}" を選択してください`, 'info', 5000);
        }
        
        // Open file picker
        this.openFilePicker();
    }

    // File System Access API - for saving file handles
    async openFilePicker() {
        // Check if File System Access API is supported
        if (!('showOpenFilePicker' in window)) {
            Toast.show('このブラウザはFile System Access APIをサポートしていません', 'warning');
            this.elements.fileInput?.click();
            return;
        }

        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Video Files',
                    accept: { 'video/*': ['.mp4', '.webm', '.mkv', '.avi', '.mov'] }
                }]
            });

            // Store file handle for later use
            this.fileHandle = fileHandle;
            const file = await fileHandle.getFile();
            
            // Save file handle name (can be used to identify the file)
            this.loadLocalFileWithHandle(file, fileHandle.name);
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('File picker error:', err);
                Toast.show('ファイル選択エラー', 'error');
            }
        }
    }

    loadLocalFileWithHandle(file, handleName) {
        this.cleanup();
        this.type = 'local';
        this.videoUrl = handleName || file.name;

        // Save to project with handle info
        Storage.savePlayerData(this.key, {
            source: handleName || file.name,
            sourceType: 'local',
            hasFileHandle: !!this.fileHandle
        });

        this.elements.placeholder.style.display = 'none';
        this.elements.youtubeContainer.style.display = 'none';
        this.elements.video.style.display = 'block';

        const url = URL.createObjectURL(file);
        this.elements.video.src = url;
        this.elements.video.preload = 'auto';
        this.elements.video.load();
        
        Toast.show(`${file.name} 読込中...`, 'info');
    }

    loadLocalFile(file) {
        this.cleanup();
        this.type = 'local';
        this.videoUrl = file.name;
        this.fileHandle = null; // No file handle from regular input

        // Save to project
        Storage.savePlayerData(this.key, {
            source: file.name,
            sourceType: 'local',
            hasFileHandle: false
        });

        this.elements.placeholder.style.display = 'none';
        this.elements.youtubeContainer.style.display = 'none';
        this.elements.video.style.display = 'block';

        const url = URL.createObjectURL(file);
        this.elements.video.src = url;
        this.elements.video.preload = 'auto';
        this.elements.video.load();
        
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
        setTimeout(() => this.generateThumbnailStrip(), 300);
        
        this.onReady(this);
        Toast.show(`${this.elements.nameInput?.value || 'Player'}: 読込完了`, 'success');
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
            const percent = time / duration;
            this.updateSeekbarUI(percent);
            this.updatePlayhead(percent);
        }
        
        // Check end marker - notify sync controller
        if (this.endMarker !== null && this.isPlaying()) {
            if (time >= this.endMarker) {
                // Notify sync controller if available
                if (window.app?.syncController) {
                    window.app.syncController.handleEndReached(this.key);
                } else {
                    // No sync controller, handle locally
                    if (this.startMarker !== null) {
                        this.seekTo(this.startMarker);
                    } else {
                        this.pause();
                        this.seekTo(this.endMarker);
                        Toast.show('End marker reached', 'info');
                    }
                }
            }
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
        if (this.elements.playhead) this.elements.playhead.style.left = '0%';
        if (this.elements.currentTimeDisplay) this.elements.currentTimeDisplay.textContent = '0:00';
        if (this.elements.durationDisplay) this.elements.durationDisplay.textContent = '0:00';
        
        this.thumbnails = [];
        this.isGeneratingThumbnails = false;
        this.isReady = false;
        this.type = null;
        this.videoUrl = null;
        this.localFilePath = null;
    }
}

window.VideoPlayer = VideoPlayer;
