# Board Lab

Dan's personal Tension Board 2 tool: browse climb lists, see each climb on the board, and light it (12×12, Mirror or Spray) over Bluetooth. Open it in **Bluefy** on iPhone, or Chrome on Android or a laptop.

Live page: https://danbeallclimbingcoach.github.io/board-lab/

## What it does

- **Search** the TB2 12×12 catalogue (Mirror or Spray) by angle, grade range, minimum ascents and
  stars, with an option to skip classics (benchmarks or 500+ ascents). Save results as lists on the
  phone.
- **Hold-type search** (low crimp, slopers & pinches) uses Dan's hold tags. They ship encrypted
  (`tags.enc.json`, AES-GCM, key from a passphrase via PBKDF2-SHA256) and only open on a phone where
  the passphrase has been entered.
- **Light** any climb on the board over Bluetooth, and see it on the board picture.

Climb data (`catalogue-*.json`) is a snapshot taken when the page was built.

## Credits and sources

- Bluetooth protocol (framing, LED encoding, UUIDs) follows Boardsesh's
  `docs/AURORA_BLUETOOTH_PROTOCOL_SPEC.md` — https://github.com/boardsesh/boardsesh (Apache-2.0).
- Hold → LED positions and role colours come from Boardsesh's generated board constants
  (`packages/board-constants`, Apache-2.0).
- Climb names, setters, holds and stats are from the public Tension Board catalogue, via
  Boardsesh's nightly board snapshots.
- Board pictures (`tb2-*-12x12.webp`) are Tension Climbing's hold renders, as used by the Tension
  app and published in Boardsesh's repository; they remain Tension's artwork.

Not affiliated with Tension Climbing, Aurora Climbing or Boardsesh. Board and product names
are used only to describe compatibility.

## How it's built

`index.html` is generated (climb lists, hold positions and the LED map are baked in) by a build
script kept with Dan's private project files; `encoder.js` and `search.js` are readable copies of
the code it embeds. To change the lists, rebuild and push — don't edit `index.html` by hand.
