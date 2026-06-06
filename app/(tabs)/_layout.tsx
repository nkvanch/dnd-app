// app/(tabs)/_layout.tsx
// Bottom tab navigator — 4 sections: Home, Campaigns, Characters, Homebrew.
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize } from '../../src/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconActive]}>{glyph}</Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarStyle:          {
          ...styles.bar,
          paddingBottom: insets.bottom || 8,
          height:        60 + (insets.bottom || 0),
        },
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle:     styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚔️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campaigns',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🗺️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="characters"
        options={{
          title: 'Characters',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homebrew"
        options={{
          title: 'Homebrew',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📜" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surfaceHigh,
    borderTopColor:  Colors.border,
    borderTopWidth:  1,
    height:          60,
    paddingBottom:   8,
  },
  label: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  icon: {
    fontSize:   22,
    opacity:    0.5,
  },
  iconActive: {
    opacity: 1,
  },
});
