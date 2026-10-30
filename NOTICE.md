# NOTICE — 阿搜PDF工具箱 (Asou PDF Toolbox)

本仓库是开源项目 **BentoPDF**（https://github.com/alam00000/bentopdf ，
Copyright © BentoPDF 原作者及贡献者）的修改版本，以 **GNU AGPL-3.0** 发布。
原始 `LICENSE` 及原有版权声明保持不变。线上站点：https://pdf.metext.xyz ，
对应源码：https://github.com/chenziming808-cpu/bentopdf 。

This repository is a modified version of BentoPDF, licensed under the GNU
Affero General Public License v3.0. The original LICENSE and copyright notices
are retained.

## 修改内容 (Modifications, 2026-10, branch `asou-brand`, based on v2.8.10)

- 品牌：站点名改为「阿搜PDF工具箱 / Asou PDF Toolbox」，新 logo、favicon、
  OG 图、site.webmanifest、robots.txt；标题/meta/OG/JSON-LD 通过
  `asou.env`（SITE*ORG*\*）与构建后处理 `scripts/rebrand-dist.mjs` 替换。
  PDF 元数据：表单创建器 Author 改为新品牌；pdf-lib 默认 Producer 及
  ComicInfo `appID: BentoPDF/1.0` 等出处标识保留。
- 默认简洁模式（SIMPLE_MODE=true），默认中文（VITE_DEFAULT_LANGUAGE=zh），
  关闭 GitHub stars（DISABLE_GITHUB_STARS=true）。
- 移除：捐赠/赞助、DigitalOcean 推广、原作者社交链接、kura / hyper-compress
  产品页及入口、blog / docs 构建。
- 新增顶栏与页脚的小红书引流文案、页脚 AGPL 出处与源码链接。
- 重写 about / contact / terms / licensing 页面（中文为主）。
- 运行组件改为同域自托管（国内可用）：`scripts/fetch-selfhost-assets.sh`
  下载，`scripts/copy-selfhost-assets.mjs` 复制到 `dist/wasm/`，
  root-relative URL 经 `src/js/utils/same-origin-url.ts` 解析为绝对地址。
- 构建入口：`scripts/build-asou.sh`。

## 自托管第三方组件及许可证 (Self-hosted components)

| 路径 (dist/wasm/) | 组件                                             | 许可证            |
| ----------------- | ------------------------------------------------ | ----------------- |
| pymupdf/          | @bentopdf/pymupdf-wasm 0.11.16 (MuPDF/PyMuPDF)   | AGPL-3.0-only     |
| gs/               | @bentopdf/gs-wasm 0.1.1 (Ghostscript)            | AGPL-3.0-only     |
| cpdf/             | coherentpdf 2.5.5                                | AGPL-3.0-or-later |
| ocr/worker.min.js | tesseract.js 7.0.0                               | Apache-2.0        |
| ocr/core/         | tesseract.js-core 7.0.0                          | Apache-2.0        |
| ocr/lang-data/    | tessdata (eng, chi_sim, chi_tra; 4.0.0_best_int) | Apache-2.0        |
| ocr/fonts/        | Noto 字体（原 githack 来源）                     | SIL OFL-1.1       |
| embedpdf/         | @embedpdf/fonts-\* 1.0.0 (Noto)                  | SIL OFL-1.1       |

已随 npm 依赖打包：hyper-compress-wasm、bentopdf-pdfium（AGPL-3.0），
bentopdf-viewer（MIT），LibreOffice WASM（MPL-2.0）等，见各包 LICENSE。

## 数字签名 CORS 代理

上游仅在 bentopdf.com 域名下使用其 Cloudflare Worker 代理拉取证书链/时间戳。
本站**不配置** `VITE_CORS_PROXY_URL`（不借用上游代理，也暂不自建）：
本地签名正常可用；需要从外部服务器补全证书链或 RFC3161 时间戳（如 freetsa）
的场景可能因浏览器 CORS 失败。以后可自建代理并设置该变量。
