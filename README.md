# via-readable

[VIA](https://www.usevia.app/) を読める見た目にする Stylus 用のユーザースタイル。

- 配色は Filer の `theme.py` と同じ Win11 パレット(Windows のライト/ダークに追従)
- フォントは BIZ UDP ゴシック
- キーボードの絵は黒基調(斜面が天面より暗い、本物と同じ明暗)
- トップ画面のマスコットを消す
- 上端の吹き出しを「キー配列 / キーテスト / 定義ファイル / VIA の設定」に分ける
- 左端のメニューにアイコンの名前を出す

なぜこうするかは `via-readable.user.css` の先頭に書いてある。

## 入れ方

1. Chrome に [Stylus](https://chromewebstore.google.com/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne) を入れる
2. Stylus → 管理 → 新しいスタイルを作成 → `via-readable.user.css` の中身を貼って保存
3. VIA を再読み込み

色を変えたいときは、ファイル上のほうの「パレット」だけ直せば全部に効く。
