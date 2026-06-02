// @ts-nocheck — Deno runtime; TS errors from VS Code Node config are false positives
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function calculateAge(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return { years: Math.max(0, years), months: Math.max(0, years * 12 + months) };
}

function buildPrompt(ageYears: number, gender: string, preferences: Record<string, string>) {
  const g = gender === 'male' ? 'boy' : gender === 'female' ? 'girl' : 'child';
  return (
    `Create a cute, child-safe, stylized 3D cartoon avatar of a ${ageYears}-year-old ${g}. ` +
    `Use the reference photo only for loose visual inspiration — hairstyle, hair color, glasses, and friendly expression. ` +
    `Do NOT recreate the real face. Do NOT make it photorealistic. ` +
    `Style: high-quality 3D cartoon character, soft rounded features, warm friendly smile, ` +
    `age-appropriate child appearance, bright clean studio lighting, simple neutral background, ` +
    `centered head-and-shoulders composition, suitable as a mobile app profile avatar. ` +
    `Favorite theme: ${preferences?.favorite_theme || 'friendly learning'}. ` +
    `Outfit color: ${preferences?.outfit_color || 'soft pastel'}. ` +
    `Safety: no photorealism, no text, no medical symbols, no adult styling, no scary elements.`
  );
}

// Upload to Cloudinary using unsigned preset — same as mobile app, no API secret needed
async function cloudinaryUpload(
  base64Image: string,
  cloudName: string,
  uploadPreset: string,
  folder: string,
): Promise<{ secure_url: string; public_id: string }> {
  const form = new FormData();
  form.append('file', `data:image/png;base64,${base64Image}`);
  form.append('upload_preset', uploadPreset);
  form.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const result = await res.json();
  if (!res.ok || !result.secure_url) {
    throw new Error(`Cloudinary upload failed: ${JSON.stringify(result)}`);
  }
  return { secure_url: result.secure_url, public_id: result.public_id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseUrl   = Deno.env.get('SUPABASE_URL')!;
    const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey     = Deno.env.get('OPENAI_API_KEY')!;
    const cloudName     = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
    const uploadPreset  = Deno.env.get('CLOUDINARY_UPLOAD_PRESET') ?? 'ai4autism';

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      child_id,
      source_avatar_url,
      source_avatar_thumb_url,
      target_folder_3d,
      preferences = {},
    } = body;

    if (!child_id || !source_avatar_url) {
      return json({ error: 'child_id and source_avatar_url are required' }, 400);
    }

    // ── Load child ────────────────────────────────────────────────────────────
    const { data: child, error: childErr } = await supabase
      .from('children')
      .select('id, date_of_birth, gender, avatar_url, avatar_3d_url, avatar_job_id')
      .eq('id', child_id)
      .single();
    if (childErr || !child) return json({ error: 'Child not found' }, 404);

    const age = calculateAge(child.date_of_birth || '2020-01-01');

    // ── Create ai_jobs row (processing) ───────────────────────────────────────
    const { data: job, error: jobErr } = await supabase
      .from('ai_jobs')
      .insert({
        job_type: 'avatar_generation',
        status: 'processing',
        priority: 2,
        subscription_plan: 'enterprise',
        child_id: child.id,
        triggered_by: user.id,
        started_at: new Date().toISOString(),
        input_data: {
          source_avatar_url,
          source_avatar_thumb_url,
          child_age_years: age.years,
          child_age_months: age.months,
          prompt_version: 'child_avatar_v1',
          target_folder_3d,
          preferences,
        },
      })
      .select('id')
      .single();
    if (jobErr) throw jobErr;

    await supabase.from('children')
      .update({ avatar_job_id: job.id })
      .eq('id', child.id);

    // ── Build prompt ──────────────────────────────────────────────────────────
    const prompt = buildPrompt(age.years, child.gender, preferences);
    const openai = new OpenAI({ apiKey: openaiKey });
    let imageBase64: string | null = null;

    // ── Try images.edit with source photo (gpt-image-1 uses it as reference) ─
    try {
      const srcRes = await fetch(source_avatar_url);
      if (srcRes.ok) {
        const srcBlob = await srcRes.blob();
        // Convert to PNG blob (required by images.edit)
        const srcFile = new File([srcBlob], 'source.png', { type: 'image/png' });
        const edited = await openai.images.edit({
          model: 'gpt-image-1',
          image: srcFile,
          prompt,
          size: '1024x1024',
          n: 1,
        });
        // gpt-image-1 returns b64_json by default
        imageBase64 = (edited.data[0] as { b64_json?: string }).b64_json ?? null;
        console.log('[avatar] images.edit succeeded');
      }
    } catch (editErr) {
      console.warn('[avatar] images.edit failed, falling back to generate:', String(editErr));
    }

    // ── Fallback: text-only generate ──────────────────────────────────────────
    if (!imageBase64) {
      const generated = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        n: 1,
      });
      // gpt-image-1 always returns b64_json (no response_format param needed)
      imageBase64 = (generated.data[0] as { b64_json?: string }).b64_json ?? null;
      console.log('[avatar] images.generate fallback used');
    }

    if (!imageBase64) throw new Error('OpenAI returned no image data');

    // ── Upload to Cloudinary (unsigned preset) ────────────────────────────────
    const folder = target_folder_3d || `BIC-HCM/${child.id}/ava/3D`;
    const { secure_url: avatar3dUrl, public_id: cloudinaryPublicId } =
      await cloudinaryUpload(imageBase64, cloudName, uploadPreset, folder);

    console.log('[avatar] Cloudinary upload OK:', avatar3dUrl);

    // ── Update children ───────────────────────────────────────────────────────
    await supabase.from('children').update({
      avatar_3d_url: avatar3dUrl,
      avatar_job_id: job.id,
      updated_at: new Date().toISOString(),
    }).eq('id', child.id);

    // ── Update ai_jobs ────────────────────────────────────────────────────────
    await supabase.from('ai_jobs').update({
      status: 'completed',
      output_data: {
        avatar_3d_url: avatar3dUrl,
        cloudinary_public_id: cloudinaryPublicId,
        child_age_years: age.years,
        child_age_months: age.months,
        model: 'gpt-image-1',
        prompt_version: 'child_avatar_v1',
      },
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    // ── Optional: avatar log (non-fatal if table doesn't exist) ──────────────
    try {
      await supabase.from('child_avatar_generation_logs')
        .update({ is_current: false }).eq('child_id', child.id);
      await supabase.from('child_avatar_generation_logs').insert({
        child_id: child.id,
        parent_id: user.id,
        ai_job_id: job.id,
        source_avatar_url,
        source_avatar_thumb_url,
        generated_avatar_3d_url: avatar3dUrl,
        child_age_years: age.years,
        child_age_months: age.months,
        prompt_version: 'child_avatar_v1',
        model: 'gpt-image-1',
        cloudinary_public_id: cloudinaryPublicId,
        status: 'completed',
        is_current: true,
        completed_at: new Date().toISOString(),
      });
    } catch { /* log table is optional */ }

    return json({ job_id: job.id, avatar_3d_url: avatar3dUrl });

  } catch (err) {
    console.error('[generate-child-avatar] error:', err);
    return json({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});
