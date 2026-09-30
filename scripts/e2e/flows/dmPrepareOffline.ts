// Spec steps A-E: the DM prepares a campaign with NO Host and NO network use, closes the app
// completely, relaunches, and everything is still there.
import { Flow, openLiveHub } from './common';

export const dmPrepareOffline: Flow = {
  name: 'dm-prepare-offline',
  description: 'A-E: prepare campaign / encounter / public + secret effects / change template / DM note offline, kill the app, relaunch, verify persistence',
  async run({ phone, step }) {
    await phone.launch();
    await openLiveHub(phone);
    step('wipe previous live-session test data (test build fixture; characters untouched)');
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.assertText('session data wiped');
    phone.back();
    await phone.tap({ id: 'live-open-prepare' });

    step('create the campaign');
    await phone.typeInto({ id: 'prep-new-name' }, 'Automation Campaign');
    await phone.tap({ id: 'prep-create' });
    await phone.assertText('Automation Campaign');

    step('prepared encounter: Bridge Ambush');
    await phone.tap({ id: 'prep-add-encounter' });
    await phone.typeInto({ id: 'prep-enc-name' }, 'Bridge Ambush');
    await phone.typeInto({ id: 'prep-enc-combatants' }, 'Bandit, Bandit Captain');
    await phone.tap({ id: 'prep-enc-save' });
    await phone.assertPresent({ id: 'prep-encounter-Bridge Ambush' });

    step('prepared public effect: Blessing');
    await phone.tap({ id: 'prep-add-effect' });
    await phone.typeInto({ id: 'prep-fx-name' }, 'Blessing');
    await phone.tap({ id: 'prep-fx-stat-save' });
    await phone.typeInto({ id: 'prep-fx-rounds' }, '10');
    await phone.tap({ id: 'prep-fx-save' });
    await phone.assertPresent({ id: 'prep-effect-Blessing' });

    step('prepared secret effect: Hidden Curse (AC -1)');
    await phone.tap({ id: 'prep-add-effect' });
    await phone.typeInto({ id: 'prep-fx-name' }, 'Hidden Curse');
    await phone.tap({ id: 'prep-fx-vis-secret' });
    await phone.tap({ id: 'prep-fx-stat-ac' });
    await phone.typeInto({ id: 'prep-fx-value' }, '-1');
    await phone.tap({ id: 'prep-fx-save' });
    await phone.assertPresent({ id: 'prep-effect-Hidden Curse' });

    step('prepared change template: Exhaustion Increase');
    await phone.tap({ id: 'prep-add-template' });
    await phone.typeInto({ id: 'prep-tpl-label' }, 'Exhaustion Increase');
    await phone.tap({ id: 'prep-tpl-save' });
    await phone.assertPresent({ id: 'prep-template-Exhaustion Increase' });

    step('DM-only note');
    await phone.tap({ id: 'prep-add-note' });
    await phone.typeInto({ id: 'prep-note-text' }, 'automation fixture note');
    await phone.tap({ id: 'prep-note-save' });
    await phone.assertPresent({ textContains: 'utomation fixture note' });

    step('close the app COMPLETELY and relaunch');
    phone.stopApp();
    await phone.launch(false);
    await openLiveHub(phone);
    await phone.tap({ id: 'live-open-prepare' });
    await phone.assertVisible({ id: 'prep-campaign-Automation Campaign' });
    await phone.tap({ id: 'prep-open-Automation Campaign' });

    step('everything persisted');
    await phone.assertPresent({ id: 'prep-encounter-Bridge Ambush' });
    await phone.assertPresent({ id: 'prep-effect-Blessing' });
    await phone.assertPresent({ id: 'prep-effect-Hidden Curse' });
    await phone.assertPresent({ id: 'prep-template-Exhaustion Increase' });
    await phone.assertPresent({ textContains: 'utomation fixture note' });
  },
};
