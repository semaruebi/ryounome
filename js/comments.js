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
        
        // Edit modal events
        document.getElementById('saveEditComment')?.addEventListener('click', () => {
            this.saveEditComment();
        });
        document.getElementById('cancelEditComment')?.addEventListener('click', () => {
            this.closeEditModal();
        });
        document.getElementById('closeEditCommentModal')?.addEventListener('click', () => {
            this.closeEditModal();
        });
        document.getElementById('editCommentModal')?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
            this.closeEditModal();
        });
        
        // Ctrl+Enter to save in edit modal
        document.getElementById('editCommentText')?.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.saveEditComment();
            }
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
     * コメントを投稿（空でもOK - タイムスタンプだけ記録）
     */
    postComment() {
        const text = this.elements.commentInput.value.trim();

        // Get start positions from sync panel
        const startPosA = document.getElementById('playerAStartPos')?.value || '0:00';
        const startPosB = document.getElementById('playerBStartPos')?.value || '0:00';

        // Get current times from BOTH players
        const playerA = window.app?.playerA;
        const playerB = window.app?.playerB;
        
        const timestampA = playerA?.getCurrentTime() ?? 0;
        const timestampB = playerB?.getCurrentTime() ?? 0;

        const comment = {
            id: Storage.generateId(),
            videoUrl: '',
            timestamp: this.currentTimestamp,
            timestampA: timestampA,
            timestampB: timestampB,
            comment: text, // Can be empty
            playerKey: this.selectedPlayerKey,
            startPosA: startPosA,
            startPosB: startPosB,
            markerA: {
                start: playerA?.startMarker ?? null,
                end: playerA?.endMarker ?? null
            },
            markerB: {
                start: playerB?.startMarker ?? null,
                end: playerB?.endMarker ?? null
            },
            createdAt: new Date().toISOString()
        };

        this.comments.push(comment);
        this.comments.sort((a, b) => (a.timestampA || a.timestamp) - (b.timestampA || b.timestamp));
        this.saveComments();
        this.renderComments();

        // 入力欄をクリア
        this.elements.commentInput.value = '';
        
        // Success animation (Peak-End Rule - memorable moment)
        this.showAddSuccessAnimation();
        Toast.show('✨ マーク追加！', 'success');
    }
    
    /**
     * マーク追加時の成功アニメーション（ピーク・エンドの法則）
     */
    showAddSuccessAnimation() {
        // Animate the post button
        const btn = this.elements.postCommentBtn;
        btn?.classList.add('success-pulse');
        setTimeout(() => btn?.classList.remove('success-pulse'), 600);
        
        // Flash effect on the newest comment
        setTimeout(() => {
            const list = this.elements.commentsList;
            const items = list?.querySelectorAll('.comment-item');
            if (items?.length > 0) {
                // Find the newly added comment (sorted by timestamp, so need to find it)
                const newest = list.querySelector('.comment-item');
                newest?.classList.add('comment-new');
                setTimeout(() => newest?.classList.remove('comment-new'), 1000);
            }
        }, 100);
    }

    /**
     * コメントを編集（カスタムモーダル使用）
     * @param {string} id - コメントID
     */
    editComment(id) {
        const comment = this.comments.find(c => c.id === id);
        if (!comment) return;
        
        this.editingCommentId = id;
        
        const modal = document.getElementById('editCommentModal');
        const textarea = document.getElementById('editCommentText');
        
        if (!modal || !textarea) {
            // Fallback to prompt
            const newText = prompt('コメントを編集:', comment.comment || '');
            if (newText !== null) {
                comment.comment = newText.trim();
                this.saveComments();
                this.renderComments();
                Toast.show('コメントを更新しました', 'success');
            }
            return;
        }
        
        textarea.value = comment.comment || '';
        modal.classList.add('open');
        textarea.focus();
    }
    
    /**
     * コメント編集を保存
     */
    saveEditComment() {
        if (!this.editingCommentId) return;
        
        const comment = this.comments.find(c => c.id === this.editingCommentId);
        if (!comment) return;
        
        const textarea = document.getElementById('editCommentText');
        comment.comment = textarea.value.trim();
        
        this.saveComments();
        this.renderComments();
        this.closeEditModal();
        Toast.show('コメントを更新しました', 'success');
    }
    
    /**
     * 編集モーダルを閉じる
     */
    closeEditModal() {
        const modal = document.getElementById('editCommentModal');
        modal?.classList.remove('open');
        this.editingCommentId = null;
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
     * コメント数バッジを更新（ツァイガルニク効果 - 進捗の可視化）
     */
    updateCommentCountBadge() {
        const badge = document.getElementById('commentCountBadge');
        if (badge) {
            const count = this.comments.length;
            badge.textContent = count;
            badge.classList.toggle('has-comments', count > 0);
        }
    }

    /**
     * コメントリストをレンダリング
     */
    renderComments() {
        const list = this.elements.commentsList;
        
        // Update comment count badge
        this.updateCommentCountBadge();
        
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
                        // Restore start positions to sync panel
                        const startPosAInput = document.getElementById('playerAStartPos');
                        const startPosBInput = document.getElementById('playerBStartPos');
                        if (startPosAInput && comment.startPosA) {
                            startPosAInput.value = comment.startPosA;
                        }
                        if (startPosBInput && comment.startPosB) {
                            startPosBInput.value = comment.startPosB;
                        }
                        
                        // Restore markers and seek BOTH players
                        const playerA = window.app?.playerA;
                        const playerB = window.app?.playerB;
                        
                        if (playerA) {
                            if (comment.markerA) {
                                playerA.startMarker = comment.markerA.start;
                                playerA.endMarker = comment.markerA.end;
                                playerA.updateMarkerDisplay();
                            }
                            // Seek to saved timestamp
                            const tsA = comment.timestampA ?? comment.timestamp;
                            playerA.seekTo(tsA);
                        }
                        if (playerB) {
                            if (comment.markerB) {
                                playerB.startMarker = comment.markerB.start;
                                playerB.endMarker = comment.markerB.end;
                                playerB.updateMarkerDisplay();
                            }
                            // Seek to saved timestamp
                            if (comment.timestampB !== undefined) {
                                playerB.seekTo(comment.timestampB);
                            }
                        }
                        
                        Toast.show('両プレイヤーの位置を復元', 'info');
                    }
                });
            }
        });

        // 編集ボタンのイベント
        list.querySelectorAll('.comment-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.comment-item').dataset.id;
                this.editComment(id);
            });
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
        
        // Show both player timestamps
        const timeA = comment.timestampA !== undefined ? this.formatTime(comment.timestampA) : this.formatTime(comment.timestamp);
        const timeB = comment.timestampB !== undefined ? this.formatTime(comment.timestampB) : '--';
        
        // Show markers if available
        let markerInfo = '';
        if (comment.markerA || comment.markerB) {
            const aStart = comment.markerA?.start !== null ? this.formatTimeShort(comment.markerA.start) : '--';
            const bStart = comment.markerB?.start !== null ? this.formatTimeShort(comment.markerB.start) : '--';
            markerInfo = `<div class="comment-markers">区間 A:${aStart}― B:${bStart}―</div>`;
        }
        
        // Show comment text or placeholder (with Markdown support)
        const commentText = comment.comment 
            ? this.parseMarkdown(comment.comment) 
            : '<span class="comment-empty-text">（メモなし）</span>';
        
        return `
            <li class="comment-item ${playerClass}" data-id="${comment.id}" data-timestamp="${comment.timestamp}" data-timestamp-a="${comment.timestampA || comment.timestamp}" data-timestamp-b="${comment.timestampB || 0}">
                <span class="comment-badge ${badgeClass}">${comment.playerKey}</span>
                <div class="comment-content">
                    <div class="comment-timestamps">
                        <span class="ts-label ts-a">A</span><span class="ts-time">${timeA}</span>
                        <span class="ts-label ts-b">B</span><span class="ts-time">${timeB}</span>
                    </div>
                    ${markerInfo}
                    <div class="comment-text">${commentText}</div>
                </div>
                <div class="comment-actions">
                    <button class="comment-edit" title="編集">✏️</button>
                    <button class="comment-delete" title="削除">🗑️</button>
                </div>
            </li>
        `;
    }

    formatTimeShort(seconds) {
        if (seconds === null || seconds === undefined) return '--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
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
    
    /**
     * 簡易Markdownをパース
     * @param {string} text 
     * @returns {string}
     */
    parseMarkdown(text) {
        if (!text) return '';
        
        // First escape HTML
        let html = this.escapeHtml(text);
        
        // Convert line breaks to <br>
        html = html.replace(/\n/g, '<br>');
        
        // Bold: **text** or __text__
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // Italic: *text* or _text_
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Code: `text`
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Strikethrough: ~~text~~
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
        
        return html;
    }
}

// グローバルに公開
window.CommentsController = CommentsController;

