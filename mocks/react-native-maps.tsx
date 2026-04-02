// Web fallback for react-native-maps
import React from "react";
import { View, Text, StyleSheet } from "react-native";

const MapView = ({ children, style, initialRegion, ...props }: any) => (
  <View style={[styles.map, style]}>
    <Text style={styles.icon}>🗺️</Text>
    <Text style={styles.label}>الموصل — 36.3392° N, 43.1289° E</Text>
    <Text style={styles.sub}>الخريطة متاحة على iOS و Android</Text>
    {children}
  </View>
);

const Marker = ({ children }: any) => <>{children}</>;
const Polyline = () => null;
const Circle = () => null;
const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE = "google";

const styles = StyleSheet.create({
  map: {
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  icon: { fontSize: 48, marginBottom: 8 },
  label: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  sub: { color: "#9B8EC4", fontSize: 12, marginTop: 4 },
});

export default MapView;
export { Marker, Polyline, Circle, PROVIDER_DEFAULT, PROVIDER_GOOGLE };
