# Masar iQ - مسار

تطبيق نقل ذكي لمدينة الموصل (تكسي، توصيل، اشتراكات).

## الروابط

- **API:** https://api.msargo.com
- **لوحة التحكم:** https://msargo.com/admin (PIN: 1234)

## بناء APK / IPA

### عبر EAS Build (الطريقة الموصى بها)

```bash
# تثبيت EAS CLI
npm install -g eas-cli

# تسجيل الدخول
eas login

# بناء APK للأندرويد
eas build --platform android --profile preview

# بناء IPA للآيفون
eas build --platform ios --profile preview

# بناء الاثنين معاً
eas build --platform all --profile preview
```

### عبر GitHub Actions (تلقائي)

عند كل push على `main` يبني APK تلقائياً.
يمكن تشغيل البناء يدوياً من: **Actions → Build APK & IPA → Run workflow**

## المتغيرات المطلوبة في GitHub Secrets

| المتغير | الوصف |
|---------|-------|
| `EXPO_TOKEN` | Token من expo.dev/settings/access-tokens |

## التقنيات

- React Native + Expo SDK 54
- TypeScript
- NativeWind v4 (Tailwind CSS)
- Expo Router 6
- tRPC + Drizzle ORM
- MySQL

## السيرفر

- **Hetzner CPX32** - Ubuntu 22.04
- **IP:** 178.104.250.204
- **Process Manager:** PM2
- **Web Server:** Nginx
