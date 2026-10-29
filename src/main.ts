/**
 * ANIME ARCHIVE · 莱茵生命风格追番档案系统
 * 数据来自 scripts/sync.mjs 生成的 data/anime.json（构建期打包进站点）
 */
import './styles.css';
import raw from '../data/anime.json';

interface AnimeItem {
  seasonId: number;
  title: string;
  type: string;
  cover: string;
  squareCover: string;
  isFinish: boolean;
  epCount: number;
  rating: number | null;
  ratingCount: number;
  areas: string[];
  styles: string[];
  pubDate: string;
  url: string;
  latestEp: string;
  renewal: string;
  summary: string;
  status: 'watched' | 'watching' | 'want';
}

interface ArchiveData {
  uid: string;
  syncedAt: string;
  counts: Record<string, number>;
  items: AnimeItem[];
}

const data = raw as ArchiveData;

const STATUS_CN: Record<AnimeItem['status'], string> = {
  watched: '看过',
  watching: '在看',
  want: '想看',
};
const STATUS_CODE: Record<AnimeItem['status'], string> = {
  watched: 'W',
  watching: 'C',
  want: 'Q',
};

/** 给每条记录分配稳定档案编号：按状态 + 默认排序（放送时间倒序） */
function assignIndices(items: AnimeItem[]): Map<AnimeItem, string> {
  const map = new Map<AnimeItem, string>();
  const groups: Record<string, AnimeItem[]> = { watched: [], watching: [], want: [] };
  for (const it of items) groups[it.status].push(it);
  for (const key of Object.keys(groups)) {
    groups[key]
      .slice()
      .sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1))
      .forEach((it, i) => {
        map.set(it, `${STATUS_CODE[it.status as AnimeItem['status']]}-${String(i + 1).padStart(3, '0')}`);
      });
  }
  return map;
}
const indices = assignIndices(data.items);

/* ---------------- 滚动数字 ---------------- */

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function rollNumber(el: HTMLElement, target: number, decimals = 0, duration = 1100): void {
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const v = target * easeOut(p);
    el.textContent = v.toFixed(decimals);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- 开机序列 ---------------- */

const BOOT_LINES: [string, string][] = [
  ['RHINE ANIME ARCHIVE — ACCESS TERMINAL v0.1', ''],
  ['INITIALIZING RENDER CORE .......... ', 'OK'],
  [`LOADING RECORD DATABASE [${data.items.length}] ...... `, 'OK'],
  [`AUTHENTICATING OPERATOR UID ${data.uid} ... `, 'OK'],
  ['DECRYPTING ARCHIVE INDEX ........... ', 'OK'],
  ['WELCOME BACK, OPERATOR.', ''],
];

function runBoot(): Promise<void> {
  const boot = document.getElementById('boot')!;
  const linesEl = document.getElementById('boot-lines')!;
  const barFill = document.getElementById('boot-bar-fill')!;
  const app = document.getElementById('app')!;

  return new Promise((resolve) => {
    let line = 0;
    let ch = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      linesEl.textContent = BOOT_LINES.map(([l, ok]) => l + (ok ? `[${ok}]` : '')).join('\n');
      barFill.style.width = '100%';
      setTimeout(() => {
        boot.classList.add('is-done');
        app.hidden = false;
        requestAnimationFrame(() => app.classList.add('is-in'));
        setTimeout(resolve, 350);
      }, 320);
    };

    const tick = () => {
      if (done) return;
      if (line >= BOOT_LINES.length) { finish(); return; }
      const [text, ok] = BOOT_LINES[line];
      ch += 2;
      if (ch >= text.length) {
        linesEl.textContent =
          BOOT_LINES.slice(0, line).map(([l, o]) => l + (o ? `[${o}]` : '')).join('\n') +
          (line > 0 ? '\n' : '') + text + (ok ? `[${ok}]` : '');
        line += 1;
        ch = 0;
        barFill.style.width = `${Math.round((line / BOOT_LINES.length) * 100)}%`;
        setTimeout(tick, ok ? 190 : 300);
      } else {
        linesEl.textContent =
          BOOT_LINES.slice(0, line).map(([l, o]) => l + (o ? `[${o}]` : '')).join('\n') +
          (line > 0 ? '\n' : '') + text.slice(0, ch);
        setTimeout(tick, 16);
      }
    };
    setTimeout(tick, 260);

    const skip = () => { finish(); };
    boot.addEventListener('click', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    setTimeout(finish, 6000); // 兜底
  });
}

/* ---------------- 渲染 ---------------- */

type Filter = 'all' | AnimeItem['status'];
type SortKey = 'pub' | 'rating' | 'title';

let filter: Filter = 'all';
let query = '';
let sortKey: SortKey = 'pub';

const grid = document.getElementById('grid')!;
const empty = document.getElementById('empty')!;
const footerCount = document.getElementById('footer-count')!;

function currentItems(): AnimeItem[] {
  let list = data.items.filter((it) => filter === 'all' || it.status === filter);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.styles.some((s) => s.toLowerCase().includes(q)) ||
        it.areas.some((a) => a.toLowerCase().includes(q)),
    );
  }
  const sorted = list.slice();
  if (sortKey === 'pub') sorted.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
  if (sortKey === 'rating') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sortKey === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  return sorted;
}

function statusChip(status: AnimeItem['status']): string {
  return `<span class="card-status ${status}">${STATUS_CN[status]}</span>`;
}

function ratingText(r: number | null): string {
  return r == null ? 'N/A' : r.toFixed(1);
}

function render(): void {
  const list = currentItems();
  grid.innerHTML = '';
  empty.hidden = list.length > 0;
  footerCount.textContent = `SHOWING ${list.length} / ${data.items.length} RECORDS`;

  const frag = document.createDocumentFragment();
  list.forEach((it, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.setProperty('--i', String(Math.min(i, 24)));
    card.dataset.seasonId = String(it.seasonId);
    card.innerHTML = `
      <img class="card-cover" src="${it.cover}" referrerpolicy="no-referrer" loading="lazy" alt="${it.title}">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="card-index mono">${indices.get(it)}</span>
      ${statusChip(it.status)}
      <div class="card-body">
        <h3 class="card-title">${it.title}</h3>
        <div class="card-foot">
          <span class="card-type">${it.type || 'ANIME'}${it.isFinish ? ' · FIN' : ''}</span>
          <span class="card-rating ${it.rating == null ? 'none' : ''}">★ ${ratingText(it.rating)}</span>
        </div>
      </div>`;
    card.addEventListener('click', () => openDetail(it));
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

/* ---------------- 详情面板 ---------------- */

const detail = document.getElementById('detail')!;
let openItem: AnimeItem | null = null;

function metaRow(label: string, value: string): string {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function openDetail(it: AnimeItem): void {
  openItem = it;
  const img = document.getElementById('detail-cover-img') as HTMLImageElement;
  img.src = it.cover;
  img.alt = it.title;
  (document.getElementById('detail-index') as HTMLElement).textContent =
    `RECORD ${indices.get(it)} · SS${it.seasonId}`;
  document.getElementById('detail-title')!.textContent = it.title;

  const chips = [
    `<span class="pill status-${it.status}">${STATUS_CN[it.status]}</span>`,
    it.type ? `<span class="pill type">${it.type}</span>` : '',
    ...it.areas.map((a) => `<span class="pill">${a}</span>`),
    ...it.styles.slice(0, 6).map((s) => `<span class="pill">${s}</span>`),
  ].filter(Boolean);
  document.getElementById('detail-chips')!.innerHTML = chips.join('');

  document.getElementById('detail-meta')!.innerHTML = [
    metaRow('EPISODES', it.latestEp || (it.epCount ? `全 ${it.epCount} 话` : '未知')),
    metaRow('FINISHED', it.isFinish ? '已完结' : it.renewal ? `连载中 · ${it.renewal}` : '连载中'),
    metaRow('PUB DATE', it.pubDate || '未知'),
    metaRow('RATING COUNT', it.ratingCount ? String(it.ratingCount) : '—'),
  ].join('');

  document.getElementById('detail-summary')!.textContent = it.summary || '暂无官方简介。';

  const ratingEl = document.getElementById('detail-rating')!;
  if (it.rating == null) {
    ratingEl.textContent = '暂无评分';
    ratingEl.classList.add('none');
  } else {
    ratingEl.classList.remove('none');
    ratingEl.textContent = '0.0';
    rollNumber(ratingEl, it.rating, 1, 900);
  }

  const link = document.getElementById('detail-link') as HTMLAnchorElement;
  link.href = it.url;

  detail.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => detail.classList.add('is-open'));
}

function closeDetail(): void {
  if (!openItem) return;
  openItem = null;
  detail.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => { if (!openItem) detail.hidden = true; }, 440);
}

document.getElementById('detail-close')!.addEventListener('click', closeDetail);
document.getElementById('detail-backdrop')!.addEventListener('click', closeDetail);

/* ---------------- 工具栏事件 ---------------- */

document.getElementById('tabs')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tab') as HTMLElement | null;
  if (!btn) return;
  filter = btn.dataset.status as Filter;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === btn));
  render();
});

const searchInput = document.getElementById('search') as HTMLInputElement;
let searchTimer = 0;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    query = searchInput.value.trim();
    render();
  }, 180);
});

document.getElementById('sort')!.addEventListener('change', (e) => {
  sortKey = (e.target as HTMLSelectElement).value as SortKey;
  render();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
});

/* ---------------- 统计与元信息 ---------------- */

function renderStats(): void {
  const watched = data.items.filter((i) => i.status === 'watched');
  const ratings = watched.map((i) => i.rating).filter((r): r is number => r != null);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const totalEp = watched.reduce((sum, i) => sum + i.epCount, 0);

  const stats = document.getElementById('stats')!;
  stats.innerHTML = `
    <div class="stat is-accent">
      <div class="stat-label">WATCHED</div>
      <div class="stat-value"><span data-roll="${watched.length}">0</span><small>部</small></div>
      <div class="stat-unit">看过档案</div>
    </div>
    <div class="stat">
      <div class="stat-label">WATCHING</div>
      <div class="stat-value"><span data-roll="${data.counts.watching ?? 0}">0</span><small>部</small></div>
      <div class="stat-unit">追踪中</div>
    </div>
    <div class="stat">
      <div class="stat-label">PLAN TO WATCH</div>
      <div class="stat-value"><span data-roll="${data.counts.want ?? 0}">0</span><small>部</small></div>
      <div class="stat-unit">待归档</div>
    </div>
    <div class="stat">
      <div class="stat-label">AVG RATING / EPS</div>
      <div class="stat-value"><span data-roll="${avg == null ? 0 : avg.toFixed(1)}" data-dec="1">0.0</span><small>· ${totalEp} 话</small></div>
      <div class="stat-unit">看过均分 / 总集数</div>
    </div>`;

  stats.querySelectorAll<HTMLElement>('[data-roll]').forEach((el) => {
    const dec = Number(el.dataset.dec ?? 0);
    rollNumber(el, Number(el.dataset.roll), dec, 1400);
  });
}

function renderMeta(): void {
  const synced = new Date(data.syncedAt);
  document.getElementById('meta-uid')!.textContent = data.uid;
  document.getElementById('meta-sync')!.textContent =
    `${synced.getFullYear()}.${String(synced.getMonth() + 1).padStart(2, '0')}.${String(synced.getDate()).padStart(2, '0')}`;
}

/* ---------------- 启动 ---------------- */

renderStats();
renderMeta();
render();
await runBoot();
