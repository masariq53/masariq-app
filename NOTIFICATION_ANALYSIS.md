# تحليل مشكلة الإشعارات - الرحلات بين المدن

## ملخص التحليل

### ما يعمل (الرحلات داخل المدينة):
1. **تسجيل push token للراكب**: يتم في `_layout.tsx` → `PassengerPushTokenRegistrar` → يُرسل للسيرفر عبر `rides.savePassengerPushToken`
2. **تسجيل push token للكابتن**: يتم في `driver-context.tsx` → عند تسجيل الدخول أو استعادة الجلسة → يُرسل للسيرفر عبر `rides.savePushToken`
3. **إرسال الإشعارات من السيرفر**: يستخدم `getDriverPushToken()` و `getPassengerPushToken()` → يرسل عبر Expo Push API

### المشكلة المحتملة:
- **bookTripWithPickup** لا يرسل إشعار للكابتن! (السطر 2088-2089 فقط يعيد النتيجة بدون إشعار)
- **bookTrip** و **bookWithGPS** يرسلان إشعارات بشكل صحيح

### الأماكن التي تحتاج فحص:
1. هل `bookTripWithPickup` يُستخدم فعلاً من الواجهة؟
2. هل صفحة الإشعارات (bell icon) موجودة ومربوطة؟
3. هل `NotificationHandler` يعالج أنواع الإشعارات الخاصة بالرحلات بين المدن؟

## الفروقات الرئيسية:
- `bookTripWithPickup` لا يرسل push notification
- `NotificationHandler` يعالج فقط `intercity_booking` (صوت) و `account_blocked/unblocked`
- لا يوجد معالجة للأنواع: `driver_heading`, `driver_arrived_at_pickup`, `chat_message`, `trip_in_progress`, `trip_completed`, `booking_cancelled`, `booking_cancelled_by_driver`
