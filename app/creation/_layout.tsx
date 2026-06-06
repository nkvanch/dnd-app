// app/creation/_layout.tsx
// Wraps all creation wizard screens.
// Progress is now tracked on the hub screen, not here.
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme';

export default function CreationLayout() {
  return (
    <View style={styles.wrapper}>
      <Stack
        screenOptions={{
          headerShown:  false,
          contentStyle: { backgroundColor: Colors.bg },
          animation:    'slide_from_right',
        }}
      >
        {/* Explicitly register the Ability Improvement screen so the
            'creation/level-up' route always resolves. (Other creation screens
            are auto-discovered by Expo Router from this directory.) */}
        <Stack.Screen name="level-up" options={{ title: 'Ability Improvements' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.bg },
});
