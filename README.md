# 🎮 RyounoMe - RTA動画比較・分析ツール

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success)](https://semaruebi.github.io/ryounome/)

RTA走者や研究者向けの、複数動画を同期再生しフレーム単位で分析できるサーバーレスWebツールです。

## ✨ 特徴

- **📺 デュアルプレイヤー**: 2つの動画を並べて同時再生
- **🔗 同期再生**: メインプレイヤーの操作にサブプレイヤーが追従
- **⏱️ オフセット調整**: 動画間の時間差を秒単位で調整可能
- **🎬 フレーム単位操作**: 前後1フレームのコマ送り対応
- **💬 タイムスタンプコメント**: 再生位置にコメントを追加・管理
- **💾 ローカル保存**: データはブラウザのlocalStorageに保存（サーバー不要）
- **📥 エクスポート/インポート**: データのバックアップと復元が可能

## 🚀 対応動画ソース

- **YouTube**: URLを入力して読み込み
- **ローカルファイル**: ファイル選択またはドラッグ＆ドロップ

## ⌨️ キーボードショートカット

| キー | 動作 |
|------|------|
| `Space` | 再生/一時停止 (メインプレイヤー) |
| `←` | 1フレーム戻る |
| `→` | 1フレーム進む |
| `S` | 同期 ON/OFF |
| `Ctrl + Enter` | コメント投稿 |

## 🛠️ セットアップ

### GitHub Pagesでのデプロイ

1. このリポジトリをforkまたはclone
2. GitHubリポジトリの Settings → Pages を開く
3. Source を「Deploy from a branch」に設定
4. Branch を「main」、フォルダを「/ (root)」に設定
5. Save をクリック

### ローカルでの実行

```bash
# リポジトリをクローン
git clone https://github.com/semaruebi/ryounome.git
cd ryounome

# ローカルサーバーで起動（Python 3の場合）
python -m http.server 8080

# または Node.js の場合
npx serve
```

ブラウザで `http://localhost:8080` を開く

## 📁 プロジェクト構造

```
ryounome/
├── index.html          # メインHTML
├── css/
│   └── styles.css      # スタイルシート
├── js/
│   ├── app.js          # メインアプリケーション
│   ├── player.js       # 動画プレイヤー機能
│   ├── sync.js         # 同期機能
│   ├── comments.js     # コメント機能
│   └── storage.js      # localStorage管理
└── README.md           # このファイル
```

## 💾 データ形式

コメントデータは以下の形式でlocalStorageに保存されます：

```json
{
  "id": "1234567890-abc123def",
  "videoUrl": "",
  "timestamp": 123.456,
  "comment": "ここで○○のテクニックを使用",
  "playerKey": "A",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

## 📝 エクスポートファイル形式

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-01T00:00:00.000Z",
  "comments": [...],
  "settings": {
    "syncEnabled": true,
    "syncOffset": 0.5
  }
}
```

## 🔧 技術スタック

- **HTML5** / **CSS3** / **JavaScript (ES6+)**
- **YouTube IFrame API**
- **localStorage API**
- サーバーレス（GitHub Pages対応）

## 📄 ライセンス

MIT License

## 🙏 謝辞

RTA走者の皆様、動画分析に興味のあるすべての方々へ感謝を込めて。

---

Made with ❤️ for the RTA community



