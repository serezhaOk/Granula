// Auto-generated flora & fauna names for recordings — the same word banks and
// selection logic as the web build (index.html 588-633). "Used" names are
// persisted so fresh recordings avoid repeats until the pool is exhausted.

import { getPref, setPref } from "../storage/prefs";

const NAME_SINGLES = (
  "Mycelium Nightjar Sphagnum Bryophyte Chanterelle Murmuration Foxglove Mandrake Nightshade " +
  "Wolfsbane Yarrow Vervain Mugwort Tansy Betony Amanita Morel Puffball Inkcap Waxwing Redstart Dunnock " +
  "Goshawk Merlin Kestrel Kite Shrike Corncrake Bittern Godwit Whimbrel Dotterel Wheatear Stonechat " +
  "Brambling Siskin Twite Serin Crossbill Hawfinch Nuthatch Treecreeper Goldcrest Firecrest Chiffchaff " +
  "Blackcap Whitethroat Nightingale Bullfinch Linnet Skylark Woodlark Pipit Wagtail Dipper Kingfisher " +
  "Wryneck Hoopoe Cuckoo Swift Swallow Martin Starling Fieldfare Redwing Ouzel Raven Rook Jackdaw Magpie " +
  "Chough Lapwing Snipe Woodcock Sanderling Dunlin Knot Ruff Turnstone Avocet Shelduck Teal Wigeon " +
  "Pintail Pochard Goldeneye Smew Eider Scoter Gannet Fulmar Shearwater Petrel Guillemot Razorbill " +
  "Puffin Kittiwake Skua Tern Osprey Harrier Buzzard Hobby Peregrine Saxifrage Stonecrop Bogbean " +
  "Sundew Butterwort Bladderwort Milkwort Eyebright Selfheal Bugle Woundwort Figwort Toadflax Speedwell " +
  "Cowslip Oxlip Campion Ragwort Knapweed Scabious Teasel Burdock Mallow Meadowsweet Loosestrife " +
  "Angelica Hogweed Pignut Sanicle Moschatel Twayblade Helleborine Ramsons Bistort Tormentil Cinquefoil " +
  "Agrimony Avens Burnet Dropwort Cloudberry Dewberry Bilberry Crowberry Cowberry Juniper Yew Hornbeam " +
  "Wychelm Blackthorn Buckthorn Guelder Spindle Dogwood Wayfaring Whitebeam Medlar Quince Damson Sloe " +
  "Samphire Glasswort Eelgrass Wrack Kelp Dulse Carrageen Limpet Whelk Cockle Razorshell Cuttlefish " +
  "Brittlestar Anemone Barnacle Sandhopper Lugworm Ragworm Shipworm Glowworm Slowworm Lacewing Alderfly " +
  "Caddisfly Mayfly Damselfly Hawkmoth Silkmoth Lappet Drinker Ermine Footman Tussock Underwing Carpet " +
  "Pug Wainscot Rustic Quaker Chestnut Sallow Brindle Shark Snout Thorn Beauty Emerald Arches Dart " +
  "Minor Fanfoot Silverline Burnet Forester Longhorn Weevil Chafer Dorbeetle Sexton Glowfly Springtail " +
  "Bristletail Silverfish Firebrat Katydid Bushcricket Groundhopper Froghopper Leafhopper Lacebug " +
  "Shieldbug Damselbug Waterboatman Backswimmer Pondskater Whirligig Diving Beetle Scorpionfly Snakefly"
)
  .split(/\s+/)
  .filter((w) => w.length > 3);

const NAME_ADJ = (
  "Silent Lunar Velvet Hollow Amber Feral Misty Dusky Pale Wild Creeping Whispering Gilded " +
  "Mossy Fading Spectral Drifting Woven Umbral Verdant Sleeping Wandering Thorned Dappled Brackish Silver " +
  "Ashen Ember Twilight Boreal Tidal Sylvan Obsidian Opaline Cinder Hidden"
).split(" ");

const NAME_NOUN = (
  "Moth Fern Lichen Owl Reed Moss Heron Beetle Willow Ivy Nettle Orchid Bracken Thistle " +
  "Wren Newt Toadstool Bramble Alder Rowan Sedge Vole Lark Finch Adder Hare Badger Cricket Cicada Mantis " +
  "Dragonfly Hawthorn Elder Aspen Plover Curlew Weasel Stoat Polecat Marten"
).split(" ");

let namePool: string[] | null = null;

export async function randomRecName(): Promise<string> {
  if (!namePool) {
    namePool = NAME_SINGLES.slice();
    for (const a of NAME_ADJ) for (const n of NAME_NOUN) namePool.push(a + " " + n);
  }
  let used: Set<string>;
  try {
    used = new Set(JSON.parse((await getPref("used-names")) || "[]"));
  } catch {
    used = new Set();
  }
  let candidates = namePool.filter((n) => !used.has(n));
  if (!candidates.length) {
    used.clear();
    candidates = namePool;
  }
  const name = candidates[(Math.random() * candidates.length) | 0];
  used.add(name);
  try {
    await setPref("used-names", JSON.stringify([...used]));
  } catch {}
  return name;
}

// Deterministic per-sample palette (hash of name), matching paletteFor().
const PALETTES = ["ember", "orchid", "nebula"] as const;
export type Palette = (typeof PALETTES)[number];

export function paletteFor(name: string): Palette {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}
