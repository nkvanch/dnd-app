// Shared UI primitives for the Host / DM / Player live-session screens.
import { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { useSafeGoBack } from '../../hooks/useSafeGoBack';
import { SafeBottomView } from '../SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function LiveScreen({ title, subtitle, children, right, backTo = '/live' }: {
  title: string; subtitle?: string; children: ReactNode; right?: ReactNode; backTo?: string;
}) {
  const goBack = useSafeGoBack(backTo);
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={goBack} style={s.back} testID="live-back" accessibilityRole="button" accessibilityLabel="Back">
          <Text style={s.backTxt}>← Back</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <View style={s.right}>{right}</View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {children}
        <SafeBottomView><View style={{ height: Spacing.lg }} /></SafeBottomView>
      </ScrollView>
    </View>
  );
}

export function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

export function Card({ children, tone = 'default', testID }: { children: ReactNode; tone?: 'default' | 'secret' | 'warn'; testID?: string }) {
  return (
    <View testID={testID} style={[s.card, tone === 'secret' && s.cardSecret, tone === 'warn' && s.cardWarn]}>{children}</View>
  );
}

export function Btn({ label, onPress, kind = 'primary', disabled, testID, small }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; testID?: string; small?: boolean;
}) {
  return (
    <Pressable
      testID={testID} accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} disabled={disabled}
      style={[s.btn, small && s.btnSmall, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, disabled && s.btnDisabled]}
    >
      <Text style={[s.btnTxt, kind !== 'primary' && s.btnTxtAlt, small && s.btnTxtSmall]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={active ? `${label} (selected)` : label}
      accessibilityState={{ selected: !!active }} onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={Colors.textDim}
        style={[s.input, props.multiline && s.inputMulti]}
      />
    </View>
  );
}

export function Row({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return <View style={[s.row, wrap && s.rowWrap]}>{children}</View>;
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'good' | 'warn' | 'bad' | 'secret' }) {
  const color = tone === 'good' ? Colors.green : tone === 'warn' ? Colors.gold : tone === 'bad' ? Colors.red : tone === 'secret' ? Colors.purple : Colors.textSecondary;
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}

export function Body({ children, bold }: { children: ReactNode; bold?: boolean }) {
  return <Text style={[s.body, bold && s.bold]}>{children}</Text>;
}

export function NotCapable({ needs }: { needs: string }) {
  return (
    <Card tone="warn" testID="live-not-capable">
      <Body bold>This device is not {needs} in the current session.</Body>
      <Muted>Roles are assigned per session. A Host does not automatically get DM tools.</Muted>
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm,
  },
  back: { padding: Spacing.xs },
  backTxt: { color: Colors.gold, fontSize: FontSize.md },
  titleWrap: { flex: 1 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
  right: { minWidth: 8 },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 6 },
  cardSecret: { borderColor: Colors.purple },
  cardWarn: { borderColor: Colors.gold },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnSmall: { paddingVertical: 6, paddingHorizontal: Spacing.sm, minHeight: 36 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.gold },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.red },
  btnDisabled: { opacity: 0.4 },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  btnTxtAlt: { color: Colors.textPrimary },
  btnTxtSmall: { fontSize: FontSize.sm },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.bg },
  field: { gap: 4 },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowWrap: { flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  muted: { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 18 },
  body: { color: Colors.textPrimary, fontSize: FontSize.md },
  bold: { fontWeight: FontWeight.bold },
});
