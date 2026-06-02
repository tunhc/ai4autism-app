import { Platform } from 'react-native';
import { supabase } from './supabase';

export function buildCloudinaryThumbUrl(url) {
  if (!url || !url.includes('/upload/')) return url || null;
  return url.replace('/upload/', '/upload/c_fill,g_face,w_160,h_160,q_auto,f_auto/');
}

export async function uploadTeacherAvatarToCloudinary({ asset, centerCode, teacherId }) {
  if (!asset?.uri && !asset?.file) return null;

  const body = new FormData();
  const fileName = asset.fileName || asset.file?.name || 'teacher-avatar.jpg';
  const mimeType = asset.mimeType || asset.file?.type || 'image/jpeg';

  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    body.append('file', blob, fileName);
  } else {
    body.append('file', {
      uri: asset.uri,
      type: mimeType,
      name: fileName,
    });
  }

  const folder = `${centerCode || 'BIC-HCM'}/teachers/${teacherId}/ava`;
  body.append('upload_preset', process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ai4autism_preset');
  body.append('folder', folder);

  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    console.error('[Cloudinary] upload failed:', JSON.stringify(result));
    throw new Error(result.error?.message || 'Không upload được avatar lên Cloudinary.');
  }

  return {
    url: result.secure_url,
    thumbUrl: buildCloudinaryThumbUrl(result.secure_url),
    publicId: result.public_id,
    folder,
  };
}
