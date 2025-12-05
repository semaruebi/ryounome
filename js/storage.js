/**
 * RyounoMe - Storage Module
 * localStorage管理とデータのエクスポート/インポート機能
 */

const Storage = {
    KEYS: {
        COMMENTS: 'ryounome_comments',
        SETTINGS: 'ryounome_settings'
    },

    /**
     * コメントデータを保存
     * @param {Array} comments - コメント配列
     */
    saveComments(comments) {
        try {
            localStorage.setItem(this.KEYS.COMMENTS, JSON.stringify(comments));
            return true;
        } catch (e) {
            console.error('Failed to save comments:', e);
            return false;
        }
    },

    /**
     * コメントデータを読み込み
     * @returns {Array} コメント配列
     */
    loadComments() {
        try {
            const data = localStorage.getItem(this.KEYS.COMMENTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load comments:', e);
            return [];
        }
    },

    /**
     * 設定を保存
     * @param {Object} settings - 設定オブジェクト
     */
    saveSettings(settings) {
        try {
            const current = this.loadSettings();
            const merged = { ...current, ...settings };
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(merged));
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    },

    /**
     * 設定を読み込み
     * @returns {Object} 設定オブジェクト
     */
    loadSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : {
                syncEnabled: false,
                syncOffset: 0,
                playerAVolume: 100,
                playerBVolume: 100
            };
        } catch (e) {
            console.error('Failed to load settings:', e);
            return {};
        }
    },

    /**
     * 全コメントを削除
     */
    clearComments() {
        try {
            localStorage.removeItem(this.KEYS.COMMENTS);
            return true;
        } catch (e) {
            console.error('Failed to clear comments:', e);
            return false;
        }
    },

    /**
     * データをJSONファイルとしてエクスポート
     */
    exportData() {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            comments: this.loadComments(),
            settings: this.loadSettings()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ryounome_data_${this.formatDateForFilename(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * JSONファイルからデータをインポート
     * @param {File} file - インポートするファイル
     * @param {string} mode - 'merge' または 'overwrite'
     * @returns {Promise<Object>} インポート結果
     */
    async importData(file, mode = 'merge') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // バリデーション
                    if (!data.comments || !Array.isArray(data.comments)) {
                        throw new Error('Invalid data format: comments array not found');
                    }

                    // コメントデータのバリデーション
                    const validComments = data.comments.filter(comment => {
                        return comment.id && 
                               typeof comment.timestamp === 'number' &&
                               typeof comment.comment === 'string' &&
                               ['A', 'B'].includes(comment.playerKey);
                    });

                    if (mode === 'merge') {
                        const existing = this.loadComments();
                        const existingIds = new Set(existing.map(c => c.id));
                        const newComments = validComments.filter(c => !existingIds.has(c.id));
                        const merged = [...existing, ...newComments]
                            .sort((a, b) => a.timestamp - b.timestamp);
                        this.saveComments(merged);
                        
                        resolve({
                            success: true,
                            imported: newComments.length,
                            total: merged.length,
                            mode: 'merge'
                        });
                    } else {
                        this.saveComments(validComments);
                        
                        resolve({
                            success: true,
                            imported: validComments.length,
                            total: validComments.length,
                            mode: 'overwrite'
                        });
                    }

                    // 設定もインポート
                    if (data.settings) {
                        this.saveSettings(data.settings);
                    }

                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    /**
     * ファイル名用の日付フォーマット
     * @param {Date} date 
     * @returns {string}
     */
    formatDateForFilename(date) {
        return date.toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19);
    },

    /**
     * 一意のIDを生成
     * @returns {string}
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
};

// グローバルに公開
window.Storage = Storage;

