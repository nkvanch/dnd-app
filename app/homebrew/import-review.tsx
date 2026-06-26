// app/homebrew/import-review.tsx
// REMOVED: this screen previously used an AI parser to import homebrew content.
// The app no longer includes any AI features. Homebrew is created via the
// guided builders (race-builder, class-builder, spell-builder, feature-editor)
// reached from the Homebrew tab's Create panel.
//
// This file is intentionally a stub so any stale route reference resolves to a
// harmless redirect rather than a missing-module error. It is safe to delete
// along with src/engine/wikiImporter.ts.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ImportReviewScreen() {
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)/homebrew'); }, [router]);
  return <View />;
}
