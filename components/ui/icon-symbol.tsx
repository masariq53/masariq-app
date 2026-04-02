// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navigation tabs
  "house.fill": "home",
  "car.fill": "directions-car",
  "clock.fill": "history",
  "person.fill": "person",
  "bag.fill": "local-shipping",
  // Actions
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "xmark": "close",
  "checkmark": "check",
  "star.fill": "star",
  "star": "star-outline",
  "location.fill": "location-on",
  "location": "location-off",
  "magnifyingglass": "search",
  "bell.fill": "notifications",
  "creditcard.fill": "credit-card",
  "wallet.pass.fill": "account-balance-wallet",
  "phone.fill": "phone",
  "shield.fill": "security",
  "map.fill": "map",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",
  "plus": "add",
  "minus": "remove",
  "info.circle.fill": "info",
  "exclamationmark.triangle.fill": "warning",
  "hand.thumbsup.fill": "thumb-up",
  "hand.thumbsdown.fill": "thumb-down",
  "doc.text.fill": "description",
  "gear": "settings",
  "power": "power-settings-new",
  "person.badge.plus": "person-add",
  "car.2.fill": "directions-car",
  "bicycle": "directions-bike",
  "truck.box.fill": "local-shipping",
  "calendar": "calendar-today",
  "clock": "access-time",
  "mappin.and.ellipse": "place",
  "arrow.triangle.turn.up.right.diamond.fill": "navigation",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
