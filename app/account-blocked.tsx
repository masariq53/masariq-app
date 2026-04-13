import { View, Text, Pressable, Linking } from "react-native";
import { router } from "expo-router";
import { usePassenger } from "@/lib/passenger-context";
import { ScreenContainer } from "@/components/screen-container";

/**
 * شاشة الحظر - تظهر عند تعطيل حساب المستخدم.
 * لا يوجد زر رجوع أو تنقل - فقط تواصل مع الدعم أو تسجيل خروج.
 */
export default function AccountBlockedScreen() {
  const { logout } = usePassenger();

  const handleContactSupport = () => {
    // رقم الدعم الفني عبر واتساب أو اتصال مباشر
    Linking.openURL("https://wa.me/9647700000000").catch(() => {
      Linking.openURL("tel:+9647700000000");
    });
  };

  const handleLogout = async () => {
    await logout();
    router.dismissAll();
    router.replace("/login" as any);
  };

  return (
    <ScreenContainer
      edges={["top", "bottom", "left", "right"]}
      className="items-center justify-center px-6"
    >
      {/* أيقونة الحظر */}
      <View className="w-28 h-28 rounded-full bg-error/10 items-center justify-center mb-8">
        <Text style={{ fontSize: 56 }}>🚫</Text>
      </View>

      {/* العنوان */}
      <Text
        className="text-2xl font-bold text-foreground text-center mb-3"
        style={{ writingDirection: "rtl" }}
      >
        تم تعطيل حسابك
      </Text>

      {/* الوصف */}
      <Text
        className="text-base text-muted text-center leading-7 mb-10"
        style={{ writingDirection: "rtl" }}
      >
        تم تعطيل حسابك من قِبل إدارة مسار.{"\n"}
        للاستفسار أو الاعتراض، يرجى التواصل مع فريق الدعم الفني.
      </Text>

      {/* زر التواصل مع الدعم */}
      <Pressable
        onPress={handleContactSupport}
        style={({ pressed }) => [
          {
            backgroundColor: "#7C3AED",
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 14,
            width: "100%",
            alignItems: "center",
            marginBottom: 14,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Text className="text-white font-bold text-base">
          💬 تواصل مع الدعم الفني
        </Text>
      </Pressable>

      {/* زر تسجيل الخروج */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          {
            borderWidth: 1.5,
            borderColor: "#EF4444",
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 14,
            width: "100%",
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text className="text-error font-semibold text-base">
          تسجيل الخروج
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}
