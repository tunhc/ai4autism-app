/**
 * One-time migration: gán tất cả video trong Bunny Stream vào collection của từng bé.
 *
 * Title format hiện tại: {child_id}_{asset_id}
 * → extract child_id từ title → getOrCreate collection → update video
 *
 * Chạy: node project/migrate_bunny_collections.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const LIB = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE;
const KEY = process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY;
const BASE = `https://video.bunnycdn.com/library/${LIB}`;
const HEADERS = { AccessKey: KEY, accept: 'application/json', 'Content-Type': 'application/json' };

if (!LIB || !KEY) {
  console.error('Thiếu EXPO_PUBLIC_BUNNY_STORAGE_ZONE hoặc EXPO_PUBLIC_BUNNY_STORAGE_API_KEY trong .env');
  process.exit(1);
}

// Delay nhỏ giữa các request để tránh rate limit
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAllVideos() {
  let page = 1;
  const all = [];
  while (true) {
    const res = await fetch(`${BASE}/videos?page=${page}&itemsPerPage=100&orderBy=date`, { headers: HEADERS });
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    console.log(`  Đã fetch trang ${page}: ${items.length} video (tổng: ${all.length}/${data.totalItems})`);
    if (all.length >= data.totalItems || items.length === 0) break;
    page++;
    await sleep(200);
  }
  return all;
}

async function getOrCreateCollection(childId, collectionCache) {
  if (collectionCache[childId]) return collectionCache[childId];

  // Tìm collection đã có
  const listRes = await fetch(`${BASE}/collections?page=1&itemsPerPage=100`, { headers: HEADERS });
  const listData = await listRes.json();
  const existing = (listData.items || []).find(c => c.name === `child_${childId}`);
  if (existing) {
    collectionCache[childId] = existing.guid;
    return existing.guid;
  }

  // Tạo mới
  await sleep(100);
  const createRes = await fetch(`${BASE}/collections`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ name: `child_${childId}` }),
  });
  if (!createRes.ok) {
    console.warn(`  Không tạo được collection cho ${childId}:`, await createRes.text());
    return null;
  }
  const created = await createRes.json();
  console.log(`  Tạo collection mới: child_${childId} → ${created.guid}`);
  collectionCache[childId] = created.guid;
  return created.guid;
}

async function assignVideoToCollection(videoGuid, collectionId) {
  const res = await fetch(`${BASE}/videos/${videoGuid}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ collectionId }),
  });
  return res.ok;
}

async function main() {
  console.log(`\n=== Bunny Stream Migration: gán video vào collection theo bé ===`);
  console.log(`Library ID: ${LIB}\n`);

  console.log('1. Đang tải danh sách video...');
  const videos = await fetchAllVideos();
  console.log(`   Tổng: ${videos.length} video\n`);

  // Nhóm video theo child_id từ title
  const byChild = {};
  const skipped = [];
  for (const v of videos) {
    const parts = v.title?.split('_');
    const maybeChildId = parts?.[0];
    // Kiểm tra là UUID hợp lệ
    if (maybeChildId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybeChildId)) {
      if (!byChild[maybeChildId]) byChild[maybeChildId] = [];
      byChild[maybeChildId].push(v);
    } else {
      skipped.push(v);
    }
  }

  const childIds = Object.keys(byChild);
  console.log(`2. Phân tích title: tìm thấy ${childIds.length} bé, ${skipped.length} video không rõ chủ nhân`);
  for (const cid of childIds) {
    console.log(`   child ${cid}: ${byChild[cid].length} video`);
  }
  console.log();

  // Tải collection list một lần để điền cache
  const collectionCache = {};
  const colListRes = await fetch(`${BASE}/collections?page=1&itemsPerPage=100`, { headers: HEADERS });
  const colListData = await colListRes.json();
  for (const c of colListData.items || []) {
    const match = c.name.match(/^child_(.+)$/);
    if (match) collectionCache[match[1]] = c.guid;
  }
  console.log(`3. Collection hiện có: ${Object.keys(collectionCache).length}`);
  console.log();

  // Assign từng video
  console.log('4. Bắt đầu gán video vào collection...');
  let done = 0, failed = 0, alreadyAssigned = 0;

  for (const [childId, childVideos] of Object.entries(byChild)) {
    const collectionId = await getOrCreateCollection(childId, collectionCache);
    if (!collectionId) { failed += childVideos.length; continue; }

    for (const v of childVideos) {
      if (v.collectionId === collectionId) {
        alreadyAssigned++;
        continue;
      }
      await sleep(80); // ~12 req/s để tránh rate limit
      const ok = await assignVideoToCollection(v.guid, collectionId);
      if (ok) { done++; } else { failed++; }
    }
    process.stdout.write(`\r   Đã xử lý: ${done + alreadyAssigned + failed}/${videos.length - skipped.length} video...`);
  }

  console.log(`\n\n=== Kết quả ===`);
  console.log(`  Gán thành công: ${done}`);
  console.log(`  Đã gán sẵn:    ${alreadyAssigned}`);
  console.log(`  Thất bại:       ${failed}`);
  console.log(`  Không rõ bé:    ${skipped.length}`);

  if (skipped.length) {
    console.log('\nVideo không nhận ra child_id (cần xử lý tay):');
    skipped.forEach(v => console.log(`  ${v.guid}  title: ${v.title}`));
  }
}

main().catch(err => { console.error('Lỗi:', err); process.exit(1); });
