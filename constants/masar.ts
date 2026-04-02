// ثوابت تطبيق مسار — Masar App Constants

export const MASAR_COLORS = {
  // الألوان الأساسية
  royalPurple: '#1A0533',
  deepPurple: '#0D0019',
  midPurple: '#2D1B69',
  lightPurple: '#3D2580',
  pureGold: '#FFD700',
  darkGold: '#B8860B',
  lightGold: '#FFF0A0',
  white: '#FFFFFF',
  mutedWhite: '#C4B5D4',
} as const;

export const MASAR_STRINGS = {
  appName: 'مسار',
  appNameEn: 'MASAR',
  tagline: 'كل رحلة، بأمان وأناقة',
  taglineEn: 'Every Ride, Safe & Elegant',
  city: 'الموصل',
  currency: 'د.ع',

  // أنواع الرحلات
  rideTypes: {
    economy: 'اقتصادي',
    comfort: 'مريح',
    vip: 'VIP',
    ladies: 'سائقة',
  },

  // التبويبات
  tabs: {
    home: 'الرئيسية',
    delivery: 'التوصيل',
    history: 'رحلاتي',
    profile: 'حسابي',
  },

  // تبويبات الكابتن
  captainTabs: {
    home: 'الرئيسية',
    earnings: 'أرباحي',
    trips: 'رحلاتي',
    documents: 'وثائقي',
    profile: 'حسابي',
  },

  // الاشتراكات
  subscriptions: {
    basic: 'الأساسي',
    premium: 'المميز',
    vip: 'VIP',
  },
} as const;

// خطط الاشتراك
export const SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    name: 'الأساسي',
    price: 25000,
    rides: 10,
    discount: 5,
    features: ['10 رحلات شهرياً', 'خصم 5%', 'دعم عادي'],
    highlighted: false,
  },
  {
    id: 'premium',
    name: 'المميز',
    price: 45000,
    rides: 20,
    discount: 20,
    features: ['20 رحلة شهرياً', 'خصم 20%', 'أولوية الحجز', 'دعم 24/7'],
    highlighted: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 75000,
    rides: -1, // غير محدود
    discount: 35,
    features: ['رحلات غير محدودة', 'خصم 35%', 'سائق خاص', 'دعم فوري'],
    highlighted: false,
  },
] as const;

// أنواع الرحلات
export const RIDE_TYPES = [
  { id: 'economy', name: 'اقتصادي', icon: 'car', basePrice: 2500, description: 'رحلة عادية بسعر مناسب' },
  { id: 'comfort', name: 'مريح', icon: 'car-sport', basePrice: 4000, description: 'سيارة مريحة ونظيفة' },
  { id: 'vip', name: 'VIP', icon: 'diamond', basePrice: 7000, description: 'خدمة فاخرة وسائق محترف' },
  { id: 'ladies', name: 'سائقة', icon: 'person', basePrice: 3500, description: 'سائقة للسيدات فقط' },
] as const;

// خدمات التوصيل
export const DELIVERY_TYPES = [
  { id: 'small', name: 'طرد صغير', icon: 'cube-outline', price: 3000, weight: 'حتى 2 كغ' },
  { id: 'medium', name: 'طرد متوسط', icon: 'cube', price: 5000, weight: 'حتى 10 كغ' },
  { id: 'large', name: 'طرد كبير', icon: 'archive', price: 8000, weight: 'حتى 30 كغ' },
  { id: 'documents', name: 'وثائق', icon: 'document-text', price: 2000, weight: 'مستندات مهمة' },
] as const;
