# TB2 Light

A small web page that lights climbs on a Tension Board 2 (12×12, Mirror or Spray) over
Bluetooth. Open it in **Bluefy** on iPhone, or Chrome on Android or a laptop.

Live page: https://danbeallclimbingcoach.github.io/tb2-light/

## Credits and sources

- Bluetooth protocol (framing, LED encoding, UUIDs) follows Boardsesh's
  `docs/AURORA_BLUETOOTH_PROTOCOL_SPEC.md` — https://github.com/boardsesh/boardsesh (Apache-2.0).
- Hold → LED positions and role colours come from Boardsesh's generated board constants
  (`packages/board-constants`, Apache-2.0).
- Climb names, setters, holds and stats are from the public Tension Board catalogue, via
  Boardsesh's nightly board snapshots.

Not affiliated with Tension Climbing, Aurora Climbing or Boardsesh. Board and product names
are used only to describe compatibility.
