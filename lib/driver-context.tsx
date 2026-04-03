import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerDriverPushToken } from "@/lib/driver-notifications";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";

// Minimal tRPC client for push token registration (outside React context)
function getApiBaseUrl() {
  if (typeof window !== "undefined") return "";
  return "http://localhost:3000";
}
const _trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${getApiBaseUrl()}/api/trpc`, transformer: superjson })],
});

const DRIVER_STORAGE_KEY = "@masar_driver_session";

export interface DriverSession {
  id: number;
  phone: string;
  name: string;
  photoUrl: string | null;
  registrationStatus: "pending" | "approved" | "rejected" | null;
  rejectionReason: string | null;
  isVerified: boolean;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  vehicleType: string;
  rating: string;
  totalRides: number;
  walletBalance: string;
}

interface DriverContextType {
  driver: DriverSession | null;
  isLoading: boolean;
  setDriver: (driver: DriverSession | null) => Promise<void>;
  logout: () => Promise<void>;
  updateDriver: (updates: Partial<DriverSession>) => Promise<void>;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriverState] = useState<DriverSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DRIVER_STORAGE_KEY);
        if (stored) {
          setDriverState(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("[DriverContext] Failed to load session:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setDriver = useCallback(async (newDriver: DriverSession | null) => {
    setDriverState(newDriver);
    if (newDriver) {
      await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(newDriver));
      // تسجيل push token وإرساله للسيرفر
      registerDriverPushToken()
        .then(async (token) => {
          if (token && newDriver.id) {
            try {
              await _trpcClient.rides.savePushToken.mutate({
                driverId: newDriver.id,
                token,
              });
            } catch (e) {
              console.warn("[DriverContext] Failed to save push token:", e);
            }
          }
        })
        .catch(() => {});
    } else {
      await AsyncStorage.removeItem(DRIVER_STORAGE_KEY);
    }
  }, []);

  const logout = useCallback(async () => {
    setDriverState(null);
    await AsyncStorage.removeItem(DRIVER_STORAGE_KEY);
  }, []);

  const updateDriver = useCallback(async (updates: Partial<DriverSession>) => {
    setDriverState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <DriverContext.Provider value={{ driver, isLoading, setDriver, logout, updateDriver }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error("useDriver must be used within DriverProvider");
  return ctx;
}
