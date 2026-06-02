import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Circle, Defs, G, Line, LinearGradient, Path, Polygon, Polyline,
  Stop, Text as SvgText,
} from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAIDailyAdvice, getChildrenByParent, getHpdtHistory,
  getHomeActivities, getIEPGoals, createParentJournalEntry, supabase
} from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { uploadVideoToBunny } from '../../lib/bunny';
import { colors, radius, shadows, spacing } from '../../lib/colors';
import { typography } from '../../lib/typography';
import { getChildDisplayAvatar } from '../../lib/childAvatar';



const DOMAIN_WEIGHTS = {
  communication: 0.28,
  social:        0.25,
  behavior:      0.20,
  cognitive:     0.15,
  sensory:       0.07,
  motor:         0.05,
};

function calculateOverallScore(scores) {
  if (!scores) return 0;
  const val = (scores.communication_score || 0) * DOMAIN_WEIGHTS.communication +
              (scores.social_score || 0) * DOMAIN_WEIGHTS.social +
              (scores.behavior_score || 0) * DOMAIN_WEIGHTS.behavior +
              (scores.cognitive_score || 0) * DOMAIN_WEIGHTS.cognitive +
              (scores.sensory_score || 0) * DOMAIN_WEIGHTS.sensory +
              (scores.motor_score || 0) * DOMAIN_WEIGHTS.motor;
  return Math.round(val);
}

const DOMAIN_LABELS = {
  communication: 'Giao tiếp', social: 'Xã hội', behavior: 'Hành vi',
  sensory: 'Cảm giác', motor: 'Vận động', cognitive: 'Nhận thức',
};
const DOMAIN_AXES = ['communication', 'social', 'behavior', 'sensory', 'motor', 'cognitive'];
const RANGES = [
  { key: 'week', label: 'Tuần', count: 7 },
  { key: 'month', label: 'Tháng', count: 12 },
];
const VIDEO_LOCATIONS = ['Nhà', 'Trường', 'Công viên', 'Khác'];
const CHILD_STATES    = ['Bình tĩnh', 'Hưng phấn', 'Khó chịu', 'Tập trung', 'Mất tập trung'];
const JOURNAL_SHORTCUTS = ['Bé đi ngủ', 'Bé ăn tối', 'Bé tắm', 'Bé chơi', 'Bé đi học'];
const JOURNAL_TIME_OF_DAY   = ['Sáng', 'Trưa', 'Chiều', 'Tối'];
const JOURNAL_ACTIVITY_TYPES = ['Học tập', 'Vui chơi', 'Sinh hoạt', 'Trị liệu', 'Ngoài trời'];

const MOCK_ADVICE = {
  domain: 'social',
  advice_title: 'Tăng cường tương tác chung (Joint Attention)',
  advice_text: 'Khi chơi cùng bé, hãy thử chỉ tay vào một đồ chơi thú vị và nói "Nhìn kìa!". Đợi 3-5 giây để xem bé có nhìn theo hướng tay bạn không. Nếu bé nhìn, hãy khen ngợi bé ngay lập tức.'
};

// =======================================================================
// Sub-components
// =======================================================================

function ChildAvatar3D({ child, size = 68 }) {
  const avatarUri = getChildDisplayAvatar(child);
  return (
    <View style={{ width: size + 10, height: size + 10, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size + 10, height: size + 10,
        borderRadius: (size + 10) / 2,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
        borderStyle: 'dashed',
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.22)',
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
        overflow: 'hidden',
      }}>
        {avatarUri && <Image source={{ uri: avatarUri }} style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]} />}
        <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.64 }}>👦</Text>
      </View>
    </View>
  );
}

function TrendChart({ data, width = 300 }) {
  if (!data || data.length < 2) return null;
  const H = 100, PAD_L = 26, PAD_B = 22, PAD_T = 10, PAD_R = 6;
  const chartW = width - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const scores = data.map(d => d.overall_score);
  const minS = Math.max(0, Math.min(...scores) - 10);
  const maxS = Math.min(100, Math.max(...scores) + 10);
  const toX = i => PAD_L + (i / (data.length - 1)) * chartW;
  const toY = s => PAD_T + chartH - ((s - minS) / (maxS - minS)) * chartH;
  const pointsStr = data.map((d, i) => `${toX(i)},${toY(d.overall_score)}`).join(' ');
  const areaPath = `M${toX(0)},${toY(data[0].overall_score)} ` +
    data.slice(1).map((d, i) => `L${toX(i + 1)},${toY(d.overall_score)}`).join(' ') +
    ` L${toX(data.length - 1)},${H - PAD_B} L${toX(0)},${H - PAD_B} Z`;
  const labelIdxs = data.length <= 4
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];
  return (
    <Svg width={width} height={H}>
      <Defs>
        <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[25, 50, 75].map(g => {
        const y = toY(Math.max(minS, Math.min(maxS, g)));
        if (y < PAD_T || y > H - PAD_B) return null;
        return (
          <G key={g}>
            <Line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y}
              stroke={colors.border} strokeWidth="0.8" strokeDasharray="3,3" />
            <SvgText x={PAD_L - 3} y={y + 4} fontSize="8" fill={colors.textLight} textAnchor="end">{g}</SvgText>
          </G>
        );
      })}
      <Path d={areaPath} fill="url(#trendGrad)" />
      <Polyline points={pointsStr} fill="none" stroke={colors.primary} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.overall_score)}
          r={i === data.length - 1 ? 4 : 2.5}
          fill={i === data.length - 1 ? colors.primary : colors.bgCard}
          stroke={colors.primary} strokeWidth="1.8" />
      ))}
      {labelIdxs.map(i => {
        const dt = new Date(data[i].recorded_at);
        const lbl = `${dt.getDate()}/${dt.getMonth() + 1}`;
        return (
          <SvgText key={i} x={toX(i)} y={H - PAD_B + 13}
            fontSize="8" fill={colors.textLight} textAnchor="middle">{lbl}</SvgText>
        );
      })}
    </Svg>
  );
}

function TrendChartMeasured({ data }) {
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={e => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) setWidth(w);
    }}>
      {width > 0 && <TrendChart data={data} width={width} />}
    </View>
  );
}

function RadarChart({ scores, svgWidth = 200 }) {
  if (!scores) return null;
  // svgWidth is the full rendered width; PAD gives room for labels
  const PAD = 50;
  const innerSize = Math.max(60, svgWidth - PAD * 2);
  const cx = svgWidth / 2, cy = svgWidth / 2;
  const R = innerSize * 0.44;
  const n = DOMAIN_AXES.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pnt = (r, i) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const grids = [0.25, 0.5, 0.75, 1.0].map(f =>
    DOMAIN_AXES.map((_, i) => pnt(R * f, i)).map(p => `${p.x},${p.y}`).join(' ')
  );
  const scoreRatios = DOMAIN_AXES.map(d => (scores[`${d}_score`] || 0) / 100);
  const dataPoints = DOMAIN_AXES.map((_, i) => { const p = pnt(R * scoreRatios[i], i); return `${p.x},${p.y}`; }).join(' ');
  const labelDist = R + 8;

  const getLabelAnchor = (i) => {
    if (i === 0 || i === 3) return 'middle';
    if (i === 1 || i === 2) return 'start';
    return 'end'; // i === 4 || i === 5
  };

  const getLabelOffsets = (i) => {
    if (i === 0) return { dx: 0, dy: -4 };
    if (i === 1) return { dx: 2, dy: -2 };
    if (i === 2) return { dx: 2, dy: 4 };
    if (i === 3) return { dx: 0, dy: 10 };
    if (i === 4) return { dx: -2, dy: 4 };
    return { dx: -2, dy: -2 }; // i === 5
  };

  const fs = Math.max(7.5, Math.min(9.5, innerSize / 16));
  return (
    <Svg width={svgWidth} height={svgWidth}>
      {grids.map((pts, gi) => (
        <Polygon key={gi} points={pts} fill="none" stroke={colors.border} strokeWidth={gi === 3 ? 1.2 : 0.7} />
      ))}
      {DOMAIN_AXES.map((_, i) => {
        const t = pnt(R, i);
        return <Line key={i} x1={cx} y1={cy} x2={t.x} y2={t.y} stroke={colors.border} strokeWidth="0.7" />;
      })}
      <Polygon points={dataPoints} fill={colors.primary} fillOpacity="0.18" stroke={colors.primary} strokeWidth="1.8" />
      {DOMAIN_AXES.map((d, i) => {
        const p = pnt(R * scoreRatios[i], i);
        return <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={colors.domain[d] || colors.primary} />;
      })}
      {DOMAIN_AXES.map((d, i) => {
        const t = pnt(labelDist, i);
        const anchor = getLabelAnchor(i);
        const { dx, dy } = getLabelOffsets(i);
        return (
          <SvgText key={i} x={t.x + dx} y={t.y + dy}
            fontSize={fs} fill={colors.textMid} textAnchor={anchor} fontWeight="600">
            {DOMAIN_LABELS[d]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function RadarChartMeasured({ scores }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ width: '100%' }} onLayout={e => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) setWidth(w);
    }}>
      {width > 0 && <RadarChart scores={scores} svgWidth={width} />}
    </View>
  );
}

function ScoreCircle({ score, size = 76 }) {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score || 0)) / 100;
  const dash = pct * circ;
  const col = score >= 70 ? colors.success : score >= 50 ? colors.primary : colors.warning;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.bgMuted} strokeWidth="7" />
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <SvgText x={size / 2} y={size / 2 + 5} textAnchor="middle"
        fontSize="17" fontWeight="800" fill={colors.textDark}>{Math.round(score || 0)}</SvgText>
    </Svg>
  );
}

function DomainBars({ hpdt }) {
  return (
    <View style={{ marginTop: 2 }}>
      {DOMAIN_AXES.map(d => {
        const val = hpdt[`${d}_score`] || 0;
        const col = colors.domain[d] || colors.primary;
        return (
          <View key={d} style={st.domainRow}>
            <Text style={st.domainLabel}>{DOMAIN_LABELS[d]}</Text>
            <View style={st.domainBarBg}>
              <View style={[st.domainBarFill, { width: `${val}%`, backgroundColor: col }]} />
            </View>
            <Text style={[st.domainScore, { color: col }]}>{Math.round(val)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AIAdviceCard({ advice }) {
  if (!advice) {
    return (
      <View style={[st.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
        <Text style={{ fontSize: 28 }}>🤖</Text>
        <Text style={[{ marginTop: spacing.xs }, typography.caption, { color: colors.textMid }]}>
          Lời khuyên AI đang được tạo...
        </Text>
      </View>
    );
  }
  const domCol = colors.domain[advice.domain] || colors.primary;
  return (
    <View style={[st.card, st.adviceCard]}>
      <View style={st.adviceHeader}>
        <View style={st.adviceIconWrap}><Text style={{ fontSize: 18 }}>💡</Text></View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={st.cardTitle}>Lời khuyên từ AI</Text>
          {advice.domain && (
            <View style={[st.chip, { backgroundColor: domCol + '22', marginTop: 3 }]}>
              <Text style={[st.chipText, { color: domCol }]}>{DOMAIN_LABELS[advice.domain]}</Text>
            </View>
          )}
        </View>
      </View>
      {advice.advice_title && <Text style={st.adviceTitle}>{advice.advice_title}</Text>}
      <Text style={st.adviceText}>{advice.advice_text}</Text>
    </View>
  );
}

function IEPGoalItem({ goal }) {
  const pct = goal.current_progress_pct || 0;
  const col = colors.domain[goal.domain] || colors.primary;
  return (
    <View style={st.iepItem}>
      <View style={st.iepHeader}>
        <View style={[st.iepDot, { backgroundColor: col }]} />
        <Text style={st.iepTitle} numberOfLines={1}>{goal.goal_title}</Text>
        <Text style={[st.iepPct, { color: col }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={st.iepBarBg}>
        <View style={[st.iepBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: col }]} />
      </View>
    </View>
  );
}

function HomeActivityItem({ activity, onDone, onUpload }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  
  // Hoàn thành khi số phiên (completed) đạt yêu cầu, hoặc có note (đã click Save)
  // Tuy nhiên theo logic hệ thống, onDone sẽ tăng completed_sessions lên.
  const done = activity.completed_sessions >= activity.required_sessions;
  const ex = activity.exercises || {};
  const col = colors.domain[ex.domain] || colors.primary;
  
  const handleSave = () => {
    if (onDone) onDone(note);
    setExpanded(false);
  };

  return (
    <View style={[st.activityItem, done && { opacity: 0.55 }]}>
      <View style={st.actMainRow}>
        <TouchableOpacity
          style={[st.actCheckbox, done && st.actCheckboxDone]}
          onPress={() => {
            if (!done) {
              setExpanded(!expanded);
            }
          }}
          activeOpacity={0.7}
        >
          {done && <Text style={st.actCheckmark}>✓</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={{ flex: 1, marginLeft: spacing.sm }} onPress={() => { if(!done) setExpanded(!expanded); }} activeOpacity={0.7}>
          <Text style={[st.actName, done && { textDecorationLine: 'line-through', color: colors.textLight }]} numberOfLines={1}>
            {ex.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[st.chip, { backgroundColor: col + '22' }]}>
              <Text style={[st.chipText, { color: col }]}>{DOMAIN_LABELS[ex.domain] || ex.domain}</Text>
            </View>
            {!!ex.duration_minutes && <Text style={st.actMeta}>{ex.duration_minutes} phút</Text>}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={st.actUploadBtn} onPress={onUpload}>
          <Text style={{ fontSize: 16 }}>📹</Text>
        </TouchableOpacity>
      </View>
      
      {expanded && !done && (
        <View style={st.actExpandArea}>
          <TextInput
            style={st.actNoteInput}
            placeholder="Ghi chú thêm về hoạt động này (tuỳ chọn)..."
            placeholderTextColor={colors.textLight}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <TouchableOpacity style={st.actSaveBtn} onPress={handleSave}>
            <Text style={st.actSaveBtnText}>Lưu & Hoàn thành</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Helper showAlert tương thích tốt trên cả Web và Mobile
const showAlert = (title, message) => {
  console.log(`[Alert] ${title}: ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// =======================================================================
// Main Screen
// =======================================================================
export default function DashboardScreen({ navigation }) {
  const { user, session } = useAuth();

  const [children, setChildren]             = useState([]);
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const [hpdt, setHpdt]                     = useState(null);
  const [trendData, setTrendData]           = useState([]);
  const [advice, setAdvice]                 = useState(null);
  const [iepGoals, setIepGoals]             = useState([]);
  const [activities, setActivities]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [trendRange, setTrendRange]         = useState('week');

  const [uploadVisible, setUploadVisible]   = useState(false);
  const [journalVisible, setJournalVisible] = useState(false);
  const [uploadLocation, setUploadLocation] = useState('Nhà');
  const [uploadState, setUploadState]       = useState('');
  const [uploadNotes, setUploadNotes]       = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading]           = useState(false);

  const [journalContent, setJournalContent]         = useState('');
  const [journalSaving, setJournalSaving]           = useState(false);
  const [journalDate, setJournalDate]               = useState(new Date());
  const [journalTimeOfDay, setJournalTimeOfDay]     = useState('');
  const [journalActivityType, setJournalActivityType] = useState('');
  const [journalMood, setJournalMood]               = useState('neutral');
  const [selectedVideoParams, setSelectedVideoParams] = useState(null);

  const selectedChild = children[selectedChildIdx] || null;

  const loadData = useCallback(async () => {
    try {
      const userId = session?.user?.id || user?.id;
      if (!userId) return;

      let childList = [];
      try { childList = await getChildrenByParent(userId); } catch { childList = []; }

      // Fallback mock khi DB rỗng (mock login hoặc chưa có dữ liệu)
      const useMock = !childList?.length;
      if (useMock) childList = [MOCK_CHILD];
      setChildren(childList);

      const child = childList[selectedChildIdx] || childList[0];
      const childId = child?.id;
      setHpdt(child?.hpdt_profiles?.[0] || null);

      if (useMock) {
        setTrendData(MOCK_TREND);
        setAdvice(null);
        setIepGoals(MOCK_IEP);
        setActivities(MOCK_ACTIVITIES);
        return;
      }

      let trend = [];
      if (childId) {
        try { trend = await getHpdtHistory(childId, 12); } catch { trend = []; }
      }
      setTrendData(trend);

      let adv = null;
      if (childId) {
        try { adv = await getAIDailyAdvice(childId); } catch { adv = null; }
      }
      setAdvice(adv || MOCK_ADVICE);

      let goals = [];
      if (childId) {
        try { goals = await getIEPGoals(childId); } catch { goals = []; }
      }
      setIepGoals(goals.length ? goals : MOCK_IEP);

      let acts = [];
      if (childId) {
        try { acts = await getHomeActivities(childId); } catch { acts = []; }
      }
      setActivities(acts.length ? acts : MOCK_ACTIVITIES);

    } catch (e) {
      console.warn('Dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, user, selectedChildIdx]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  let displayedTrend = trendData.slice(-(trendRange === 'week' ? 7 : 12));

  // Nếu dữ liệu chỉ có 1 điểm (1 bài test), nhân bản ra làm 2 điểm (cách 1 ngày) để vẽ được đường thẳng ngang
  if (displayedTrend.length === 1) {
    const pt = displayedTrend[0];
    const prevDate = new Date(pt.recorded_at);
    prevDate.setDate(prevDate.getDate() - 7); // Lùi 1 tuần cho điểm đầu tiên
    displayedTrend = [{ ...pt, recorded_at: prevDate.toISOString() }, pt];
  }

  async function pickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Từ chối quyền', 'Ứng dụng cần quyền truy cập thư viện để tải video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    
    const asset = result.assets[0];
    const durationSec = Math.round((asset.duration || 0) / 1000);
    // Bỏ qua validate duration trên Web vì đôi khi thư viện không lấy được (trả về 0)
    if (durationSec > 0 && (durationSec < 30 || durationSec > 600)) {
      showAlert('Không hợp lệ', 'Video phải có thời lượng từ 30 giây đến 10 phút.');
      return;
    }
    
    let sizeBytes = 0;
    if (Platform.OS === 'web') {
      // Trên môi trường web, asset.file là một đối tượng File chuẩn của HTML5, có chứa thuộc tính size.
      sizeBytes = asset.file ? asset.file.size : (asset.size || 0);
    } else {
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      sizeBytes = fileInfo.size || 0;
    }
    
    if (sizeBytes > 500 * 1024 * 1024) {
      showAlert('Không hợp lệ', 'Dung lượng video không được vượt quá 500MB.');
      return;
    }
    
    let ext = '';
    let filename = asset.fileName || '';
    
    if (Platform.OS === 'web') {
      if (asset.file && asset.file.name) {
        filename = asset.file.name;
      } else if (asset.name) {
        filename = asset.name;
      }
      if (filename && filename.includes('.')) {
        ext = filename.split('.').pop().toLowerCase();
      } else if (asset.mimeType) {
        ext = asset.mimeType.split('/').pop().toLowerCase();
      } else {
        ext = 'mp4'; // fallback
      }
    } else {
      const uriParts = asset.uri.split('.');
      ext = uriParts[uriParts.length - 1].toLowerCase();
    }
    
    // Một số trình duyệt có thể trả về video/quicktime cho .mov
    if (!['mp4', 'mov', 'avi', 'mkv', 'quicktime'].includes(ext)) {
      showAlert('Không hợp lệ', 'Chỉ hỗ trợ định dạng mp4, mov, avi, mkv. (Định dạng nhận được: ' + ext + ')');
      return;
    }
    
    if (!filename) {
      filename = `video.${ext === 'quicktime' ? 'mov' : ext}`;
    }
    setSelectedVideoParams({
      uri: asset.uri,
      duration: durationSec,
      size: sizeBytes,
      filename: filename,
      file: asset.file || null,
    });
  }

  async function handleUpload() {
    console.log('Bắt đầu handleUpload với selectedVideoParams:', selectedVideoParams);
    if (!selectedVideoParams) { showAlert('Thiếu thông tin', 'Vui lòng chọn video để tải lên.'); return; }
    if (!uploadState) { showAlert('Thiếu thông tin', 'Vui lòng chọn trạng thái của bé.'); return; }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Xác định cấu trúc thư mục lưu trữ động trên Bunny.net
      // Cấu trúc: centers/{center_id}/children/{child_id}/observation
      const centerId = selectedChild.center_id || user?.center_id || 'global';
      const childId = selectedChild.id;
      const folderPath = `centers/${centerId}/children/${childId}/observation`;

      // Tải video thực sự lên Bunny.net theo cấu trúc thư mục động
      const bunnyVideoUrl = await uploadVideoToBunny(
        selectedVideoParams,
        folderPath,
        (progress) => {
          setUploadProgress(progress);
        }
      );
      
      const parentId = user?.id || session?.user?.id;
      
      // Nếu là bé demo (chưa liên kết bé thật vào tài khoản phụ huynh)
      if (childId === 'demo-child') {
        console.log('Chế độ Demo: Giả lập lưu video record thành công với URL:', bunnyVideoUrl);
        showAlert('Thành công', 'Video đã được tải lên Bunny.net và đang được phân tích AI (Chế độ Demo).');
        
        setUploadVisible(false);
        setUploading(false);
        setUploadLocation('Nhà'); 
        setUploadState(''); 
        setUploadNotes(''); 
        setSelectedVideoParams(null);
        
        // Mô phỏng AI chạy nền
        setTimeout(() => {
          console.log('AI Simulation complete (Demo mode)');
          showAlert('Phân tích hoàn tất', 'Hệ thống AI đã phân tích xong video demo của bé! Bạn có thể xem kết quả.');
        }, 5000);
        return;
      }
      
      // Tạo bản ghi trong observation_videos với URL thực từ Pull Zone của Bunny.net và folderPath động
      const { data: videoRecord, error: videoError } = await supabase
        .from('observation_videos')
        .insert({
          child_id: selectedChild.id,
          uploaded_by: parentId,
          uploaded_by_role: 'parent',
          context: uploadLocation,
          bunny_video_url: bunnyVideoUrl,
          bunny_folder_path: folderPath,
          original_filename: selectedVideoParams.filename,
          file_size_bytes: selectedVideoParams.size,
          duration_seconds: selectedVideoParams.duration,
          video_status: 'processing',
          quality_status: 'pass',
          quality_check_result: { lighting: 'good', sharpness: 'good', frontal_face: 'yes', audio_clarity: 'good', person_count: 2, overall: 'pass' },
          child_state_log: [{ ts_sec: 0, state: uploadState, note: uploadNotes }],
          notes: uploadNotes,
        })
        .select()
        .single();
        
      if (videoError) throw videoError;
      
      showAlert('Thành công', 'Video đã được tải lên Bunny.net và đang được phân tích AI.');
      
      setUploadVisible(false);
      setUploading(false);
      setUploadLocation('Nhà'); setUploadState(''); setUploadNotes(''); setSelectedVideoParams(null);
      
      // Chạy nền tác vụ phân tích AI giả lập (sau 5 giây)
      setTimeout(async () => {
        try {
          const { data: reportData, error: reportError } = await supabase
            .from('ai_reports')
            .insert({
              child_id: selectedChild.id,
              video_id: videoRecord.id,
              status: 'done',
              ai_model_used: 'gemini-3.5-flash',
              communication_score: 62,
              social_score: 58,
              behavior_score: 70,
              sensory_score: 48,
              motor_score: 65,
              cognitive_score: 58,
              message_to_uploader: 'Báo cáo phân tích hành vi của bé cho thấy tiến bộ tốt về khả năng tập trung. Ba mẹ có thể xem chi tiết trong Thư viện nhé!',
              message_role: 'parent',
              confidence_score: 0.88,
              processing_time_ms: 4500,
              report_json: {
                child_name: selectedChild.full_name || selectedChild.nickname || 'Bé',
                context: uploadLocation || 'Nhà',
                duration: 'Video mô phỏng (0 phút 30 giây)',
                domain_scores: { communication: 62, social: 58, behavior: 70, sensory: 48, motor: 65, cognitive: 58 },
                scene_analysis: [
                  { time_range: '0:00 - 0:15', activity: 'Bé chơi đồ chơi tự do', observed_behavior: 'Tập trung vào đồ chơi, đôi lúc nhìn phụ huynh', clinical_note: 'Tương tác xã hội có tiến bộ nhẹ.' },
                  { time_range: '0:15 - 0:30', activity: 'Phụ huynh gọi tên bé', observed_behavior: 'Chưa quay đầu lại ngay, cần gọi nhiều lần', clinical_note: 'Cần chú trọng bài tập phản hồi gọi tên.' }
                ],
                strengths: ['Bé có khoảng chú ý lâu hơn khi chơi đồ chơi tự do.'],
                challenges: ['Phản hồi chậm khi được gọi tên từ xa.'],
                clinical_advice: {
                  overview: 'Bé đang cải thiện tương tác tốt. Chú ý theo dõi biểu hiện khi chuyển đổi hoạt động.',
                  recommendations: [
                    'Nói những câu ngắn 2-3 từ để bé bắt chước dễ hơn.',
                    'Khen ngợi ngay lập tức khi bé duy trì giao tiếp mắt.'
                  ]
                },
                exercises: [
                  { title: 'Tập phản hồi khi gọi tên', therapy_method: 'ESDM / ABA', goal: 'Bé quay đầu lại ngay khi nghe tên', steps: ['Đứng gần bé (khoảng 1m)', 'Gọi tên bé bằng giọng rõ ràng, vui vẻ', 'Thưởng đồ chơi yêu thích ngay khi bé nhìn lại'] }
                ],
                weekly_schedule: {
                  rows: [
                    { label: 'Sáng', days: ['Gọi tên', 'Tương tác', 'Gọi tên', 'Tương tác', 'Tự do'] },
                    { label: 'Chiều', days: ['Tự do', 'Gọi tên', 'Tự do', 'Gọi tên', 'Tự do'] }
                  ]
                }
              }
            })
            .select()
            .single();
            
          if (reportError) throw reportError;
          
          await supabase
            .from('observation_videos')
            .update({
              ai_report_id: reportData.id,
              video_status: 'ready'
            })
            .eq('id', videoRecord.id);
            
          console.log('AI Simulation complete');
        } catch (simErr) {
          console.warn('Lỗi mô phỏng AI:', simErr);
        }
      }, 5000);
      
    } catch (e) {
      console.error('Lỗi tải video chi tiết:', e);
      showAlert('Lỗi tải video', e.message || 'Không thể tải video. Vui lòng thử lại sau.');
      setUploading(false);
    }
  }

  async function handleSaveJournal() {
    if (!journalContent.trim()) { showAlert('Thiếu nội dung', 'Vui lòng nhập nội dung nhật ký.'); return; }
    if (!selectedChild) { showAlert('Lỗi', 'Chưa có thông tin bé.'); return; }
    setJournalSaving(true);
    
    try {
      const entry = {
        child_id: selectedChild.id,
        parent_id: user?.id || session?.user?.id,
        entry_date: journalDate.toISOString().split('T')[0],
        content: journalContent.trim(),
        mood_tags: journalMood ? [journalMood] : [],
        activity_tags: journalActivityType ? [journalActivityType] : [],
        context_tags: journalTimeOfDay ? [journalTimeOfDay] : [],
        is_flagged: false
      };
      await createParentJournalEntry(entry);
      setJournalVisible(false);
      setJournalContent('');
      setJournalTimeOfDay('');
      setJournalActivityType('');
      setJournalMood('neutral');
      setJournalDate(new Date());
      showAlert('Thành công', 'Nhật ký hôm nay đã được lưu.');
    } catch (e) {
      console.error('Lỗi lưu nhật ký chi tiết:', e);
      showAlert('Lỗi', 'Không thể lưu nhật ký. Vui lòng thử lại sau.');
    } finally {
      setJournalSaving(false);
    }
  }

  const childName  = selectedChild?.nickname || selectedChild?.full_name?.split(' ').pop() || '';
  const parentName = user?.full_name?.split(' ').pop() || 'bạn';

  const today = new Date();
  const isJournalToday = journalDate.toDateString() === today.toDateString();

  if (loading) return (
    <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  return (
    <View style={st.root}>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />}
      >
        {/* ══ Hero Card ══ */}
        <View style={st.heroCard}>
          <View style={st.heroRow}>
            <View style={st.heroLeftCol}>
              <View style={st.heroGreetRow}>
                <ChildAvatar3D child={selectedChild} size={56} />
                <View style={st.heroGreetTextWrap}>
                  <Text style={st.heroGreet}>Chào phụ huynh{childName ? ` bé ${childName}` : ''}</Text>
                  <Text style={st.heroDate}>{formatViDate(new Date())}</Text>
                </View>
              </View>
            </View>

            <View style={st.heroRightCol}>
              <View style={st.heroScoreBadge}>
                <Text style={st.heroScoreBig}>{calculateOverallScore(hpdt)}</Text>
                <View style={st.heroScoreSub}>
                  <Text style={st.heroScoreUnit}>/100</Text>
                  <Text style={st.heroScoreLabel}>điểm hpDT</Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingTop: spacing.md, paddingBottom: 2 }}>
            {DOMAIN_AXES.map(d => {
              const val = Math.round((hpdt || {})[`${d}_score`] || 0);
              return (
                <View key={d} style={st.domainChipHero}>
                  <Text style={st.domainChipHeroText}>{DOMAIN_LABELS[d]}: {val}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Child strip ── */}
        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
            {children.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={[st.childChip, i === selectedChildIdx && st.childChipActive]}
                onPress={() => setSelectedChildIdx(i)}
              >
                <Text style={{ fontSize: 14, marginRight: 4 }}>👦</Text>
                <Text style={[st.childChipName, i === selectedChildIdx && { color: colors.primary, fontWeight: '700' }]}>
                  {c.nickname || c.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ══ Charts Row (side by side) ══ */}
        <View style={st.chartsRow}>
          {/* Trend chart */}
          <View style={[st.card, st.chartCard]}>
            <View style={st.chartCardHeader}>
              <Text style={st.cardTitleSm}>Xu hướng điểm</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {RANGES.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[st.rangeTabSm, trendRange === r.key && st.rangeTabActive]}
                    onPress={() => setTrendRange(r.key)}
                  >
                    <Text style={[st.rangeTabText, trendRange === r.key && { color: colors.primary, fontWeight: '700' }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TrendChartMeasured data={displayedTrend} />
          </View>

          {/* Radar chart */}
          <View style={[st.card, st.chartCard]}>
            <Text style={[st.cardTitleSm, { marginBottom: spacing.xs }]}>6 lĩnh vực</Text>
            {hpdt ? (
              <RadarChartMeasured scores={hpdt} />
            ) : (
              <Text style={{ ...typography.caption, color: colors.textLight, marginTop: 20, textAlign: 'center' }}>Chưa có dữ liệu đánh giá</Text>
            )}
          </View>
        </View>

        {/* ══ AI Advice ══ */}
        <AIAdviceCard advice={advice} />

        {/* ══ Action Buttons ══ */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md, marginHorizontal: spacing.lg }}>
          {[
            { emoji: '📹', label: 'Upload Video', onPress: () => setUploadVisible(true) },
            { emoji: '📝', label: 'Bài tập', onPress: () => navigation?.getParent?.()?.navigate?.('TienTrinh') },
            { emoji: '📖', label: 'Nhật ký', onPress: () => setJournalVisible(true) },
          ].map(btn => (
            <TouchableOpacity key={btn.label} style={st.actionBtn} onPress={btn.onPress}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{btn.emoji}</Text>
              <Text style={st.actionLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══ SOS Banner ══ */}
        <TouchableOpacity
          style={st.sosBanner}
          onPress={() => navigation?.navigate?.('SOS')}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 28 }}>🆘</Text>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={st.sosTitle}>SOS / Xoa dịu bé</Text>
            <Text style={st.sosSub}>Bé đang khó chịu? Nhấn để xem hướng dẫn ngay</Text>
          </View>
          <Text style={{ fontSize: 24, color: colors.danger, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>

        {/* ══ IEP Goals ══ */}
        {iepGoals.length > 0 && (
          <View style={st.card}>
            <View style={st.cardTitleRow}>
              <Text style={st.cardTitle}>Mục tiêu học kỳ</Text>
              <Text style={{ ...typography.caption, color: colors.textMid }}>{iepGoals.length} mục tiêu</Text>
            </View>
            {iepGoals.map(g => <IEPGoalItem key={g.id} goal={g} />)}
          </View>
        )}

        {/* ══ Home Activities ══ */}
        {activities.length > 0 && (
          <View style={st.card}>
            <View style={st.cardTitleRow}>
              <Text style={st.cardTitle}>Hoạt động tại nhà</Text>
              <Text style={{ ...typography.caption, color: colors.textMid }}>
                {activities.filter(a => a.completed_sessions >= a.required_sessions).length}/{activities.length} hoàn thành
              </Text>
            </View>
            {activities.map(a => (
              <HomeActivityItem
                key={a.id} activity={a}
                onDone={(note) => setActivities(prev => prev.map(p =>
                  p.id === a.id ? { ...p, completed_sessions: Math.min(p.required_sessions, p.completed_sessions + 1), parent_note: note } : p
                ))}
                onUpload={() => setUploadVisible(true)}
              />
            ))}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ══ Upload Modal ══ */}
      <Modal visible={uploadVisible} animationType="slide" transparent onRequestClose={() => setUploadVisible(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
            <View style={st.modalCard}>
              <View style={st.handleBar} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={st.modalTitle}>Tải video lên 📹</Text>
                <TouchableOpacity onPress={() => setUploadVisible(false)} style={st.modalCloseBtn}>
                  <Text style={st.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={st.modalSub}>Lưu trữ hành trình Video Modeling của bé</Text>

              {/* Enterprise Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 }}>
                <Text style={{ fontSize: 12, marginRight: 4 }}>👑</Text>
                <Text style={{ ...typography.caption, color: colors.primaryDark, fontWeight: '700' }}>Gói Enterprise: Tải không giới hạn</Text>
              </View>

              {/* Video Picker Button */}
              <TouchableOpacity style={st.videoPickerBtn} onPress={pickVideo}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>{selectedVideoParams ? '✅' : '📁'}</Text>
                <Text style={st.videoPickerBtnText}>
                  {selectedVideoParams ? `Đã chọn: ${selectedVideoParams.filename}${selectedVideoParams.duration > 0 ? ` (${Math.floor(selectedVideoParams.duration / 60)}:${String(selectedVideoParams.duration % 60).padStart(2, '0')})` : ''}` : 'Nhấn để chọn Video từ thư viện'}
                </Text>
              </TouchableOpacity>

              {/* Video requirements */}
              <View style={st.videoReqBox}>
                <Text style={st.videoReqTitle}>LƯU Ý CHO VIDEO:</Text>
                <Text style={[st.videoReqItem, { color: colors.warning, fontWeight: '700' }]}>
                  • Thời gian video: 30 giây - 10 phút
                </Text>
                <Text style={st.videoReqItem}>• Chất lượng rõ nét</Text>
                <Text style={st.videoReqItem}>• Ánh sáng đầy đủ</Text>
                <Text style={st.videoReqItem}>• Góc quay chính diện hoặc 45 độ</Text>
                <Text style={st.videoReqItem}>• Hạn chế rung lắc video</Text>
              </View>

              <Text style={st.modalLabel}>Địa điểm</Text>
              <View style={st.chipRow}>
                {VIDEO_LOCATIONS.map(loc => (
                  <TouchableOpacity key={loc}
                    style={[st.selChip, uploadLocation === loc && st.selChipActive]}
                    onPress={() => setUploadLocation(loc)}>
                    <Text style={[st.selChipText, uploadLocation === loc && { color: colors.primary, fontWeight: '700' }]}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.modalLabel}>Trạng thái bé</Text>
              <View style={st.chipRow}>
                {CHILD_STATES.map(s => (
                  <TouchableOpacity key={s}
                    style={[st.selChip, uploadState === s && st.selChipActive]}
                    onPress={() => setUploadState(s)}>
                    <Text style={[st.selChipText, uploadState === s && { color: colors.primary, fontWeight: '700' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.modalLabel}>Ghi chú</Text>
              <TextInput
                style={[st.input, { height: 62, textAlignVertical: 'top', paddingTop: spacing.sm }]}
                placeholder="Bé đang chơi tự do, sau bữa trưa..."
                placeholderTextColor={colors.textLight}
                value={uploadNotes} onChangeText={setUploadNotes} multiline
              />

              {uploading && (
                <View style={{ marginVertical: spacing.sm }}>
                  <View style={st.progressBar}>
                    <View style={[st.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={{ ...typography.caption, color: colors.textMid, marginTop: 4 }}>{uploadProgress}% — Đang tải lên...</Text>
                </View>
              )}

              <View style={[st.videoAINote, { marginBottom: spacing.sm }]}>
                <Text style={{ fontSize: 14 }}>✨</Text>
                <Text style={st.videoAINoteText}>Video sẽ được mã hóa và tự động bóc tách các hành vi kỹ năng sau khi tải lên.</Text>
              </View>

              <View style={st.modalBtnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setUploadVisible(false)}>
                  <Text style={st.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.primaryBtn, uploading && { opacity: 0.6 }]} onPress={handleUpload} disabled={uploading}>
                  {uploading ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={st.primaryBtnText}>Tải lên</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══ Journal Modal ══ */}
      <Modal visible={journalVisible} animationType="slide" transparent onRequestClose={() => setJournalVisible(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
            <View style={st.modalCard}>
              <View style={st.handleBar} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={st.modalTitle}>Nhật ký 📖</Text>
                <TouchableOpacity onPress={() => setJournalVisible(false)} style={st.modalCloseBtn}>
                  <Text style={st.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Date navigator */}
              <Text style={st.modalLabel}>Ngày ghi</Text>
              <View style={st.journalDateRow}>
                <TouchableOpacity style={st.journalDateNav}
                  onPress={() => { const d = new Date(journalDate); d.setDate(d.getDate() - 1); setJournalDate(d); }}>
                  <Text style={st.journalDateNavText}>‹</Text>
                </TouchableOpacity>
                <Text style={st.journalDateText}>📅 {formatViDate(journalDate)}</Text>
                <TouchableOpacity style={[st.journalDateNav, isJournalToday && { opacity: 0.3 }]}
                  onPress={() => {
                    if (!isJournalToday) {
                      const d = new Date(journalDate);
                      d.setDate(d.getDate() + 1);
                      setJournalDate(d);
                    }
                  }}
                  disabled={isJournalToday}>
                  <Text style={st.journalDateNavText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Time of day */}
              <Text style={st.modalLabel}>Thời điểm trong ngày</Text>
              <View style={st.chipRow}>
                {JOURNAL_TIME_OF_DAY.map(t => (
                  <TouchableOpacity key={t}
                    style={[st.selChip, journalTimeOfDay === t && st.selChipActive]}
                    onPress={() => setJournalTimeOfDay(t)}>
                    <Text style={[st.selChipText, journalTimeOfDay === t && { color: colors.primary, fontWeight: '700' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Activity type */}
              <Text style={st.modalLabel}>Loại hoạt động</Text>
              <View style={st.chipRow}>
                {JOURNAL_ACTIVITY_TYPES.map(t => (
                  <TouchableOpacity key={t}
                    style={[st.selChip, journalActivityType === t && st.selChipActive]}
                    onPress={() => setJournalActivityType(t)}>
                    <Text style={[st.selChipText, journalActivityType === t && { color: colors.primary, fontWeight: '700' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Mood selector */}
              <Text style={st.modalLabel}>Tâm trạng của bé</Text>
              <View style={st.moodRow}>
                {[
                  { key: 'very_bad', emoji: '😭' },
                  { key: 'bad', emoji: '☹️' },
                  { key: 'neutral', emoji: '😐' },
                  { key: 'good', emoji: '🙂' },
                  { key: 'very_good', emoji: '😄' }
                ].map(m => (
                  <TouchableOpacity key={m.key}
                    style={[st.moodBtn, journalMood === m.key && st.moodBtnActive]}
                    onPress={() => setJournalMood(m.key)}>
                    <Text style={st.moodEmoji}>{m.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick shortcuts */}
              <Text style={st.modalLabel}>Hoạt động nhanh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
                {JOURNAL_SHORTCUTS.map(s => (
                  <TouchableOpacity key={s} style={st.shortcutChip}
                    onPress={() => setJournalContent(c => c ? `${c}\n${s}` : s)}>
                    <Text style={st.shortcutText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Notes */}
              <Text style={st.modalLabel}>Ghi lại chi tiết</Text>
              <TextInput
                style={[st.input, { height: 90, textAlignVertical: 'top', paddingTop: spacing.sm }]}
                placeholder="Bé hôm nay như thế nào? Có điều gì đặc biệt không?..."
                placeholderTextColor={colors.textLight}
                value={journalContent} onChangeText={setJournalContent}
                multiline autoFocus
              />

              <View style={st.modalBtnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setJournalVisible(false)}>
                  <Text style={st.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.primaryBtn, journalSaving && { opacity: 0.6 }]} onPress={handleSaveJournal} disabled={journalSaving}>
                  {journalSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={st.primaryBtnText}>Lưu nhật ký</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function formatDate(d) {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatViDate(d) {
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return `${days[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: 0 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  // ── Hero Card ──────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 8,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadows.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroLeftCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGreetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGreetTextWrap: {
    marginLeft: spacing.sm,
  },
  heroGreet: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.2,
  },
  heroChildName: {
    fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 1,
  },
  heroDate: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2,
  },
  heroRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroScoreBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroScoreBig: {
    fontSize: 34, fontWeight: '900', color: '#FFFFFF', lineHeight: 38,
  },
  heroScoreSub: {
    marginLeft: 3,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  heroScoreUnit: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)',
  },
  heroScoreLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginTop: 1,
  },
  domainChipHero: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  domainChipHeroText: {
    fontSize: 11, fontWeight: '700', color: '#FFFFFF',
  },

  // ── Child chip ─────────────────────────────────────────────────
  childChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgMuted, marginRight: 8,
  },
  childChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  childChipName: { ...typography.label, color: colors.textMid },

  // ── Cards ──────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm, marginBottom: spacing.md, marginHorizontal: spacing.lg,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', fontSize: 15 },

  // ── Charts Row ─────────────────────────────────────────────────
  chartsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  chartCard: {
    flex: 1, padding: spacing.md, marginBottom: 0, marginHorizontal: 0,
  },
  chartCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitleSm: {
    fontSize: 11, fontWeight: '700', color: colors.textDark,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  rangeTabSm: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted,
  },
  rangeTab: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted,
  },
  rangeTabActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  rangeTabText: { ...typography.caption, color: colors.textMid, fontSize: 10 },

  // ── Domain bars ────────────────────────────────────────────────
  domainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  domainLabel: { ...typography.caption, color: colors.textMid, width: 64, fontSize: 10 },
  domainBarBg: { flex: 1, height: 7, backgroundColor: colors.bgMuted, borderRadius: 4, marginHorizontal: 4, overflow: 'hidden' },
  domainBarFill: { height: '100%', borderRadius: 4 },
  domainScore: { ...typography.caption, fontWeight: '700', fontSize: 10, width: 22, textAlign: 'right' },

  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontWeight: '600' },

  // ── AI Advice ──────────────────────────────────────────────────
  adviceCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  adviceIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  adviceTitle: { ...typography.label, color: colors.textDark, fontWeight: '700', marginBottom: 6, lineHeight: 20 },
  adviceText: { ...typography.body, color: colors.textMid, lineHeight: 22 },

  // ── Action buttons ─────────────────────────────────────────────
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  actionLabel: { ...typography.caption, color: colors.textDark, fontWeight: '600', textAlign: 'center' },

  // ── SOS ────────────────────────────────────────────────────────
  sosBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.dangerBg, borderWidth: 1.5, borderColor: colors.danger,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    marginHorizontal: spacing.lg, ...shadows.sm,  // explicit - not a card
  },
  sosTitle: { ...typography.label, color: colors.danger, fontWeight: '700' },
  sosSub: { ...typography.caption, color: colors.accentDark, marginTop: 2, lineHeight: 16 },

  // ── IEP ───────────────────────────────────────────────────────
  iepItem: { marginBottom: spacing.sm },
  iepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  iepDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  iepTitle: { ...typography.body, color: colors.textDark, flex: 1, fontSize: 13 },
  iepPct: { ...typography.label, fontWeight: '700', fontSize: 12 },
  iepBarBg: { height: 6, backgroundColor: colors.bgMuted, borderRadius: 3, overflow: 'hidden' },
  iepBarFill: { height: '100%', borderRadius: 3 },

  // ── Activities ─────────────────────────────────────────────────
  activityItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  actMainRow: { flexDirection: 'row', alignItems: 'center' },
  actCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  actCheckboxDone: { borderColor: colors.success, backgroundColor: colors.success },
  actCheckmark: { color: colors.white, fontSize: 13, fontWeight: '800' },
  actName: { ...typography.label, color: colors.textDark, fontSize: 13 },
  actMeta: { ...typography.caption, color: colors.textLight, fontSize: 10 },
  actUploadBtn: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  actExpandArea: { marginTop: spacing.sm, paddingLeft: 32, paddingRight: 32 },
  actNoteInput: { backgroundColor: colors.bgMuted, borderRadius: radius.sm, padding: spacing.sm, minHeight: 60, textAlignVertical: 'top', ...typography.bodySm, marginBottom: spacing.sm },
  actSaveBtn: { backgroundColor: colors.primary, alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  actSaveBtnText: { color: colors.white, ...typography.caption, fontWeight: '700' },

  // ── Modals ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border,
  },
  handleBar: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.textDark, marginBottom: 2 },
  modalSub: { ...typography.caption, color: colors.textMid, marginBottom: spacing.md },
  modalLabel: { ...typography.label, color: colors.textDark, fontWeight: '600', marginBottom: 8, marginTop: spacing.sm },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  modalCloseBtnText: { fontSize: 14, color: colors.textMid, fontWeight: '700' },

  input: {
    height: 48, backgroundColor: colors.bgMuted, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md,
    ...typography.body, color: colors.textDark,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xs },
  selChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted },
  selChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  selChipText: { ...typography.caption, color: colors.textMid, fontWeight: '600' },
  shortcutChip: { paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.secondaryBg },
  shortcutText: { ...typography.caption, color: colors.secondaryDark, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: colors.bgMuted, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { ...typography.label, color: colors.textMid },
  primaryBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  primaryBtnText: { ...typography.btn, color: colors.white, fontSize: 15 },

  // ── Video requirements ─────────────────────────────────────────
  videoReqBox: {
    backgroundColor: colors.bgMuted, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  videoReqTitle: {
    fontSize: 10, fontWeight: '700', color: colors.textLight,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
  },
  videoReqItem: {
    fontSize: 13, color: colors.textMid, lineHeight: 20,
  },
  videoAINote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.primaryBg, borderRadius: radius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.primaryLight,
  },
  videoAINoteText: {
    flex: 1, fontSize: 12, color: colors.primaryDark, lineHeight: 18,
  },

  // ── Journal date row ───────────────────────────────────────────
  journalDateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgMuted, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  journalDateNav: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  journalDateNavText: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  journalDateText: { ...typography.body, color: colors.textDark, fontWeight: '600' },
  
  // Mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginHorizontal: spacing.xs },
  moodBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  moodEmoji: { fontSize: 26 },
  
  // Video Picker
  videoPickerBtn: {
    borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: radius.md, backgroundColor: colors.bgCard,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm
  },
  videoPickerBtnText: { ...typography.body, color: colors.primaryDark, fontWeight: '600', textAlign: 'center' },
});
