import type { RoomType, VaasthuRule, ZoneId, ZoneRating } from '../model/types';

/**
 * Default Vaasthu rule profile.
 *
 * These are commonly cited traditional directional preferences. Sources and practitioners differ on
 * many of them, so every rule is editable per project. They are advisory only: they are not structural,
 * health or legal requirements, and they never override building regulations, structural safety,
 * sanitation, ventilation or setbacks.
 */

export type RuleTarget = RoomType | 'entrance';

/** Which 3×3 grid a rule is judged on: the house (outline or building) or the whole plot. */
export const PLOT_GRID_TARGETS: RuleTarget[] = ['sump', 'septic_tank', 'borewell', 'garden'];

export const ZONE_IDS: ZoneId[] = ['NW', 'N', 'NE', 'W', 'C', 'E', 'SW', 'S', 'SE'];

export const ZONE_NAMES: Record<ZoneId, { en: string; ta: string }> = {
  NE: { en: 'north-east', ta: 'வடகிழக்கு (ஈசான்ய மூலை)' },
  N: { en: 'north', ta: 'வடக்கு' },
  NW: { en: 'north-west', ta: 'வடமேற்கு (வாயு மூலை)' },
  E: { en: 'east', ta: 'கிழக்கு' },
  C: { en: 'centre', ta: 'மையம் (பிரம்மஸ்தானம்)' },
  W: { en: 'west', ta: 'மேற்கு' },
  SE: { en: 'south-east', ta: 'தென்கிழக்கு (அக்னி மூலை)' },
  S: { en: 'south', ta: 'தெற்கு' },
  SW: { en: 'south-west', ta: 'தென்மேற்கு (கன்னி மூலை)' },
};

export interface RuleText {
  label: { en: string; ta: string };
  explain: { en: string; ta: string };
}

export const RULE_TEXT: Partial<Record<RuleTarget, RuleText>> = {
  entrance: {
    label: { en: 'Main entrance', ta: 'தலைவாசல்' },
    explain: {
      en: 'Traditionally an entrance on the north, east or north-east side is preferred, and a south-west entrance is avoided.',
      ta: 'பாரம்பரியமாக வடக்கு, கிழக்கு அல்லது வடகிழக்கு பக்கத் தலைவாசல் சிறந்ததாகக் கருதப்படுகிறது; தென்மேற்குத் தலைவாசல் தவிர்க்கப்படுகிறது.',
    },
  },
  pooja: {
    label: { en: 'Pooja room', ta: 'பூஜை அறை' },
    explain: {
      en: 'The north-east is the traditional place for the pooja room; north or east are acceptable. South and south-west are avoided.',
      ta: 'பூஜை அறைக்கு வடகிழக்கு பாரம்பரியமாகச் சிறந்த இடம்; வடக்கு அல்லது கிழக்கு ஏற்கத்தக்கவை. தெற்கு, தென்மேற்கு தவிர்க்கப்படுகின்றன.',
    },
  },
  master_bedroom: {
    label: { en: 'Master bedroom', ta: 'முதன்மைப் படுக்கையறை' },
    explain: {
      en: 'The master bedroom is traditionally in the south-west; south or west are acceptable. North-east and south-east are avoided.',
      ta: 'முதன்மைப் படுக்கையறை பாரம்பரியமாகத் தென்மேற்கில் அமைகிறது; தெற்கு அல்லது மேற்கு ஏற்கத்தக்கவை. வடகிழக்கு, தென்கிழக்கு தவிர்க்கப்படுகின்றன.',
    },
  },
  bedroom: {
    label: { en: 'Other bedrooms', ta: 'மற்ற படுக்கையறைகள்' },
    explain: {
      en: 'Children’s and guest bedrooms are usually placed in the west or north-west; north, east or south are acceptable. The north-east corner is avoided.',
      ta: 'குழந்தைகள் மற்றும் விருந்தினர் படுக்கையறைகள் பொதுவாக மேற்கு அல்லது வடமேற்கில் அமைகின்றன; வடக்கு, கிழக்கு, தெற்கு ஏற்கத்தக்கவை. வடகிழக்கு மூலை தவிர்க்கப்படுகிறது.',
    },
  },
  kitchen: {
    label: { en: 'Kitchen', ta: 'சமையலறை' },
    explain: {
      en: 'The south-east (Agni corner) is traditionally preferred for the kitchen; north-west is the usual alternative. North-east, south-west and north are avoided.',
      ta: 'சமையலறைக்குத் தென்கிழக்கு (அக்னி மூலை) பாரம்பரியமாகச் சிறந்தது; வடமேற்கு வழக்கமான மாற்று இடம். வடகிழக்கு, தென்மேற்கு, வடக்கு தவிர்க்கப்படுகின்றன.',
    },
  },
  living: {
    label: { en: 'Living room', ta: 'வரவேற்பறை' },
    explain: {
      en: 'The living room is traditionally in the north, east or north-east, keeping the front of the house open and bright.',
      ta: 'வரவேற்பறை பாரம்பரியமாக வடக்கு, கிழக்கு அல்லது வடகிழக்கில் அமைகிறது; இதனால் வீட்டின் முன்பகுதி திறந்தும் வெளிச்சமாகவும் இருக்கும்.',
    },
  },
  dining: {
    label: { en: 'Dining', ta: 'உணவருந்தும் இடம்' },
    explain: {
      en: 'Dining is usually in the west or east, close to the kitchen.',
      ta: 'உணவருந்தும் இடம் பொதுவாகச் சமையலறைக்கு அருகில், மேற்கு அல்லது கிழக்கில் அமைகிறது.',
    },
  },
  bathroom: {
    label: { en: 'Bathrooms', ta: 'குளியலறைகள்' },
    explain: {
      en: 'Bathrooms are usually placed in the west or north-west; south is acceptable. The north-east, south-west and centre are avoided.',
      ta: 'குளியலறைகள் பொதுவாக மேற்கு அல்லது வடமேற்கில் அமைகின்றன; தெற்கு ஏற்கத்தக்கது. வடகிழக்கு, தென்மேற்கு, மையப் பகுதி தவிர்க்கப்படுகின்றன.',
    },
  },
  toilet: {
    label: { en: 'Toilets', ta: 'கழிப்பறைகள்' },
    explain: {
      en: 'Toilets are usually placed in the west or north-west; south is acceptable. The north-east, south-west and centre are avoided.',
      ta: 'கழிப்பறைகள் பொதுவாக மேற்கு அல்லது வடமேற்கில் அமைகின்றன; தெற்கு ஏற்கத்தக்கது. வடகிழக்கு, தென்மேற்கு, மையப் பகுதி தவிர்க்கப்படுகின்றன.',
    },
  },
  staircase: {
    label: { en: 'Staircase', ta: 'படிக்கட்டு' },
    explain: {
      en: 'Staircases are traditionally in the south, west or south-west; the north-east and the centre are avoided.',
      ta: 'படிக்கட்டுகள் பாரம்பரியமாகத் தெற்கு, மேற்கு அல்லது தென்மேற்கில் அமைகின்றன; வடகிழக்கு மற்றும் மையப் பகுதி தவிர்க்கப்படுகின்றன.',
    },
  },
  store: {
    label: { en: 'Store room', ta: 'சேமிப்பு அறை' },
    explain: {
      en: 'Heavy storage is traditionally kept in the south-west; south, west or north-west are acceptable. The north-east is avoided.',
      ta: 'கனமான பொருட்களைச் சேமிக்கத் தென்மேற்கு பாரம்பரியமாகச் சிறந்தது; தெற்கு, மேற்கு, வடமேற்கு ஏற்கத்தக்கவை. வடகிழக்கு தவிர்க்கப்படுகிறது.',
    },
  },
  utility: {
    label: { en: 'Utility / wash', ta: 'துவைக்கும் இடம்' },
    explain: {
      en: 'Utility and washing areas are usually in the north-west or south-east; the north-east is avoided.',
      ta: 'துவைக்கும் / பயன்பாட்டு இடம் பொதுவாக வடமேற்கு அல்லது தென்கிழக்கில் அமைகிறது; வடகிழக்கு தவிர்க்கப்படுகிறது.',
    },
  },
  portico: {
    label: { en: 'Portico / car parking', ta: 'போர்டிகோ / வாகன நிறுத்தம்' },
    explain: {
      en: 'Car parking and porticos are commonly placed in the north-west or south-east; north or east are acceptable.',
      ta: 'வாகன நிறுத்தம் மற்றும் போர்டிகோ பொதுவாக வடமேற்கு அல்லது தென்கிழக்கில் அமைகின்றன; வடக்கு அல்லது கிழக்கு ஏற்கத்தக்கவை.',
    },
  },
  study: {
    label: { en: 'Study', ta: 'படிப்பறை' },
    explain: {
      en: 'A study is usually placed in the west or north-east; north or east are acceptable.',
      ta: 'படிப்பறை பொதுவாக மேற்கு அல்லது வடகிழக்கில் அமைகிறது; வடக்கு அல்லது கிழக்கு ஏற்கத்தக்கவை.',
    },
  },
  balcony: {
    label: { en: 'Balcony / sit-out', ta: 'பால்கனி / அமரும் இடம்' },
    explain: {
      en: 'Balconies and sit-outs are preferred on the north, east or north-east; the south-west is avoided.',
      ta: 'பால்கனி மற்றும் அமரும் இடங்கள் வடக்கு, கிழக்கு அல்லது வடகிழக்கில் இருப்பது சிறந்தது; தென்மேற்கு தவிர்க்கப்படுகிறது.',
    },
  },
  sump: {
    label: { en: 'Underground sump', ta: 'நிலத்தடி நீர்த்தொட்டி (சம்ப்)' },
    explain: {
      en: 'An underground water sump is traditionally in the north-east, north or east of the plot; south-east, south and south-west are avoided.',
      ta: 'நிலத்தடி நீர்த்தொட்டி பாரம்பரியமாக மனையின் வடகிழக்கு, வடக்கு அல்லது கிழக்கில் அமைகிறது; தென்கிழக்கு, தெற்கு, தென்மேற்கு தவிர்க்கப்படுகின்றன.',
    },
  },
  overhead_tank: {
    label: { en: 'Overhead tank', ta: 'மேல்நிலை நீர்த்தொட்டி' },
    explain: {
      en: 'The overhead water tank is traditionally over the south-west of the house; west or south are acceptable. The north-east and centre are avoided.',
      ta: 'மேல்நிலை நீர்த்தொட்டி பாரம்பரியமாக வீட்டின் தென்மேற்குப் பகுதியின் மேல் அமைகிறது; மேற்கு அல்லது தெற்கு ஏற்கத்தக்கவை. வடகிழக்கு, மையம் தவிர்க்கப்படுகின்றன.',
    },
  },
  septic_tank: {
    label: { en: 'Septic tank', ta: 'கழிவுநீர்த் தொட்டி (செப்டிக் டேங்க்)' },
    explain: {
      en: 'A septic tank is usually in the north-west of the plot, or the west; the north-east, south-west and centre are avoided. Health and sanitation rules on distances from wells and sumps come first.',
      ta: 'செப்டிக் டேங்க் பொதுவாக மனையின் வடமேற்கு அல்லது மேற்கில் அமைகிறது; வடகிழக்கு, தென்மேற்கு, மையம் தவிர்க்கப்படுகின்றன. கிணறு, சம்ப் ஆகியவற்றிலிருந்து தேவையான தூரம் போன்ற சுகாதார விதிகளே முதன்மை.',
    },
  },
  borewell: {
    label: { en: 'Borewell', ta: 'ஆழ்துளைக் கிணறு' },
    explain: {
      en: 'A borewell or well is traditionally in the north-east, north or east of the plot; south-west and south-east are avoided.',
      ta: 'ஆழ்துளைக் கிணறு அல்லது கிணறு பாரம்பரியமாக மனையின் வடகிழக்கு, வடக்கு அல்லது கிழக்கில் அமைகிறது; தென்மேற்கு, தென்கிழக்கு தவிர்க்கப்படுகின்றன.',
    },
  },
  garden: {
    label: { en: 'Garden / open space', ta: 'தோட்டம் / திறந்த வெளி' },
    explain: {
      en: 'More open space and low planting are traditionally kept on the north, east and north-east of the plot.',
      ta: 'மனையின் வடக்கு, கிழக்கு, வடகிழக்கு பகுதிகளில் அதிக திறந்த வெளியும் தாழ்வான செடிகளும் இருப்பது பாரம்பரிய வழக்கம்.',
    },
  },
};

export const CENTRE_TEXT = {
  en: 'The centre of the house (Brahmasthan) is traditionally kept open and light: toilets, staircases, kitchens and heavy storage are avoided there.',
  ta: 'வீட்டின் மையப் பகுதி (பிரம்மஸ்தானம்) பாரம்பரியமாகத் திறந்தும் இலகுவாகவும் வைக்கப்படுகிறது; அங்கு கழிப்பறை, படிக்கட்டு, சமையலறை, கனமான சேமிப்பு தவிர்க்கப்படுகின்றன.',
};

/** Room types that should not sit on the centre of the house when keepCentreOpen is on. */
export const CENTRE_AVOID: RoomType[] = ['toilet', 'bathroom', 'staircase', 'kitchen', 'store'];

/** Which rule a room type is judged by (several types share one rule). */
export function ruleTargetFor(type: RoomType): RuleTarget | null {
  switch (type) {
    case 'parking':
      return 'portico';
    case 'sitout':
      return 'balcony';
    case 'terrace':
      return null; // roof terraces cover the house; judging them by zone is meaningless
    default:
      return RULE_TEXT[type] ? type : null;
  }
}

function z(preferred: ZoneId[], acceptable: ZoneId[], avoid: ZoneId[]): Record<ZoneId, ZoneRating> {
  const out = {} as Record<ZoneId, ZoneRating>;
  for (const id of ZONE_IDS) {
    out[id] = preferred.includes(id) ? 'preferred' : acceptable.includes(id) ? 'acceptable' : avoid.includes(id) ? 'avoid' : 'neutral';
  }
  return out;
}

export function defaultRules(): VaasthuRule[] {
  const r = (target: RuleTarget, weight: number, zones: Record<ZoneId, ZoneRating>): VaasthuRule => ({ target, enabled: true, weight, zones });
  return [
    r('entrance', 3, z(['N', 'NE', 'E'], ['NW'], ['SW'])),
    r('pooja', 2, z(['NE'], ['N', 'E'], ['S', 'SW'])),
    r('master_bedroom', 2, z(['SW'], ['S', 'W'], ['NE', 'SE'])),
    r('bedroom', 1, z(['W', 'NW'], ['N', 'E', 'S'], ['NE'])),
    r('kitchen', 2, z(['SE'], ['NW'], ['NE', 'SW', 'N'])),
    r('living', 1, z(['N', 'NE', 'E'], ['NW', 'W', 'C'], [])),
    r('dining', 1, z(['W', 'E'], ['N', 'S', 'C'], [])),
    r('bathroom', 2, z(['W', 'NW'], ['S'], ['NE', 'SW', 'C'])),
    r('toilet', 2, z(['W', 'NW'], ['S'], ['NE', 'SW', 'C'])),
    r('staircase', 1, z(['S', 'W', 'SW'], ['SE', 'NW'], ['NE', 'C'])),
    r('store', 1, z(['SW'], ['S', 'W', 'NW'], ['NE'])),
    r('utility', 1, z(['NW', 'SE'], ['W', 'S'], ['NE'])),
    r('portico', 1, z(['NW', 'SE'], ['N', 'E'], [])),
    r('study', 1, z(['W', 'NE'], ['N', 'E'], [])),
    r('balcony', 1, z(['N', 'E', 'NE'], ['NW', 'SE'], ['SW'])),
    r('sump', 2, z(['NE', 'N', 'E'], [], ['SE', 'S', 'SW'])),
    r('overhead_tank', 1, z(['SW'], ['W', 'S'], ['NE', 'C'])),
    r('septic_tank', 2, z(['NW'], ['W'], ['NE', 'SW', 'C'])),
    r('borewell', 1, z(['NE', 'N', 'E'], [], ['SW', 'SE'])),
    r('garden', 1, z(['N', 'NE', 'E'], ['NW'], [])),
  ];
}
