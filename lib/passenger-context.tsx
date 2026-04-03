/**
 * Passenger Auth Context
 * Manages the logged-in passenger state using AsyncStorage for persistence.
 * This is separate from the OAuth user system - it's for phone-based auth.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PASSENGER_KEY = "@masar_passenger";
const DRIVER_KEY = "@masar_driver";
const MODE_KEY = "@masar_mode"; // "passenger" | "captain"

export type PassengerProfile = {
  id: number;
  phone: string;
  name: string | null;
  walletBalance: string;
  totalRides: number;
  rating: string | null;
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
  setPassenger: (p: PassengerProfile | null) => Promise<void>;
  setDriver: (d: DriverProfile | null) => Promise<void>;
  setMode: (m: AppMode) => Promise<void>;
  logout: () => Promise<void>;
};

const PassengerContext = createContext<PassengerContextType | null>(null);

export function PassengerProvider({ children }: { children: React.ReactNode }) {
  const [passenger, setPassengerState] = useState<PassengerProfile | null>(null);
  const [driver, setDriverState] = useState<DriverProfile | null>(null);
  const [mode, setModeState] = useState<AppMode>("passenger");
  const [isLoading, setIsLoading] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [pStr, dStr, mStr] = await Promise.all([
          AsyncStorage.getItem(PASSENGER_KEY),
          AsyncStorage.getItem(DRIVER_KEY),
          AsyncStorage.getItem(MODE_KEY),
        ]);
        if (pStr) setPassengerState(JSON.parse(pStr));
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
    } else {
      await AsyncStorage.removeItem(PASSENGER_KEY);
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
    await Promise.all([
      AsyncStorage.removeItem(PASSENGER_KEY),
      AsyncStorage.removeItem(DRIVER_KEY),
      AsyncStorage.removeItem(MODE_KEY),
    ]);
  }, []);

  return (
    <PassengerContext.Provider
      value={{ passenger, driver, mode, isLoading, setPassenger, setDriver, setMode, logout }}
    >
      {children}
    </PassengerContext.Provider>
  );
}

export function usePassenger() {
  const ctx = useContext(PassengerContext);
  if (!ctx) throw new Error("usePassenger must be used within PassengerProvider");
  return ctx;
}
