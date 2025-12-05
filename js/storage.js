/**
 * RyounoMe - Storage Module
 * プロジェクト管理とlocalStorage管理
 */

const Storage = {
    KEYS: {
        PROJECTS: 'ryounome_projects',
        CURRENT_PROJECT: 'ryounome_current_project',
        GLOBAL_SETTINGS: 'ryounome_global_settings'
    },

    // ==================== Project Management ====================

    /**
     * 新規プロジェクトを作成
     * @param {string} name - プロジェクト名
     * @returns {Object} 作成されたプロジェクト
     */
    createProject(name) {
        const project = {
            id: this.generateId(),
            name: name || `Project ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Player A
            playerA: {
                source: '', // YouTube URL or file path
                sourceType: '', // 'youtube' or 'local'
                name: 'メイン',
                startPos: '0:00',
                startMarker: null,
                endMarker: null
            },
            // Player B
            playerB: {
                source: '',
                sourceType: '',
                name: 'サブ',
                startPos: '0:00',
                startMarker: null,
                endMarker: null
            },
            // Settings
            settings: {
                syncEnabled: false,
                syncMaster: 'A',
                loopMode: 'loop'
            },
            // Comments
            comments: []
        };

        const projects = this.getAllProjects();
        projects.push(project);
        this.saveAllProjects(projects);
        this.setCurrentProject(project.id);

        return project;
    },

    /**
     * 全プロジェクトを取得
     * @returns {Array} プロジェクト配列
     */
    getAllProjects() {
        try {
            const data = localStorage.getItem(this.KEYS.PROJECTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load projects:', e);
            return [];
        }
    },

    /**
     * 全プロジェクトを保存
     * @param {Array} projects
     */
    saveAllProjects(projects) {
        try {
            localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
            return true;
        } catch (e) {
            console.error('Failed to save projects:', e);
            return false;
        }
    },

    /**
     * 現在のプロジェクトIDを取得
     * @returns {string|null}
     */
    getCurrentProjectId() {
        return localStorage.getItem(this.KEYS.CURRENT_PROJECT);
    },

    /**
     * 現在のプロジェクトIDを設定
     * @param {string} id
     */
    setCurrentProject(id) {
        localStorage.setItem(this.KEYS.CURRENT_PROJECT, id);
    },

    /**
     * 現在のプロジェクトを取得
     * @returns {Object|null}
     */
    getCurrentProject() {
        const id = this.getCurrentProjectId();
        if (!id) return null;
        const projects = this.getAllProjects();
        return projects.find(p => p.id === id) || null;
    },

    /**
     * プロジェクトを更新
     * @param {string} id - プロジェクトID
     * @param {Object} updates - 更新内容
     */
    updateProject(id, updates) {
        const projects = this.getAllProjects();
        const index = projects.findIndex(p => p.id === id);
        if (index !== -1) {
            projects[index] = {
                ...projects[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveAllProjects(projects);
            return projects[index];
        }
        return null;
    },

    /**
     * 現在のプロジェクトを更新
     * @param {Object} updates
     */
    updateCurrentProject(updates) {
        const id = this.getCurrentProjectId();
        if (id) {
            return this.updateProject(id, updates);
        }
        return null;
    },

    /**
     * プロジェクトを削除
     * @param {string} id
     */
    deleteProject(id) {
        let projects = this.getAllProjects();
        projects = projects.filter(p => p.id !== id);
        this.saveAllProjects(projects);

        // 削除したのが現在のプロジェクトなら、別のプロジェクトに切り替え
        if (this.getCurrentProjectId() === id) {
            if (projects.length > 0) {
                this.setCurrentProject(projects[0].id);
            } else {
                localStorage.removeItem(this.KEYS.CURRENT_PROJECT);
            }
        }
        return true;
    },

    /**
     * プロジェクト名を変更
     * @param {string} id
     * @param {string} name
     */
    renameProject(id, name) {
        return this.updateProject(id, { name });
    },

    // ==================== Current Project Data ====================

    /**
     * コメントデータを保存（現在のプロジェクト）
     * @param {Array} comments
     */
    saveComments(comments) {
        const project = this.getCurrentProject();
        if (project) {
            this.updateProject(project.id, { comments });
            return true;
        }
        return false;
    },

    /**
     * コメントデータを読み込み（現在のプロジェクト）
     * @returns {Array}
     */
    loadComments() {
        const project = this.getCurrentProject();
        return project?.comments || [];
    },

    /**
     * 設定を保存（現在のプロジェクト）
     * @param {Object} settings
     */
    saveSettings(settings) {
        const project = this.getCurrentProject();
        if (project) {
            const merged = { ...project.settings, ...settings };
            this.updateProject(project.id, { settings: merged });
            return true;
        }
        return false;
    },

    /**
     * 設定を読み込み（現在のプロジェクト）
     * @returns {Object}
     */
    loadSettings() {
        const project = this.getCurrentProject();
        return project?.settings || {
            syncEnabled: false,
            syncMaster: 'A',
            loopMode: 'loop'
        };
    },

    /**
     * プレイヤー情報を保存
     * @param {string} playerKey - 'A' or 'B'
     * @param {Object} data
     */
    savePlayerData(playerKey, data) {
        const project = this.getCurrentProject();
        console.log('savePlayerData:', playerKey, data, 'project:', project?.id);
        if (project) {
            const key = playerKey === 'A' ? 'playerA' : 'playerB';
            const merged = { ...project[key], ...data };
            console.log('merged:', merged);
            const result = this.updateProject(project.id, { [key]: merged });
            console.log('updateProject result:', result);
            return true;
        }
        console.warn('No current project!');
        return false;
    },

    /**
     * プレイヤー情報を読み込み
     * @param {string} playerKey
     * @returns {Object}
     */
    loadPlayerData(playerKey) {
        const project = this.getCurrentProject();
        const key = playerKey === 'A' ? 'playerA' : 'playerB';
        return project?.[key] || {
            source: '',
            sourceType: '',
            name: playerKey === 'A' ? 'メイン' : 'サブ',
            startPos: '0:00'
        };
    },

    /**
     * 全コメントを削除（現在のプロジェクト）
     */
    clearComments() {
        return this.saveComments([]);
    },

    // ==================== Export/Import ====================

    /**
     * プロジェクトをJSONファイルとしてエクスポート
     * @param {string} projectId - エクスポートするプロジェクトID（省略時は現在のプロジェクト）
     */
    exportProject(projectId = null) {
        const id = projectId || this.getCurrentProjectId();
        const projects = this.getAllProjects();
        const project = projects.find(p => p.id === id);

        if (!project) {
            console.error('Project not found');
            return false;
        }

        const data = {
            version: '2.0',
            type: 'project',
            exportedAt: new Date().toISOString(),
            project: project
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const safeName = project.name.replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '_');
        a.download = `ryounome_${safeName}_${this.formatDateForFilename(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * 全プロジェクトをエクスポート
     */
    exportAllProjects() {
        const projects = this.getAllProjects();
        const data = {
            version: '2.0',
            type: 'all_projects',
            exportedAt: new Date().toISOString(),
            projects: projects
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ryounome_all_projects_${this.formatDateForFilename(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * JSONファイルからプロジェクトをインポート
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // v1.0 format (legacy)
                    if (data.version === '1.0' && data.comments) {
                        const project = this.createProject('Imported (Legacy)');
                        this.updateProject(project.id, { comments: data.comments });
                        if (data.settings) {
                            this.updateProject(project.id, { settings: data.settings });
                        }
                        resolve({ success: true, imported: 1, type: 'legacy' });
                        return;
                    }

                    // v2.0 single project
                    if (data.type === 'project' && data.project) {
                        const project = { ...data.project, id: this.generateId() };
                        const projects = this.getAllProjects();
                        projects.push(project);
                        this.saveAllProjects(projects);
                        this.setCurrentProject(project.id);
                        resolve({ success: true, imported: 1, type: 'project', project });
                        return;
                    }

                    // v2.0 all projects
                    if (data.type === 'all_projects' && data.projects) {
                        const existingProjects = this.getAllProjects();
                        const existingIds = new Set(existingProjects.map(p => p.id));
                        let importedCount = 0;

                        data.projects.forEach(p => {
                            if (!existingIds.has(p.id)) {
                                existingProjects.push(p);
                                importedCount++;
                            }
                        });

                        this.saveAllProjects(existingProjects);
                        resolve({ success: true, imported: importedCount, type: 'all_projects' });
                        return;
                    }

                    reject(new Error('Unknown file format'));
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    // Legacy export (for backwards compatibility)
    exportData() {
        return this.exportProject();
    },

    async importData(file, mode = 'merge') {
        return this.importProject(file);
    },

    // ==================== Utilities ====================

    formatDateForFilename(date) {
        return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    },

    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // ==================== Global Settings ====================

    saveGlobalSettings(settings) {
        try {
            const current = this.loadGlobalSettings();
            const merged = { ...current, ...settings };
            localStorage.setItem(this.KEYS.GLOBAL_SETTINGS, JSON.stringify(merged));
            return true;
        } catch (e) {
            return false;
        }
    },

    loadGlobalSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.GLOBAL_SETTINGS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }
};

// グローバルに公開
window.Storage = Storage;
