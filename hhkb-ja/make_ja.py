"""DMK の via.json から、HHKB 詳細設定を日本語にした via.json を作る。

使い方:
    python make_ja.py <DMK の keyboards/hhkb/via.json> [出力先]

訳は同じフォルダの translation.json に置く。訳が無い文字列は英語のまま残して、最後に一覧を出す。
DMK 側の via.json が更新されたら、これを流し直して、出てきた未訳を translation.json に足す。
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# 数字と単位だけの選択肢(「50 Hz」「0.4 mm」「12%」)は訳さない
NUMERIC = re.compile(r"[\d.]+ ?(Hz|mm|%)?")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "via.ja.json"

    table = {k: v for k, v in json.loads((HERE / "translation.json").read_text("utf-8")).items()
             if not k.startswith("_")}
    data = json.loads(src.read_text("utf-8"))
    missing: list[str] = []

    def tr(s: str) -> str:
        if NUMERIC.fullmatch(s):
            return s
        if s in table:
            return table[s]
        if s not in missing:
            missing.append(s)
        return s

    def walk(node):
        if isinstance(node, list):
            for x in node:
                walk(x)
            return
        if not isinstance(node, dict):
            return
        if isinstance(node.get("label"), str):
            node["label"] = tr(node["label"])
        if node.get("type") == "dropdown":
            for opt in node.get("options", []):
                if opt and isinstance(opt[0], str):
                    opt[0] = tr(opt[0])
        content = node.get("content")
        # 文字だけの説明行は content に文が入っている(設定値の行は "id_..." で始まる)
        if (node.get("type") == "label" and isinstance(content, list) and content
                and isinstance(content[0], str) and not content[0].startswith("id_")):
            node["content"] = [tr(x) if isinstance(x, str) else x for x in content]
        elif isinstance(content, list):
            walk(content)

    walk(data["menus"])
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"wrote {dst}")
    if missing:
        print(f"未訳 {len(missing)} 件(英語のまま):")
        for s in missing:
            print(f"  {s!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
