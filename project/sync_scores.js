const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DOMAIN_WEIGHTS = {
  communication: 0.28,
  social:        0.25,
  behavior:      0.20,
  cognitive:     0.15,
  sensory:       0.07,
  motor:         0.05,
};

function calculateOverallScore(scores) {
  const val = (scores.communication_score || 0) * DOMAIN_WEIGHTS.communication +
              (scores.social_score || 0) * DOMAIN_WEIGHTS.social +
              (scores.behavior_score || 0) * DOMAIN_WEIGHTS.behavior +
              (scores.cognitive_score || 0) * DOMAIN_WEIGHTS.cognitive +
              (scores.sensory_score || 0) * DOMAIN_WEIGHTS.sensory +
              (scores.motor_score || 0) * DOMAIN_WEIGHTS.motor;
  return Math.round(val);
}

async function run() {
  console.log('--- 1. CLEANUP DUPLICATE CHILDREN ---');
  // Lấy tất cả children
  const { data: children, error: cErr } = await supabase.from('children').select('*').eq('is_active', true);
  if (cErr) throw cErr;

  const parentChildMap = {};
  for (const child of children) {
    if (!parentChildMap[child.parent_id]) {
      parentChildMap[child.parent_id] = [];
    }
    parentChildMap[child.parent_id].push(child);
  }

  for (const parentId in parentChildMap) {
    const list = parentChildMap[parentId];
    if (list.length > 1) {
      // Giữ lại child có tạo trước (cũ nhất) hoặc child có dữ liệu
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const keep = list[0];
      const duplicates = list.slice(1);
      console.log(`Found ${duplicates.length} duplicates for parent ${parentId}`);
      for (const dup of duplicates) {
        // Soft delete
        await supabase.from('children').update({ is_active: false }).eq('id', dup.id);
        console.log(`Soft deleted duplicate child: ${dup.id} (${dup.full_name})`);
      }
    }
  }

  console.log('\n--- 2. SYNC AI REPORTS TO HPDT ---');
  // Lấy tất cả ai_reports đã done
  const { data: reports, error: rErr } = await supabase
    .from('ai_reports')
    .select('*')
    .in('status', ['done', 'completed'])
    .order('created_at', { ascending: true }); // Cũ đến mới

  if (rErr) throw rErr;

  const latestReportsByChild = {};
  for (const r of reports) {
    latestReportsByChild[r.child_id] = r; // Lấy cái mới nhất
    
    // Ghi vào hpdt_history (nếu chưa có trong ngày)
    const dateStr = r.created_at.split('T')[0];
    const { data: existingHist } = await supabase
      .from('hpdt_history')
      .select('id')
      .eq('child_id', r.child_id)
      .gte('recorded_at', dateStr + 'T00:00:00Z')
      .lte('recorded_at', dateStr + 'T23:59:59Z')
      .maybeSingle();

    const overall = calculateOverallScore(r);
    
    if (!existingHist) {
      await supabase.from('hpdt_history').insert({
        child_id: r.child_id,
        recorded_at: r.created_at,
        source_report_id: r.id,
        communication_score: r.communication_score,
        social_score: r.social_score,
        behavior_score: r.behavior_score,
        sensory_score: r.sensory_score,
        motor_score: r.motor_score,
        cognitive_score: r.cognitive_score,
        overall_score: overall,
      });
      console.log(`Inserted hpdt_history for child ${r.child_id} on ${dateStr}`);
    }
  }

  // Cập nhật hpdt_profiles với data mới nhất
  for (const childId in latestReportsByChild) {
    const r = latestReportsByChild[childId];
    const overall = calculateOverallScore(r);

    const { data: existingProf } = await supabase
      .from('hpdt_profiles')
      .select('id')
      .eq('child_id', childId)
      .maybeSingle();

    if (existingProf) {
      await supabase.from('hpdt_profiles').update({
        communication_score: r.communication_score,
        social_score: r.social_score,
        behavior_score: r.behavior_score,
        sensory_score: r.sensory_score,
        motor_score: r.motor_score,
        cognitive_score: r.cognitive_score,
        overall_score: overall,
        last_updated: r.created_at,
      }).eq('id', existingProf.id);
      console.log(`Updated hpdt_profiles for child ${childId}`);
    } else {
      await supabase.from('hpdt_profiles').insert({
        child_id: childId,
        communication_score: r.communication_score,
        social_score: r.social_score,
        behavior_score: r.behavior_score,
        sensory_score: r.sensory_score,
        motor_score: r.motor_score,
        cognitive_score: r.cognitive_score,
        overall_score: overall,
        last_updated: r.created_at,
      });
      console.log(`Inserted hpdt_profiles for child ${childId}`);
    }
  }

  console.log('DONE!');
}

run().catch(console.error);
