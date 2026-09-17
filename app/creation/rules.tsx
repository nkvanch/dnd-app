// app/creation/rules.tsx
// Campaign Settings screen. Lives in Character Basics — accessible from the
// name screen before creation starts. Not a step in the creation flow.
// Renders three control types: boolean (descriptive labels), choice (chips),
// and number (stepper). Reminder-only rules are clearly labelled as notes.
//
// All sections are collapsible accordions, collapsed by default — the full
// rule set is long enough that showing everything expanded at once felt
// overwhelming. Tap a section header to expand/collapse it.
//
// HP Mode, Max Level, Table Rules (feats/multiclass/XP), and Ability Score
// Maximum used to live on the separate app Settings screen — moved here
// since they're campaign-rule concerns, not app-level preferences. They're
// direct fields on CampaignRules (not routed through the HOUSE_RULES
// registry the rest of this screen uses), so they're rendered as their own
// accordion sections with bespoke controls, same visual language as before.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { useCampaignStore } from '../../src/store/campaignStore';
import {
  HOUSE_RULES, HouseRuleDef,
  getHouseRule, getHouseChoice, getHouseNumber, setHouseRuleValue,
} from '../../src/engine/houseRules';
import { Entity, CampaignRules } from '../../src/engine/types';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type HpMode = 'fixed' | 'rolled' | 'max';

const HP_MODES: { value: HpMode; label: string; description: string }[] = [
  { value: 'fixed',  label: 'Fixed (PHB)',  description: 'Floor(die/2)+1 per level. Consistent and fair.' },
  { value: 'rolled', label: 'Rolled',       description: 'Roll your hit die each level. More exciting, less predictable.' },
  { value: 'max',    label: 'Max HP',       description: 'Always take the maximum. Heroic campaigns.' },
];

export default function CreationRulesScreen() {
  const router   = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const setRulesLocal = useCharacterStore(s => s.setRules);
  // Despite this screen's own "Campaign Settings" title, it used to only
  // ever edit the device-local characterStore.rules — Campaign.rules was
  // written once at creation and never read by anything (audit finding
  // CAMPAIGN-RULES-1), so two players at the same table could silently run
  // under different house rules. When this device is the DM of an active
  // campaign, every rule change here now also updates (and syncs, via the
  // Campaign metadata sync machinery — see CAMPAIGN-SYNC-1) Campaign.rules,
  // which characterStore.rules is kept in sync with everywhere (see
  // app/_layout.tsx's activeCampaign subscription). Outside a campaign
  // (solo play) this behaves exactly as before — device-local only.
  const activeCampaign     = useCampaignStore(s => s.activeCampaign);
  const isDm               = useCampaignStore(s => s.isDm);
  const updateCampaign     = useCampaignStore(s => s.updateCampaign);
  function setRules(partial: Partial<CampaignRules>) {
    setRulesLocal(partial);
    if (activeCampaign && isDm) {
      updateCampaign(activeCampaign.id, c => ({ ...c, rules: { ...c.rules, ...partial } }));
    }
  }

  // Collapsed by default — tap a header to expand. Keyed by section title.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(title: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  }

  // Accessible from Character Basics (no draft) and from within creation (draft
  // exists). When no draft, "Done" goes back; otherwise pushes to hub.
  const hasDraft = !!draft;

  function setValue(key: string, value: boolean | string | number) {
    setRules({ customRules: setHouseRuleValue(rules, key, value) });
  }

  function handleDone() {
    if (!hasDraft) { safeGoBack(); return; }
    const notes = (() => { try { return JSON.parse(draft!.notes || '{}'); } catch { return {}; } })();
    const updated: Entity = { ...draft!, notes: JSON.stringify({ ...notes, rulesVisited: true }) };
    setDraft(updated);
    router.push('/creation/hub');
  }

  const sections = HOUSE_RULES.reduce<Record<string, HouseRuleDef[]>>((acc, r) => {
    (acc[r.section] ??= []).push(r);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Campaign Settings</Text>
        <Pressable onPress={() => setRules(DEFAULT_RULES)}>
          <Text style={styles.reset}>Reset All</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />

      <View style={styles.infoCard}>
        <Text style={styles.infoTxt}>
          Configure your table's rules here. Everything defaults to standard 5e —
          change only what your table plays differently. Tap a section to expand it.
        </Text>
      </View>

      {/* ── Core campaign fields (moved from the app Settings screen) ────── */}
      <Accordion title="HP on Level Up" expanded={expanded.has('HP on Level Up')} onToggle={() => toggle('HP on Level Up')}>
        {HP_MODES.map(m => (
          <Pressable
            key={m.value}
            style={[styles.optionRow, rules.hpMode === m.value && styles.optionRowActive]}
            onPress={() => setRules({ hpMode: m.value })}
          >
            <View style={[styles.radio, rules.hpMode === m.value && styles.radioActive]}>
              {rules.hpMode === m.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{m.label}</Text>
              <Text style={styles.ruleDesc}>{m.description}</Text>
            </View>
          </Pressable>
        ))}
      </Accordion>

      <Accordion title="Maximum Level" expanded={expanded.has('Maximum Level')} onToggle={() => toggle('Maximum Level')}>
        <View style={styles.choiceWrap}>
          {[5, 10, 15, 20].map(lvl => (
            <Pressable
              key={lvl}
              style={[styles.choiceChip, rules.maxLevel === lvl && styles.choiceChipActive]}
              onPress={() => setRules({ maxLevel: lvl })}
            >
              <Text style={[styles.choiceChipTxt, rules.maxLevel === lvl && styles.choiceChipTxtActive]}>{lvl}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.choiceChip, rules.maxLevel === null && styles.choiceChipActive]}
            onPress={() => setRules({ maxLevel: null })}
          >
            <Text style={[styles.choiceChipTxt, rules.maxLevel === null && styles.choiceChipTxtActive]}>Uncapped</Text>
          </Pressable>
        </View>
        <Text style={styles.ruleDesc}>
          {rules.maxLevel === null
            ? 'Currently: Uncapped. Characters can level up to 20, the highest level any class progression in Grimoire defines.'
            : `Currently: Level ${rules.maxLevel ?? 20}. Characters cannot level beyond this.`}
        </Text>
      </Accordion>

      <Accordion title="Table Rules" expanded={expanded.has('Table Rules')} onToggle={() => toggle('Table Rules')}>
        <ToggleRow
          label="Feats"
          description="Allow taking a Feat instead of an Ability Score Improvement."
          value={rules.customRules?.featsEnabled !== false}
          onToggle={v => setRules({ customRules: { ...rules.customRules, featsEnabled: v } })}
        />
        <ToggleRow
          label="Multiclassing"
          description="Allow characters to gain levels in more than one class."
          value={rules.allowMulticlass}
          onToggle={v => setRules({ allowMulticlass: v })}
        />
        <ToggleRow
          label="XP Tracking"
          description="Track experience points instead of milestone leveling."
          value={rules.useXP}
          onToggle={v => setRules({ useXP: v })}
        />
      </Accordion>

      <Accordion title="Ability Score Maximum" expanded={expanded.has('Ability Score Maximum')} onToggle={() => toggle('Ability Score Maximum')}>
        <View style={styles.choiceWrap}>
          {[18, 20, 24, 30].map(cap => (
            <Pressable
              key={cap}
              style={[styles.choiceChip, rules.maxAbilityScore === cap && styles.choiceChipActive]}
              onPress={() => setRules({ maxAbilityScore: cap })}
            >
              <Text style={[styles.choiceChipTxt, rules.maxAbilityScore === cap && styles.choiceChipTxtActive]}>{cap}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.choiceChip, rules.maxAbilityScore === null && styles.choiceChipActive]}
            onPress={() => setRules({ maxAbilityScore: null })}
          >
            <Text style={[styles.choiceChipTxt, rules.maxAbilityScore === null && styles.choiceChipTxtActive]}>Uncapped</Text>
          </Pressable>
        </View>
        <Text style={styles.ruleDesc}>
          {rules.maxAbilityScore === null
            ? 'Currently: Uncapped. Ability Score Improvements and feats always apply in full, with no ceiling.'
            : `Currently: ${rules.maxAbilityScore ?? 20}. Applies to ability score improvements. Standard 5th-edition rules use 20.`}
        </Text>
      </Accordion>

      {/* ── House rules registry (existing sections) ──────────────────────── */}
      {Object.entries(sections).map(([section, defs]) => (
        <Accordion key={section} title={section} expanded={expanded.has(section)} onToggle={() => toggle(section)}>
          {defs.map(rule => (
            <View key={rule.key} style={styles.ruleCard}>
              <Text style={styles.ruleLabel}>
                {rule.label}
                {rule.reminderOnly && <Text style={styles.reminderTag}>  · reminder only</Text>}
              </Text>

              {rule.kind === 'boolean' && (
                <BooleanControl
                  on={getHouseRule(rules, rule.key)}
                  bookLabel={rule.bookLabel ?? 'Standard'}
                  homebrewLabel={rule.homebrewLabel ?? 'Homebrew'}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              {rule.kind === 'choice' && rule.options && (
                <ChoiceControl
                  options={rule.options}
                  selected={getHouseChoice(rules, rule.key)}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              {rule.kind === 'number' && (
                <NumberControl
                  value={getHouseNumber(rules, rule.key)}
                  min={rule.min ?? 0}
                  max={rule.max ?? 99}
                  onSet={v => setValue(rule.key, v)}
                />
              )}

              <Text style={styles.ruleDesc}>{rule.description}</Text>
            </View>
          ))}
        </Accordion>
      ))}

      <View style={styles.divider} />
      <Pressable style={styles.doneBtn} onPress={handleDone}>
        <Text style={styles.doneBtnTxt}>
          {hasDraft ? 'Done \u2192' : '\u2190 Back to Basics'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Accordion wrapper ────────────────────────────────────────────────────────
function Accordion({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={styles.accordion}>
      <Pressable style={styles.accordionHeader} onPress={onToggle}>
        <Text style={styles.sectionHeading}>{title.toUpperCase()}</Text>
        <Text style={styles.chevron}>{expanded ? '\u2212' : '+'}</Text>
      </Pressable>
      {expanded && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────
function BooleanControl({ on, bookLabel, homebrewLabel, onSet }: {
  on: boolean; bookLabel: string; homebrewLabel: string; onSet: (v: boolean) => void;
}) {
  return (
    <View style={styles.segment}>
      <Pressable style={[styles.segBtn, !on && styles.segBtnActiveBook]} onPress={() => onSet(false)}>
        <Text style={[styles.segTxt, !on && styles.segTxtActive]}>{bookLabel}</Text>
      </Pressable>
      <Pressable style={[styles.segBtn, on && styles.segBtnActiveHome]} onPress={() => onSet(true)}>
        <Text style={[styles.segTxt, on && styles.segTxtActive]}>{homebrewLabel}</Text>
      </Pressable>
    </View>
  );
}

function ChoiceControl({ options, selected, onSet }: {
  options: { value: string; label: string }[]; selected: string; onSet: (v: string) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            style={[styles.choiceChip, active && styles.choiceChipActive]}
            onPress={() => onSet(opt.value)}
          >
            <Text style={[styles.choiceChipTxt, active && styles.choiceChipTxtActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberControl({ value, min, max, onSet }: {
  value: number; min: number; max: number; onSet: (v: number) => void;
}) {
  return (
    <View style={styles.numberRow}>
      <Pressable
        style={[styles.numBtn, value <= min && styles.numBtnDisabled]}
        onPress={() => onSet(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Text style={styles.numBtnTxt}>−</Text>
      </Pressable>
      <Text style={styles.numValue}>{value}</Text>
      <Pressable
        style={[styles.numBtn, value >= max && styles.numBtnDisabled]}
        onPress={() => onSet(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Text style={styles.numBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({ label, description, value, onToggle }: {
  label: string; description: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.ruleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.gold + '88' }}
        thumbColor={value ? Colors.gold : Colors.textDim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary },
  reset:     { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  infoCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.lg },
  infoTxt:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  accordion: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md,
  },
  accordionBody: { padding: Spacing.md, paddingTop: 0, gap: Spacing.sm },
  chevron: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },

  sectionHeading: { fontSize: FontSize.sm, fontWeight: FontWeight.black, color: Colors.gold, letterSpacing: 1.5 },

  ruleCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  ruleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  reminderTag: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.normal, fontStyle: 'italic' },
  ruleDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  optionRowActive: {},
  optionText: { flex: 1 },
  optionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gold },

  segment: { flexDirection: 'row', borderRadius: Radius.full, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  segBtn:  { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  segBtnActiveBook: { backgroundColor: Colors.blue + '33' },
  segBtnActiveHome: { backgroundColor: Colors.gold + '33' },
  segTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  segTxtActive: { color: Colors.textPrimary },

  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  choiceChip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  choiceChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  choiceChipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  choiceChipTxtActive: { color: Colors.gold },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'flex-start' },
  numBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  numBtnDisabled: { opacity: 0.3 },
  numBtnTxt: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  numValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },

  doneBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  doneBtnTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
