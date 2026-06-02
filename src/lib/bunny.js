import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Các cấu hình Bunny.net lấy từ biến môi trường
const BUNNY_STORAGE_ZONE = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE;
const BUNNY_STORAGE_API_KEY = process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY;
const BUNNY_PULL_ZONE_URL = process.env.EXPO_PUBLIC_BUNNY_PULL_ZONE_URL;

// Tạo tên collection chuẩn: {centerCode}_{childCode}, fallback child_{uuid}
// Với video bài giảng (type = 'training'): {centerCode}_Training_{vstCode}
function buildCollectionName(centerCode, childCode, childId, type = 'observation', vstCode = '') {
  if (type === 'training' && centerCode && vstCode) {
    return `${centerCode}_Training_${vstCode}`;
  }
  if (centerCode && childCode) return `${centerCode}_${childCode}`;
  return `child_${childId}`;
}

/**
 * Tìm Collection trên Bunny Stream theo childId.
 * Ưu tiên tên mới {centerCode}_{childCode}, fallback tên cũ child_{uuid}.
 *
 * @param {string} childId
 * @param {string} [childCode]
 * @param {string} [centerCode]
 * @param {string} [type='observation']
 * @param {string} [vstCode='']
 */
export async function findChildCollection(childId, childCode, centerCode, type = 'observation', vstCode = '') {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) return null;
  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STORAGE_ZONE}/collections?page=1&itemsPerPage=100`,
      { headers: { 'AccessKey': BUNNY_STORAGE_API_KEY, 'accept': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.items || [];
    // Tìm tên mới trước
    const newName = buildCollectionName(centerCode, childCode, childId, type, vstCode);
    const found = items.find(c => c.name === newName)
      || items.find(c => c.name === `child_${childId}`); // fallback tên cũ
    return found ? found.guid : null;
  } catch {
    return null;
  }
}

/**
 * Lấy danh sách video từ Bunny Stream theo collection của một bé.
 *
 * @param {string} childId
 * @param {string} [childCode]
 * @param {string} [centerCode]
 * @param {string} [type='observation']
 * @param {string} [vstCode='']
 * @returns {Promise<Array>}
 */
export async function listBunnyChildVideos(childId, childCode, centerCode, type = 'observation', vstCode = '') {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY || !BUNNY_PULL_ZONE_URL) return [];

  const collectionId = await findChildCollection(childId, childCode, centerCode, type, vstCode);
  if (!collectionId) return [];

  let pullZoneUrl = BUNNY_PULL_ZONE_URL.trim();
  if (!pullZoneUrl.startsWith('http')) pullZoneUrl = `https://${pullZoneUrl}`;
  if (pullZoneUrl.endsWith('/')) pullZoneUrl = pullZoneUrl.slice(0, -1);

  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STORAGE_ZONE}/videos?page=1&itemsPerPage=100&collection=${collectionId}&orderBy=date`,
      { headers: { 'AccessKey': BUNNY_STORAGE_API_KEY, 'accept': 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json();

    return (data.items || []).map(v => ({
      id: v.guid,
      bunny_video_id: v.guid,
      bunny_collection_id: collectionId,
      child_id: childId,
      title: v.title || '',
      video_url: `${pullZoneUrl}/${v.guid}/playlist.m3u8`,
      thumbnail_url: v.thumbnailFileName
        ? `${pullZoneUrl}/${v.guid}/${v.thumbnailFileName}`
        : null,
      duration_seconds: v.length || null,
      video_status: v.status === 4 ? 'ready' : v.status === 3 ? 'processing' : 'pending',
      provider: 'bunny',
      created_at: v.dateUploaded || null,
    }));
  } catch (err) {
    console.warn('listBunnyChildVideos error:', err.message);
    return [];
  }
}

/**
 * Lấy hoặc tạo mới Collection trên Bunny Stream cho một trẻ.
 * Tên collection: {centerCode}_{childCode} (vd: BIC-HCM_MA001)
 *
 * @param {string} childId
 * @param {string} [childCode]
 * @param {string} [centerCode]
 * @param {string} [type='observation']
 * @param {string} [vstCode='']
 * @returns {Promise<string>} collectionId trên Bunny Stream
 */
export async function getOrCreateChildCollection(childId, childCode = '', centerCode = '', type = 'observation', vstCode = '') {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    throw new Error('Thiếu cấu hình Bunny.net trong file .env.');
  }

  const baseUrl = `https://video.bunnycdn.com/library/${BUNNY_STORAGE_ZONE}/collections`;
  const headers = {
    'AccessKey': BUNNY_STORAGE_API_KEY,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  };

  const collectionName = buildCollectionName(centerCode, childCode, childId, type, vstCode);

  const listRes = await fetch(`${baseUrl}?page=1&itemsPerPage=100`, { headers });
  if (!listRes.ok) throw new Error(`Không thể lấy danh sách collections: ${await listRes.text()}`);

  const listData = await listRes.json();
  const items = listData.items || [];
  // Tìm tên mới, fallback tên cũ
  const existing = items.find(c => c.name === collectionName)
    || items.find(c => c.name === `child_${childId}`);
  if (existing) return existing.guid;

  const createRes = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: collectionName }),
  });
  if (!createRes.ok) throw new Error(`Không thể tạo collection: ${await createRes.text()}`);

  const newCollection = await createRes.json();
  console.log(`Tạo collection: ${collectionName} → ${newCollection.guid}`);
  return newCollection.guid;
}

/**
 * Upload video lên Bunny Stream, tự động gắn vào Collection của trẻ.
 * Support cả Web và Mobile với tiến trình upload thời gian thực (real-time progress)
 *
 * @param {object} selectedVideoParams - Đối tượng video chứa uri, filename, file (chỉ có trên web), size
 * @param {object} childInfo           - { childId, childCode, centerCode, type, vstCode } để gắn video vào đúng collection
 * @param {function} onProgress        - Callback nhận tiến trình upload (%)
 * @returns {Promise<{playUrl: string, videoGuid: string}>} URL HLS và GUID của video
 */
export async function uploadVideoToBunny(selectedVideoParams, childInfo = {}, onProgress) {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY || !BUNNY_PULL_ZONE_URL) {
    throw new Error('Thiếu cấu hình Bunny.net trong file .env (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_PULL_ZONE_URL).');
  }

  const { uri, filename, file } = selectedVideoParams;
  const { childId, childCode, centerCode, type = 'observation', vstCode } = childInfo;

  // Đảm bảo tên file an toàn (bỏ dấu tiếng Việt, ký tự đặc biệt)
  const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;

  // 1. Lấy hoặc tạo Collection cho trẻ/trung tâm (nếu có childId hoặc nếu là video training)
  let collectionId = null;
  if (childId || type === 'training') {
    try {
      collectionId = await getOrCreateChildCollection(childId, childCode, centerCode, type, vstCode);
    } catch (err) {
      console.warn('Không thể gắn collection, video sẽ upload không có collection:', err.message);
    }
  }

  // 2. Tạo video record trên Bunny Stream để lấy GUID (Video ID)
  console.log('Đang khởi tạo video record trên Bunny Stream...');
  const createVideoUrl = `https://video.bunnycdn.com/library/${BUNNY_STORAGE_ZONE}/videos`;

  let videoGuid = '';
  try {
    const createBody = { title: cleanFilename };
    if (collectionId) createBody.collectionId = collectionId;

    const createRes = await fetch(createVideoUrl, {
      method: 'POST',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(createBody)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Bunny Stream API error: ${errText}`);
    }

    const videoData = await createRes.json();
    videoGuid = videoData.guid;
    console.log('Khởi tạo video thành công, Video GUID:', videoGuid);
  } catch (err) {
    console.error('Lỗi khi tạo video record trên Bunny Stream:', err);
    throw new Error(`Không thể khởi tạo video trên Bunny Stream: ${err.message}`);
  }

  // 3. Endpoint tải video lên Bunny Stream
  const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_STORAGE_ZONE}/videos/${videoGuid}`;

  // Chuẩn hoá Pull Zone URL
  let pullZoneCleanUrl = BUNNY_PULL_ZONE_URL.trim();
  if (!pullZoneCleanUrl.startsWith('http://') && !pullZoneCleanUrl.startsWith('https://')) {
    pullZoneCleanUrl = `https://${pullZoneCleanUrl}`;
  }
  if (pullZoneCleanUrl.endsWith('/')) {
    pullZoneCleanUrl = pullZoneCleanUrl.slice(0, -1);
  }
  
  // Link phát video dạng HLS Stream (playlist.m3u8)
  const playUrl = `${pullZoneCleanUrl}/${videoGuid}/playlist.m3u8`;

  if (Platform.OS === 'web') {
    // Luồng upload dành cho Web: Dùng XMLHttpRequest để lắng nghe tiến trình upload thời gian thực
    return new Promise((resolve, reject) => {
      const fileToUpload = file || selectedVideoParams; // fallback phòng hờ
      
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('AccessKey', BUNNY_STORAGE_API_KEY);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      // Theo dõi tiến trình tải lên
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          console.log('Bunny Stream Web Upload Success:', playUrl);
          resolve({ playUrl, videoGuid, collectionId });
        } else {
          let errorMsg = 'Upload failed';
          try {
            const resp = JSON.parse(xhr.responseText);
            errorMsg = resp.Message || errorMsg;
          } catch (_) {}
          reject(new Error(`Bunny Stream Upload Error (${xhr.status}): ${errorMsg}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Kết nối mạng thất bại khi tải lên Bunny Stream.'));
      };

      // Gửi dữ liệu nhị phân của file
      if (fileToUpload instanceof File || fileToUpload instanceof Blob) {
        xhr.send(fileToUpload);
      } else {
        // Nếu không có đối tượng file/blob trực tiếp, ta sẽ fetch lại blob từ URI cục bộ
        fetch(uri)
          .then(res => res.blob())
          .then(blob => xhr.send(blob))
          .catch(err => reject(new Error(`Không thể đọc file từ uri: ${err.message}`)));
      }
    });
  } else {
    // Luồng upload dành cho Mobile: Dùng expo-file-system createUploadTask
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      uri,
      {
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      },
      (data) => {
        if (onProgress && data.totalBytesExpectedToSend > 0) {
          const pct = Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100);
          onProgress(Math.min(pct, 100));
        }
      }
    );

    const result = await uploadTask.uploadAsync();
    
    if (result.status === 200 || result.status === 201) {
      console.log('Bunny Stream Mobile Upload Success:', playUrl);
      return { playUrl, videoGuid, collectionId };
    } else {
      let errorMsg = 'Upload failed';
      try {
        const resp = JSON.parse(result.body);
        errorMsg = resp.Message || errorMsg;
      } catch (_) {}
      throw new Error(`Bunny Stream Upload Error (${result.status}): ${errorMsg}`);
    }
  }
}
