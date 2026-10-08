import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, ActionCard, ActivationOption } from '../../engine/types';
import { legalSpellPaymentOptions, SpellPaymentOption } from '../../engine/spellPayment';

/** Selection has no entity side effects. Cancel only discards the pending intent. */
export function useSpellPayment(entity: Entity) {
  const [pending, setPending] = useState<{
    options: SpellPaymentOption[]; commit: (option?: SpellPaymentOption) => void;
  } | null>(null);
  const consumed = useRef(false);
  useEffect(() => { setPending(null); consumed.current = true; }, [entity]);
  const cancel = useCallback(() => { consumed.current = true; setPending(null); }, []);
  const requestPayment = useCallback((card: ActionCard, activation: ActivationOption | undefined,
    commit: (option?: SpellPaymentOption) => void) => {
    const cost = activation?.resourceCost ?? card.resourceCost;
    if (cost?.resourceId !== 'spell_slots') { commit(); return; }
    const options = entity.spellcasting
      ? legalSpellPaymentOptions(entity.spellcasting, cost.spellSlotTier ?? 1) : [];
    if (options.length === 1) commit(options[0]);
    else if (options.length > 1) { consumed.current = false; setPending({ options, commit }); }
  }, [entity]);
  const paymentChooser = <Modal visible={pending !== null} transparent animationType="fade"
    onRequestClose={cancel}>
    <View style={styles.overlay}><View style={styles.panel}>
      <Text style={styles.title}>Choose spell payment</Text>
      {pending?.options.map(option => <Pressable accessibilityRole="button"
        key={option.kind + option.tier} style={styles.button} onPress={() => {
          if (consumed.current) return;
          consumed.current = true;
          const commit = pending.commit;
          setPending(null);
          commit(option);
        }}>
        <Text>{option.kind === 'pact' ? 'Pact' : 'Normal'} slot · Level {option.tier}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" style={styles.button} onPress={cancel}>
        <Text>Cancel</Text>
      </Pressable>
    </View></View>
  </Modal>;
  return { requestPayment, paymentChooser };
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 },
  panel: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  button: { padding: 12, minHeight: 44 },
});
