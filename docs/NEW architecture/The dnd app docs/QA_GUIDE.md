# Grimoire — Manual QA Guide

Step-by-step test procedures grounded in the actual engine and screens.
Each test includes: what to do, what to expect, and what the failure looks like.
Run tests top to bottom — they build on each other.

---

## How to read this guide

**Expected:** what the app should show or do.
**Bug if:** what a failure looks like.
**Why it can go wrong:** the specific engine path that produces this result,
so you can narrow down the cause faster.

---

## SECTION 1 — Creation: Basic character

### 1.1 Create a new character

1. Tap the **Characters** tab → tap **+ New**.
2. Enter a name (e.g. "Thorin").
3. Set starting level to **1**.
4. Tap Continue.

**Expected:** hub screen opens showing all steps incomplete.
**Bug if:** crash, blank screen, or hub doesn't show.

---

### 1.2 Select a race with a subrace — Dwarf

1. Tap **Race** on the hub.
2. Select **Dwarf**.
3. On the detail screen, tap **Hill Dwarf**.
4. Tap **Select Race**.

**Expected:** returns to hub with Race marked complete.
**Bug if:** can confirm without selecting a subrace, or hub doesn't update.

---

### 1.3 Select a class — Fighter

1. Tap **Class** on the hub.
2. Select **Fighter**.
3. Tap **Select Class**.

**Expected:** hub marks Class complete. Fighter grants: d10 hit die,
CON + STR saving throw proficiencies, Fighting Style choice (pending),
Second Wind resource, and an equipment choice queued.
**Bug if:** crash, or hub doesn't update.

---

### 1.4 Assign ability scores — Standard Array with +2 CON racial bonus visible

1. Tap **Ability Scores**.
2. Select the **Standard Array** tab.
3. Assign: STR=15, DEX=13, CON=14, INT=12, WIS=10, CHA=8.
4. Verify the CON row shows: **14 base + 2 race = 16 (+3)**.
5. Tap **Confirm Scores**.

**Expected:** scores confirmed. Hill Dwarf's +2 CON is shown as a separate
annotation, not baked into the base score.
**Bug if:**
- CON row shows 16 with no "race" annotation (racial bonus baked into base).
- CON row shows only 14 with no bonus at all (racial feature not applied yet).
- App shows 16 but doesn't add the +2 later either (both wrong in opposite ways).

**Why it works this way:** racial bonuses are stored as `stat_modifier` Effects,
never written into `entity.stats`. The scores screen shows base + annotation;
`applyStatModifiers` produces the effective total.

---

### 1.5 Verify HP after scores — Fighter + CON 16

After confirming scores, go to Review or create the character and open the sheet.

**Expected:** Level 1 Fighter with CON 16 (+3 mod) → HP = 10 + 3 = **13**.
Formula: `Math.max(1, die + conMod)` = `Math.max(1, 10 + 3)` = 13.

**Bug if:**
- HP = 10 (CON modifier not applied — effectiveStats not used).
- HP = 8 (wrong die size — Wizard d6 instead of Fighter d10).
- HP = 11 (using base CON 14 (+2) instead of effective 16 (+3) — racial bonus missing).

**Why it can go wrong:** `recalculateAllHP` calls `applyStatModifiers` to get
effective CON. If `collectAllEffects` doesn't return the racial feature, the race
bonus is invisible to HP calculation.

---

### 1.6 Select Background — Criminal

1. Tap **Background**.
2. Select **Criminal**.
3. Tap the detail page **Select Background**.

**Expected:** hub marks Background complete. Criminal grants:
Deception and Stealth as trained skills.

---

### 1.7 Select skills — no double-picks

1. Tap **Skills** on the hub.
2. **Expected:** Deception and Stealth (from Criminal background) appear at the top
   in green under "Already owned." In the choice list below, they appear **disabled**
   with a "From background" tag — you cannot pick them.
3. Fighter chooses 2 skills from: Acrobatics, Animal Handling, Athletics,
   History, Insight, Intimidation, Perception, Survival.
4. Pick **Athletics** and **Perception**. Tap Confirm.

**Expected:** returns to hub, Skills marked complete.
**Bug if:**
- Deception or Stealth are selectable (background skills not locked out).
- Confirming crashes (resolveChoice throws because count doesn't match).

---

### 1.8 Re-enter the skills screen after confirming

1. Tap **Skills** again on the hub.

**Expected:** a read-only summary showing "✓ Athletics, ✓ Perception"
with a Continue button. NOT "No additional skill choices for this class."
**Bug if:** shows "No additional skill choices" (the re-entry bug).

---

### 1.9 Select equipment

1. Tap **Equipment**.
2. Make choices (e.g. chain mail + martial weapon).
3. Tap Continue.

**Expected:** hub marks Equipment complete.

---

### 1.10 Finalize the character

1. Tap **Create Character** on the hub.

**Expected:** navigates to the Characters tab; the new character appears in the list
with name, "Level 1 · fighter · dwarf", HP bar, AC badge.

---

## SECTION 2 — Abilities tab: race bonuses and skill math

### 2.1 Verify ability scores show effective values (including race bonuses)

1. Open the character sheet → **Abilities** tab.
2. Look at the STR, DEX, CON, INT, WIS, CHA boxes.

**Expected for Hill Dwarf Fighter (Standard Array: STR 15, DEX 13, CON 14, INT 12, WIS 10, CHA 8):**
- STR: 15 (+2)
- DEX: 13 (+1)
- CON: **16 (+3)** ← Hill Dwarf +2 CON applies here
- INT: 12 (+1)
- WIS: **11 (+0)** ← Hill Dwarf +1 WIS applies here
- CHA: 8 (−1)

**Bug if:** CON shows 14 (+2) and WIS shows 10 (+0) — race bonuses not in the display.

**Why this matters:** `TabAbilities` computes `effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity))` and must display `effectiveStats[key]`, not `entity.stats[key]`.

---

### 2.2 Verify saving throw math

Fighter is proficient in STR and CON saves.
Level 1 proficiency bonus = +2.

**Expected saving throws:**
- STR: +2 (mod) + 2 (proficiency) = **+4**
- CON: +3 (mod) + 2 (proficiency) = **+5**
- DEX: +1 (no proficiency) = **+1**
- INT: +1 = **+1**
- WIS: +0 = **+0**
- CHA: −1 = **−1**

**Bug if:** saving throws use base stats instead of effective (CON save shows +4 instead of +5).

---

### 2.3 Verify skill bonuses

- **Athletics** (STR, trained): +2 (mod) + 2 (proficiency) = **+4**
- **Perception** (WIS, trained): +0 (mod) + 2 (proficiency) = **+2**
- **Stealth** (DEX, trained from background): +1 (mod) + 2 (proficiency) = **+3**
- **Deception** (CHA, trained from background): −1 (mod) + 2 (proficiency) = **+1**
- **Acrobatics** (DEX, not trained): +1

**Bug if:** trained skills don't show proficiency bonus, or background skills are
missing their proficiency dot.

---

### 2.4 Tap a value to verify audit trail

1. Tap the **CON** box.
2. The audit modal must open and show:
   - Base: 14
   - Racial bonus (Hill Dwarf): +2
   - Total: 16

**Bug if:** modal shows "No breakdown available" or just shows 16 with no contributors.

---

## SECTION 3 — Inventory: armor equip changes AC

### 3.1 Equip chain mail — AC must update

1. Open sheet → **Inventory** tab.
2. Tap **Equip** next to Chain Mail.

**Expected:**
- Chain Mail moves from Carried to Equipped.
- AC immediately changes. Chain Mail is AC 16 (heavy armor, flat — no DEX).
  With no shield: **AC = 16**.

**Bug if:** AC stays at 10+DEX after equipping chain mail.

**Why it can go wrong:** items' features carry `base_ac_formula` effects.
`collectAllEffects` must read from `entity.inventory.equipped` items'
features, not just the `entity.features` array.

---

### 3.2 Unequip chain mail — AC reverts

1. Tap **Unequip** next to Chain Mail.

**Expected:** AC drops back to the unarmored value (10 + DEX mod = 11).
**Bug if:** AC stays at 16 after unequipping.

---

### 3.3 Equip a light armor piece — DEX modifier adds to AC

If the character has Leather Armor in inventory:
1. Equip **Leather Armor**.

**Expected:** AC = 11 + DEX modifier. With DEX 13 (+1): **AC = 12**.
**Bug if:** AC = 11 (DEX not added — `formulaAbilities: ['dex']` not set on the effect).

---

## SECTION 4 — Combat tab: HP mechanics

### 4.1 Damage

1. Tap the HP block on the Combat tab.
2. Enter damage of 5. Confirm.

**Expected:** HP drops by 5. Bar color updates (green if above 50%, gold if 25–50%, red below 25%).

---

### 4.2 Healing

1. Tap HP block → enter healing of 3.

**Expected:** HP increases by 3, capped at maximum.
**Bug if:** HP exceeds maximum.

---

### 4.3 Temp HP does not stack

1. Add 5 temp HP.
2. Try to add 3 more temp HP.

**Expected:** temp HP stays at **5** (not 8). Temp HP takes the higher value, doesn't stack.
**Bug if:** shows 8 temp HP.

---

### 4.4 Death saving throws

1. Set HP to 0 (apply enough damage).

**Expected:** Death Saves section appears showing 3 empty success pips and 3 empty failure pips.

2. Tap **Roll Death Save** three times and observe all three outcomes:
   - Roll 20 → should immediately go to 1 HP, no longer dying.
   - Roll 10–19 → one success pip fills.
   - Roll 1 → two failure pips fill.

3. Accumulate 3 successes → character stabilizes at 1 HP.
4. Accumulate 3 failures → character dies.

---

### 4.5 Hit dice — Roll vs Use

**Roll Hit Die:**
1. Tap **🎲 Roll Hit Die**.

**Expected:** app reports rolled amount, character heals. Formula: d10 + CON modifier (+3 = d10+3). Minimum heal: 1.
The hit die pool decrements by 1.
**Bug if:** healing uses base CON instead of effective CON (race bonus ignored).

**Use Hit Die:**
1. Tap **Use Hit Die**.

**Expected:** hit die pool decrements by 1. HP does NOT change (player rolls physical dice).
**Bug if:** HP changes when using "Use Hit Die."

---

## SECTION 5 — Conditions

### 5.1 Apply Poisoned condition

1. Tap **+ Add** in the Conditions section.
2. Select **Poisoned** from the list.

**Expected:** "poisoned" chip appears. Below it, mechanical reminder text:
"Disadvantage on attacks and ability checks."

### 5.2 Apply Prone condition

1. Add **Prone**.

**Expected:** "Disadvantage on attacks; melee attacks against you have advantage."

### 5.3 Remove condition

1. Tap the **poisoned** chip.

**Expected:** poisoned removed. Only prone reminder remains.

---

## SECTION 6 — Short rest and long rest

### 6.1 Short rest

1. Apply some damage (e.g. reduce HP to 5).
2. Tap **☕ Short Rest** in the rest bar.

**Expected:**
- Short-rest resources (e.g. Second Wind) recharge.
- HP does NOT automatically restore (short rest HP recovery requires spending hit dice).
- Hit dice pool unchanged until you spend one.

### 6.2 Long rest

1. Apply some damage. Spend a hit die. Use a Second Wind.
2. Tap **🌙 Long Rest**.

**Expected:**
- HP restores to **maximum**.
- Hit dice pool restores to full (level 1 = 1/1 remaining).
- Second Wind resource recharges to full.
- Temp HP clears to 0.
- Concentration drops.

**Bug if:** HP or resources don't fully restore.

---

## SECTION 7 — Class change during creation (skills stacking bug regression)

This test verifies the skills-stacking fix.

1. Create a new character at level 1.
2. Select any race.
3. Select **Rogue** as the class (grants 4 skill picks from a list of 11).
4. Select **Criminal** background (grants Deception + Stealth).
5. Go to Skills and pick **4 skills** (excluding Deception and Stealth).
6. Confirm skills. Return to hub.
7. Go back to Class and select **Fighter** instead.
8. Go to Skills.

**Expected:**
- Fighter queues 2 skill picks (not 4 + 2 = 6).
- The previously chosen Rogue skills are **gone** — they don't pre-fill.
- Criminal's Deception + Stealth are still locked/pre-owned at the top.
- You must pick exactly 2 new skills.

**Bug if:**
- Fighter skills screen shows Rogue's 4 previous picks already checked.
- Fighter confirms with more than 2 trained class skills.
- Deception or Stealth are gone (background skills also wiped — that's also wrong).

---

## SECTION 8 — Background change (skills stacking regression)

1. Create a character with **Acolyte** background (Insight + Religion).
2. Confirm. Go to Skills; verify Insight and Religion appear as pre-owned.
3. Go back to Background and switch to **Soldier** (Athletics + Intimidation).
4. Return to Skills.

**Expected:** Acolyte skills (Insight, Religion) are GONE. Soldier's skills
(Athletics, Intimidation) appear as pre-owned instead.
**Bug if:** both Acolyte and Soldier skills appear as pre-owned (4 free skills instead of 2).

---

## SECTION 9 — ASI (Ability Score Improvement) — level 4

Create a character at starting level 4, or level an existing character up to 4.

### 9.1 Create a level-4 Wizard

1. Create new character. Set **starting level to 4**. Name "Merlin".
2. Select **High Elf** race (INT +1).
3. Select **Wizard** class.
4. Assign ability scores: STR=8, DEX=14, CON=13, INT=15, WIS=12, CHA=10.
   With High Elf INT +1: effective INT = 16.
5. Complete remaining steps.

**Expected:** Level 4 Wizard queues an ASI choice (Wizard gets ASI at level 4).

### 9.2 Resolve the ASI

1. On the hub, tap **Level Up** or go to the ASI picker.
2. Choose **+2 to one ability** → select **INT**.

**Expected:**
- INT base goes from 15 to 17. Effective INT = 17 + 1 (racial) = 18.
- The picker must show the **effective** score (18) before the increase,
  and cap the increase so effective INT cannot exceed 20.

**Bug if:**
- Picker shows 15 (base only, ignoring the racial +1).
- After taking +2 INT, sheet shows INT = 20 (used base 15 + racial 1 + ASI 2 = 18, correct)
  OR INT = 19 (missing the racial bonus somewhere).

### 9.3 Re-confirm ability scores after taking an ASI

1. Return to the Ability Scores step.
2. Change DEX from 14 to 15 (just a small tweak). Confirm.

**Expected:**
- The INT ASI (+2 to base) is preserved. INT base stays 17.
- DEX updates to 15.
- HP recalculates correctly.

**Bug if:** INT drops back to 15 (the ASI was erased by the score overwrite).
This is the "reapplyResolvedAsi" fix regression test.

---

## SECTION 10 — Level up on the character sheet (in-play)

1. Open any character at level 1. Tap **⬆ Level Up (→ 2)**.

**Expected:**
- Level becomes 2.
- HP increases by die/2+1+CON mod (fixed mode), minimum 1. For Fighter CON +3:
  floor(10/2)+1+3 = 9. New HP max = 13 + 9 = **22**.
- Hit dice pool becomes 2/2.
- No ASI at level 2 for Fighter (ASI first appears at level 4) — picker must NOT open.

2. Level up to 4.

**Expected:** ASI picker opens automatically at level 4.
**Bug if:** ASI picker opens at wrong levels, or doesn't open at level 4.

---

## SECTION 11 — Spellcaster: spells and spell slots

1. Create a new level 1 **Wizard** with INT 16 (+3 mod).

### 11.1 Spell selection during creation

1. On the Spells step, verify the spell list is filtered to Wizard spells only.
2. Select 3 cantrips and 6 spells (level-1 Wizard allowance).
3. Confirm.

**Expected:** hub marks Spells complete.
**Bug if:** spell list shows spells from all classes mixed together (no class filtering).

### 11.2 Spell save DC and attack bonus

Open the character sheet. On the Abilities or Combat tab:

**Expected for Level 1 Wizard, INT 16 (+3), proficiency +2:**
- Spell Save DC = 8 + 2 + 3 = **13**
- Spell Attack Bonus = 2 + 3 = **+5**

**Bug if:** either value doesn't include the racial INT bonus.

### 11.3 Spell slots visible

On the Combat tab, check the spell slots section.

**Expected:** 2 × level-1 slots shown as tappable pips (Level 1 Wizard = 2 slots).

### 11.4 Spend and restore a spell slot

1. Tap a level-1 slot pip → it should mark as used (greyed).
2. Tap it again → restores.
3. Take a **Long Rest** → all slots restore.

**Bug if:** slots don't respond to taps, or long rest doesn't restore them.

---

## SECTION 12 — Homebrew: spell builder

1. Tap the **Homebrew** tab.
2. Under Create, tap **✨ New Spell**.
3. Fill in: Name = "Arcane Bolt", Level = 1, School = Evocation,
   Casting Time = "1 action", Range = "60 feet",
   Components = "V, S", Duration = "Instantaneous",
   Description = "You hurl a bolt of pure arcane energy at a target."
4. Toggle **Concentration** off (leave it off for this test).
5. Tap **💾 Save Spell**.

**Expected:** alert "Arcane Bolt added to your homebrew library." Navigates back.
On the Homebrew tab, the Library panel shows "Arcane Bolt" with a blue "spell" badge.

**Bug if:** validation error with the above valid data, or save crashes.

---

## SECTION 13 — Campaigns: create and join flow

### 13.1 Create a campaign (DM)

1. Tap **Campaigns** tab.
2. Enter your name in the "YOUR NAME" field.
3. Tap **👑 Create Campaign (DM)**.
4. Enter a name (e.g. "Dragon Campaign"). Tap **Create Campaign**.

**Expected:** campaign view switches to DM mode. A 6-digit room code and QR code appear.
A status shows "0 players connected."

### 13.2 End the campaign

1. Tap **🗑 End Campaign**. Confirm.

**Expected:** returns to the "No Active Campaign" screen.

---

## SECTION 14 — Audit modal: verify every key value has a breakdown

For a character with at least: a race with bonuses, a class, background skills, and armor equipped.

Tap each of the following and verify the audit modal opens with a meaningful breakdown
(not empty, not "unavailable"):

- [ ] AC
- [ ] Speed
- [ ] Initiative
- [ ] Passive Perception
- [ ] STR, DEX, CON, INT, WIS, CHA (one per ability)
- [ ] STR saving throw (proficient) and DEX saving throw (not proficient)
- [ ] Athletics skill (trained)
- [ ] Perception skill (trained)
- [ ] Stealth skill (not trained)

**Bug if:** any modal opens empty, or any tap does nothing.

---

## Quick regression checklist

Run this after any code change to verify nothing regressed:

- [ ] Create a Hill Dwarf Fighter → HP = 10 + CON mod (effective, with +2 from race)
- [ ] Abilities tab shows CON 16, not 14 (racial bonus visible)
- [ ] Equip chain mail → AC = 16. Unequip → AC reverts.
- [ ] Equip leather armor → AC = 11 + DEX mod.
- [ ] Pick skills → background skills locked out in the picker.
- [ ] Return to skills screen after confirming → summary view, not "no choices."
- [ ] Change class → previous class skills cleared, background skills preserved.
- [ ] Long rest → HP full, slots full, hit dice full.
- [ ] Take ASI (+2 INT) → return to scores screen → re-confirm → INT still +2 not lost.
- [ ] Audit modal on AC shows base formula + contributors.
