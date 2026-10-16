# 终端符号表格、选区与尺寸刷新回归

本记录针对 Claude Code 等 TUI 输出的预排版表格：`✻`、`※`、歧义宽度符号、
VS16 变体、键帽、旗帜、肤色和 ZWJ emoji 组合在缩放、选中与尺寸变化后，
是否仍然占用与生产者相同的列数。

文字宽度与列数仍以 xterm buffer 为准，不按字体实际笔画扩大或缩小列数：

- `✻`、`※`、`•`、`○`、`■`、`§`、`±`、`×` 保持单列；`✅`、`❌`、`🚀` 等
  emoji 保持双列。把单列字符改成双列会推偏后续所有表格线，Windows 11
  自带终端同样按制表方的列宽约定处理。
- `terminal-symbol-glyph-renderer.ts` 只调整显示槽与笔画，显示槽宽度固定为
  buffer 列宽，因此 fallback 字体的实际 advance 不再推偏后面的列。
- 跨格选中时，双列字形的笔画绘制在选区背景之上；从延续格开始选择也不会
  遮住右半边。

## 自动浏览器回归

安装 Playwright 并提供本机 Chrome 后运行：

```sh
node apps/tauri/tests/browser/terminal-symbol-tables.mjs
node apps/tauri/tests/browser/terminal-resize-repaint.mjs
```

`terminal-symbol-tables.mjs` 使用 `tests/fixtures/terminal-symbol-table.mjs`
中预排好列宽的表格，覆盖内置字体栈与中文回退栈、三个字号和多个 DPI。断言
包含三层：

- buffer 层的表格线必须落在精确列上（对每行交替使用 `|` 与 `│`，避免单一
  制表字符的宽度假设掩盖漂移）；
- 屏幕上的表格线坐标与同字号的 ASCII 对照行比较，允许不足 1 CSS px 的
  字体测量取整误差；
- 全选后的复制文本必须与原始表格逐字节一致。

`terminal-resize-repaint.mjs` 覆盖拖宽、拖窄、窗口缩放和持续输出期间的尺寸
同步：像素尺寸变化必须在下一帧刷新显示行，列数冻结不得阻止重绘；稳定后
一次性把真实 `cols` 同步给本地 xterm 和 PTY，不再等待输出安静或 shell
提示符。

## 本机验证结果

macOS Chrome（`PLAYWRIGHT_CHANNEL=chrome`）与 Playwright WebKit 两个引擎，
8 个脚本各跑一遍，共 16 次全部通过：`terminal-symbol-tables`、
`terminal-resize-repaint`、`terminal-symbol-proportions`、`terminal-symbol-glyphs`、
`terminal-selection-glyphs`、`terminal-font-loading`、`terminal-plain-output`、
`terminal-redraw-load`。

配套门禁同批通过：`npm run typecheck`、`npm run lint`、Prettier、
`git diff --check`、105 项 renderer 测试、789 项 Rust 测试（756 单元 + 10 CLI +
23 contract）以及 `cargo clippy --all-targets --all-features -- -D warnings`。

`terminal-symbol-proportions.mjs` 从 9 行扩到 18 行，逐行断言字形实际占用的
列宽等于 Unicode 列宽（含 `✔️`、`✖️`、`1️⃣`、`1⃣`、`🇨🇳`、`🇨🇳🇺🇸`、`👍🏽`、
`👩🏽‍🚀`、`👨‍👩‍👧‍👦`），并保留逐字形等比缩放检查。行级“整体墨迹等比”断言
只对单一字素成立：实测 `⚠️•` 行中 `⚠️` 在 2 格槽位内被缩放到 0.8406，而
`•` 不缩放，整行墨迹没有统一缩放因子，因此该断言对多字素行不适用；这类行
改由上面的列宽与逐字形检查覆盖。

## 原生 WebView 复核（未完成）

浏览器回归不能代替原生 WebView 手测。需要在 Windows 11 WebView2 上连接一台
Linux 主机，用实际 Claude Code 输出复核：

- 表格在缩小字号、缩放窗口、拖动终端区域宽度后是否仍然对齐；
- 拖动过程中窗口宽度变化时是否立即重绘，而不是等到下一次输出；
- 全选和跨格选中后，双列 emoji 的笔画是否仍完整可见。

同一清单需要在 macOS WKWebView 与 Linux WebKitGTK 上重复一次。当前自动化只
覆盖本机 Chrome 与 Playwright WebKit。
