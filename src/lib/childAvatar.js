import { Platform } from 'react-native';
import { supabase } from './supabase';

export function getChildDisplayAvatar(child) {
  return child?.avatar_3d_url || child?.avatar_thumb_url || child?.avatar_url || null;
}

export function calculateChildAge(dateOfBirth, atDate = new Date()) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return { years: 0, months: 0 };

  let years = atDate.getFullYear() - dob.getFullYear();
  let monthRemainder = atDate.getMonth() - dob.getMonth();

  if (atDate.getDate() < dob.getDate()) monthRemainder -= 1;
  if (monthRemainder < 0) {
    years -= 1;
    monthRemainder += 12;
  }

  const totalMonths = Math.max(0, years * 12 + monthRemainder);
  return { years: Math.max(0, years), months: totalMonths };
}

export function buildCloudinaryThumbUrl(url) {
  if (!url || !url.includes('/upload/')) return url || null;
  return url.replace('/upload/', '/upload/c_fill,g_face,w_160,h_160,q_auto,f_auto/');
}

// avatarType: 'source' | '3D' — determines subfolder inside {centerCode}/{childId}/ava/
export async function uploadChildAvatarToCloudinary({ asset, centerCode, childId, avatarType = 'source' }) {
  if (!asset?.uri && !asset?.file) return null;

  const body = new FormData();
  const fileName = asset.fileName || asset.file?.name || 'child-avatar.jpg';
  const mimeType = asset.mimeType || asset.file?.type || 'image/jpeg';

  if (Platform.OS === 'web') {
    // On web, expo-image-picker returns a blob/data URI — must fetch it as a Blob
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

  const folder = `${centerCode || 'BIC-HCM'}/${childId}/ava/${avatarType}`;
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

export async function enqueueChildAvatarGeneration({ child, parentId, centerCode, preferences = {} }) {
  if (!child?.id || !parentId || !child.avatar_url) return null;

  const age = calculateChildAge(child.date_of_birth);
  const targetFolder3D = `${centerCode || 'BIC-HCM'}/${child.id}/ava/3D`;
  const payload = {
    child_id: child.id,
    source_avatar_url: child.avatar_url,
    source_avatar_thumb_url: child.avatar_thumb_url,
    target_folder_3d: targetFolder3D,
    preferences,
  };

  try {
    const { data, error } = await supabase.functions.invoke('generate-child-avatar', {
      body: payload,
    });
    if (!error && data?.job_id) {
      await supabase
        .from('children')
        .update({ avatar_job_id: data.job_id, updated_at: new Date().toISOString() })
        .eq('id', child.id);
      return data.job_id;
    }
  } catch {
    // The Edge Function may not exist in local/pilot builds. Fall back to ai_jobs.
  }

  const { data: job, error: jobError } = await supabase
    .from('ai_jobs')
    .insert({
      job_type: 'avatar_generation',
      status: 'queued',
      priority: 2,
      subscription_plan: 'enterprise',
      child_id: child.id,
      triggered_by: parentId,
      input_data: {
        source_avatar_url: child.avatar_url,
        source_avatar_thumb_url: child.avatar_thumb_url,
        target_folder_3d: targetFolder3D,
        child_age_years: age.years,
        child_age_months: age.months,
        prompt_version: 'child_avatar_v1',
        preferences,
      },
    })
    .select('id')
    .single();

  if (jobError) throw jobError;

  await supabase
    .from('children')
    .update({ avatar_job_id: job.id, updated_at: new Date().toISOString() })
    .eq('id', child.id);

  return job.id;
}

export async function fetchChildAvatarState(childId) {
  const { data, error } = await supabase
    .from('children')
    .select('id, avatar_url, avatar_thumb_url, avatar_3d_url, avatar_job_id')
    .eq('id', childId)
    .single();
  if (error) throw error;
  return data;
}
