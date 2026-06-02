/**
 * One-time migration: đổi tên collections từ child_{uuid} → {centerCode}_{childCode}
 *
 * Chuẩn bị trước khi chạy:
 *   1. Thêm dòng này vào .env:
 *      SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← lấy từ Supabase Dashboard > Settings > API
 *   2. Chạy: node project/rename_bunny_collections.js
 *   3. Xoá SUPABASE_SERVICE_ROLE_KEY khỏi .env sau khi xong
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIB          = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE;
const KEY          = process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY;
const BUNNY_BASE   = `https://video.bunnycdn.com/library/${LIB}`;
const BUNNY_HDR    = { AccessKey: KEY, accept: 'application/json', 'Content-Type': 'application/json' };

if (!SERVICE_KEY) {
  console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env');
  console.error('Thêm dòng: SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  process.exit(1);
}
if (!LIB || !KEY) {
  console.error('Thiếu BUNNY_STORAGE_ZONE hoặc BUNNY_STORAGE_API_KEY trong .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('\n=== Rename Bunny collections: child_{uuid} → {centerCode}_{childCode} ===\n');

  // 1. Lấy toàn bộ collections hiện tại trên Bunny
  const colRes = await fetch(`${BUNNY_BASE}/collections?page=1&itemsPerPage=100`, { headers: BUNNY_HDR });
  const colData = await colRes.json();
  const collections = (colData.items || []).filter(c => /^child_/.test(c.name));
  console.log(`Collections dạng child_{uuid}: ${collections.length}`);

  if (!collections.length) {
    console.log('Không còn collection nào cần đổi tên. Đã xong.');
    return;
  }

  // 2. Trích child_id từ tên collection
  const childIds = collections.map(c => c.name.replace('child_', ''));

  // 3. Query Supabase lấy child_code + center_code
  console.log('Đang query Supabase...');
  const { data: children, error } = await sb
    .from('children')
    .select('id, child_code, centers(center_code)')
    .in('id', childIds);

  if (error) {
    console.error('Lỗi query Supabase:', error.message);
    process.exit(1);
  }

  // Build map uuid → { childCode, centerCode }
  const infoMap = {};
  for (const c of children || []) {
    infoMap[c.id] = {
      childCode:  c.child_code || null,
      centerCode: c.centers?.center_code || null,
    };
  }

  console.log(`Tìm thấy thông tin cho ${Object.keys(infoMap).length}/${childIds.length} bé\n`);

  // 4. Đổi tên từng collection
  let renamed = 0, skipped = 0, failed = 0;

  for (const col of collections) {
    const childId = col.name.replace('child_', '');
    const info = infoMap[childId];

    if (!info?.childCode || !info?.centerCode) {
      console.warn(`  SKIP ${col.name} — không tìm thấy child_code/center_code`);
      skipped++;
      continue;
    }

    const newName = `${info.centerCode}_${info.childCode}`;

    if (col.name === newName) {
      console.log(`  OK   ${col.name} (đã đúng tên)`);
      renamed++;
      continue;
    }

    await sleep(150);
    const res = await fetch(`${BUNNY_BASE}/collections/${col.guid}`, {
      method: 'POST',
      headers: BUNNY_HDR,
      body: JSON.stringify({ name: newName }),
    });

    if (res.ok) {
      console.log(`  ✓    ${col.name}  →  ${newName}`);
      renamed++;
    } else {
      console.error(`  ✗    ${col.name}  →  ${newName}  (${res.status}: ${await res.text()})`);
      failed++;
    }
  }

  console.log(`\n=== Kết quả ===`);
  console.log(`  Đổi tên thành công: ${renamed}`);
  console.log(`  Bỏ qua (thiếu info): ${skipped}`);
  console.log(`  Thất bại:            ${failed}`);

  if (skipped) {
    console.log('\nHint: các bé bị skip có thể không có child_code trong DB hoặc không liên kết center.');
  }
}

main().catch(err => { console.error('Lỗi:', err); process.exit(1); });
