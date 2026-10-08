# grimoire-dm-workflow (Phase 21 recording)

Real footage of the phone acting as the **DM** through the whole Tater workflow while the Host and two Players run on the PC
over real TCP: offline preparation, connect to a Host, prepared encounter not live until activated, change request modified by
the player, multi-target effect with Due to End and end-one-target, secret effect, player disconnect/reconnect, preparation
still present. Produced by `npx tsx scripts/e2e/run.ts tater-dm-workflow --record`; the recording is also the acceptance test
(the run PASSED, with 13 Node-side assertions, e.g. the Player's raw wire bytes contain no secret metadata).

| File | Duration |
|---|---|
| grimoire-dm-workflow-part1.mp4 | 169.6 s |
| grimoire-dm-workflow-part2.mp4 | 95.7 s |

The two files play back to back (Android `screenrecord` caps a file at 3 minutes and no video editor is installed on this
machine to join them). Unedited. The Player-side isolation is asserted by the Node Player's captured bytes in the run's
`result.json`; a phone can only show one role per recording.
Status-bar icons of the tester's phone are visible; this is an internal acceptance recording, not an outreach asset.
