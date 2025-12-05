/**
 * RyounoMe - Comments Module
 * タイムスタンプ付きコメント管理機能
 */

class CommentsController {
    constructor(options = {}) {
        this.comments = [];
        this.selectedPlayerKey = 'A';
        this.currentTimestamp = 0;
        this.filter = 'all';
        this.highlightRange = 2; // 現在位置±2秒のコメントをハイライト
        
        this.onCommentClick = options.onCommentClick || (() => {});
        this.getPlayerTime = options.getPlayerTime || (() => 0);
        
        this.initElements();
        this.bindEvents();
        this.loadComments();
    }

    initElements() {
        this.elements = {
            commentsList: document.getElementById('commentsList'),
            commentInput: document.getElementById('commentInput'),
            postCommentBtn: document.getElementById('postCommentBtn'),
            currentTimestamp: document.getElementById('currentTimestamp'),
            captureTimestampBtn: document.getElementById('captureTimestampBtn'),
            commentsFilter: document.getElementById('commentsFilter'),
            clearCommentsBtn: document.getElementById('clearCommentsBtn'),
            playerRadios: document.querySelectorAll('input[name="commentPlayer"]')
        };
    }

    bindEvents() {
        // コメント投稿
        this.elements.postCommentBtn.addEventListener('click', () => this.postComment());
        
        // Ctrl+Enterでコメント投稿
        this.elements.commentInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.postComment();
            }
        });

        // タイムスタンプキャプチャ
        this.elements.captureTimestampBtn.addEventListener('click', () => {
            this.captureTimestamp();
        });

        // プレイヤー選択
        this.elements.playerRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectedPlayerKey = e.target.value;
            });
        });

        // フィルター
        this.elements.commentsFilter.addEventListener('change', (e) => {
            this.filter = e.target.value;
            this.renderComments();
        });

        // 全コメントクリア
        this.elements.clearCommentsBtn.addEventListener('click', () => {
            this.confirmClearComments();
        });
    }

    loadComments() {
        this.comments = Storage.loadComments();
        this.renderComments();
    }

    saveComments() {
        Storage.saveComments(this.comments);
    }

    /**
     * 現在のタイムスタンプをキャプチャ
     */
    captureTimestamp() {
        this.currentTimestamp = this.getPlayerTime(this.selectedPlayerKey);
        this.updateTimestampDisplay();
        Toast.show('タイムスタンプをキャプチャしました', 'success');
    }

    /**
     * タイムスタンプ表示を更新
     */
    updateTimestampDisplay() {
        this.elements.currentTimestamp.textContent = this.formatTime(this.currentTimestamp);
    }

    /**
     * タイムスタンプをリアルタイム更新（外部から呼び出し）
     * @param {number} time - 現在時刻
     */
    setCurrentTimestamp(time) {
        this.currentTimestamp = time;
        this.updateTimestampDisplay();
    }

    /**
     * コメントを投稿
     */
    postComment() {
        const text = this.elements.commentInput.value.trim();
        
        if (!text) {
            Toast.show('コメントを入力してください', 'warning');
            return;
        }

        const comment = {
            id: Storage.generateId(),
            videoUrl: '', // 将来的に動画URLを保存する場合用
            timestamp: this.currentTimestamp,
            comment: text,
            playerKey: this.selectedPlayerKey,
            createdAt: new Date().toISOString()
        };

        this.comments.push(comment);
        this.comments.sort((a, b) => a.timestamp - b.timestamp);
        this.saveComments();
        this.renderComments();

        // 入力欄をクリア
        this.elements.commentInput.value = '';
        
        Toast.show('コメントを投稿しました', 'success');
    }

    /**
     * コメントを削除
     * @param {string} id - コメントID
     */
    deleteComment(id) {
        const index = this.comments.findIndex(c => c.id === id);
        if (index !== -1) {
            this.comments.splice(index, 1);
            this.saveComments();
            this.renderComments();
            Toast.show('コメントを削除しました', 'success');
        }
    }

    /**
     * 全コメントをクリア（確認付き）
     */
    confirmClearComments() {
        if (this.comments.length === 0) {
            Toast.show('削除するコメントがありません', 'warning');
            return;
        }

        if (confirm(`全てのコメント（${this.comments.length}件）を削除しますか？\nこの操作は取り消せません。`)) {
            this.comments = [];
            Storage.clearComments();
            this.renderComments();
            Toast.show('全コメントを削除しました', 'success');
        }
    }

    /**
     * コメントリストをレンダリング
     */
    renderComments() {
        const list = this.elements.commentsList;
        
        // フィルタリング
        let filteredComments = this.comments;
        if (this.filter !== 'all') {
            filteredComments = this.comments.filter(c => c.playerKey === this.filter);
        }

        if (filteredComments.length === 0) {
            list.innerHTML = `
                <li class="comment-empty">
                    <p>コメントはまだありません</p>
                    <p class="hint">動画を再生しながらコメントを追加してみましょう！</p>
                </li>
            `;
            return;
        }

        list.innerHTML = filteredComments.map(comment => this.renderCommentItem(comment)).join('');

        // クリックイベントを設定
        list.querySelectorAll('.comment-item').forEach(item => {
            const id = item.dataset.id;
            const comment = this.comments.find(c => c.id === id);
            
            if (comment) {
                item.addEventListener('click', (e) => {
                    // 削除ボタンをクリックした場合は除外
                    if (!e.target.closest('.comment-delete')) {
                        this.onCommentClick(comment);
                    }
                });
            }
        });

        // 削除ボタンのイベント
        list.querySelectorAll('.comment-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.comment-item').dataset.id;
                this.deleteComment(id);
            });
        });
    }

    /**
     * コメントアイテムのHTMLを生成
     * @param {Object} comment 
     * @returns {string}
     */
    renderCommentItem(comment) {
        const badgeClass = comment.playerKey === 'A' ? 'badge-a' : 'badge-b';
        const playerClass = comment.playerKey === 'A' ? 'player-a' : 'player-b';
        
        return `
            <li class="comment-item ${playerClass}" data-id="${comment.id}" data-timestamp="${comment.timestamp}">
                <span class="comment-badge ${badgeClass}">${comment.playerKey}</span>
                <div class="comment-content">
                    <div class="comment-time">${this.formatTime(comment.timestamp)}</div>
                    <div class="comment-text">${this.escapeHtml(comment.comment)}</div>
                </div>
                <button class="comment-delete" title="削除">🗑️</button>
            </li>
        `;
    }

    /**
     * 現在の再生位置に近いコメントをハイライト
     * @param {number} currentTime - 現在の再生時間
     * @param {string} playerKey - 'A' or 'B'
     */
    highlightActiveComments(currentTime, playerKey) {
        const items = this.elements.commentsList.querySelectorAll('.comment-item');
        
        items.forEach(item => {
            const timestamp = parseFloat(item.dataset.timestamp);
            const isActive = Math.abs(timestamp - currentTime) <= this.highlightRange;
            item.classList.toggle('active', isActive);
        });
    }

    /**
     * 時間をフォーマット
     * @param {number} seconds 
     * @returns {string}
     */
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    /**
     * HTMLエスケープ
     * @param {string} text 
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// グローバルに公開
window.CommentsController = CommentsController;

