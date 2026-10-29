/**
 * sync.mjs —— 从 B 站公开接口拉取追番列表，生成 data/anime.json
 *
 * 数据源：https://api.bilibili.com/x/space/bangumi/follow/list
 *   type=1（番剧+国创）, follow_status: 1=在看 2=看过 3=想看
 * 纯公开数据，不需要任何登录凭据。
 * 带节流（每请求间隔 ≥300ms）和分页，尊重 B 站风控。
 *
 * 用法：node scripts/sync.mjs [uid]   // 缺省用 DEFAULT_UID
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_UID = '110701034';
const UID = process.argv[2] || DEFAULT_UID;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'anime.json');

const STATUSES = [
  { code: 2, label: 'watched', labelCN: '看过' },
  { code: 1, label: 'watching', labelCN: '在看' },
  { code: 3, label: 'want', labelCN: '想看' },
];
const PS = 30; // 每页条数（接口上限 30）
const GAP_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(status, pn) {
  const url =
    `https://api.bilibili.com/x/space/bangumi/follow/list` +
    `?vmid=${UID}&type=1&follow_status=${status}&pn=${pn}&ps=${PS}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Referer: `https://space.bilibili.com/${UID}/bangumi`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ status=${status} pn=${pn}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`API code=${json.code} msg=${json.message}`);
  return json.data;
}

/** 把接口的原始条目裁剪成站点需要的精简字段 */
function slim(it, statusLabel) {
  return {
    seasonId: it.season_id,
    title: it.title,
    type: it.season_type_name || '',          // 番剧 / 国创 / 影视…
    cover: it.cover,
    squareCover: it.square_cover || '',
    isFinish: it.is_finish === 1,
    epCount: it.formal_ep_count ?? it.total_count ?? 0,
    rating: it.rating?.score ?? null,
    ratingCount: it.rating?.count ?? 0,
    areas: (it.areas || []).map((a) => a.name),
    styles: it.styles || [],
    pubDate: it.publish?.release_date || it.publish?.pub_time || '',
    url: it.url || `https://www.bilibili.com/bangumi/play/ss${it.season_id}`,
    latestEp: it.new_ep?.index_show || '',     // 如「更新至第106话」「全12话」
    renewal: it.renewal_time || '',
    summary: (it.summary || it.evaluate || '').replace(/\s+/g, ' ').trim(),
    status: statusLabel,                       // watched / watching / want
  };
}

async function fetchAll() {
  const items = [];
  const meta = { counts: {} };
  for (const st of STATUSES) {
    let pn = 1;
    let total = Infinity;
    let count = 0;
    do {
      const data = await fetchPage(st.code, pn);
      total = data.total ?? 0;
      const list = data.list ?? [];
      for (const it of list) items.push(slim(it, st.label));
      count += list.length;
      meta.counts[st.label] = total;
      if (list.length === 0) break;
      pn += 1;
      await sleep(GAP_MS);
    } while (count < total && pn <= 50);
    console.log(`[${st.labelCN}] total=${total} fetched=${count}`);
  }
  return { items, meta };
}

const { items, meta } = await fetchAll();

const payload = {
  uid: UID,
  syncedAt: new Date().toISOString(),
  counts: meta.counts,
  items,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 1), 'utf8');
console.log(`OK -> ${OUT}  (${items.length} 条记录)`);
