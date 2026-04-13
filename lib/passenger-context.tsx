/**
 * Passenger Auth Context
 * Manages the logged-in passenger state using AsyncStorage for persistence.
 * This is separate from the OAuth user system - it's for phone-based auth.
 *
 * Block handling: Instead of navigation (which causes POP_TO_TOP errors),
 * we use an `isBlockedOverlay` state that renders a full-screen overlay
 * directly in the provider, covering all app content without any navigation.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from "react-native";

const PASSENGER_KEY = "@masar_passenger";
const DRIVER_KEY = "@masar_driver";
const DRIVER_SESSION_KEY = "@masar_driver_session"; // used by driver-context
const MODE_KEY = "@masar_mode"; // "passenger" | "captain"

export type PassengerProfile = {
  id: number;
  phone: string;
  name: string | null;
  photoUrl?: string | null;
  walletBalance: string;
  totalRides: number;
  rating: string | null;
  isBlocked?: boolean;
};

export type DriverProfile = {
  id: number;
  phone: string;
  name: string;
  isVerified: boolean;
  rating: string | null;
  totalRides: number;
};

type AppMode = "passenger" | "captain";

type PassengerContextType = {
  passenger: PassengerProfile | null;
  driver: DriverProfile | null;
  mode: AppMode;
  isLoading: boolean;
  isBlockedOverlay: boolean;
  setIsBlockedOverlay: (v: boolean) => void;
  /** Register navigation callbacks so the overlay can navigate without router dependency in context */
  registerBlockNavigation: (callbacks: { toSupport: () => void; toLogin: () => void }) => void;
  setPassenger: (p: PassengerProfile | null) => Promise<void>;
  setDriver: (d: DriverProfile | null) => Promise<void>;
  setMode: (m: AppMode) => Promise<void>;
  logout: () => Promise<void>;
};

const PassengerContext = createContext<PassengerContextType | null>(null);

/**
 * شاشة الحظر كـ overlay - تُعرض فوق كل المحتوى بدون أي navigation
 */
function BlockedOverlay({
  onContactSupport,
  onLogout,
}: {
  onContactSupport: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* أيقونة الحظر */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🚫</Text>
          </View>

          {/* العنوان */}
          <Text style={styles.title}>تم تعطيل حسابك</Text>

          {/* الوصف */}
          <Text style={styles.description}>
            تم تعطيل حسابك من قِبل إدارة مسار.{"\n"}
            للاستفسار أو الاعتراض، يرجى التواصل مع فريق الدعم الفني.
          </Text>

          {/* زر التواصل مع الدعم الفني */}
          <Pressable
            onPress={onContactSupport}
            style={({ pressed }) => [
              styles.supportButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.supportButtonText}>💬 تواصل مع الدعم الفني</Text>
          </Pressable>

          {/* زر تسجيل الخروج */}
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutPressed,
            ]}
          >
            <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    zIndex: 99999,
    elevation: 99999,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#11181C",
    textAlign: "center",
    marginBottom: 12,
    writingDirection: "rtl",
  },
  description: {
    fontSize: 16,
    color: "#687076",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 40,
    writingDirection: "rtl",
  },
  supportButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  supportButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: "#EF4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  logoutPressed: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 15,
  },
});

export function PassengerProvider({ children }: { children: React.ReactNode }) {
  const [passenger, setPassengerState] = useState<PassengerProfile | null>(null);
  const [driver, setDriverState] = useState<DriverProfile | null>(null);
  const [mode, setModeState] = useState<AppMode>("passenger");
  const [isLoading, setIsLoading] = useState(true);
  const [isBlockedOverlay, setIsBlockedOverlay] = useState(false);

  // Navigation callbacks registered by _layout.tsx once router is available
  const navCallbacksRef = useRef<{ toSupport?: () => void; toLogin?: () => void }>({});

  const registerBlockNavigation = useCallback(
    (callbacks: { toSupport: () => void; toLogin: () => void }) => {
      navCallbacksRef.current = callbacks;
    },
    []
  );

  // Load from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [pStr, dStr, mStr] = await Promise.all([
          AsyncStorage.getItem(PASSENGER_KEY),
          AsyncStorage.getItem(DRIVER_KEY),
          AsyncStorage.getItem(MODE_KEY),
        ]);
        if (pStr) {
          const p = JSON.parse(pStr) as PassengerProfile;
          setPassengerState(p);
          // If passenger was blocked when app was closed, show overlay immediately
          if (p.isBlocked) {
            setIsBlockedOverlay(true);
          }
        }
        if (dStr) setDriverState(JSON.parse(dStr));
        if (mStr) setModeState(mStr as AppMode);
      } catch (e) {
        console.warn("[PassengerContext] Failed to load from storage:", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const setPassenger = useCallback(async (p: PassengerProfile | null) => {
    setPassengerState(p);
    if (p) {
      await AsyncStorage.setItem(PASSENGER_KEY, JSON.stringify(p));
      // Auto-show/hide overlay based on isBlocked
      if (p.isBlocked) {
        setIsBlockedOverlay(true);
      } else {
        setIsBlockedOverlay(false);
      }
    } else {
      await AsyncStorage.removeItem(PASSENGER_KEY);
      setIsBlockedOverlay(false);
    }
  }, []);

  const setDriver = useCallback(async (d: DriverProfile | null) => {
    setDriverState(d);
    if (d) {
      await AsyncStorage.setItem(DRIVER_KEY, JSON.stringify(d));
    } else {
      await AsyncStorage.removeItem(DRIVER_KEY);
    }
  }, []);

  const setMode = useCallback(async (m: AppMode) => {
    setModeState(m);
    await AsyncStorage.setItem(MODE_KEY, m);
  }, []);

  const logout = useCallback(async () => {
    setPassengerState(null);
    setDriverState(null);
    setModeState("passenger");
    setIsBlockedOverlay(false);
    // Clear ALL session keys - including driver-context's separate key
    await Promise.all([
      AsyncStorage.removeItem(PASSENGER_KEY),
      AsyncStorage.removeItem(DRIVER_KEY),
      AsyncStorage.removeItem(DRIVER_SESSION_KEY), // clears driver-context session
      AsyncStorage.removeItem(MODE_KEY),
    ]);
  }, []);

  // Handlers for the overlay buttons
  const handleContactSupport = useCallback(() => {
    if (navCallbacksRef.current.toSupport) {
      navCallbacksRef.current.toSupport();
    }
  }, []);

  const handleOverlayLogout = useCallback(async () => {
    await logout();
    if (navCallbacksRef.current.toLogin) {
      navCallbacksRef.current.toLogin();
    }
  }, [logout]);

  return (
    <PassengerContext.Provider
      value={{
        passenger,
        driver,
        mode,
        isLoading,
        isBlockedOverlay,
        setIsBlockedOverlay,
        registerBlockNavigation,
        setPassenger,
        setDriver,
        setMode,
        logout,
      }}
    >
      {children}
      {/* Overlay يُعرض فوق كل المحتوى عند الحظر - بدون أي navigation */}
      {isBlockedOverlay && (
        <BlockedOverlay
          onContactSupport={handleContactSupport}
          onLogout={handleOverlayLogout}
        />
      )}
    </PassengerContext.Provider>
  );
}

export function usePassenger() {
  const ctx = useContext(PassengerContext);
  if (!ctx) throw new Error("usePassenger must be used within PassengerProvider");
  return ctx;
}
