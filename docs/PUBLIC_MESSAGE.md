# Grimoire — Public Message & Creator Outreach

*Companion to `GROWTH_STRATEGY.md` (distribution/product) and `CURRENT_STATE.md` (what's shipped). This one is about how Grimoire talks about itself — to players, and to the creators who might tell players about it.*

---

## The problem, stated honestly

Not "an app was missing from the market." A specific, personal frustration:

> I wanted to create and play the character I imagined, but the tools I found kept putting restrictions between me and my character.

That's the actual reason Grimoire exists. It's a stronger opening than any feature list, because it's true and it's specific.

---

## Don't frame this as a startup launch

The message is not:

> "I built an open-source alternative to D&D Beyond."

That's a comparison, and comparisons invite "why not just use D&D Beyond." The real message is about *why*, not *versus*:

> I built Grimoire because I wanted to create my character, not the character an app allowed me to create.
>
> I kept running into restrictions when trying to represent the character I actually wanted to play. So I started building an offline, open-source 5e character tool where the software helps calculate and track the rules without deciding what you're allowed to make.
>
> Grimoire is free. There are no accounts, subscriptions or servers. You can create your own classes, subclasses, races, feats, spells, items and other content, use them like normal game content, and share them as files.
>
> I don't want other players to run into the same problem I did.

---

## This philosophy isn't just marketing — it's already built

The dangerous version of this pitch is making a claim the software doesn't back up. It's worth saying plainly: this one already checks out against the actual implementation, not just the intent behind it.

- **Homebrew isn't a second tier.** A custom race, class, subclass, background, feat, spell, or item runs through the exact same engine as official content — same choice-resolution, same rules validation, same character-sheet behavior. There's no "homebrew mode" with fewer capabilities.
- **You're not locked into what the builder anticipated.** A character isn't frozen at whatever the creation wizard originally allowed — features and even your entire background can be added, removed, or swapped *mid-campaign*, including authoring a one-off custom feature on the spot, with the sheet showing exactly what changes before you commit to it.
- **You can test whether your homebrew actually does what you meant.** Before saving a custom feat or item, you can simulate its real mechanical effect against a scratch character and see the actual before/after — not just trust your own description of it.
- **Rule limits are configurable, not hardcoded.** Something as basic as the ability-score cap isn't wired to a fixed `20` buried in the code — it's sourced from the ruleset/campaign/feature/item in play, so a DM's house rule is a first-class setting, not a workaround.
- **Manual overrides exist on purpose.** When the rules genuinely don't cover what a table wants to do, there's a real, disclosed manual-override path — instead of forcing a player to fake it through an unrelated field.

That's the difference between a marketing line and a design principle: every claim above is something a skeptical reviewer could actually go verify by using the app.

---

## Two lines that carry the identity

Better than a feature list. Both are already true of the implementation, not aspirational:

> **The table plays. Grimoire tracks.**

(Reactive features like Sneak Attack or Shield are described, never auto-resolved — the app tells you the trigger and the effect; you still roll the dice and decide. It computes and remembers; it doesn't play the game for you.)

> **Your character shouldn't be limited by your character-sheet app.**

Together, those two sentences explain the project better than forty bullet points would.

---

## Creator outreach — ask for discoverability, not promotion

Don't open with "Would you promote my app?" You don't even need to open with "Would you test my app?"

Tell them why it exists, and ask whether it sounds useful to the people they already talk to. Be explicit that visibility is the actual goal — just not visibility bought with money, ads, data collection, or a subscription funnel. There's nothing to hide there, so don't imply there is.

### Template

```
Hi,

I'm Nika, and I've been building an open-source 5e-compatible companion
app called Grimoire.

I started the project because I kept running into a problem with
existing character tools: I couldn't freely create and represent the
character I actually wanted to play.

I don't want other players to have to deal with the same problem.

Grimoire is therefore built around the idea that the app should help
with the rules and bookkeeping without deciding what kind of character
you're allowed to make.

It's completely free and open source, works offline, requires no
account or server, and allows players to create their own classes,
subclasses, races/species, backgrounds, feats, spells, features,
items, monsters and conditions. Custom content participates in the
same character-building and rules systems as built-in content rather
than being treated as simple notes.

Players can also export their homebrew as ".grimoire-pack" files and
give them directly to other players. Grimoire doesn't operate a
content marketplace or require a central server.

I'm not contacting you about a sponsorship or paid promotion. I'm
trying to make the project publicly known so that players who have the
same problem I had can actually find it.

If Grimoire sounds useful to you or to the kinds of players you
interact with, I'd be very interested in having you try it. Criticism
is welcome, especially around things the app still prevents players or
DMs from doing.

And if you create original homebrew, I'd be happy to help turn one of
your creations into a Grimoire pack, with your permission, to see
whether the system can actually represent what you designed.

If you're interested, I can send you the Android build, source
repository, and a short demonstration.

Thanks,
Nika
Grimoire
```

### Why this version works

- It says exactly why you're reaching out (discoverability), so nothing reads as fishing for a favor in disguise.
- It offers something specific and low-effort back to the creator (turn one of *their* homebrew into a working pack) instead of only asking for their time.
- "Criticism is welcome, especially around things the app still prevents" invites a real reviewer's honest reaction instead of a canned "check it out."
- It never claims the app is finished or perfect — it's honest about being early, which reads as more trustworthy than a polished pitch would.

---

## What not to do

- Don't mass-send the same message to large, generic D&D channels. It reads as spam and gets nothing back.
- Don't lead with the feature list. Lead with the reason. The feature list is what backs the reason up, not what replaces it.
- Don't position it against D&D Beyond by name in outreach messages — it invites a defensive "why not just use..." reaction instead of curiosity.
- Don't ask for promotion before anyone has actually used it.

---

## The actual next question

Not "how do we market Grimoire" — it's:

> Who are the first creators and communities whose audiences have exactly this problem?

That's answerable concretely, not abstractly: specific homebrew-focused YouTubers, specific subclass/species homebrew creators (Reddit, itch.io, Discord), specific TTRPG-tools and open-source communities — chosen because their audience already cares about *making* content, not blasted at the largest D&D channels because they have the biggest numbers.

Worth researching by name before sending anything.
