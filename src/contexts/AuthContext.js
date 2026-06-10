import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, signInByLegacyId, signOut, supabase } from '../lib/supabase';

const DEFAULT_CENTER_CODE = 'BIC-HCM';
const MOCK_PROFILE_KEY = '@mock_profile';
const REMEMBER_UNTIL_KEY = '@auth_remember_until';
const REMEMBER_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
let sessionLoginActive = false;

export const MOCK_PROFILES = {
  GV_KBC_VY: {
    id: '3dfa47de-b421-4c22-bdf9-b8b7ea30655c',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'teacher',
    full_name: 'Co Vy',
    email: 'gv.vy@bicenter.edu.vn',
    legacy_id: 'GV_KBC_VY',
    profile_complete: true,
    password: '&nC2od1r',
  },
  GV_KBC_NGAN: {
    id: '66747e8b-04c1-4ee4-aea6-840d75650240',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'teacher',
    full_name: 'Co Hong Ngan',
    email: 'gv.ngan@bicenter.edu.vn',
    legacy_id: 'GV_KBC_NGAN',
    profile_complete: true,
    password: 'sjyoLuPi',
  },
  GV_admin: {
    id: '86e4fb12-d52f-43be-a02e-c0349d020636',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'admin',
    full_name: 'Admin GV',
    email: 'admin.gv@bicenter.edu.vn',
    legacy_id: 'GV_admin',
    profile_complete: true,
    password: 'admin$$$',
  },
  PH_admin: {
    id: 'd9e78c49-1de5-4c3d-b666-cf12ed6e6971',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'parent',
    full_name: 'Admin PH',
    email: 'admin.ph@bicenter.edu.vn',
    legacy_id: 'PH_admin',
    profile_complete: true,
    password: 'admin$$$',
  },
  CG_NBAI_Lam: {
    id: '117409e3-d084-42ee-a31f-e989ed10b199',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'specialist',
    full_name: 'CG Lam',
    email: 'cg.lam@bicenter.edu.vn',
    legacy_id: 'CG_NBAI_Lam',
    profile_complete: true,
    password: 'lamld0404',
  },
  'PH_KBC-HCM_Long-G20': {
    id: '4c8f20ed-12f8-4ec7-b035-431a640ffe20',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'parent',
    full_name: 'Phu huynh Long-G20',
    email: 'ph.long-g20@bicenter.edu.vn',
    legacy_id: 'PH_KBC-HCM_Long-G20',
    profile_complete: true,
    password: '1hOSkbwY',
  },
  'PH_KBC-HCM_Khoi-G18': {
    id: 'e993e17a-c7f2-40bf-8fa5-7588e4896ec5',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'parent',
    full_name: 'Phu huynh Khoi-G18',
    email: 'ph.khoi-g18@bicenter.edu.vn',
    legacy_id: 'PH_KBC-HCM_Khoi-G18',
    profile_complete: true,
    password: 'fZ8#$G34',
  },
  'PH_KBC-HCM_Phong-G19': {
    id: 'accdc61f-565b-4ae9-b21f-784f1342944d',
    center_id: 'cba3c2a9-b888-47d3-a068-c5591ac3cee7',
    center_code: DEFAULT_CENTER_CODE,
    role: 'parent',
    full_name: 'Phu huynh Phong-G19',
    email: 'ph.phong-g19@bicenter.edu.vn',
    legacy_id: 'PH_KBC-HCM_Phong-G19',
    profile_complete: true,
    password: 'PLT9dBrc',
  },
};

const AuthContext = createContext(null);

async function getRememberUntil() {
  const raw = await AsyncStorage.getItem(REMEMBER_UNTIL_KEY);
  const rememberUntil = raw ? Number(raw) : 0;
  return Number.isFinite(rememberUntil) ? rememberUntil : 0;
}

async function rememberUntilIsValid() {
  return (await getRememberUntil()) > Date.now();
}

async function saveRememberPreference(remember30Days) {
  if (remember30Days) {
    sessionLoginActive = false;
    await AsyncStorage.setItem(
      REMEMBER_UNTIL_KEY,
      String(Date.now() + REMEMBER_30_DAYS_MS)
    );
    return;
  }

  sessionLoginActive = true;
  await AsyncStorage.removeItem(REMEMBER_UNTIL_KEY);
}

async function clearPersistedAuth() {
  sessionLoginActive = false;
  await AsyncStorage.multiRemove([MOCK_PROFILE_KEY, REMEMBER_UNTIL_KEY]);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const canRestoreSession = sessionLoginActive || (await rememberUntilIsValid());

        if (!canRestoreSession) {
          await signOut().catch(() => {});
          await clearPersistedAuth();
          setLoading(false);
          return;
        }

        const { data: { session: restoredSession } } = await supabase.auth.getSession();

        if (restoredSession?.user) {
          setSession(restoredSession);
          await loadProfile(restoredSession.user.id);
          return;
        }

        const savedMock = await AsyncStorage.getItem(MOCK_PROFILE_KEY);
        if (savedMock) {
          const parsed = JSON.parse(savedMock);
          setSession({ user: { id: parsed.id, email: parsed.email } });
          setUser(parsed);
          setProfile(parsed);
        }
      } catch (e) {
        console.error('Loi khoi tao Auth:', e);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (nextSession?.user) {
          const canRestoreSession = sessionLoginActive || (await rememberUntilIsValid());
          if (!canRestoreSession) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          setSession(nextSession);
          await loadProfile(nextSession.user.id);
          return;
        }

        const savedMock = await AsyncStorage.getItem(MOCK_PROFILE_KEY);
        if (!savedMock) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    try {
      const data = await getUserProfile(userId);
      setUser(data);
      setProfile(data);
      await AsyncStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Loi tai ho so:', e.message);
      const matchedMock = Object.values(MOCK_PROFILES).find(p => p.id === userId);
      if (matchedMock) {
        setUser(matchedMock);
        setProfile(matchedMock);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(credentials, passwordArg, isMockArg = false) {
    const isLegacySignature = typeof credentials === 'string';
    const legacyId = isLegacySignature ? credentials : credentials.legacyId;
    const password = isLegacySignature ? passwordArg : credentials.password;
    const remember30Days = isLegacySignature ? true : credentials.remember30Days !== false;

    // ── Tìm password từ MOCK_PROFILES để xác minh ──
    const mockProfile = Object.values(MOCK_PROFILES).find(
      p => p.legacy_id?.toLowerCase() === legacyId.trim().toLowerCase()
    );

    // Kiểm tra password nếu có trong MOCK_PROFILES
    if (mockProfile && mockProfile.password !== password) {
      throw new Error('Mã người dùng hoặc mật khẩu không chính xác.');
    }

    await saveRememberPreference(remember30Days);

    // ── Ưu tiên: Tìm user trong database bằng legacy_id ──
    try {
      const dbUser = await signInByLegacyId(legacyId.trim());

      const sessionObj = { user: { id: dbUser.id, email: dbUser.email || `${legacyId}@app.local` } };
      setSession(sessionObj);
      setUser(dbUser);
      setProfile(dbUser);
      await AsyncStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(dbUser));
      return { session: sessionObj, user: dbUser };
    } catch (dbErr) {
      console.warn('DB login failed, trying mock fallback:', dbErr.message);

      // ── Fallback: dùng MOCK_PROFILES nếu DB không có ──
      if (mockProfile) {
        const sessionObj = { user: { id: mockProfile.id, email: mockProfile.email } };
        setSession(sessionObj);
        setUser(mockProfile);
        setProfile(mockProfile);
        await AsyncStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(mockProfile));
        return { session: sessionObj, user: mockProfile };
      }

      sessionLoginActive = false;
      await AsyncStorage.removeItem(REMEMBER_UNTIL_KEY);
      throw new Error('Không tìm thấy tài khoản với mã: ' + legacyId);
    }
  }

  async function logout() {
    try {
      await signOut();
    } catch (e) {
      console.log('Dang xuat Supabase loi (offline):', e.message);
    }

    await clearPersistedAuth();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  const isParent = profile?.role === 'parent';
  const isTeacher = profile?.role === 'teacher';
  const isSpecialist = profile?.role === 'specialist';
  const isAdmin = profile?.role === 'admin';
  const profileComplete = profile?.profile_complete === true;

  const value = {
    session,
    user,
    profile,
    loading,
    login,
    logout,
    isParent,
    isTeacher,
    isSpecialist,
    isAdmin,
    profileComplete,
    role: profile?.role || null,
    centerId: profile?.center_id || null,
    centerCode: profile?.center_code || profile?.centers?.center_code || DEFAULT_CENTER_CODE,
    refreshUser: () => session?.user && loadProfile(session.user.id),
    refreshProfile: () => session?.user && loadProfile(session.user.id),
    MOCK_PROFILES,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phai dung trong AuthProvider');
  return ctx;
}
