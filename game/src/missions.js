// The story: Rae Calloway, getaway driver, back in Velmar Bay. Twelve missions
// in sequence — each has a briefing, a chain of objectives, a cash reward and a
// fail condition. Objective types: goto, pickup, deliver, race, escape, eliminate.

export const MISSIONS = [
  {
    id: 1, title: 'BACK IN TOWN', reward: 500,
    briefing: "Five years away, and Velmar Bay still smells like gasoline and rain. Rook needs a driver. Get to the garage — don't keep him waiting.",
    fail: 'You abandoned the job.',
    objectives: [{ type: 'goto', label: "Drive to Rook's Garage", place: 'garage' }],
  },
  {
    id: 2, title: 'FIRST WHEELS', reward: 800,
    briefing: "Rook's got a buyer for a Bayline Coupe parked in Neon Row. Steal it and bring it back — quietly. Cops hate joyriders.",
    fail: 'The car was wrecked or the job went cold.',
    objectives: [
      { type: 'goto', label: 'Steal the marked coupe in Neon Row', place: 'casino' },
      { type: 'deliver', label: 'Deliver the coupe to the garage', place: 'garage' },
    ],
  },
  {
    id: 3, title: 'HARBOUR RUN', reward: 1200,
    briefing: "A crate at the Old Harbor docks needs to reach Palm Court before the Vex boys find it. Drive fast, don't stop for anyone.",
    fail: 'The crate never arrived.',
    objectives: [
      { type: 'pickup', label: 'Pick up the crate at the docks', place: 'docks' },
      { type: 'deliver', label: 'Deliver the crate to Palm Court Plaza', place: 'plaza' },
    ],
  },
  {
    id: 4, title: 'HEAT WAVE', reward: 1500,
    briefing: "You got spotted. The whole precinct is on you — lose the tail, then lay low at the hideout until the heat dies.",
    fail: 'The cops boxed you in.',
    objectives: [
      { type: 'escape', label: 'Lose the police (wanted to 0)', seconds: 45 },
      { type: 'goto', label: 'Lay low at the hideout', place: 'hideout' },
    ],
  },
  {
    id: 5, title: 'NEON SPRINT', reward: 2000,
    briefing: "Street race through Neon Row. Five checkpoints, no shortcuts through the cops. Winner takes the pot — and the respect.",
    fail: 'You lost the race.',
    objectives: [{ type: 'race', label: 'Hit all 5 checkpoints before time runs out', seconds: 75 }],
  },
  {
    id: 6, title: 'THE COLLECTOR', reward: 2500,
    briefing: "Three debtors owe Rook money across the city. Collect from each — some of them will run. Bring the cash home.",
    fail: 'A debtor got away for good.',
    objectives: [
      { type: 'goto', label: 'Collect from the debtor in Cinder Flats', place: 'flats' },
      { type: 'goto', label: 'Collect from the debtor in Dockside', place: 'dockside' },
      { type: 'goto', label: 'Collect from the debtor in The Palisades', place: 'palisades' },
      { type: 'deliver', label: 'Bring the cash to the garage', place: 'garage' },
    ],
  },
  {
    id: 7, title: 'GUN RUNNER', reward: 3000,
    briefing: "Vex gunmen are holding the Ammo-N-Go. Clear them out on foot, then grab the shipment. Watch your ammo — and your health.",
    fail: 'The shipment was lost.',
    objectives: [
      { type: 'eliminate', label: 'Clear out the Vex gunmen at the shop (4)', place: 'shop', count: 4 },
      { type: 'pickup', label: 'Grab the weapons shipment', place: 'shop' },
    ],
  },
  {
    id: 8, title: 'BRIDGE BURNER', reward: 4000,
    briefing: "The Vex move product over the Bay Bridge at midnight. Intercept the convoy car and run it off the road — then vanish.",
    fail: 'The convoy got through.',
    objectives: [
      { type: 'goto', label: 'Reach the Bay Bridge', place: 'bridge' },
      { type: 'ram', label: 'Ram the convoy car until it stops', count: 1 },
      { type: 'escape', label: 'Escape the police dragnet', seconds: 40 },
    ],
  },
  {
    id: 9, title: 'HIGH ROLLER', reward: 5000,
    briefing: "The casino vault job. Drive the crew to Neon Row, hold the cops off while they work, then drive the getaway — no mistakes.",
    fail: 'The crew got caught.',
    objectives: [
      { type: 'goto', label: 'Pick up the crew at the hideout', place: 'hideout' },
      { type: 'deliver', label: 'Drive the crew to the casino', place: 'casino' },
      { type: 'escape', label: 'Getaway — lose the 4-star heat', seconds: 60 },
    ],
  },
  {
    id: 10, title: 'FIVE STAR FRENZY', reward: 6000,
    briefing: "Full heat. Five stars, Air One overhead, roadblocks everywhere. Survive the chase for two minutes and prove you're the best wheelman in the bay.",
    fail: 'Busted.',
    objectives: [{ type: 'survive', label: 'Survive the 5-star chase', seconds: 120 }],
  },
  {
    id: 11, title: 'KINGPIN', reward: 8000,
    briefing: "Vex himself is in the Palisades mansion district. Take his guards down, then take him. End this tonight.",
    fail: 'Vex slipped away.',
    objectives: [
      { type: 'eliminate', label: 'Take down the mansion guards (6)', place: 'palisades', count: 6 },
      { type: 'goto', label: 'Confront Vex at the gardens', place: 'gardens' },
    ],
  },
  {
    id: 12, title: 'LAST JOB', reward: 12000,
    briefing: "One last run: the money, the bridge, the whole city behind you. Drive the package across the Bay Bridge while every cop in Velmar Bay gives chase. Finish this, and the bay is yours.",
    fail: 'The package never crossed the bridge.',
    objectives: [
      { type: 'pickup', label: 'Pick up the package at the docks', place: 'docks' },
      { type: 'deliver', label: 'Cross the Bay Bridge with the package', place: 'bridge' },
      { type: 'escape', label: 'Lose the heat and reach the hideout', seconds: 45 },
    ],
  },
];

export const MISSION_PLACES = {
  garage: (city) => ({ x: city.garage.x, y: city.garage.y }),
  casino: (city) => ({ x: city.casino.x, y: city.casino.y }),
  docks: (city) => ({ x: city.docks.x, y: city.docks.y }),
  plaza: (city) => ({ x: 1430, y: 1400 }),
  hideout: (city) => ({ x: city.hideout.x, y: city.hideout.y }),
  flats: () => ({ x: 500, y: 1500 }),
  dockside: () => ({ x: 2500, y: 1500 }),
  palisades: () => ({ x: 1600, y: 2500 }),
  shop: (city) => ({ x: city.shop.x, y: city.shop.y }),
  bridge: (city) => ({ x: city.bridge.x, y: city.bridge.y }),
  gardens: () => ({ x: 2550, y: 2410 }),
};

export function missionTitle(index) {
  return MISSIONS[index] ? `${MISSIONS[index].id}. ${MISSIONS[index].title}` : 'FREE ROAM';
}
