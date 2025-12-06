# 👀 RyounoMe - RTA動画比較・分析ツール

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success)](https://semaruebi.github.io/ryounome/)

RTA走者や研究者向けの、複数動画を同期再生しフレーム単位で分析できるサーバーレスWebツールです。

## ✨ 特徴

- **📺 デュアルプレイヤー**: 2つの動画を並べて同時比較
- **⏱️ フレーム単位操作**: 30fps/60fps対応、±1フレームのコマ送り
- **📍 マーカー機能**: Start/End区間を設定して時間計測
- **💬 タイムスタンプメモ**: 両プレイヤーの時刻を同時記録、Markdown対応
- **🎛️ リサイズ可能UI**: プレイヤー・サイドバーの幅を自由に調整
- **💾 プロジェクト保存**: 複数の分析セッションを管理
- **📤 エクスポート/インポート**: データのバックアップと共有

## 🚀 対応動画ソース

- **YouTube**: URLを入力して読み込み
- **ローカルファイル**: ファイル選択またはドラッグ＆ドロップ

## ⌨️ キーボードショートカット

| キー | 動作 |
|------|------|
| `Space` | 再生/停止（プレイヤーA） |
| `,` `.` | ±1フレーム |
| `Shift` + `,` `.` | ±5フレーム |
| `←` `→` | ±1秒 |
| `Shift` + `←` `→` | ±5秒 |
| `R` | 開始位置に戻る |
| `Ctrl` + `Enter` | マーク追加 |

## 🎬 主な機能

### プレイヤー操作
- **ステップボタン**: ±1m, ±30s, ±10s, ±5s, ±1s, ±10f, ±1f
- **FPS設定**: 動画に合わせて30fps/60fpsを選択
- **サイズ調整**: 中央のハンドルをドラッグでプレイヤーサイズを変更

### マーカー機能
- **START**: 現在位置をスタートに設定
- **END**: 現在位置をエンドに設定  
- **区間表示**: Start〜End間の時間とフレーム数

### コメント機能
- **マーク追加**: 両プレイヤーの現在時刻を同時記録（空でもOK）
- **Markdown対応**: `**太字**`, `*斜体*`, `` `コード` ``, `~~取消~~`
- **ジャンプ**: クリックで両プレイヤーがそのタイミングに移動
- **編集**: あとからメモを追記・編集可能

### プロジェクト管理
- **保存**: 現在の設定を名前付きで保存
- **読込**: 保存したプロジェクトを復元
- **新規**: まっさらな状態で開始

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
│   └── styles.css      # スタイルシート（テーマ対応）
├── js/
│   ├── app.js          # メインアプリケーション
│   ├── player.js       # 動画プレイヤー機能
│   ├── sync.js         # 再生コントロール
│   ├── comments.js     # コメント機能
│   └── storage.js      # localStorage管理
└── README.md           # このファイル
```

## 🎨 テーマ

- **ライトモード**: Rose Pink - 清潔感のある白背景にピンクアクセント
- **ダークモード**: Midnight Cream - 深い紺背景にクリームアクセント

右上の☀️/🌙ボタンで切り替え可能

## 💾 データ保存

すべてのデータはブラウザのlocalStorageに保存されます（サーバー不要）

- プロジェクト設定
- コメント（タイムスタンプ、マーカー情報含む）
- UI設定（サイドバー幅、プレイヤー比率など）

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
