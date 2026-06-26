// app/creation/class-detail.tsx
// Class detail with back button, collapsible sections, and safe re-selection.
import { View, Text, ScrollView, Pressable, StyleSheet, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { globalContentDB } from '../../src/content/classes/library';
import { levelUp, stripResolvedAsiStats } from '../../src/engine/leveling';
import { recomputeDerived } from '../../src/engine/pipeline';
import { getProgressionForClass } from '../../src/content/classes/progressions';
import {
  classMeta, featuresByLevel, progressionTable, abilityFullName,
} from '../../src/content/classes/classBrowse';
import { subclassEntriesForClass } from '../../src/content/subclasses/subclassBrowse';
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
  abyss_knight: {
    description: 'A warrior bound by pact to a demon lord of the Abyss, channeling dark power through their hit dice to fuel both their attacks and their nascent spellcasting.',
    savingThrows: ['Strength', 'Constitution'],
    savingThrowAbilities: ['str', 'con'],
    primaryFeatures: ['Abyssal Energy', 'Oozing Knight', "Demon's Sight", 'Frightening Gaze', 'Dark Magic'],
    armorProf: 'Light, medium, heavy, shields',
    weaponProf: 'Simple weapons, martial weapons',
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
  const [browseLayer, setBrowseLayer] = useState<'summary' | 'progression' | 'features'>('summary');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Jump from a progression row to the Features tab, expanding that feature.
  function goToFeature(featureId: string) {
    setExpandedFeature(featureId);
    setBrowseLayer('features');
  }
  // Custom-styled class-change confirmation (replaces native Alert)
  const [changePrompt, setChangePrompt] = useState<{
    lines: string[]; className: string; onConfirm: () => void;
  } | null>(null);
  const homebrewClasses = useHomebrewStore(s => s.classes);

  const cls    = [...globalContentDB.classes, ...homebrewClasses].find(c => c.id === id);
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
    const progression = getProgressionForClass(cls!);
    const detail      = cls ? CLASS_DETAIL[cls.id] : null;
    const isReselect  = !!draft!.identity.classId && draft!.identity.classId !== cls!.id;

    function doSelect() {
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
          // For official classes: use CLASS_DETAIL saving throws.
          // For homebrew Phase 2 classes: fall back to cls.savingThrows.
          // For Phase 1 stub classes with no data: empty array.
          savingThrows: detail?.savingThrowAbilities ?? cls!.savingThrows ?? [],
        },
        notes: JSON.stringify({ ...notes, equipmentVisited: false, spellsVisited: false }),
      };

      updated = levelUp(updated, targetLevel, progression, rules);

      updated = recomputeDerived(updated, rules);
      setDraft(updated);
      router.push('/creation/hub');
    }

    // Q29: if switching away from an already-selected class, warn clearly what
    // will be lost so the player can make an informed decision.
    if (isReselect) {
      const classFeatures = draft!.features
        .filter(f => f.source.kind === 'class' || f.source.kind === 'subclass')
        .map(f => f.name);
      const resolvedChoices = draft!.choices
        .filter(c => c.resolved && c.grantedAt > 0)
        .length;
      const resolvedAsis = draft!.choices
        .filter(c => c.resolved && c.definition.kind === 'asi')
        .length;
      const hadSpells = !!draft!.spellcasting;
      const newHadSpells = detail?.spellcasting ?? false;

      const lines: string[] = [
        `Switching from ${draft!.identity.classId} to ${cls!.id}.`,
        '',
        'This will remove:',
        `• ${classFeatures.length} class feature${classFeatures.length !== 1 ? 's' : ''} (${classFeatures.slice(0, 3).join(', ')}${classFeatures.length > 3 ? '…' : ''})`,
        `• ${resolvedChoices} resolved choice${resolvedChoices !== 1 ? 's' : ''} (skill picks, equipment, spells)`,
        resolvedAsis > 0 ? `• ${resolvedAsis} Ability Score Improvement${resolvedAsis !== 1 ? 's' : ''}` : null,
        hadSpells && !newHadSpells ? '• Spellcasting block (new class has no spells)' : null,
        '',
        'HP will be recalculated using the new hit die.',
      ].filter(Boolean) as string[];

      setChangePrompt({
        lines,
        className: cls!.name,
        onConfirm: () => { setChangePrompt(null); doSelect(); },
      });
    } else {
      doSelect();
    }
  }

  function toggle(section: string) {
    setOpenSection(prev => prev === section ? null : section);
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.headingRow}>
        <Text style={styles.heading}>{cls.name}</Text>
        {!detail && (
          <View style={styles.homebrewTag}>
            <Text style={styles.homebrewTagTxt}>Homebrew</Text>
          </View>
        )}
      </View>
      <View style={styles.divider} />

      {/* ── Three-layer class browser (Summary / Features / Progression) ── */}
      <View style={styles.layerTabs}>
        {([
          ['summary', 'Summary'],
          ['progression', 'Progression'],
          ['features', 'Features'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.layerTab, browseLayer === key && styles.layerTabActive]}
            onPress={() => setBrowseLayer(key)}
          >
            <Text style={[styles.layerTabTxt, browseLayer === key && styles.layerTabTxtActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Layer 1 — Summary */}
      {browseLayer === 'summary' && (() => {
        const meta = classMeta(cls);
        return (
          <View style={styles.summaryCard}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellLabel}>ROLE</Text>
                <Text style={styles.summaryCellValue}>{meta.role}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellLabel}>PRIMARY</Text>
                <Text style={styles.summaryCellValue}>{abilityFullName(meta.primaryAbility)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellLabel}>HIT DIE</Text>
                <Text style={styles.summaryCellValue}>d{cls.hitDie}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellLabel}>COMPLEXITY</Text>
                <Text style={[styles.summaryCellValue, {
                  color: meta.complexity === 'Easy' ? Colors.green
                       : meta.complexity === 'Complex' ? Colors.red : Colors.gold,
                }]}>{meta.complexity}</Text>
              </View>
            </View>

            <Text style={styles.summaryDesc}>{meta.shortDescription}</Text>

            {meta.keyMechanics.length > 0 && (
              <>
                <Text style={styles.summarySectionLabel}>KEY MECHANICS</Text>
                <View style={styles.mechanicsRow}>
                  {meta.keyMechanics.map((m, i) => (
                    <View key={i} style={styles.mechanicChip}>
                      <Text style={styles.mechanicChipTxt}>{m}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.summarySectionLabel}>PLAYSTYLE</Text>
            <Text style={styles.summaryDesc}>{meta.playstyle}</Text>

            {meta.recommendation && (
              <View style={styles.recBox}>
                <Text style={styles.recLabel}>💡 RECOMMENDED BUILD</Text>
                <Text style={styles.recTxt}>{meta.recommendation}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Layer 2 — Feature database (descriptions collapse behind names) */}
      {browseLayer === 'features' && (() => {
        const feats = featuresByLevel(cls);
        if (feats.length === 0) {
          return <Text style={styles.emptyNote}>No features defined for this class yet.</Text>;
        }
        return (
          <View style={{ gap: Spacing.sm }}>
            {feats.map(({ feature, level }) => {
              const open = expandedFeature === feature.id;
              return (
                <View key={feature.id} style={styles.featCard}>
                  <Pressable
                    style={styles.featCardHead}
                    onPress={() => setExpandedFeature(open ? null : feature.id)}
                  >
                    <Text style={styles.featCardName}>{feature.name}</Text>
                    <View style={styles.featLevelBadge}>
                      <Text style={styles.featLevelTxt}>Lv {level}</Text>
                    </View>
                    <Text style={styles.featCaret}>{open ? '▲' : '▼'}</Text>
                  </Pressable>
                  {open && (
                    <>
                      {feature.activation && (
                        <Text style={styles.featTag}>
                          {feature.activation.actionType === 'bonus_action' ? 'Bonus Action'
                            : feature.activation.actionType === 'reaction' ? 'Reaction'
                            : feature.activation.actionType === 'action' ? 'Action'
                            : 'Passive'}
                        </Text>
                      )}
                      <Text style={styles.featDesc}>{feature.description}</Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Layer 3 — Progression table (tap a feature → Features tab) */}
      {browseLayer === 'progression' && (() => {
        const rows = progressionTable(cls);
        return (
          <>
            <Text style={styles.progHint}>Tap a feature to read its description.</Text>
            <View style={styles.progTable}>
              <View style={[styles.progRow, styles.progHeaderRow]}>
                <Text style={[styles.progLevelCell, styles.progHeaderTxt]}>Lv</Text>
                <Text style={[styles.progFeatCell, styles.progHeaderTxt]}>Features</Text>
                <Text style={[styles.progSlotCell, styles.progHeaderTxt]}>Slots</Text>
              </View>
              {rows.map(row => (
                <View key={row.level} style={styles.progRow}>
                  <Text style={styles.progLevelCell}>{row.level}</Text>
                  <View style={styles.progFeatCell}>
                    {row.features.length === 0 && !row.hasASI ? (
                      <Text style={styles.progFeatNone}>—</Text>
                    ) : (
                      <View style={styles.progFeatWrap}>
                        {row.features.map((f, i) => (
                          <Pressable key={f.id} onPress={() => goToFeature(f.id)}>
                            <Text style={styles.progFeatLink}>
                              {f.name}{(i < row.features.length - 1 || row.hasASI) ? ',' : ''}
                            </Text>
                          </Pressable>
                        ))}
                        {row.hasASI && (
                          <Text style={styles.progFeatAsi}>Ability Score Improvement</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Text style={styles.progSlotCell}>{row.slotSummary ?? ''}</Text>
                </View>
              ))}
            </View>
          </>
        );
      })()}

      <View style={styles.divider} />

      {/* Proficiencies & Saving Throws — the one piece the three layers don't
          cover. Works for official (CLASS_DETAIL) and homebrew (cls fields). */}
      {(() => {
        // Saving throws: official from CLASS_DETAIL, homebrew from cls.savingThrows.
        const saves = detail
          ? detail.savingThrows
          : (cls.savingThrows ?? []).map(a => a.charAt(0).toUpperCase() + a.slice(1));
        // Proficiencies: official has prose strings; homebrew has profs arrays.
        const armor   = detail ? detail.armorProf  : (cls.armorProfs ?? []).join(', ');
        const weapons = detail ? detail.weaponProf : (cls.weaponProfs ?? []).join(', ');
        const tools   = detail ? detail.toolProf   : '';
        const hasAny  = saves.length > 0 || armor || weapons || tools;
        if (!hasAny) {
          return (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTxt}>
                Saving throws and proficiencies haven't been configured for this
                class yet. Edit it in the Homebrew tab to add them.
              </Text>
            </View>
          );
        }
        return (
          <>
            <CollapsibleSection
              title="Proficiencies & Saving Throws"
              open={openSection === 'profs'}
              onToggle={() => toggle('profs')}
            >
              {saves.length > 0 && <InfoRow label="Saving Throws" value={saves.join(', ')} />}
              {!!armor   && <InfoRow label="Armor"   value={armor} />}
              {!!weapons && <InfoRow label="Weapons" value={weapons} />}
              {!!tools   && <InfoRow label="Tools"   value={tools} />}
            </CollapsibleSection>

            {/* Homebrew with incomplete spellcasting config gets a gentle hint */}
            {!detail && cls.spellcastingAbility === undefined && (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTxt}>
                  If this is a spellcasting class, configure spellcasting in the
                  Homebrew tab so spell slots appear in the progression.
                </Text>
              </View>
            )}
          </>
        );
      })()}

      {/* ── Subclasses ── */}
      {(() => {
        const subs = subclassEntriesForClass(cls.id);
        if (subs.length === 0) return null;
        return (
          <>
            <View style={styles.divider} />
            <Text style={styles.subclassHeading}>SUBCLASSES</Text>
            <View style={{ gap: Spacing.sm }}>
              {subs.map(sub => (
                <Pressable
                  key={sub.id}
                  style={styles.subclassCard}
                  onPress={() => router.push(`/creation/subclass-detail?classId=${cls!.id}&subclassId=${sub.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.subclassNameRow}>
                      <Text style={styles.subclassName}>{sub.name}</Text>
                      <View style={styles.subclassLvlBadge}>
                        <Text style={styles.subclassLvlTxt}>Lv {sub.unlockLevel}+</Text>
                      </View>
                    </View>
                    <Text style={styles.subclassBlurb} numberOfLines={2}>{sub.blurb}</Text>
                  </View>
                  <Text style={styles.subclassArrow}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        );
      })()}

      <View style={styles.divider} />
      <Pressable style={styles.selectBtn} onPress={selectClass}>
        <Text style={styles.selectBtnText}>Select Class</Text>
      </Pressable>
    </ScrollView>

    {/* Class-change confirmation — custom dark/gold modal (replaces native Alert) */}
    <Modal visible={!!changePrompt} transparent animationType="fade" onRequestClose={() => setChangePrompt(null)}>
      <View style={ccStyles.backdrop}>
        <View style={ccStyles.sheet}>
          <Text style={ccStyles.title}>Change Class?</Text>
          {changePrompt && (
            <ScrollView style={ccStyles.body} showsVerticalScrollIndicator={false}>
              {changePrompt.lines.map((line, i) => {
                if (line === '') return <View key={i} style={ccStyles.spacer} />;
                if (line.startsWith('•')) {
                  return <Text key={i} style={ccStyles.bullet}>{line}</Text>;
                }
                if (line === 'This will remove:') {
                  return <Text key={i} style={ccStyles.sectionLabel}>{line}</Text>;
                }
                return <Text key={i} style={ccStyles.line}>{line}</Text>;
              })}
            </ScrollView>
          )}
          <View style={ccStyles.btnRow}>
            <Pressable style={ccStyles.cancelBtn} onPress={() => setChangePrompt(null)}>
              <Text style={ccStyles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={ccStyles.confirmBtn} onPress={() => changePrompt?.onConfirm()}>
              <Text style={ccStyles.confirmTxt}>Switch to {changePrompt?.className}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
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

// ── Class-change confirmation modal styles ───────────────────────────────────
const ccStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: '#000000bb',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.gold + '44',
    padding:         Spacing.lg,
    width:           '100%',
    maxHeight:       '75%',
    gap:             Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  body:  { maxHeight: 320 },
  line:  { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold, marginTop: 2 },
  bullet: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, paddingLeft: Spacing.sm },
  spacer: { height: Spacing.xs },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirmBtn: {
    flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  confirmTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md, textAlign: 'center' },
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
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  headingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    marginBottom: Spacing.md,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  // ── Three-layer browser ──
  layerTabs: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  layerTab: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  layerTabActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  layerTabTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  layerTabTxtActive: { color: Colors.gold },

  // Layer 1 — summary
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryCell: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.sm,
  },
  summaryCellLabel: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1, marginBottom: 2 },
  summaryCellValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  summaryDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  summarySectionLabel: {
    fontSize: FontSize.xs, color: Colors.gold, letterSpacing: 2,
    fontWeight: FontWeight.bold, marginTop: Spacing.xs,
  },
  mechanicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  mechanicChip: {
    backgroundColor: Colors.gold + '18', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '44',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  mechanicChipTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  recBox: {
    backgroundColor: Colors.gold + '11', borderRadius: Radius.md,
    borderLeftWidth: 3, borderLeftColor: Colors.gold,
    padding: Spacing.sm, marginTop: Spacing.xs,
  },
  recLabel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1, marginBottom: 2 },
  recTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  // Layer 2 — feature cards
  featCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: 4,
  },
  featCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featCardName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold, flex: 1 },
  featCaret: { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: Spacing.sm },
  featLevelBadge: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  featLevelTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  featTag: { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },
  featDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  // Layer 3 — progression table
  progTable: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden',
  },
  progRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, gap: Spacing.sm,
  },
  progHeaderRow: { backgroundColor: Colors.surfaceHigh },
  progHeaderTxt: { color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  progLevelCell: { width: 28, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  progFeatCell:  { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  progHint: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginBottom: Spacing.xs },
  progFeatWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  progFeatLink: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  progFeatAsi: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic' },
  progFeatNone: { fontSize: FontSize.sm, color: Colors.textDim },
  progSlotCell:  { width: 56, fontSize: FontSize.xs, color: Colors.blue, textAlign: 'right' },
  infoCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  infoCardTxt: { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 20 },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  selectBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  selectBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
  subclassHeading: { fontSize: FontSize.xs, color: Colors.gold, letterSpacing: 2, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  subclassCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  subclassNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  subclassName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  subclassLvlBadge: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  subclassLvlTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  subclassBlurb: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  subclassArrow: { fontSize: FontSize.xl, color: Colors.textDim },
});
