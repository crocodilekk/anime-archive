# ANIME ARCHIVE · 追番档案系统

莱茵生命风格（明日方舟）的 B 站看过动画档案站。纯静态，无需后端、无需 Cookie。

## 架构

```
B站公开API ──▶ scripts/sync.mjs ──▶ data/anime.json ──▶ Vite 构建 ──▶ 静态站点
   (免登录)        (Node 脚本)        (提交进仓库)        (数据打包进 JS)
```

- **数据同步**：`pnpm sync` 调用 B 站公开追番接口（仅用 UID，无需登录），拉取"在看/看过/想看"三个列表，写入 `data/anime.json`。
- **站点**：`index.html + src/main.ts + src/styles.css`，Vite + TypeScript，数据在构建期打包，无跨域问题。
- **部署**：GitHub Pages（`.github/workflows/deploy.yml`），push 到 main 自动构建部署。

## 更新数据

```bash
pnpm sync    # 重新拉取最新追番数据
git add data/anime.json
git commit -m "sync"
git push     # 自动触发 Pages 重新部署
```

## 本地开发

```bash
pnpm install
pnpm dev       # 开发服务器
pnpm build     # 产出 dist/
pnpm preview   # 预览构建产物
```

## 首次部署步骤

1. 在 GitHub 新建仓库，把本项目 push 上去。
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**。
3. 之后每次 push 自动部署；更新数据只需 `pnpm sync` + push。

## 隐私说明

- 只调用公开接口 `api.bilibili.com/x/space/bangumi/follow/list`，仅需 UID，不使用、不存储任何 Cookie/Token。
- 站点为纯静态，数据全部来自仓库内的 `data/anime.json`。
