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
        this.initProjects(); // Initialize projects first
        this.initPlayers();
        this.initSync();
        this.initComments();
        this.loadCurrentProject(); // Load project data after everything is ready
        this.initUI();
        this.initSidebar();
        this.bindKeyboardShortcuts();
        
        console.log('RyounoMe initialized');
        Toast.show('RyounoMe 起動', 'success');
    }

    // ==================== Project Management ====================

    initProjects() {
        // Start with no project loaded (fresh state)
        this.currentProjectId = null;
        this.currentProjectName = null;
        this.isModified = false;
        
        this.projectNameDisplay = document.getElementById('currentProjectName');
        this.loadProjectModal = document.getElementById('loadProjectModal');
        this.projectListContainer = document.getElementById('projectList');
        
        this.updateProjectNameDisplay();
        this.bindProjectEvents();
    }

    updateProjectNameDisplay() {
        if (this.projectNameDisplay) {
            if (this.currentProjectName) {
                this.projectNameDisplay.textContent = this.currentProjectName + (this.isModified ? ' *' : '');
            } else {
                this.projectNameDisplay.textContent = '新規';
            }
        }
    }

    bindProjectEvents() {
        // Save project button - save with name
        document.getElementById('saveProjectBtn')?.addEventListener('click', () => {
            this.saveProjectWithName();
        });

        // Load project button - show modal
        document.getElementById('loadProjectBtn')?.addEventListener('click', () => {
            this.showLoadProjectModal();
        });

        // New project button - clear everything
        document.getElementById('newProjectBtn')?.addEventListener('click', () => {
            if (this.isModified) {
                if (!confirm('保存されていない変更があります。新規作成しますか？')) {
                    return;
                }
            }
            this.createNewProject();
        });

        // Modal close buttons
        document.getElementById('closeLoadModal')?.addEventListener('click', () => {
            this.hideLoadProjectModal();
        });
        document.getElementById('cancelLoadBtn')?.addEventListener('click', () => {
            this.hideLoadProjectModal();
        });
        
        // Close modal on backdrop click
        this.loadProjectModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
            this.hideLoadProjectModal();
        });
    }

    saveProjectWithName() {
        // Prompt for project name
        const defaultName = this.currentProjectName || `RUN-${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}`;
        const name = prompt('プロジェクト名を入力:', defaultName);
        
        if (!name) return;
        
        // Check if name already exists
        const projects = Storage.getAllProjects();
        const existing = projects.find(p => p.name === name);
        
        if (existing && existing.id !== this.currentProjectId) {
            if (!confirm(`"${name}" は既に存在します。上書きしますか？`)) {
                return;
            }
            // Delete existing project
            Storage.deleteProject(existing.id);
        }
        
        // Create or update project
        let project;
        if (this.currentProjectId && this.currentProjectName === name) {
            // Update existing
            project = Storage.getCurrentProject();
        } else {
            // Create new
            project = Storage.createProject(name);
        }
        
        this.currentProjectId = project.id;
        this.currentProjectName = name;
        Storage.setCurrentProject(project.id);
        
        // Save all current state
        this.saveCurrentProjectState();
        
        // Save comments
        if (this.commentsController) {
            Storage.saveComments(this.commentsController.comments);
        }
        
        // Save sync settings
        if (this.syncController) {
            this.syncController.saveSettings();
        }
        
        this.isModified = false;
        this.updateProjectNameDisplay();
        Toast.show(`"${name}" を保存しました`, 'success');
    }

    showLoadProjectModal() {
        const projects = Storage.getAllProjects();
        
        if (projects.length === 0) {
            Toast.show('保存されたプロジェクトはありません', 'info');
            return;
        }
        
        // Build project list
        this.projectListContainer.innerHTML = projects.map(p => `
            <div class="project-item" data-id="${p.id}">
                <div class="project-item-info">
                    <span class="project-item-name">${p.name}</span>
                    <span class="project-item-date">${new Date(p.updatedAt || p.createdAt).toLocaleDateString('ja-JP')}</span>
                </div>
                <div class="project-item-actions">
                    <button class="btn btn-small btn-primary load-btn" data-id="${p.id}">読込</button>
                    <button class="btn btn-small btn-ghost delete-btn" data-id="${p.id}" title="削除">🗑️</button>
                </div>
            </div>
        `).join('');
        
        // Bind load buttons
        this.projectListContainer.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const projectId = e.target.dataset.id;
                this.loadProject(projectId);
                this.hideLoadProjectModal();
            });
        });
        
        // Bind delete buttons
        this.projectListContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const projectId = e.target.dataset.id;
                const project = projects.find(p => p.id === projectId);
                if (project && confirm(`"${project.name}" を削除しますか？`)) {
                    Storage.deleteProject(projectId);
                    this.showLoadProjectModal(); // Refresh list
                    Toast.show('削除しました', 'success');
                }
            });
        });
        
        this.loadProjectModal.classList.add('open');
    }

    hideLoadProjectModal() {
        this.loadProjectModal?.classList.remove('open');
    }

    loadProject(projectId) {
        if (this.isModified) {
            if (!confirm('保存されていない変更があります。読み込みますか？')) {
                return;
            }
        }
        
        Storage.setCurrentProject(projectId);
        const project = Storage.getCurrentProject();
        
        this.currentProjectId = projectId;
        this.currentProjectName = project.name;
        this.isModified = false;
        
        this.loadCurrentProject();
        this.updateProjectNameDisplay();
        Toast.show(`"${project.name}" を読み込みました`, 'success');
    }

    createNewProject() {
        // Clear everything to fresh state
        this.currentProjectId = null;
        this.currentProjectName = null;
        this.isModified = false;
        
        // Clear players
        this.clearAllPlayers();
        
        // Clear comments
        if (this.commentsController) {
            this.commentsController.comments = [];
            this.commentsController.render();
        }
        
        // Reset sync settings
        if (this.syncController) {
            this.syncController.reset();
        }
        
        this.updateProjectNameDisplay();
        Toast.show('新規プロジェクトを作成', 'success');
    }

    markAsModified() {
        this.isModified = true;
        this.updateProjectNameDisplay();
    }

    switchProject(projectId) {
        // Save current player sources before switching
        this.saveCurrentProjectState();
        
        Storage.setCurrentProject(projectId);
        this.loadCurrentProject();
        Toast.show('プロジェクトを切替', 'info');
    }

    saveCurrentProjectState() {
        // Save player A state
        if (this.playerA) {
            let sourceA = this.playerA.videoUrl || '';
            
            // If local file, prompt for folder path
            if (this.playerA.type === 'local' && this.playerA.videoUrl) {
                if (!this.playerA.localFilePath) {
                    sourceA = this.promptForLocalFilePath('A', this.playerA.videoUrl);
                    this.playerA.localFilePath = sourceA;
                } else {
                    sourceA = this.playerA.localFilePath;
                }
            }
            
            Storage.savePlayerData('A', {
                source: sourceA,
                sourceType: this.playerA.type || '',
                startMarker: this.playerA.startMarker,
                endMarker: this.playerA.endMarker
            });
        }
        // Save player B state
        if (this.playerB) {
            let sourceB = this.playerB.videoUrl || '';
            
            // If local file, prompt for folder path
            if (this.playerB.type === 'local' && this.playerB.videoUrl) {
                if (!this.playerB.localFilePath) {
                    sourceB = this.promptForLocalFilePath('B', this.playerB.videoUrl);
                    this.playerB.localFilePath = sourceB;
                } else {
                    sourceB = this.playerB.localFilePath;
                }
            }
            
            Storage.savePlayerData('B', {
                source: sourceB,
                sourceType: this.playerB.type || '',
                startMarker: this.playerB.startMarker,
                endMarker: this.playerB.endMarker
            });
        }
    }
    
    promptForLocalFilePath(playerKey, fileName) {
        // Get last used folder from localStorage
        const lastFolder = localStorage.getItem('ryounome_lastVideoFolder') || 'E:\\Videos';
        
        const inputFolder = prompt(
            `プレイヤー${playerKey} の動画フォルダを入力してください:\n` +
            `ファイル名: ${fileName}\n` +
            `（例: E:\\Videos）`,
            lastFolder
        );
        
        if (inputFolder) {
            // Save as last used folder
            localStorage.setItem('ryounome_lastVideoFolder', inputFolder);
            
            // Combine folder + filename
            // Ensure folder ends without backslash, then add one
            const folder = inputFolder.replace(/\\$/, '');
            return `${folder}\\${fileName}`;
        }
        
        return fileName;
    }

    clearAllPlayers() {
        // Clear player A
        if (this.playerA) {
            this.playerA.cleanup();
            this.playerA.elements.urlInput.value = '';
            this.playerA.videoUrl = null;
            this.playerA.localFilePath = null;
            this.playerA.type = null;
            this.playerA.startMarker = null;
            this.playerA.endMarker = null;
            this.playerA.updateMarkerDisplay();
            this.playerA.elements.placeholder.style.display = 'flex';
            this.playerA.elements.video.style.display = 'none';
            this.playerA.elements.youtubeContainer.style.display = 'none';
            if (this.playerA.elements.thumbnailsContainer) {
                this.playerA.elements.thumbnailsContainer.innerHTML = '';
            }
        }
        
        // Clear player B
        if (this.playerB) {
            this.playerB.cleanup();
            this.playerB.elements.urlInput.value = '';
            this.playerB.videoUrl = null;
            this.playerB.localFilePath = null;
            this.playerB.type = null;
            this.playerB.startMarker = null;
            this.playerB.endMarker = null;
            this.playerB.updateMarkerDisplay();
            this.playerB.elements.placeholder.style.display = 'flex';
            this.playerB.elements.video.style.display = 'none';
            this.playerB.elements.youtubeContainer.style.display = 'none';
            if (this.playerB.elements.thumbnailsContainer) {
                this.playerB.elements.thumbnailsContainer.innerHTML = '';
            }
        }
        
        // Clear sync panel start positions
        const startPosA = document.getElementById('playerAStartPos');
        const startPosB = document.getElementById('playerBStartPos');
        if (startPosA) startPosA.value = '0:00';
        if (startPosB) startPosB.value = '0:00';
    }

    loadCurrentProject() {
        const project = Storage.getCurrentProject();
        console.log('loadCurrentProject:', project);
        if (!project) return;

        // Load player A
        const playerAData = project.playerA;
        console.log('playerAData:', playerAData);
        if (playerAData && this.playerA) {
            // Set markers first
            this.playerA.startMarker = playerAData.startMarker ?? null;
            this.playerA.endMarker = playerAData.endMarker ?? null;
            this.playerA.updateMarkerDisplay();
            
            if (playerAData.source) {
                this.playerA.elements.urlInput.value = playerAData.source;
                
                if (playerAData.sourceType === 'youtube') {
                    // Auto-load YouTube
                    this.playerA.loadFromUrl();
                } else if (playerAData.sourceType === 'local') {
                    // Restore stored path
                    this.playerA.localFilePath = playerAData.source;
                    // Prompt to select local file
                    Toast.show(`A: "${playerAData.source}" を選択してください`, 'warning', 4000);
                    this.playerA.elements.fileInput?.click();
                }
            }
        }

        // Load player B
        const playerBData = project.playerB;
        console.log('playerBData:', playerBData);
        if (playerBData && this.playerB) {
            // Set markers first
            this.playerB.startMarker = playerBData.startMarker ?? null;
            this.playerB.endMarker = playerBData.endMarker ?? null;
            this.playerB.updateMarkerDisplay();
            
            if (playerBData.source) {
                this.playerB.elements.urlInput.value = playerBData.source;
                
                if (playerBData.sourceType === 'youtube') {
                    // Auto-load YouTube (with delay to avoid API issues)
                    setTimeout(() => {
                        this.playerB.loadFromUrl();
                    }, 500);
                } else if (playerBData.sourceType === 'local') {
                    // Restore stored path
                    this.playerB.localFilePath = playerBData.source;
                    // Prompt to select local file
                    setTimeout(() => {
                        Toast.show(`B: "${playerBData.source}" を選択してください`, 'warning', 4000);
                        this.playerB.elements.fileInput?.click();
                    }, 1000);
                }
            }
        }

        // Load start positions to sync panel
        const startPosAInput = document.getElementById('playerAStartPos');
        const startPosBInput = document.getElementById('playerBStartPos');
        if (startPosAInput && project.playerA?.startPos) {
            startPosAInput.value = project.playerA.startPos;
        }
        if (startPosBInput && project.playerB?.startPos) {
            startPosBInput.value = project.playerB.startPos;
        }

        // Reload comments
        this.commentsController?.loadComments();
        
        // Reload sync settings
        this.syncController?.loadSettings();
        
        Toast.show(`プロジェクト "${project.name}" を読込`, 'success');
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
        // Theme toggle
        this.initTheme();
        document.getElementById('themeToggleBtn')?.addEventListener('click', () => this.toggleTheme());

        // Help modal
        const helpModal = document.getElementById('helpModal');
        document.getElementById('helpBtn')?.addEventListener('click', () => helpModal.classList.add('active'));
        document.getElementById('closeHelpModal')?.addEventListener('click', () => helpModal.classList.remove('active'));
        helpModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => helpModal.classList.remove('active'));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') helpModal?.classList.remove('active');
        });

        // Export - save state first
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.saveCurrentProjectState();
            if (Storage.exportProject()) {
                Toast.show('プロジェクトをエクスポート', 'success');
            } else {
                Toast.show('エクスポート失敗', 'error');
            }
        });

        // Import
        const importInput = document.getElementById('importFileInput');
        document.getElementById('importBtn')?.addEventListener('click', () => importInput?.click());
        
        importInput?.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            try {
                const result = await Storage.importProject(e.target.files[0]);
                this.updateProjectList();
                if (result.project) {
                    this.loadCurrentProject();
                }
                Toast.show(`インポート完了`, 'success');
            } catch (err) {
                Toast.show(`インポートエラー: ${err.message}`, 'error');
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

    initTheme() {
        const savedTheme = localStorage.getItem('ryounome-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = current === 'light' ? 'dark' : 'light';
        
        // Disable transitions during theme change
        document.body.classList.add('theme-transition-disable');
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ryounome-theme', newTheme);
        this.updateThemeIcon(newTheme);
        
        // Re-enable transitions after paint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.classList.remove('theme-transition-disable');
            });
        });
        
        Toast.show(newTheme === 'dark' ? 'ダークモード' : 'ライトモード', 'info');
    }

    updateThemeIcon(theme) {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = theme === 'dark' ? '☀️' : '🌙';
            btn.title = theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替';
        }
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
