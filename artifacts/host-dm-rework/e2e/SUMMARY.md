# Android E2E results (physical phone, final E2E build)

Device: POCO M7 Pro 5G (HyperOS 3.0 / Android 16), adb `GAJFYTFIW8KBOZDA`. Build: `builds/grimoire-local-20260930-0516.apk` (EXPO_PUBLIC_E2E=1, SRD-only default), SHA-256 `93b71a363007f288bcc0d0b4f2001fd92b0db0c6f48bd8a5b640d1439be0e41c`.
Other roles were played by Node peers on the PC over real TCP with the same production session code. No human interaction occurred during any run.

| Flow | Result | Seconds | Node-side checks | What it proves |
|---|---|---|---|---|
| dm-live | PASS | 336 | 36 | F-AM: phone = DM against a Node Host + Players; activation, secrets, change requests, per-target effects, reconnects, Host X -> Host Y |
| dm-prepare-offline | PASS | 227 | 0 | A-E: prepare campaign / encounter / public + secret effects / change template / DM note offline, kill the app, relaunch, verify persistence |
| host-only | PASS | 96 | 19 | phone = Host-only: approve a DM, forged DM ops refused, Host sees no DM material, Host app restart resumes with roles intact |
| host-plus-dm | PASS | 109 | 9 | phone = Host + DM (explicit): both screens reachable, no Player screen, DM operations work through its own Host, secrets stay out of the player wire |
| player-phone | PASS | 333 | 18 | phone = Player: change request modified on-device, secret effect hidden but its AC change applied to the real sheet, exactly-once across reconnect |
| tater-dm-workflow | PASS | 315 | 13 | Tater the Bard: DM prepares offline, connects to a Host, activates prepared content, change request modified by the player, per-target effects, secret effect, reconnect, prep still there |

Per-flow evidence (`result.json`, `final.png`, step log, phone action log) is in each flow folder. Failure runs during development were fixed at the root cause; see `progress.md`.

`tater-dm-workflow` also produced the screen recording in `../demo/` (two consecutive segments because `screenrecord` stops at 3 minutes; not edited).
