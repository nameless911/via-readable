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

## HHKB メニューの日本語化(`hhkb-ja/`)

DMK の `via.json` の「HHKB Settings」を、PFU/富士通の取扱説明書っぽい日本語にしたもの。

- `via.ja.json` … できあがり。VIA の「定義ファイル」タブで、元の `via.json` の代わりに読み込む
- `translation.json` … 英語 → 日本語の対応表
- `make_ja.py` … 対応表から `via.ja.json` を作る

DMK 側の `via.json` が更新されたら作り直す:

```
uv run python hhkb-ja/make_ja.py <dmk>/keyboards/hhkb/via.json
```

未訳の文字列があれば一覧が出るので、`translation.json` に足して流し直す。
状態表示(「Writable」など)はファームウェアが返す文字なので、ここでは訳せない。
