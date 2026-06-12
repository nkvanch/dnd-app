// app/creation/class-detail.tsx
// Class detail with back button, collapsible sections, and safe re-selection.
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { globalContentDB } from '../../src/content/classes/library';
import { levelUp, stripResolvedAsiStats } from '../../src/engine/leveling';
import { recomputeDerived } from '../../src/engine/pipeline';
import { PROGRESSIONS } from '../../src/content/classes/progressions';
import { Entity } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type ClassDetail = {
  description: string;
  savingThrows: string[];
  savingThrowAbilities: ('str'|'dex'|'con'|'int'|'wis'|'cha')[];
  primaryFeatures: string[];
  armorProf: string;
  weaponProf: string;
  toolProf: string;
  spellcasting: boolean;
};

const CLASS_DETAIL: Record<string, ClassDetail> = {
  fighter: {
    description: 'A master of martial combat, skilled with a variety of weapons and armor.',
    savingThrows: ['Strength', 'Constitution'],
    savingThrowAbilities: ['str', 'con'],
    primaryFeatures: ['Fighting Style', 'Second Wind', 'Action Surge', 'Extra Attack'],
    armorProf: 'All armor, shields',
    weaponProf: 'Simple weapons, martial weapons',
    toolProf: 'None',
    spellcasting: false,
  },
  rogue: {
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
    savingThrows: ['Dexterity', 'Intelligence'],
    savingThrowAbilities: ['dex', 'int'],
    primaryFeatures: ['Sneak Attack', 'Thieves\'s Cant', 'Cunning Action', 'Uncanny Dodge', 'Evasion'],
    armorProf: 'Light armor',
    weaponProf: 'Simple weapons, hand crossbows, longswords, rapiers, shortswords',
    toolProf: 'Thieves\' tools',
    spellcasting: false,
  },
  wizard: {
    description: 'A scholarly magic-user capable of manipulating the fabric of reality.',
    savingThrows: ['Intelligence', 'Wisdom'],
    savingThrowAbilities: ['int', 'wis'],
    primaryFeatures: ['Spellcasting', 'Arcane Recovery', 'Arcane Tradition'],
    armorProf: 'None',
    weaponProf: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    toolProf: 'None',
    spellcasting: true,
  },
  cleric: {
    description: 'A priestly champion who wields divine magic in service of a higher power.',
    savingThrows: ['Wisdom', 'Charisma'],
    savingThrowAbilities: ['wis', 'cha'],
    primaryFeatures: ['Spellcasting', 'Divine Domain', 'Channel Divinity', 'Destroy Undead'],
    armorProf: 'Light, medium, shields',
    weaponProf: 'Simple weapons',
    toolProf: 'None',
    spellcasting: true,
  },
  barbarian: {
    description: 'A fierce warrior of primitive background who can enter a battle rage.',
    savingThrows: ['Strength', 'Constitution'],
    savingThrowAbilities: ['str', 'con'],
    primaryFeatures: ['Rage', 'Unarmored Defense', 'Reckless Attack', 'Extra Attack', 'Fast Movement'],
    armorProf: 'Light, medium, shields',
    weaponProf: 'Simple weapons, martial weapons',
    toolProf: 'None',
    spellcasting: false,
  },
  ranger: {
    description: 'A warrior who uses martial prowess and nature magic to combat threats.',
    savingThrows: ['Strength', 'Dexterity'],
    savingThrowAbilities: ['str', 'dex'],
    primaryFeatures: ['Favored Enemy', 'Natural Explorer', 'Fighting Style', 'Primeval Awareness', 'Extra Attack'],
    armorProf: 'Light, medium, shields',
    weaponProf: 'Simple weapons, martial weapons',
    toolProf: 'None',
    spellcasting: true,
  },
  paladin: {
    description: 'A holy warrior bound to a sacred oath, wielding divine magic and martial skill.',
    savingThrows: ['Wisdom', 'Charisma'],
    savingThrowAbilities: ['wis', 'cha'],
    primaryFeatures: ['Divine Sense', 'Lay on Hands', 'Divine Smite', 'Sacred Oath', 'Extra Attack'],
    armorProf: 'All armor, shields',
    weaponProf: 'Simple weapons, martial weapons',
    toolProf: 'None',
    spellcasting: true,
  },
  druid: {
    description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    savingThrows: ['Intelligence', 'Wisdom'],
    savingThrowAbilities: ['int', 'wis'],
    primaryFeatures: ['Spellcasting', 'Wild Shape', 'Druid Circle', 'Beast Spells'],
    armorProf: 'Light, medium (non-metal), shields (non-metal)',
    weaponProf: 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, slings, spears',
    toolProf: 'Herbalism kit',
    spellcasting: true,
  },
  bard: {
    description: 'An inspiring magician whose power echoes the music of creation.',
    savingThrows: ['Dexterity', 'Charisma'],
    savingThrowAbilities: ['dex', 'cha'],
    primaryFeatures: ['Spellcasting', 'Bardic Inspiration', 'Jack of All Trades', 'Expertise', 'Bard College'],
    armorProf: 'Light armor',
    weaponProf: 'Simple weapons, hand crossbows, longswords, rapiers, shortswords',
    toolProf: 'Three musical instruments',
    spellcasting: true,
  },
  monk: {
    description: 'A master of martial arts who harnesses the power of the body in pursuit of perfection.',
    savingThrows: ['Strength', 'Dexterity'],
    savingThrowAbilities: ['str', 'dex'],
    primaryFeatures: ['Unarmored Defense', 'Martial Arts', 'Ki', 'Unarmored Movement', 'Extra Attack'],
    armorProf: 'None',
    weaponProf: 'Simple weapons, shortswords',
    toolProf: 'One artisan tool or musical instrument',
    spellcasting: false,
  },
  sorcerer: {
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
    savingThrows: ['Constitution', 'Charisma'],
    savingThrowAbilities: ['con', 'cha'],
    primaryFeatures: ['Spellcasting', 'Sorcerous Origin', 'Font of Magic', 'Metamagic'],
    armorProf: 'None',
    weaponProf: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    toolProf: 'None',
    spellcasting: true,
  },
  warlock: {
    description: 'A wielder of magic derived from a bargain with an extraplanar entity.',
    savingThrows: ['Wisdom', 'Charisma'],
    savingThrowAbilities: ['wis', 'cha'],
    primaryFeatures: ['Otherworldly Patron', 'Pact Magic', 'Eldritch Invocations', 'Pact Boon'],
    armorProf: 'Light armor',
    weaponProf: 'Simple weapons',
    toolProf: 'None',
    spellcasting: true,
  },
};

/**
 * Strips everything granted by the previously-selected class so re-selecting a
 * class starts clean. Without this, going back and choosing a different class
 * piles up old features/choices/resources and double-counts HP.
 */
function clearClassData(entity: Entity, hitDie: number): Entity {
  // Revert resolved-ASI stat bumps BEFORE dropping the choices that record them.
  const stripped = stripResolvedAsiStats(entity);

  // Reset ALL skills to untrained — class skill choices set trained=true on the
  // skill block directly (not via effects), so they survive a features/choices
  // wipe and stack when a new class's skill choices are resolved.
  // Background-granted skills (set at grantedAt===0 via selectBackground) also
  // live here; we'll re-apply them below from the background features.
  const clearedSkills: typeof stripped.skills = {
    skills: Object.fromEntries(
      Object.entries(stripped.skills.skills).map(([k, v]) => [
        k,
        { ...v, trained: false, expertise: false },
      ])
    ) as typeof stripped.skills.skills,
  };

  // Re-apply background skill grants so they survive the class change.
  // Background features carry grant_proficiency effects or the background
  // screen directly sets trained=true; we re-derive from the remaining features.
  let retrainedSkills = clearedSkills;
  const backgroundFeatures = stripped.features.filter(
    f => f.source.kind === 'background'
  );
  for (const feature of backgroundFeatures) {
    for (const effect of feature.effects) {
      if (
        effect.type === 'grant_proficiency' &&
        effect.target.startsWith('skill:') &&
        effect.operation === 'add'
      ) {
        const skillName = effect.target.slice(6) as keyof typeof retrainedSkills.skills;
        if (retrainedSkills.skills[skillName]) {
          retrainedSkills = {
            skills: {
              ...retrainedSkills.skills,
              [skillName]: { ...retrainedSkills.skills[skillName], trained: true },
            },
          };
        }
      }
    }
  }
  // Background.tsx also sets trained=true directly (not via effect) — re-apply
  // by checking background feature proficiency lists from the content DB.
  // This is safe because the backgroundId is stable on the entity.
  const bgId = stripped.identity.backgroundId;
  if (bgId) {
    const BG_SKILL_MAP: Record<string, string[]> = {
      acolyte:      ['insight', 'religion'],
      charlatan:    ['deception', 'sleight_of_hand'],
      criminal:     ['deception', 'stealth'],
      entertainer:  ['acrobatics', 'performance'],
      folk_hero:    ['animal_handling', 'survival'],
      guild_artisan:['insight', 'persuasion'],
      hermit:       ['medicine', 'religion'],
      noble:        ['history', 'persuasion'],
      outlander:    ['athletics', 'survival'],
      sage:         ['arcana', 'history'],
      sailor:       ['athletics', 'perception'],
      soldier:      ['athletics', 'intimidation'],
      urchin:       ['sleight_of_hand', 'stealth'],
    };
    const bgSkills = BG_SKILL_MAP[bgId] ?? [];
    for (const sk of bgSkills) {
      const skillName = sk as keyof typeof retrainedSkills.skills;
      if (retrainedSkills.skills[skillName]) {
        retrainedSkills = {
          skills: {
            ...retrainedSkills.skills,
            [skillName]: { ...retrainedSkills.skills[skillName], trained: true },
          },
        };
      }
    }
  }

  return {
    ...stripped,
    skills:   retrainedSkills,
    identity: { ...stripped.identity, level: 0, subclassId: null },
    features: stripped.features.filter(
      f => f.source.kind !== 'class' && f.source.kind !== 'subclass' && f.source.kind !== 'feat'
    ),
    choices:   stripped.choices.filter(c => c.grantedAt === 0),
    resources: {
      ...stripped.resources,
      custom:  [],
      hp:      { current: 0, maximum: 0, temp: 0 },
      hitDice: { die: hitDie, total: 0, remaining: 0 },
    },
    spellcasting: null,
  };
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const [openSection, setOpenSection] = useState<string | null>(null);

  const cls    = globalContentDB.classes.find(c => c.id === id);
  const detail = id ? CLASS_DETAIL[id] : null;

  useEffect(() => {
    if (!cls || !draft) router.back();
  }, []);

  if (!cls || !draft) return null;

  const targetLevel: number = (() => {
    try { return JSON.parse(draft.notes || '{}').targetLevel ?? 1; }
    catch { return 1; }
  })();

  function selectClass() {
    const progression = PROGRESSIONS[cls!.id];
    const detail      = cls ? CLASS_DETAIL[cls.id] : null;

    // Strip old class data before applying new class (also resets HP & spellcasting)
    let updated = clearClassData(draft!, cls!.hitDie);

    // Clear visited flags so the equipment/spells screens re-show for the new class
    const notes = (() => {
      try { return JSON.parse(updated.notes || '{}'); }
      catch { return {}; }
    })();

    updated = {
      ...updated,
      identity:  { ...updated.identity, classId: cls!.id },
      proficiencies: {
        ...updated.proficiencies,
        savingThrows: detail?.savingThrowAbilities ?? [],
      },
      notes: JSON.stringify({ ...notes, equipmentVisited: false, spellsVisited: false }),
    };

    if (progression) {
      updated = levelUp(updated, targetLevel, progression, rules);
    }

    updated = recomputeDerived(updated, rules);
    setDraft(updated);
    router.push('/creation/hub');
  }

  function toggle(section: string) {
    setOpenSection(prev => prev === section ? null : section);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.heading}>{cls.name}</Text>
      <View style={styles.divider} />

      {detail && (
        <>
          <Text style={styles.description}>{detail.description}</Text>
          <View style={styles.divider} />

          <InfoRow label="Hit Die"      value={`d${cls.hitDie}`} />
          <InfoRow label="Spellcasting" value={detail.spellcasting ? 'Yes' : 'No'} />

          <View style={styles.divider} />

          {/* Collapsible: Saving Throws */}
          <CollapsibleSection
            title="Saving Throws"
            open={openSection === 'saves'}
            onToggle={() => toggle('saves')}
          >
            {detail.savingThrows.map((s, i) => <Text key={i} style={styles.bullet}>{s}</Text>)}
          </CollapsibleSection>

          {/* Collapsible: Primary Features */}
          <CollapsibleSection
            title="Primary Features"
            open={openSection === 'features'}
            onToggle={() => toggle('features')}
          >
            {detail.primaryFeatures.map((f, i) => <Text key={i} style={styles.bullet}>• {f}</Text>)}
          </CollapsibleSection>

          {/* Collapsible: Proficiencies */}
          <CollapsibleSection
            title="Proficiencies"
            open={openSection === 'profs'}
            onToggle={() => toggle('profs')}
          >
            <InfoRow label="Armor"   value={detail.armorProf} />
            <InfoRow label="Weapons" value={detail.weaponProf} />
            <InfoRow label="Tools"   value={detail.toolProf} />
          </CollapsibleSection>
        </>
      )}

      <View style={styles.divider} />
      <Pressable style={styles.selectBtn} onPress={selectClass}>
        <Text style={styles.selectBtnText}>Select Class</Text>
      </Pressable>
    </ScrollView>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={csStyles.block}>
      <Pressable style={csStyles.header} onPress={onToggle}>
        <Text style={csStyles.title}>{title}</Text>
        <Text style={csStyles.caret}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && <View style={csStyles.body}>{children}</View>}
    </View>
  );
}

const csStyles = StyleSheet.create({
  block:  { marginBottom: Spacing.sm },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  caret: { fontSize: FontSize.sm, color: Colors.textDim },
  body:  { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.md, marginTop: 2 },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  backBtn:   { marginBottom: Spacing.md },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  bullet:    { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  selectBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  selectBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
