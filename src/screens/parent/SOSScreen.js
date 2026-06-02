import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, SafeAreaView
} from 'react-native';
import { Audio } from 'expo-av';

const BG_COLOR = '#0B0E14';
const ACCENT_BLUE = '#6E9EFF';
const ACCENT_GREEN = '#5CC382';
const ACCENT_PURPLE = '#9B61FF';
const ACCENT_ORANGE = '#F6A800';
const PANEL_BG = '#141822';

const TABS = [
  { id: 'breath', label: 'NHỊP THỞ', icon: '🌬️', color: ACCENT_BLUE },
  { id: 'visual', label: 'THỊ GIÁC', icon: '👁️', color: ACCENT_PURPLE },
  { id: 'sound', label: 'ÂM THANH', icon: '🎵', color: ACCENT_GREEN },
  { id: 'ai', label: 'AI HỖ TRỢ', icon: '🧠', color: ACCENT_ORANGE },
];

const SOUND_TRACKS = [
  { id: 'rain',  label: 'Tiếng mưa rừng', desc: 'Âm thanh trắng giúp bé tập trung và bình tĩnh', src: require('../../../assets/sounds/rain.mp3') },
  { id: 'ocean', label: 'Sóng biển',       desc: 'Sóng vỗ nhẹ nhàng, thư giãn',                   src: require('../../../assets/sounds/ocean.mp3') },
  { id: 'white', label: 'Tiếng ồn trắng', desc: 'Giảm tiếng ồn gây xao nhãng xung quanh',        src: require('../../../assets/sounds/white-noise.mp3') },
  { id: 'piano', label: 'Nhạc không lời', desc: 'Giai điệu piano nhẹ nhàng xoa dịu',             src: require('../../../assets/sounds/piano.mp3') },
  { id: 'bird',  label: 'Tiếng chim hót', desc: 'Âm thanh thiên nhiên trong lành',               src: require('../../../assets/sounds/birds.mp3') },
];

export default function SOSScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('breath');
  
  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={{color: '#A0A0A0', fontSize: 24}}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={styles.sosBadge}>
            <Text style={styles.sosBadgeText}>❗ CHẾ ĐỘ SOS</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'breath' && <BreathTab />}
        {activeTab === 'visual' && <VisualTab />}
        {activeTab === 'sound' && <SoundTab />}
        {activeTab === 'ai' && <AITab />}
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => setActiveTab(tab.id)}>
              <View style={[styles.navIconBox, isActive && { backgroundColor: tab.color }]}>
                <Text style={{fontSize: 20, opacity: isActive ? 1 : 0.4}}>{tab.icon}</Text>
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  );
}

function BreathTab() {
  const [phase, setPhase] = useState('HÍT VÀO');
  const [countdown, setCountdown] = useState(4);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let currentPhase = 'HÍT VÀO';
    let timeLeft = 4;
    setPhase(currentPhase);
    setCountdown(timeLeft);

    // Initial animation
    Animated.timing(animValue, {
      toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.ease)
    }).start();

    const interval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        if (currentPhase === 'HÍT VÀO') {
          currentPhase = 'GIỮ';
          timeLeft = 4;
        } else if (currentPhase === 'GIỮ') {
          currentPhase = 'THỞ RA';
          timeLeft = 4;
          Animated.timing(animValue, {
            toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.ease)
          }).start();
        } else {
          currentPhase = 'HÍT VÀO';
          timeLeft = 4;
          Animated.timing(animValue, {
            toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.ease)
          }).start();
        }
        setPhase(currentPhase);
      }
      setCountdown(timeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const scale = animValue.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] });
  const opacity = animValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.tabContainer}>
      <View style={styles.breathCircleContainer}>
        <Animated.View style={[styles.breathCircleOuter, { transform: [{ scale }], opacity }]} />
        <View style={styles.breathCircleInner}>
          <Text style={styles.breathCount}>{countdown}</Text>
          <Text style={styles.breathPhase}>{phase}</Text>
        </View>
      </View>
      <View style={{marginTop: 60, alignItems: 'center'}}>
        <Text style={styles.titleText}>Điều hòa nhịp thở</Text>
        <Text style={styles.subText}>Hãy cùng bé hít thở sâu theo vòng tròn để{'\n'}xoa dịu hệ thần kinh.</Text>
      </View>
    </View>
  );
}

function VisualTab() {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnim = (anim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.out(Easing.ease)
          }),
          Animated.timing(anim, {
            toValue: 0, duration: 0, useNativeDriver: true
          })
        ])
      );
    };

    createAnim(anim1, 0).start();
    createAnim(anim2, 1300).start();
    createAnim(anim3, 2600).start();
  }, []);

  const getStyle = (anim) => {
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.5] });
    const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.2, 0] });
    return { transform: [{ scale }], opacity };
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.visualCenter}>
        <Animated.View style={[styles.visualRing, getStyle(anim1)]} />
        <Animated.View style={[styles.visualRing, getStyle(anim2)]} />
        <Animated.View style={[styles.visualRing, getStyle(anim3)]} />
        <Text style={{fontSize: 56, zIndex: 10}}>✨</Text>
      </View>
    </View>
  );
}

function SoundTab() {
  const [activeSoundId, setActiveSoundId] = useState('rain');
  const [isPlaying, setIsPlaying] = useState(false);
  const soundObj = useRef(null);

  const activeTrack = SOUND_TRACKS.find(t => t.id === activeSoundId) || SOUND_TRACKS[0];

  useEffect(() => {
    return () => {
      if (soundObj.current) {
        soundObj.current.unloadAsync();
      }
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (!soundObj.current) {
        const { sound } = await Audio.Sound.createAsync(
          activeTrack.src,
          { shouldPlay: true, isLooping: true }
        );
        soundObj.current = sound;
        setIsPlaying(true);
      } else {
        if (isPlaying) {
          await soundObj.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundObj.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (e) {
      console.log('Audio playback error', e);
    }
  };

  const changeTrack = async (id) => {
    if (activeSoundId === id) return;
    setActiveSoundId(id);
    setIsPlaying(false);
    if (soundObj.current) {
      await soundObj.current.unloadAsync();
      soundObj.current = null;
    }
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.soundMainCard}>
        <View style={styles.soundMainIconBox}>
          <Text style={{fontSize: 44}}>🎵</Text>
        </View>
        <Text style={styles.soundMainTitle}>{activeTrack.label}</Text>
        <Text style={styles.soundMainDesc}>{activeTrack.desc}</Text>
        
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.soundGrid}>
        {SOUND_TRACKS.slice(1).map((track) => (
          <TouchableOpacity 
            key={track.id} 
            style={[styles.soundGridItem, activeSoundId === track.id && styles.soundGridItemActive]}
            onPress={() => changeTrack(track.id)}
          >
            <Text style={[styles.soundGridText, activeSoundId === track.id && {color: '#FFF'}]}>{track.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function AITab() {
  return (
    <View style={styles.tabContainer}>
      <View style={styles.aiCard}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
          <Text style={{fontSize: 20}}>🧠</Text>
          <Text style={styles.aiCardTitle}> AI CHUYÊN GIA HỖ TRỢ</Text>
        </View>
        <Text style={styles.aiCardText}>
          "Tôi nhận thấy bé đang có dấu hiệu quá tải. Hãy thử kỹ thuật 5-4-3-2-1 ngay bây giờ: Yêu cầu bé tìm 5 thứ bé có thể nhìn thấy, 4 thứ bé có thể chạm vào, 3 âm thanh, 2 mùi hương và 1 vị."
        </Text>
      </View>

      <TouchableOpacity style={styles.aiActionBtn}>
        <Text style={{fontSize: 20}}>⚡</Text>
        <Text style={styles.aiActionText}>Chiến lược xoa dịu nhanh</Text>
        <Text style={{color: '#666', fontSize: 18}}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.aiActionBtn}>
        <Text style={{fontSize: 20}}>💬</Text>
        <Text style={styles.aiActionText}>Chat trực tiếp với chuyên gia</Text>
        <Text style={{color: '#666', fontSize: 18}}>{'>'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 40, paddingBottom: 10
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  sosBadge: { backgroundColor: 'rgba(246, 70, 70, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(246, 70, 70, 0.5)' },
  sosBadgeText: { color: '#F64646', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  
  content: { flex: 1, justifyContent: 'center' },
  tabContainer: { flex: 1, padding: 24, justifyContent: 'center' },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#0F131C',
    paddingBottom: 30, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1A1F2B'
  },
  navItem: { flex: 1, alignItems: 'center' },
  navIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#1A1F2B', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  navLabel: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  navLabelActive: { color: '#FFF' },

  // Breath
  breathCircleContainer: { alignItems: 'center', justifyContent: 'center', height: 300 },
  breathCircleOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: ACCENT_BLUE },
  breathCircleInner: { width: 140, height: 140, borderRadius: 70, backgroundColor: ACCENT_BLUE, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 10, shadowColor: ACCENT_BLUE, shadowOpacity: 0.5, shadowRadius: 20 },
  breathCount: { color: '#FFF', fontSize: 48, fontWeight: '800' },
  breathPhase: { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  titleText: { color: '#FFF', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  subText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Visual
  visualCenter: { alignItems: 'center', justifyContent: 'center', height: 400 },
  visualRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: ACCENT_PURPLE },

  // Sound
  soundMainCard: { backgroundColor: PANEL_BG, borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#1E2433' },
  soundMainIconBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#1A2320', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  soundMainTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  soundMainDesc: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: ACCENT_GREEN, alignItems: 'center', justifyContent: 'center', shadowColor: ACCENT_GREEN, shadowOpacity: 0.4, shadowRadius: 15 },
  playBtnIcon: { color: '#FFF', fontSize: 28, marginLeft: 4 },
  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  soundGridItem: { width: '48%', backgroundColor: PANEL_BG, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#1E2433' },
  soundGridItemActive: { borderColor: ACCENT_GREEN, backgroundColor: '#14201A' },
  soundGridText: { color: '#888', fontSize: 14, fontWeight: '600' },

  // AI
  aiCard: { backgroundColor: '#18140B', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#332400' },
  aiCardTitle: { color: ACCENT_ORANGE, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  aiCardText: { color: '#DDD', fontSize: 15, lineHeight: 24 },
  aiActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: PANEL_BG, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1E2433' },
  aiActionText: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '600', marginLeft: 16 },
});
