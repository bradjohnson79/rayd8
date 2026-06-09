import { AMRITA_AUDIO_TRACKS, DEFAULT_AMRITA_AUDIO_TRACK, getAmritaAudioTrack, normalizeAmritaAudioTrackId } from './audio-manifest.js';
import { createAmritaAudioLayer } from './audio-layer.js';
import {
  bindPersonalResonanceControls,
  loadPersonalResonance,
  mountPersonalResonanceOverlay,
  renderPersonalResonanceRuntimePanel,
  savePersonalResonance,
  setPersonalResonancePaused,
  syncPersonalResonanceControls,
  syncPersonalResonanceRuntimePanel,
  unmountPersonalResonanceOverlay,
} from './personal-resonance.js';
import { createRuntimeControls } from './runtime-controls.js';

const AMRITA_DEBUG_STORAGE_KEY = 'rayd8-amrita-debug';

function isAmritaDebugEnabled() {
  try {
    return window.localStorage.getItem(AMRITA_DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function debugAmritaRuntime(eventName, details = {}) {
  if (!isAmritaDebugEnabled()) return;

  console.info('[AMRITA debug]', eventName, {
    hidden: document.hidden,
    visibilityState: document.visibilityState,
    ...details,
  });
}

const GLYPH_FILES = [
  "5 VAYU BODY.png",
  "ACUPUNCTURE BODIES.png",
  "ADRENAL-KIDNEYS.png",
  "ADRENALINE.png",
  "AJNA.png",
  "AKASHIC BODY.png",
  "ANAHATA.png",
  "ASTRAL BODY.png",
  "BALANCED BRAIN HEMISPHERES.png",
  "BLADDER.png",
  "BLOOD CELLS.png",
  "BLOOD VESSELS.png",
  "BONE MARROW.png",
  "BRAIN NEURONS.png",
  "BRAIN.png",
  "CARTILAGE.png",
  "CIRCULATORY SYSTEM.png",
  "DANTIENS.png",
  "DMT.png",
  "DNA LEVEL REFINEMENT.png",
  "DNA.png",
  "EAR.png",
  "ELBOW.png",
  "EMOTIONAL BODY.png",
  "ESTROGEN.png",
  "EYE.png",
  "FEMALE REPRODUCTIVE.png",
  "FOOT.png",
  "FULL FEMALE BODY.png",
  "FULL MALE BODY.png",
  "HAIR.png",
  "HAND.png",
  "HEART.png",
  "HYDROGEN.png",
  "HYPOTHALAMUS-AMYGDALA-PITUITARY.png",
  "IMMUNE CELLS.png",
  "KNEE.png",
  "LARGE-SMALL INTESTINES.png",
  "LIVER.png",
  "LUNGS.png",
  "LYMPHATIC SYSTEM.png",
  "MALE REPRODUCTIVE.png",
  "MAMMARY GLAND-BREAST.png",
  "MANIPURA.png",
  "MELATONIN.png",
  "MENTAL BODY.png",
  "MOUTH.png",
  "MULADHARA.png",
  "MUSCULAR SYSTEM.png",
  "NADIS.png",
  "NEGATIVE ION.png",
  "NERVOUS SYSTEM.png",
  "NOSE.png",
  "OVARY.png",
  "OXYGEN.png",
  "PANCREAS.png",
  "PINEAL GLAND.png",
  "PROGESTERONE.png",
  "SAHASRARA.png",
  "SEROTONIN.png",
  "SINUS GLANDS.png",
  "SKELETAL BODY.png",
  "SKIN.png",
  "SPINE.png",
  "SPLEEN.png",
  "STOMACH.png",
  "SWADISTHANA.png",
  "TELOMERES.png",
  "TENDONS.png",
  "TESTE.png",
  "TESTOSTERONE.png",
  "THYMUS.png",
  "THYROID.png",
  "TORUS FIELD for EMF.png",
  "VISSHUDDHA.png"
];

const GLYPH_CATALOG = [
  {
    "id": "5-vayu-body",
    "label": "5 Vayu Body",
    "file": "5 VAYU BODY.png",
    "keywords": [
      "5 vayu body",
      "energetic movement",
      "vayu",
      "vayu body"
    ],
    "aliases": [
      "5",
      "5 vayu body",
      "aura / energy",
      "body",
      "energetic movement",
      "vayu",
      "vayu body"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "acupuncture-bodies",
    "label": "Acupuncture Bodies",
    "file": "ACUPUNCTURE BODIES.png",
    "keywords": [
      "acupoints",
      "acupuncture",
      "meridians"
    ],
    "aliases": [
      "acupoints",
      "acupuncture",
      "acupuncture bodies",
      "aura / energy",
      "bodies",
      "meridians"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "energy channels"
    ]
  },
  {
    "id": "adrenal-kidneys",
    "label": "Adrenal-Kidneys",
    "file": "ADRENAL-KIDNEYS.png",
    "keywords": [
      "adrenal",
      "adrenal glands",
      "detox",
      "filtration",
      "kidneys",
      "renal"
    ],
    "aliases": [
      "adrenal",
      "adrenal glands",
      "adrenal kidneys",
      "detox",
      "endocrine system",
      "filtration",
      "kidneys",
      "renal"
    ],
    "category": "organ",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "filtration",
      "hormones"
    ]
  },
  {
    "id": "adrenaline",
    "label": "Adrenaline",
    "file": "ADRENALINE.png",
    "keywords": [
      "adrenaline",
      "stress response"
    ],
    "aliases": [
      "adrenaline",
      "endocrine system",
      "stress response"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "ajna",
    "label": "Ajna",
    "file": "AJNA.png",
    "keywords": [
      "ajna",
      "forehead",
      "intuition",
      "third eye"
    ],
    "aliases": [
      "ajna",
      "chakra system",
      "forehead",
      "intuition",
      "third eye"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "intuition"
    ]
  },
  {
    "id": "akashic-body",
    "label": "Akashic Body",
    "file": "AKASHIC BODY.png",
    "keywords": [
      "akashic",
      "akashic body",
      "spiritual memory"
    ],
    "aliases": [
      "akashic",
      "akashic body",
      "aura / energy",
      "body",
      "spiritual memory"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "aura"
    ]
  },
  {
    "id": "anahata",
    "label": "Anahata",
    "file": "ANAHATA.png",
    "keywords": [
      "anahata",
      "chest",
      "compassion",
      "heart chakra"
    ],
    "aliases": [
      "anahata",
      "chakra system",
      "chest",
      "compassion",
      "heart chakra"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "harmonization"
    ]
  },
  {
    "id": "astral-body",
    "label": "Astral Body",
    "file": "ASTRAL BODY.png",
    "keywords": [
      "astral",
      "astral body",
      "aura",
      "energetic body"
    ],
    "aliases": [
      "astral",
      "astral body",
      "aura",
      "aura / energy",
      "body",
      "energetic body"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "aura"
    ]
  },
  {
    "id": "balanced-brain-hemispheres",
    "label": "Balanced Brain Hemispheres",
    "file": "BALANCED BRAIN HEMISPHERES.png",
    "keywords": [
      "balanced brain hemispheres",
      "brain balance",
      "cognition",
      "hemispheres"
    ],
    "aliases": [
      "balanced",
      "balanced brain hemispheres",
      "brain",
      "brain balance",
      "cognition",
      "hemispheres"
    ],
    "category": "brain",
    "groups": [],
    "tags": [
      "cognition"
    ]
  },
  {
    "id": "bladder",
    "label": "Bladder",
    "file": "BLADDER.png",
    "keywords": [
      "bladder",
      "elimination",
      "urinary",
      "urine"
    ],
    "aliases": [
      "bladder",
      "elimination",
      "urinary",
      "urine"
    ],
    "category": "organ",
    "groups": [],
    "tags": [
      "elimination"
    ]
  },
  {
    "id": "blood-cells",
    "label": "Blood Cells",
    "file": "BLOOD CELLS.png",
    "keywords": [
      "blood cells",
      "immunity",
      "red blood cells",
      "white blood cells"
    ],
    "aliases": [
      "blood",
      "blood cells",
      "cardiovascular system",
      "cells",
      "immune system",
      "immunity",
      "red blood cells",
      "white blood cells"
    ],
    "category": "cellular",
    "groups": [
      "cardiovascular",
      "immune"
    ],
    "tags": [
      "blood"
    ]
  },
  {
    "id": "blood-vessels",
    "label": "Blood Vessels",
    "file": "BLOOD VESSELS.png",
    "keywords": [
      "arteries",
      "blood vessels",
      "circulation",
      "veins"
    ],
    "aliases": [
      "arteries",
      "blood",
      "blood vessels",
      "cardiovascular system",
      "circulation",
      "veins",
      "vessels"
    ],
    "category": "energy",
    "groups": [
      "cardiovascular"
    ],
    "tags": [
      "circulation"
    ]
  },
  {
    "id": "bone-marrow",
    "label": "Bone Marrow",
    "file": "BONE MARROW.png",
    "keywords": [
      "blood production",
      "bone marrow",
      "stem cells"
    ],
    "aliases": [
      "blood production",
      "bone",
      "bone marrow",
      "marrow",
      "skeletal & connective",
      "stem cells"
    ],
    "category": "skeletal",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "regeneration"
    ]
  },
  {
    "id": "brain-neurons",
    "label": "Brain Neurons",
    "file": "BRAIN NEURONS.png",
    "keywords": [
      "brain",
      "nervous system",
      "neural pathways",
      "neurons",
      "synapses"
    ],
    "aliases": [
      "brain",
      "brain neurons",
      "nervous system",
      "neural pathways",
      "neurons",
      "synapses"
    ],
    "category": "nervous system",
    "groups": [
      "nervous"
    ],
    "tags": [
      "neural activity"
    ]
  },
  {
    "id": "brain",
    "label": "Brain",
    "file": "BRAIN.png",
    "keywords": [
      "brain",
      "cognition",
      "memory",
      "nervous system",
      "neural"
    ],
    "aliases": [
      "brain",
      "cognition",
      "memory",
      "nervous system",
      "neural"
    ],
    "category": "brain",
    "groups": [
      "nervous"
    ],
    "tags": [
      "cognition"
    ]
  },
  {
    "id": "cartilage",
    "label": "Cartilage",
    "file": "CARTILAGE.png",
    "keywords": [
      "cartilage",
      "connective tissue",
      "joints"
    ],
    "aliases": [
      "cartilage",
      "connective tissue",
      "joints",
      "skeletal & connective"
    ],
    "category": "connective tissue",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "flexibility"
    ]
  },
  {
    "id": "circulatory-system",
    "label": "Circulatory System",
    "file": "CIRCULATORY SYSTEM.png",
    "keywords": [
      "arteries",
      "blood flow",
      "cardiovascular",
      "circulation",
      "veins"
    ],
    "aliases": [
      "arteries",
      "blood flow",
      "cardiovascular",
      "cardiovascular system",
      "circulation",
      "circulatory",
      "circulatory system",
      "full body",
      "system",
      "veins"
    ],
    "category": "system",
    "groups": [
      "cardiovascular",
      "fullBody"
    ],
    "tags": [
      "circulation"
    ]
  },
  {
    "id": "dantiens",
    "label": "Dantiens",
    "file": "DANTIENS.png",
    "keywords": [
      "dantians",
      "dantiens",
      "lower dantian",
      "qi center"
    ],
    "aliases": [
      "aura / energy",
      "dantians",
      "dantiens",
      "lower dantian",
      "qi center"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "energy center"
    ]
  },
  {
    "id": "dmt",
    "label": "DMT",
    "file": "DMT.png",
    "keywords": [
      "consciousness",
      "dmt",
      "pineal"
    ],
    "aliases": [
      "consciousness",
      "dmt",
      "endocrine system",
      "pineal"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "consciousness"
    ]
  },
  {
    "id": "dna-level-refinement",
    "label": "DNA Level Refinement",
    "file": "DNA LEVEL REFINEMENT.png",
    "keywords": [
      "cellular optimization",
      "dna refinement",
      "genetics"
    ],
    "aliases": [
      "aura / energy",
      "cellular optimization",
      "dna",
      "dna level refinement",
      "dna refinement",
      "genetics",
      "level",
      "refinement"
    ],
    "category": "refinement",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "refinement"
    ]
  },
  {
    "id": "dna",
    "label": "DNA",
    "file": "DNA.png",
    "keywords": [
      "cellular",
      "dna",
      "genes",
      "genetics"
    ],
    "aliases": [
      "cellular",
      "dna",
      "gaseous / atomic",
      "genes",
      "genetics"
    ],
    "category": "cellular",
    "groups": [
      "gaseousAtomic"
    ],
    "tags": [
      "cellular"
    ]
  },
  {
    "id": "ear",
    "label": "Ear",
    "file": "EAR.png",
    "keywords": [
      "auditory",
      "ear",
      "hearing"
    ],
    "aliases": [
      "auditory",
      "ear",
      "hearing"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "sensing"
    ]
  },
  {
    "id": "elbow",
    "label": "Elbow",
    "file": "ELBOW.png",
    "keywords": [
      "elbow",
      "joint"
    ],
    "aliases": [
      "elbow",
      "joint",
      "skeletal & connective"
    ],
    "category": "skeletal",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "emotional-body",
    "label": "Emotional Body",
    "file": "EMOTIONAL BODY.png",
    "keywords": [
      "emotional",
      "emotional body",
      "feelings",
      "trauma"
    ],
    "aliases": [
      "aura / energy",
      "body",
      "emotional",
      "emotional body",
      "feelings",
      "trauma"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "emotional balance"
    ]
  },
  {
    "id": "estrogen",
    "label": "Estrogen",
    "file": "ESTROGEN.png",
    "keywords": [
      "estrogen",
      "female hormone"
    ],
    "aliases": [
      "endocrine system",
      "estrogen",
      "female hormone",
      "reproductive system"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine",
      "reproductive"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "eye",
    "label": "Eye",
    "file": "EYE.png",
    "keywords": [
      "eye",
      "eyesight",
      "vision"
    ],
    "aliases": [
      "eye",
      "eyesight",
      "vision"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "sensing"
    ]
  },
  {
    "id": "female-reproductive",
    "label": "Female Reproductive",
    "file": "FEMALE REPRODUCTIVE.png",
    "keywords": [
      "female reproductive",
      "female system",
      "uterus",
      "womb"
    ],
    "aliases": [
      "female",
      "female reproductive",
      "female system",
      "reproductive",
      "reproductive system",
      "uterus",
      "womb"
    ],
    "category": "reproductive",
    "groups": [
      "reproductive"
    ],
    "tags": [
      "reproductive"
    ]
  },
  {
    "id": "foot",
    "label": "Foot",
    "file": "FOOT.png",
    "keywords": [
      "foot",
      "grounding"
    ],
    "aliases": [
      "foot",
      "grounding",
      "skeletal & connective"
    ],
    "category": "skeletal",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "grounding"
    ]
  },
  {
    "id": "full-female-body",
    "label": "Full Female Body",
    "file": "FULL FEMALE BODY.png",
    "keywords": [
      "body",
      "female",
      "full",
      "full female body"
    ],
    "aliases": [
      "body",
      "female",
      "full",
      "full body",
      "full female body"
    ],
    "category": "energy",
    "groups": [
      "fullBody"
    ],
    "tags": []
  },
  {
    "id": "full-male-body",
    "label": "Full Male Body",
    "file": "FULL MALE BODY.png",
    "keywords": [
      "body",
      "full",
      "full male body",
      "male"
    ],
    "aliases": [
      "body",
      "full",
      "full body",
      "full male body",
      "male"
    ],
    "category": "energy",
    "groups": [
      "fullBody"
    ],
    "tags": []
  },
  {
    "id": "hair",
    "label": "Hair",
    "file": "HAIR.png",
    "keywords": [
      "follicles",
      "hair"
    ],
    "aliases": [
      "follicles",
      "hair"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "body part"
    ]
  },
  {
    "id": "hand",
    "label": "Hand",
    "file": "HAND.png",
    "keywords": [
      "hand",
      "palm"
    ],
    "aliases": [
      "hand",
      "palm"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "heart",
    "label": "Heart",
    "file": "HEART.png",
    "keywords": [
      "arterial",
      "blood flow",
      "cardiac",
      "cardiovascular",
      "circulation",
      "coronary",
      "heart",
      "pulse",
      "veins"
    ],
    "aliases": [
      "arterial",
      "blood flow",
      "cardiac",
      "cardiovascular",
      "cardiovascular system",
      "circulation",
      "coronary",
      "heart",
      "pulse",
      "veins"
    ],
    "category": "organ",
    "groups": [
      "cardiovascular"
    ],
    "tags": [
      "circulation",
      "oxygenation",
      "vital organ"
    ]
  },
  {
    "id": "hydrogen",
    "label": "Hydrogen",
    "file": "HYDROGEN.png",
    "keywords": [
      "gaseous",
      "h2",
      "hydrogen",
      "molecular"
    ],
    "aliases": [
      "gaseous",
      "gaseous / atomic",
      "h2",
      "hydrogen",
      "molecular"
    ],
    "category": "atomic",
    "groups": [
      "gaseousAtomic"
    ],
    "tags": [
      "atomic"
    ]
  },
  {
    "id": "hypothalamus-amygdala-pituitary",
    "label": "Hypothalamus-Amygdala-Pituitary",
    "file": "HYPOTHALAMUS-AMYGDALA-PITUITARY.png",
    "keywords": [
      "amygdala",
      "brain",
      "emotional regulation",
      "hypothalamus",
      "nervous system",
      "pituitary"
    ],
    "aliases": [
      "amygdala",
      "brain",
      "emotional regulation",
      "endocrine system",
      "hypothalamus",
      "hypothalamus amygdala pituitary",
      "nervous system",
      "pituitary"
    ],
    "category": "brain",
    "groups": [
      "nervous",
      "endocrine"
    ],
    "tags": [
      "emotional balance"
    ]
  },
  {
    "id": "immune-cells",
    "label": "Immune Cells",
    "file": "IMMUNE CELLS.png",
    "keywords": [
      "defense",
      "immune",
      "immunity",
      "white blood cells"
    ],
    "aliases": [
      "cells",
      "defense",
      "immune",
      "immune cells",
      "immune system",
      "immunity",
      "white blood cells"
    ],
    "category": "cellular",
    "groups": [
      "immune"
    ],
    "tags": [
      "protection"
    ]
  },
  {
    "id": "knee",
    "label": "Knee",
    "file": "KNEE.png",
    "keywords": [
      "knee",
      "mobility"
    ],
    "aliases": [
      "knee",
      "mobility",
      "skeletal & connective"
    ],
    "category": "skeletal",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "large-small-intestines",
    "label": "Large-Small Intestines",
    "file": "LARGE-SMALL INTESTINES.png",
    "keywords": [
      "absorption",
      "bowel",
      "colon",
      "digestion",
      "gut",
      "intestines"
    ],
    "aliases": [
      "absorption",
      "bowel",
      "colon",
      "digestion",
      "digestive system",
      "gut",
      "intestines",
      "large",
      "large small intestines",
      "small"
    ],
    "category": "organ",
    "groups": [
      "digestive"
    ],
    "tags": [
      "absorption",
      "digestion"
    ]
  },
  {
    "id": "liver",
    "label": "Liver",
    "file": "LIVER.png",
    "keywords": [
      "bile",
      "cleansing",
      "detox",
      "digestion",
      "hepatic",
      "liver"
    ],
    "aliases": [
      "bile",
      "cleansing",
      "detox",
      "digestion",
      "digestive system",
      "hepatic",
      "liver"
    ],
    "category": "organ",
    "groups": [
      "digestive"
    ],
    "tags": [
      "detoxification",
      "metabolism"
    ]
  },
  {
    "id": "lungs",
    "label": "Lungs",
    "file": "LUNGS.png",
    "keywords": [
      "airway",
      "breathing",
      "bronchi",
      "bronchial",
      "exhale",
      "inhale",
      "lungs",
      "oxygen",
      "respiration",
      "respiratory"
    ],
    "aliases": [
      "airway",
      "breathing",
      "bronchi",
      "bronchial",
      "exhale",
      "inhale",
      "lungs",
      "oxygen",
      "respiration",
      "respiratory",
      "respiratory system"
    ],
    "category": "organ",
    "groups": [
      "respiratory"
    ],
    "tags": [
      "breathing",
      "oxygenation"
    ]
  },
  {
    "id": "lymphatic-system",
    "label": "Lymphatic System",
    "file": "LYMPHATIC SYSTEM.png",
    "keywords": [
      "detox",
      "immunity",
      "lymph",
      "lymphatic"
    ],
    "aliases": [
      "detox",
      "immune system",
      "immunity",
      "lymph",
      "lymphatic",
      "lymphatic system",
      "system"
    ],
    "category": "system",
    "groups": [
      "immune"
    ],
    "tags": [
      "cleansing"
    ]
  },
  {
    "id": "male-reproductive",
    "label": "Male Reproductive",
    "file": "MALE REPRODUCTIVE.png",
    "keywords": [
      "male reproductive",
      "male system",
      "reproductive"
    ],
    "aliases": [
      "male",
      "male reproductive",
      "male system",
      "reproductive",
      "reproductive system"
    ],
    "category": "reproductive",
    "groups": [
      "reproductive"
    ],
    "tags": [
      "reproductive"
    ]
  },
  {
    "id": "mammary-gland-breast",
    "label": "Mammary Gland-Breast",
    "file": "MAMMARY GLAND-BREAST.png",
    "keywords": [
      "breast",
      "mammary",
      "mammary gland"
    ],
    "aliases": [
      "breast",
      "gland",
      "mammary",
      "mammary gland",
      "mammary gland breast",
      "reproductive system"
    ],
    "category": "reproductive",
    "groups": [
      "reproductive"
    ],
    "tags": [
      "reproductive"
    ]
  },
  {
    "id": "manipura",
    "label": "Manipura",
    "file": "MANIPURA.png",
    "keywords": [
      "digestion",
      "manipura",
      "solar plexus",
      "willpower"
    ],
    "aliases": [
      "chakra system",
      "digestion",
      "manipura",
      "solar plexus",
      "willpower"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "metabolism"
    ]
  },
  {
    "id": "melatonin",
    "label": "Melatonin",
    "file": "MELATONIN.png",
    "keywords": [
      "circadian rhythm",
      "melatonin",
      "sleep"
    ],
    "aliases": [
      "circadian rhythm",
      "endocrine system",
      "melatonin",
      "sleep"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "sleep"
    ]
  },
  {
    "id": "mental-body",
    "label": "Mental Body",
    "file": "MENTAL BODY.png",
    "keywords": [
      "cognition",
      "mental",
      "mental body",
      "thought"
    ],
    "aliases": [
      "aura / energy",
      "body",
      "cognition",
      "mental",
      "mental body",
      "nervous system",
      "thought"
    ],
    "category": "energy",
    "groups": [
      "nervous",
      "auraEnergy"
    ],
    "tags": [
      "cognition"
    ]
  },
  {
    "id": "mouth",
    "label": "Mouth",
    "file": "MOUTH.png",
    "keywords": [
      "mouth",
      "oral",
      "teeth"
    ],
    "aliases": [
      "mouth",
      "oral",
      "teeth"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "communication"
    ]
  },
  {
    "id": "muladhara",
    "label": "Muladhara",
    "file": "MULADHARA.png",
    "keywords": [
      "grounding",
      "muladhara",
      "root chakra",
      "survival"
    ],
    "aliases": [
      "chakra system",
      "grounding",
      "muladhara",
      "root chakra",
      "survival"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "grounding"
    ]
  },
  {
    "id": "muscular-system",
    "label": "Muscular System",
    "file": "MUSCULAR SYSTEM.png",
    "keywords": [
      "body",
      "muscles",
      "muscular system",
      "strength"
    ],
    "aliases": [
      "body",
      "full body",
      "muscles",
      "muscular",
      "muscular system",
      "strength",
      "system"
    ],
    "category": "system",
    "groups": [
      "fullBody"
    ],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "nadis",
    "label": "Nadis",
    "file": "NADIS.png",
    "keywords": [
      "energy channels",
      "meridians",
      "nadis"
    ],
    "aliases": [
      "aura / energy",
      "energy channels",
      "meridians",
      "nadis"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "energy channels"
    ]
  },
  {
    "id": "negative-ion",
    "label": "Negative Ion",
    "file": "NEGATIVE ION.png",
    "keywords": [
      "atmosphere",
      "energetic",
      "ionization",
      "negative ion"
    ],
    "aliases": [
      "atmosphere",
      "energetic",
      "gaseous / atomic",
      "ion",
      "ionization",
      "negative",
      "negative ion"
    ],
    "category": "energetic",
    "groups": [
      "gaseousAtomic"
    ],
    "tags": [
      "harmonization"
    ]
  },
  {
    "id": "nervous-system",
    "label": "Nervous System",
    "file": "NERVOUS SYSTEM.png",
    "keywords": [
      "nerves",
      "nervous system",
      "neural",
      "neurological"
    ],
    "aliases": [
      "full body",
      "nerves",
      "nervous",
      "nervous system",
      "neural",
      "neurological",
      "system"
    ],
    "category": "nervous system",
    "groups": [
      "nervous",
      "fullBody"
    ],
    "tags": [
      "communication"
    ]
  },
  {
    "id": "nose",
    "label": "Nose",
    "file": "NOSE.png",
    "keywords": [
      "breathing",
      "nose",
      "respiratory",
      "sinus"
    ],
    "aliases": [
      "breathing",
      "nose",
      "respiratory",
      "respiratory system",
      "sinus"
    ],
    "category": "body part",
    "groups": [
      "respiratory"
    ],
    "tags": [
      "breathing"
    ]
  },
  {
    "id": "ovary",
    "label": "Ovary",
    "file": "OVARY.png",
    "keywords": [
      "female hormones",
      "ovary"
    ],
    "aliases": [
      "female hormones",
      "ovary",
      "reproductive system"
    ],
    "category": "reproductive",
    "groups": [
      "reproductive"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "oxygen",
    "label": "Oxygen",
    "file": "OXYGEN.png",
    "keywords": [
      "breath",
      "gaseous",
      "o2",
      "oxygen",
      "respiration"
    ],
    "aliases": [
      "breath",
      "gaseous",
      "gaseous / atomic",
      "o2",
      "oxygen",
      "respiration",
      "respiratory system"
    ],
    "category": "atomic",
    "groups": [
      "respiratory",
      "gaseousAtomic"
    ],
    "tags": [
      "oxygenation"
    ]
  },
  {
    "id": "pancreas",
    "label": "Pancreas",
    "file": "PANCREAS.png",
    "keywords": [
      "digestion",
      "glucose",
      "insulin",
      "pancreas",
      "sugar balance"
    ],
    "aliases": [
      "digestion",
      "digestive system",
      "glucose",
      "insulin",
      "pancreas",
      "sugar balance"
    ],
    "category": "organ",
    "groups": [
      "digestive"
    ],
    "tags": [
      "metabolism"
    ]
  },
  {
    "id": "pineal-gland",
    "label": "Pineal Gland",
    "file": "PINEAL GLAND.png",
    "keywords": [
      "circadian",
      "intuition",
      "melatonin",
      "pineal",
      "third eye"
    ],
    "aliases": [
      "circadian",
      "endocrine system",
      "gland",
      "intuition",
      "melatonin",
      "pineal",
      "pineal gland",
      "third eye"
    ],
    "category": "gland",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "intuition",
      "sleep"
    ]
  },
  {
    "id": "progesterone",
    "label": "Progesterone",
    "file": "PROGESTERONE.png",
    "keywords": [
      "hormone",
      "progesterone"
    ],
    "aliases": [
      "endocrine system",
      "hormone",
      "progesterone",
      "reproductive system"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine",
      "reproductive"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "sahasrara",
    "label": "Sahasrara",
    "file": "SAHASRARA.png",
    "keywords": [
      "consciousness",
      "crown chakra",
      "sahasrara"
    ],
    "aliases": [
      "chakra system",
      "consciousness",
      "crown chakra",
      "sahasrara"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "consciousness"
    ]
  },
  {
    "id": "serotonin",
    "label": "Serotonin",
    "file": "SEROTONIN.png",
    "keywords": [
      "happiness",
      "mood",
      "serotonin"
    ],
    "aliases": [
      "endocrine system",
      "happiness",
      "mood",
      "serotonin"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "emotional balance"
    ]
  },
  {
    "id": "sinus-glands",
    "label": "Sinus Glands",
    "file": "SINUS GLANDS.png",
    "keywords": [
      "airway",
      "breathing",
      "respiratory",
      "sinus"
    ],
    "aliases": [
      "airway",
      "breathing",
      "glands",
      "respiratory",
      "respiratory system",
      "sinus",
      "sinus glands"
    ],
    "category": "energy",
    "groups": [
      "respiratory"
    ],
    "tags": [
      "breathing"
    ]
  },
  {
    "id": "skeletal-body",
    "label": "Skeletal Body",
    "file": "SKELETAL BODY.png",
    "keywords": [
      "bones",
      "skeletal",
      "structure"
    ],
    "aliases": [
      "body",
      "bones",
      "full body",
      "skeletal",
      "skeletal & connective",
      "skeletal body",
      "structure"
    ],
    "category": "skeletal",
    "groups": [
      "skeletalConnective",
      "fullBody"
    ],
    "tags": [
      "support"
    ]
  },
  {
    "id": "skin",
    "label": "Skin",
    "file": "SKIN.png",
    "keywords": [
      "dermal",
      "skin"
    ],
    "aliases": [
      "dermal",
      "skin"
    ],
    "category": "body part",
    "groups": [],
    "tags": [
      "protection"
    ]
  },
  {
    "id": "spine",
    "label": "Spine",
    "file": "SPINE.png",
    "keywords": [
      "back",
      "nervous system",
      "spinal cord",
      "spine",
      "vertebrae"
    ],
    "aliases": [
      "back",
      "nervous system",
      "spinal cord",
      "spine",
      "vertebrae"
    ],
    "category": "skeletal",
    "groups": [
      "nervous"
    ],
    "tags": [
      "alignment"
    ]
  },
  {
    "id": "spleen",
    "label": "Spleen",
    "file": "SPLEEN.png",
    "keywords": [
      "blood filtration",
      "immune",
      "lymph",
      "spleen"
    ],
    "aliases": [
      "blood filtration",
      "digestive system",
      "immune",
      "immune system",
      "lymph",
      "spleen"
    ],
    "category": "organ",
    "groups": [
      "digestive",
      "immune"
    ],
    "tags": [
      "immunity"
    ]
  },
  {
    "id": "stomach",
    "label": "Stomach",
    "file": "STOMACH.png",
    "keywords": [
      "digestion",
      "digestive",
      "gastric",
      "gut",
      "stomach"
    ],
    "aliases": [
      "digestion",
      "digestive",
      "digestive system",
      "gastric",
      "gut",
      "stomach"
    ],
    "category": "organ",
    "groups": [
      "digestive"
    ],
    "tags": [
      "digestion"
    ]
  },
  {
    "id": "swadisthana",
    "label": "Swadisthana",
    "file": "SWADISTHANA.png",
    "keywords": [
      "creativity",
      "sacral chakra",
      "svadhisthana",
      "swadisthana"
    ],
    "aliases": [
      "chakra system",
      "creativity",
      "sacral chakra",
      "svadhisthana",
      "swadisthana"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "creativity"
    ]
  },
  {
    "id": "telomeres",
    "label": "Telomeres",
    "file": "TELOMERES.png",
    "keywords": [
      "aging",
      "cellular longevity",
      "chromosome",
      "telomeres"
    ],
    "aliases": [
      "aging",
      "cellular longevity",
      "chromosome",
      "gaseous / atomic",
      "telomeres"
    ],
    "category": "cellular",
    "groups": [
      "gaseousAtomic"
    ],
    "tags": [
      "longevity"
    ]
  },
  {
    "id": "tendons",
    "label": "Tendons",
    "file": "TENDONS.png",
    "keywords": [
      "connective tissue",
      "mobility",
      "tendons"
    ],
    "aliases": [
      "connective tissue",
      "mobility",
      "skeletal & connective",
      "tendons"
    ],
    "category": "connective tissue",
    "groups": [
      "skeletalConnective"
    ],
    "tags": [
      "movement"
    ]
  },
  {
    "id": "teste",
    "label": "Teste",
    "file": "TESTE.png",
    "keywords": [
      "teste",
      "testes",
      "testosterone"
    ],
    "aliases": [
      "reproductive system",
      "teste",
      "testes",
      "testosterone"
    ],
    "category": "reproductive",
    "groups": [
      "reproductive"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "testosterone",
    "label": "Testosterone",
    "file": "TESTOSTERONE.png",
    "keywords": [
      "male hormone",
      "testosterone"
    ],
    "aliases": [
      "endocrine system",
      "male hormone",
      "reproductive system",
      "testosterone"
    ],
    "category": "biochemical",
    "groups": [
      "endocrine",
      "reproductive"
    ],
    "tags": [
      "hormones"
    ]
  },
  {
    "id": "thymus",
    "label": "Thymus",
    "file": "THYMUS.png",
    "keywords": [
      "chest",
      "immune system",
      "immunity",
      "thymus"
    ],
    "aliases": [
      "chest",
      "endocrine system",
      "immune system",
      "immunity",
      "respiratory system",
      "thymus"
    ],
    "category": "gland",
    "groups": [
      "respiratory",
      "endocrine",
      "immune"
    ],
    "tags": [
      "immunity"
    ]
  },
  {
    "id": "thyroid",
    "label": "Thyroid",
    "file": "THYROID.png",
    "keywords": [
      "endocrine",
      "hormones",
      "metabolism",
      "throat",
      "thyroid"
    ],
    "aliases": [
      "endocrine",
      "endocrine system",
      "hormones",
      "metabolism",
      "throat",
      "thyroid"
    ],
    "category": "gland",
    "groups": [
      "endocrine"
    ],
    "tags": [
      "metabolism"
    ]
  },
  {
    "id": "torus-field-for-emf",
    "label": "Torus Field For EMF",
    "file": "TORUS FIELD for EMF.png",
    "keywords": [
      "aura",
      "electromagnetic field",
      "emf",
      "torus",
      "torus field"
    ],
    "aliases": [
      "aura",
      "aura / energy",
      "electromagnetic field",
      "emf",
      "field",
      "for",
      "torus",
      "torus field",
      "torus field for emf"
    ],
    "category": "energy",
    "groups": [
      "auraEnergy"
    ],
    "tags": [
      "harmonization"
    ]
  },
  {
    "id": "visshuddha",
    "label": "Vishuddha",
    "file": "VISSHUDDHA.png",
    "keywords": [
      "communication",
      "throat chakra",
      "vishuddha",
      "visshuddha"
    ],
    "aliases": [
      "chakra system",
      "communication",
      "throat chakra",
      "vishuddha",
      "visshuddha"
    ],
    "category": "chakra",
    "groups": [
      "chakra"
    ],
    "tags": [
      "communication"
    ]
  }
];

const CONFIG = Object.freeze({
  glyphCanon: {
    outlinePx: 3,
    color: '#ffffff',
    outlineAlpha: 0.92,
    bloomColor: 'rgba(255,255,255,0.34)',
    bloomAlpha: 0.18,
    sizeBucketPx: 16,
    maxOutlineCacheEntries: 180,
  },
  renderProfile: {
    maxDevicePixelRatio: 1.65,
    lowPowerMaxDevicePixelRatio: 1.2,
    targetFps: 60,
    maxGlyphs: 180,
  },
  boundaries: {
    topOffset: -0.1,
    bottomOffset: 1.1,
  },
  timing: {
    fastestTurnMs: 850,
    slowestTurnMs: 24000,
    bidirectionalTurnMultiplier: 2,
    defaultDurationMs: 15 * 60 * 1000,
    hudRefreshMs: 500,
  },
  concentration: {
    gentle: { label: 'Gentle', count: 10, lanePressure: 0.48, depth: [0.48, 0.38, 0.14] },
    balanced: { label: 'Balanced', count: 22, lanePressure: 0.65, depth: [0.42, 0.42, 0.16] },
    strong: { label: 'Strong', count: 42, lanePressure: 0.82, depth: [0.38, 0.42, 0.2] },
    intense: { label: 'Intense', count: 74, lanePressure: 1, depth: [0.36, 0.42, 0.22] },
    automatic: { label: 'Automatic', count: 30, lanePressure: 0.7, depth: [0.42, 0.4, 0.18] },
  },
  driftProfiles: {
    gentleDrift: { label: 'Gentle Drift', amplitude: 0.012, frequency: 0.7, phaseSpread: 1.4 },
    harmonicDrift: { label: 'Harmonic Drift', amplitude: 0.024, frequency: 1.0, phaseSpread: 2.1 },
    dynamicDrift: { label: 'Dynamic Drift', amplitude: 0.038, frequency: 1.35, phaseSpread: 3.2 },
  },
  depthBands: {
    background: { scale: 0.62, opacity: 0.36, velocity: 0.92, bloom: 2, softness: 0.6 },
    midground: { scale: 0.84, opacity: 0.58, velocity: 1, bloom: 3, softness: 0.75 },
    foreground: { scale: 1.12, opacity: 0.82, velocity: 1.08, bloom: 5, softness: 1 },
  },
  paletteHarmonics: {
    fullSpectrum: {
      label: 'Full Spectrum',
      description: 'Default harmonic field',
      motion: 1,
      turbulence: 0.18,
      warmth: 0.5,
      phase: 0,
      accentColor: [0.84, 0.90, 1.0],
      accentStrength: 0,
      pulseStrength: 0,
      swirlStrength: 0,
    },
    blueRestore: {
      label: 'Blue Pulse',
      description: 'Radiant blue pulsing rejuvenation',
      motion: 0.72,
      turbulence: 0.08,
      warmth: 0.12,
      phase: 1.2,
      accentColor: [0.0, 0.82, 1.0],
      accentStrength: 0.42,
      pulseStrength: 0.34,
      swirlStrength: 0.04,
    },
    goldenRegeneration: {
      label: 'Golden Regeneration',
      description: 'Golden-orange neon surge for regenerative warmth',
      motion: 0.9,
      turbulence: 0.12,
      warmth: 0.82,
      phase: 2.4,
      accentColor: [1.0, 0.78, 0.14],
      accentStrength: 0.44,
      pulseStrength: 0.3,
      swirlStrength: 0.08,
    },
    infraredWarmth: {
      label: 'Infrared Warmth',
      description: 'Circulating red infrared warmth for restorative flow',
      motion: 0.78,
      turbulence: 0.1,
      warmth: 0.95,
      phase: 3.1,
      accentColor: [1.0, 0.12, 0.06],
      accentStrength: 0.42,
      pulseStrength: 0.18,
      swirlStrength: 0.32,
    },
    violetRestoration: {
      label: 'Violet Restoration',
      description: 'Soft violet pulse for restorative harmonic balance',
      motion: 0.66,
      turbulence: 0.06,
      warmth: 0.28,
      phase: 4.2,
      accentColor: [0.76, 0.24, 1.0],
      accentStrength: 0.38,
      pulseStrength: 0.3,
      swirlStrength: 0.06,
    },
    emeraldBalance: {
      label: 'Neon Healing',
      description: 'Bright soft neon radiance for amplified color healing',
      motion: 0.82,
      turbulence: 0.1,
      warmth: 0.42,
      phase: 5.1,
      accentColor: [0.0, 1.0, 0.74],
      accentStrength: 0.5,
      pulseStrength: 0.24,
      swirlStrength: 0.14,
    },
  },
  durations: {
    fifteen: { label: '15 min', durationMs: 15 * 60 * 1000 },
    thirty: { label: '30 min', durationMs: 30 * 60 * 1000 },
    sixty: { label: '60 min', durationMs: 60 * 60 * 1000 },
    continuous: { label: 'Continuous', durationMs: null },
  },
  wellnessFilters: {
    circadian: { label: 'Circadian Rhythm Filter', className: 'circadian' },
    antiBlue: { label: 'Anti-Blue Light Filter', className: 'anti-blue' },
    nightMode: { label: 'Night Mode', className: 'night' },
  },
  tooltip: {
    gapPx: 12,
    viewportMarginPx: 16,
  },
});

const GROUPS = [
  {
    "id": "chakra",
    "label": "Chakra System",
    "glyphs": [
      "AJNA.png",
      "ANAHATA.png",
      "MANIPURA.png",
      "MULADHARA.png",
      "SWADISTHANA.png",
      "VISSHUDDHA.png",
      "SAHASRARA.png"
    ],
    "keywords": [
      "chakra",
      "energy centers",
      "third eye",
      "heart chakra",
      "solar plexus",
      "root",
      "sacral",
      "throat",
      "crown"
    ]
  },
  {
    "id": "cardiovascular",
    "label": "Cardiovascular System",
    "glyphs": [
      "HEART.png",
      "BLOOD CELLS.png",
      "BLOOD VESSELS.png",
      "CIRCULATORY SYSTEM.png"
    ],
    "keywords": [
      "heart",
      "cardiovascular",
      "circulation",
      "blood flow",
      "arteries",
      "veins",
      "pulse"
    ]
  },
  {
    "id": "respiratory",
    "label": "Respiratory System",
    "glyphs": [
      "LUNGS.png",
      "NOSE.png",
      "SINUS GLANDS.png",
      "OXYGEN.png",
      "THYMUS.png"
    ],
    "keywords": [
      "lungs",
      "respiratory",
      "breathing",
      "respiration",
      "airway",
      "oxygen",
      "sinus",
      "nose"
    ]
  },
  {
    "id": "nervous",
    "label": "Nervous System",
    "glyphs": [
      "BRAIN.png",
      "BRAIN NEURONS.png",
      "NERVOUS SYSTEM.png",
      "SPINE.png",
      "HYPOTHALAMUS-AMYGDALA-PITUITARY.png",
      "MENTAL BODY.png"
    ],
    "keywords": [
      "brain",
      "nervous system",
      "nerves",
      "neurons",
      "spine",
      "mental",
      "hypothalamus",
      "amygdala"
    ]
  },
  {
    "id": "digestive",
    "label": "Digestive System",
    "glyphs": [
      "LIVER.png",
      "PANCREAS.png",
      "STOMACH.png",
      "LARGE-SMALL INTESTINES.png",
      "SPLEEN.png"
    ],
    "keywords": [
      "digestion",
      "digestive",
      "gut",
      "liver",
      "pancreas",
      "stomach",
      "spleen",
      "intestines"
    ]
  },
  {
    "id": "endocrine",
    "label": "Endocrine System",
    "glyphs": [
      "ADRENAL-KIDNEYS.png",
      "ADRENALINE.png",
      "ESTROGEN.png",
      "PROGESTERONE.png",
      "TESTOSTERONE.png",
      "THYROID.png",
      "PINEAL GLAND.png",
      "MELATONIN.png",
      "SEROTONIN.png",
      "DMT.png",
      "THYMUS.png",
      "HYPOTHALAMUS-AMYGDALA-PITUITARY.png"
    ],
    "keywords": [
      "endocrine",
      "hormones",
      "glands",
      "adrenal",
      "thyroid",
      "pineal",
      "melatonin",
      "serotonin",
      "dmt"
    ]
  },
  {
    "id": "immune",
    "label": "Immune System",
    "glyphs": [
      "IMMUNE CELLS.png",
      "LYMPHATIC SYSTEM.png",
      "THYMUS.png",
      "BLOOD CELLS.png",
      "SPLEEN.png"
    ],
    "keywords": [
      "immune",
      "immunity",
      "lymph",
      "lymphatic",
      "defense",
      "white blood cells",
      "spleen",
      "thymus"
    ]
  },
  {
    "id": "skeletalConnective",
    "label": "Skeletal & Connective",
    "glyphs": [
      "BONE MARROW.png",
      "CARTILAGE.png",
      "TENDONS.png",
      "SKELETAL BODY.png",
      "KNEE.png",
      "ELBOW.png",
      "FOOT.png"
    ],
    "keywords": [
      "skeletal",
      "bones",
      "joints",
      "connective tissue",
      "cartilage",
      "tendons",
      "mobility"
    ]
  },
  {
    "id": "reproductive",
    "label": "Reproductive System",
    "glyphs": [
      "FEMALE REPRODUCTIVE.png",
      "MALE REPRODUCTIVE.png",
      "OVARY.png",
      "TESTE.png",
      "MAMMARY GLAND-BREAST.png",
      "ESTROGEN.png",
      "PROGESTERONE.png",
      "TESTOSTERONE.png"
    ],
    "keywords": [
      "reproductive",
      "womb",
      "uterus",
      "ovary",
      "teste",
      "testes",
      "breast",
      "mammary",
      "hormones"
    ]
  },
  {
    "id": "auraEnergy",
    "label": "Aura / Energy",
    "glyphs": [
      "ASTRAL BODY.png",
      "AKASHIC BODY.png",
      "MENTAL BODY.png",
      "EMOTIONAL BODY.png",
      "5 VAYU BODY.png",
      "NADIS.png",
      "DANTIENS.png",
      "TORUS FIELD for EMF.png",
      "ACUPUNCTURE BODIES.png",
      "DNA LEVEL REFINEMENT.png"
    ],
    "keywords": [
      "aura",
      "energy",
      "astral",
      "akashic",
      "mental",
      "emotional",
      "vayu",
      "nadis",
      "dantiens",
      "torus",
      "emf",
      "acupuncture",
      "refinement"
    ]
  },
  {
    "id": "gaseousAtomic",
    "label": "Gaseous / Atomic",
    "glyphs": [
      "OXYGEN.png",
      "HYDROGEN.png",
      "NEGATIVE ION.png",
      "DNA.png",
      "TELOMERES.png"
    ],
    "keywords": [
      "gaseous",
      "atomic",
      "oxygen",
      "hydrogen",
      "negative ion",
      "dna",
      "telomeres",
      "molecular"
    ]
  },
  {
    "id": "fullBody",
    "label": "Full System",
    "glyphs": GLYPH_FILES,
    "chargeScoped": true,
    "keywords": [
      "full system",
      "whole system",
      "all glyphs",
      "complete catalog",
      "focus of charge"
    ]
  }
];

const state = {
  selectionMode: 'automatic',
  selectedGlyphs: new Set(),
  selectedGroup: null,
  concentration: 'balanced',
  automaticConcentration: false,
  speed: 4,
  targetSpeed: 4,
  speedTransitionStartedAt: 0,
  speedTransitionFrom: 4,
  automaticSpeed: false,
  palette: 'fullSpectrum',
  duration: 'fifteen',
  driftProfile: 'harmonicDrift',
  filters: new Set(),
  amplification: 'off',
  audioTrack: DEFAULT_AMRITA_AUDIO_TRACK,
  audioVolume: 0.8,
  audioMuted: false,
  audioNotice: null,
  audioUnlockRequired: false,
  search: '',
  runtime: 'idle',
  sessionStartedAt: 0,
  pauseStartedAt: 0,
  pausedAccumulatedMs: 0,
  currentTurn: null,
  turnIndex: 0,
  frameId: 0,
  backgroundTime: 0,
  lastFrameAt: 0,
  fps: 0,
  frameSamples: [],
};

const dom = {
  controlPanel: document.getElementById('control-panel'),
  runtime: document.getElementById('runtime'),
  backgroundCanvas: document.getElementById('background-canvas'),
  glyphCanvas: document.getElementById('glyph-canvas'),
  personalResonanceRuntimeRoot: document.getElementById('personal-resonance-runtime-root'),
  wellnessOverlay: document.getElementById('wellness-overlay'),
  runtimeChromeRoot: document.getElementById('runtime-chrome-root'),
  runtimeAudioRoot: document.getElementById('runtime-audio-root'),
  performanceHud: document.getElementById('performance-hud'),
  glyphResults: document.getElementById('glyph-results'),
  groupResults: document.getElementById('group-results'),
  glyphSearch: document.getElementById('glyph-search'),
  selectedCount: document.getElementById('selected-count'),
  concentrationOptions: document.getElementById('concentration-options'),
  speedRange: document.getElementById('speed-range'),
  speedValue: document.getElementById('speed-value'),
  speedAuto: document.getElementById('speed-auto'),
  automaticSelection: document.getElementById('automatic-selection'),
  paletteOptions: document.getElementById('palette-options'),
  durationOptions: document.getElementById('duration-options'),
  driftOptions: document.getElementById('drift-options'),
  filterOptions: document.getElementById('filter-options'),
  startSequence: document.getElementById('start-sequence'),
  personalResonanceInput: document.getElementById('personal-resonance-input'),
  personalResonanceToggle: document.getElementById('personal-resonance-toggle'),
  personalResonanceRemove: document.getElementById('personal-resonance-remove'),
  personalResonanceStatus: document.getElementById('personal-resonance-status'),
  personalResonancePreview: document.getElementById('personal-resonance-preview'),
  sessionSummary: document.getElementById('session-summary'),
};

validateGlyphCatalog();
const glyphCatalog = GLYPH_CATALOG;
const glyphByFile = new Map(glyphCatalog.map((glyph) => [glyph.file, glyph]));
const glyphImages = new Map();
const outlineGlyphCache = new Map();
let globalTooltip = null;
let activeTooltipTrigger = null;
let backgroundGl = null;
let backgroundProgram = null;
let backgroundBuffer = null;
let lastHudAt = 0;
let personalResonance = loadPersonalResonance();
let runtimeControls = null;
let runtimeResonancePanelElements = null;
let runtimeAudioLayer = null;
let runtimeAudioUnlockCleanup = null;

function bindRuntimeAudioUnlock() {
  runtimeAudioUnlockCleanup?.();
  runtimeAudioUnlockCleanup = null;

  if (!dom.runtime) return;

  const retryAudio = () => {
    if (state.runtime !== 'running' || state.audioTrack === 'none' || !state.audioUnlockRequired) return;
    void resumeRuntimeAudio({ announceErrors: false });
  };

  dom.runtime.addEventListener('pointerdown', retryAudio);
  dom.runtime.addEventListener('touchstart', retryAudio);
  dom.runtime.addEventListener('keydown', retryAudio);
  runtimeAudioUnlockCleanup = () => {
    dom.runtime.removeEventListener('pointerdown', retryAudio);
    dom.runtime.removeEventListener('touchstart', retryAudio);
    dom.runtime.removeEventListener('keydown', retryAudio);
  };
}

function applyPersonalResonanceChange(nextValue, noticeMessage = null) {
  personalResonance = nextValue;
  syncPersonalResonanceControls(dom, personalResonance);
  if (runtimeResonancePanelElements) {
    syncPersonalResonanceRuntimePanel(runtimeResonancePanelElements, personalResonance);
  }
  if (state.runtime !== 'idle') {
    unmountPersonalResonanceOverlay();
    mountPersonalResonanceOverlay({
      container: dom.personalResonanceRuntimeRoot,
      paused: state.runtime === 'paused',
      resonance: personalResonance,
    });
    runtimeControls?.update();
  }
  if (noticeMessage && dom.personalResonanceStatus) {
    dom.personalResonanceStatus.textContent = noticeMessage;
  }
}

function getPersonalResonanceHandlers() {
  return {
    getValue: () => personalResonance,
    onChange: applyPersonalResonanceChange,
    onNotice: (message) => {
      if (dom.personalResonanceStatus) dom.personalResonanceStatus.textContent = message;
    },
  };
}

function normalizeSearchValue(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSearchableValues(glyph) {
  const groupValues = glyph.groups.flatMap((groupId) => {
    const group = GROUPS.find((item) => item.id === groupId);
    return group ? [group.id, group.label, ...group.keywords] : [groupId];
  });
  return [
    glyph.label,
    glyph.file,
    glyph.category,
    ...glyph.keywords,
    ...glyph.aliases,
    ...glyph.tags,
    ...groupValues,
  ].map(normalizeSearchValue);
}

function validateGlyphCatalog() {
  const fileSet = new Set(GLYPH_FILES);
  const catalogFiles = new Set(GLYPH_CATALOG.map((glyph) => glyph.file));
  const missingCatalog = GLYPH_FILES.filter((file) => !catalogFiles.has(file));
  const missingFiles = GLYPH_CATALOG.filter((glyph) => !fileSet.has(glyph.file)).map((glyph) => glyph.file);
  const missingGroupFiles = GROUPS.flatMap((group) => group.glyphs.filter((file) => !fileSet.has(file)).map((file) => `${group.id}:${file}`));
  if (missingCatalog.length || missingFiles.length || missingGroupFiles.length) {
    console.warn('[AMRITA] Glyph catalog validation warnings', { missingCatalog, missingFiles, missingGroupFiles });
  }
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem('amrita_session_config') || '{}');
    if (saved && typeof saved === 'object') {
      state.selectionMode = saved.selectionMode || state.selectionMode;
      state.selectedGlyphs = new Set(saved.selectedGlyphs || []);
      state.selectedGroup = saved.selectedGroup || null;
      state.concentration = saved.concentration || state.concentration;
      state.automaticConcentration = Boolean(saved.automaticConcentration);
      state.speed = Number(saved.speed || state.speed);
      state.targetSpeed = state.speed;
      state.speedTransitionFrom = state.speed;
      state.automaticSpeed = Boolean(saved.automaticSpeed);
      state.palette = saved.palette || state.palette;
      state.duration = saved.duration || state.duration;
      state.driftProfile = saved.driftProfile || state.driftProfile;
      state.filters = new Set(saved.filters || []);
      state.amplification = saved.amplification || state.amplification;
      state.audioTrack = getAmritaAudioTrack(saved.audioTrack)?.id || state.audioTrack;
      state.audioTrack = normalizeAmritaAudioTrackId(state.audioTrack);
      state.audioMuted = Boolean(saved.audioMuted);
      state.audioVolume = typeof saved.audioVolume === 'number' && Number.isFinite(saved.audioVolume)
        ? Math.max(0, Math.min(1, saved.audioVolume))
        : state.audioVolume;
    }
  } catch {
    localStorage.removeItem('amrita_session_config');
  }
}

function persistState() {
  localStorage.setItem('amrita_session_config', JSON.stringify({
    selectionMode: state.selectionMode,
    selectedGlyphs: [...state.selectedGlyphs],
    selectedGroup: state.selectedGroup,
    concentration: state.concentration,
    automaticConcentration: state.automaticConcentration,
    speed: state.targetSpeed,
    automaticSpeed: state.automaticSpeed,
    palette: state.palette,
    duration: state.duration,
    driftProfile: state.driftProfile,
    filters: [...state.filters],
    amplification: state.amplification,
    audioTrack: state.audioTrack,
    audioMuted: state.audioMuted,
    audioVolume: state.audioVolume,
  }));
}

function createOptionButton({ active, label, description, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `option-button${active ? ' active' : ''}`;
  button.innerHTML = `<strong>${label}</strong>${description ? `<span>${description}</span>` : ''}`;
  button.addEventListener('click', onClick);
  return button;
}

function renderControls() {
  renderGlyphResults();
  renderGroupResults();
  renderConcentrationOptions();
  renderPaletteOptions();
  renderDurationOptions();
  renderDriftOptions();
  renderFilterOptions();
  dom.speedRange.value = String(Math.round(state.targetSpeed));
  dom.speedValue.textContent = state.automaticSpeed ? 'Auto' : String(Math.round(state.targetSpeed));
  dom.speedAuto.classList.toggle('active', state.automaticSpeed);
  dom.automaticSelection.classList.toggle('active', state.selectionMode === 'automatic');
  dom.selectedCount.textContent = `${state.selectedGlyphs.size} selected`;
  syncPersonalResonanceControls(dom, personalResonance);
  updateSummary();
}

function renderGlyphResults() {
  const query = normalizeSearchValue(state.search);
  const matches = glyphCatalog.filter((glyph) => {
    if (!query) return true;
    return getSearchableValues(glyph).some((value) => value.includes(query));
  }).slice(0, 80);
  dom.glyphResults.replaceChildren(...matches.map((glyph) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chip${state.selectedGlyphs.has(glyph.file) ? ' active' : ''}`;
    button.textContent = glyph.label;
    button.addEventListener('click', () => {
      state.selectionMode = 'individual';
      state.selectedGroup = null;
      if (state.selectedGlyphs.has(glyph.file)) {
        state.selectedGlyphs.delete(glyph.file);
      } else {
        state.selectedGlyphs.add(glyph.file);
      }
      if (state.selectedGlyphs.size === 0) state.selectionMode = 'automatic';
      persistState();
      renderControls();
    });
    return button;
  }));
}

function renderGroupResults() {
  dom.groupResults.replaceChildren(...GROUPS.map((group) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chip group-chip${state.selectedGroup === group.id ? ' active' : ''}`;
    button.textContent = group.label;
    button.addEventListener('click', () => {
      state.selectionMode = 'group';
      state.selectedGroup = state.selectedGroup === group.id ? null : group.id;
      if (!state.selectedGroup) state.selectionMode = 'automatic';
      state.selectedGlyphs.clear();
      persistState();
      renderControls();
    });
    return button;
  }));
}

function renderConcentrationOptions() {
  const options = Object.entries(CONFIG.concentration).map(([key, config]) => createOptionButton({
    active: state.concentration === key,
    label: config.label,
    description: key === 'automatic' ? 'Procedural focus of charge' : `${config.count} glyph instances target`,
    onClick: () => {
      state.concentration = key;
      state.automaticConcentration = key === 'automatic';
      persistState();
      renderControls();
    },
  }));
  dom.concentrationOptions.replaceChildren(...options);
}

function renderPaletteOptions() {
  const options = Object.entries(CONFIG.paletteHarmonics).map(([key, config]) => createOptionButton({
    active: state.palette === key,
    label: config.label,
    description: config.description,
    onClick: () => {
      state.palette = key;
      persistState();
      renderControls();
    },
  }));
  dom.paletteOptions.replaceChildren(...options);
}

function renderDurationOptions() {
  const options = Object.entries(CONFIG.durations).map(([key, config]) => createOptionButton({
    active: state.duration === key,
    label: config.label,
    description: config.durationMs === null ? 'No completion timer' : 'Session clock',
    onClick: () => {
      state.duration = key;
      persistState();
      renderControls();
    },
  }));
  dom.durationOptions.replaceChildren(...options);
}

function renderDriftOptions() {
  const options = Object.entries(CONFIG.driftProfiles).map(([key, config]) => createOptionButton({
    active: state.driftProfile === key,
    label: config.label,
    description: 'Controlled downward-flow personality',
    onClick: () => {
      state.driftProfile = key;
      persistState();
      renderControls();
    },
  }));
  dom.driftOptions.replaceChildren(...options);
}

function renderFilterOptions() {
  const buttons = Object.entries(CONFIG.wellnessFilters).map(([key, filter]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-button${state.filters.has(key) ? ' active' : ''}`;
    button.innerHTML = `<strong>${filter.label}</strong><span>Global overlay filter</span>`;
    button.addEventListener('click', () => {
      if (state.filters.has(key)) state.filters.delete(key);
      else state.filters.add(key);
      persistState();
      renderControls();
    });
    return button;
  });
  dom.filterOptions.replaceChildren(...buttons);
}

function updateSummary() {
  const selection = getSelectionLabel();
  const concentration = CONFIG.concentration[state.concentration].label;
  const speed = state.automaticSpeed ? 'Automatic speed' : `Speed ${Math.round(state.targetSpeed)}`;
  const palette = CONFIG.paletteHarmonics[state.palette].label;
  dom.sessionSummary.textContent = `${selection} • ${concentration} concentration • ${speed} • ${palette}`;
}

function getSelectionLabel() {
  if (state.selectionMode === 'group') {
    return GROUPS.find((group) => group.id === state.selectedGroup)?.label || 'Automatic glyph selection';
  }
  if (state.selectionMode === 'individual' && state.selectedGlyphs.size > 0) {
    return [...state.selectedGlyphs].map((file) => glyphByFile.get(file)?.label || file).slice(0, 3).join(', ') + (state.selectedGlyphs.size > 3 ? ` +${state.selectedGlyphs.size - 3}` : '');
  }
  return 'Automatic glyph selection';
}

function setupBackgroundRenderer() {
  const gl = dom.backgroundCanvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return;
  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_motion;
    uniform float u_turbulence;
    uniform float u_warmth;
    uniform float u_phase;
    uniform vec3 u_accent_color;
    uniform float u_accent_strength;
    uniform float u_pulse_strength;
    uniform float u_swirl_strength;

    mat2 rotate2d(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float softBlob(vec2 p, vec2 center, float radius, float softness) {
      float d = length((p - center) / radius);
      return exp(-pow(d, softness));
    }

    vec2 driftCenter(float t, float phase, float xScale, float yScale) {
      return vec2(
        sin(t * 0.17 + phase) * xScale + sin(t * 0.071 + phase * 1.7) * 0.12,
        cos(t * 0.13 + phase * 0.83) * yScale + sin(t * 0.052 + phase * 2.1) * 0.10
      );
    }

    vec3 rainbowRamp(float x) {
      x = fract(x);
      float segment = x * 7.0;
      vec3 red = vec3(1.00, 0.10, 0.12);
      vec3 orange = vec3(1.00, 0.42, 0.08);
      vec3 yellow = vec3(1.00, 0.86, 0.18);
      vec3 turquoise = vec3(0.00, 0.86, 0.78);
      vec3 blue = vec3(0.08, 0.34, 1.00);
      vec3 purple = vec3(0.46, 0.20, 1.00);
      vec3 violet = vec3(0.86, 0.28, 1.00);

      if (segment < 1.0) return mix(red, orange, smoothstep(0.0, 1.0, segment));
      if (segment < 2.0) return mix(orange, yellow, smoothstep(1.0, 2.0, segment));
      if (segment < 3.0) return mix(yellow, turquoise, smoothstep(2.0, 3.0, segment));
      if (segment < 4.0) return mix(turquoise, blue, smoothstep(3.0, 4.0, segment));
      if (segment < 5.0) return mix(blue, purple, smoothstep(4.0, 5.0, segment));
      if (segment < 6.0) return mix(purple, violet, smoothstep(5.0, 6.0, segment));
      return mix(violet, red, smoothstep(6.0, 7.0, segment));
    }

    void addBlob(inout vec3 color, inout float weight, vec2 p, vec2 center, float radius, vec3 blobColor, float strength) {
      float blob = softBlob(p, center, radius, 2.15) * strength;
      color += blobColor * blob;
      weight += blob;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 p = uv - 0.5;
      p.x *= u_resolution.x / u_resolution.y;
      float t = u_time * u_motion;

      float swirl = sin(p.y * 2.4 + t * 0.16 + u_phase) * 0.16 +
        cos(p.x * 2.0 - t * 0.12 + u_phase * 0.7) * 0.11;
      swirl += sin(length(p) * 5.4 - t * 0.54 + u_phase) * u_swirl_strength;
      vec2 flow = rotate2d(swirl * 0.34) * p;
      flow += vec2(
        sin((p.y + t * 0.05) * 4.2 + u_phase),
        cos((p.x - t * 0.045) * 3.8 + u_phase * 0.8)
      ) * (0.018 + u_turbulence * 0.035);

      vec3 color = vec3(0.006, 0.009, 0.026);
      float weight = 0.22;

      addBlob(color, weight, flow, driftCenter(t, 0.2 + u_phase, 0.72, 0.48), 0.50, vec3(1.00, 0.12, 0.13), 1.00);
      addBlob(color, weight, flow, driftCenter(t, 1.0 + u_phase, 0.64, 0.42), 0.52, vec3(1.00, 0.42, 0.10), 0.95);
      addBlob(color, weight, flow, driftCenter(t, 1.8 + u_phase, 0.56, 0.50), 0.54, vec3(1.00, 0.84, 0.20), 0.90);
      addBlob(color, weight, flow, driftCenter(t, 2.7 + u_phase, 0.68, 0.44), 0.58, vec3(0.00, 0.84, 0.78), 0.94);
      addBlob(color, weight, flow, driftCenter(t, 3.5 + u_phase, 0.60, 0.50), 0.56, vec3(0.08, 0.36, 1.00), 0.96);
      addBlob(color, weight, flow, driftCenter(t, 4.4 + u_phase, 0.70, 0.46), 0.55, vec3(0.49, 0.20, 1.00), 0.94);
      addBlob(color, weight, flow, driftCenter(t, 5.2 + u_phase, 0.62, 0.54), 0.50, vec3(0.84, 0.27, 1.00), 0.88);

      vec3 lava = color / weight;
      float centerGlow = 1.0 - smoothstep(0.08, 1.12, length(p));
      float ribbonField = uv.x * 0.78 + uv.y * 0.06 + sin(flow.y * 3.0 + t * 0.10 + u_phase) * 0.055;
      vec3 ribbon = rainbowRamp(ribbonField + 0.02 + u_phase * 0.035);
      float ribbonPresence = 0.54 + centerGlow * 0.08;
      lava = mix(lava, ribbon, ribbonPresence);

      float gold = softBlob(flow, driftCenter(t, 2.25 + u_phase, 0.48, 0.34), 0.36, 2.4);
      float silver = softBlob(flow, driftCenter(t, 4.9 + u_phase, 0.52, 0.38), 0.34, 2.5);
      float warmBloom = softBlob(flow, driftCenter(t, 1.35 + u_phase, 0.58, 0.38), 0.46, 2.25);
      float shimmer = 0.5 + 0.5 * sin((flow.x - flow.y) * 9.0 + t * 0.42 + u_phase);
      lava = mix(lava, vec3(1.00, 0.32, 0.10), warmBloom * 0.16);
      lava = mix(lava, vec3(1.00, 0.86, 0.34), gold * 0.24 * shimmer);
      lava = mix(lava, vec3(0.84, 0.90, 0.98), silver * 0.18 * (1.0 - shimmer * 0.45));

      float accentPulse = 0.72 + 0.28 * sin(t * (0.84 + u_pulse_strength) + u_phase);
      float accentBlob = softBlob(flow, driftCenter(t, 3.35 + u_phase, 0.58, 0.42), 0.52, 2.1);
      float accentGlow = clamp((centerGlow * 0.34 + accentBlob * 0.46 + 0.12) * u_accent_strength, 0.0, 0.68);
      vec3 accentRadiance = u_accent_color * (0.74 + accentPulse * (0.44 + u_pulse_strength));
      lava = mix(lava, max(lava, accentRadiance), accentGlow);

      float edgeVignette = smoothstep(0.58, 1.22, length(p));
      float breathing = 0.88 + 0.12 * sin(t * 0.30 + u_phase);
      vec3 tone = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.72, 0.46), u_warmth * 0.35);
      lava *= tone;
      lava *= 0.56 + centerGlow * 0.46 * breathing;
      lava = mix(lava, vec3(0.012, 0.016, 0.052), edgeVignette * 0.46);
      lava = pow(clamp(lava, 0.0, 1.0), vec3(0.92));

      gl_FragColor = vec4(lava, 1.0);
    }
  `;
  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) return;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  backgroundGl = gl;
  backgroundProgram = program;
  backgroundBuffer = buffer;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function resizeCanvases() {
  const dpr = getDevicePixelRatioCap();
  [dom.backgroundCanvas, dom.glyphCanvas].forEach((canvas) => {
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  });
  if (backgroundGl) {
    backgroundGl.viewport(0, 0, dom.backgroundCanvas.width, dom.backgroundCanvas.height);
  }
}

function getDevicePixelRatioCap() {
  const lowPower = state.filters.has('nightMode') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Math.min(window.devicePixelRatio || 1, lowPower ? CONFIG.renderProfile.lowPowerMaxDevicePixelRatio : CONFIG.renderProfile.maxDevicePixelRatio);
}

function renderBackground(dt) {
  if (!backgroundGl || !backgroundProgram) return renderBackgroundFallback(dt);
  const gl = backgroundGl;
  const palette = CONFIG.paletteHarmonics[state.palette];
  state.backgroundTime += dt * 0.001;
  gl.useProgram(backgroundProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
  const position = gl.getAttribLocation(backgroundProgram, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_time'), state.backgroundTime);
  gl.uniform2f(gl.getUniformLocation(backgroundProgram, 'u_resolution'), dom.backgroundCanvas.width, dom.backgroundCanvas.height);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_motion'), palette.motion);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_turbulence'), palette.turbulence);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_warmth'), palette.warmth);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_phase'), palette.phase);
  gl.uniform3fv(gl.getUniformLocation(backgroundProgram, 'u_accent_color'), palette.accentColor);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_accent_strength'), palette.accentStrength);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_pulse_strength'), palette.pulseStrength);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, 'u_swirl_strength'), palette.swirlStrength);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderBackgroundFallback(dt) {
  const ctx = dom.backgroundCanvas.getContext('2d');
  if (!ctx) return;
  const palette = CONFIG.paletteHarmonics[state.palette];
  state.backgroundTime += dt * 0.001 * palette.motion;
  const width = dom.backgroundCanvas.width;
  const height = dom.backgroundCanvas.height;
  const size = Math.max(width, height);
  const t = state.backgroundTime;
  const colors = [
    'rgba(255, 36, 46, 0.62)',
    'rgba(255, 122, 32, 0.58)',
    'rgba(255, 218, 72, 0.52)',
    'rgba(20, 222, 205, 0.56)',
    'rgba(36, 92, 255, 0.58)',
    'rgba(132, 68, 255, 0.58)',
    'rgba(220, 82, 255, 0.50)',
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#020515';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'screen';

  colors.forEach((color, index) => {
    const phase = palette.phase + index * 0.82;
    const x =
      width * (0.5 + Math.sin(t * (0.11 + index * 0.011) + phase) * 0.34) +
      Math.sin(t * 0.047 + phase * 1.8) * width * 0.08;
    const y =
      height * (0.5 + Math.cos(t * (0.085 + index * 0.009) + phase * 0.74) * 0.28) +
      Math.sin(t * 0.039 + phase * 2.2) * height * 0.07;
    const radius = size * (0.35 + (index % 3) * 0.035);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.56, color.replace(/0\.\d+\)/, '0.18)'));
    gradient.addColorStop(1, 'rgba(2, 5, 21, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });

  const goldX = width * (0.5 + Math.sin(t * 0.071 + palette.phase + 2.1) * 0.22);
  const goldY = height * (0.48 + Math.cos(t * 0.059 + palette.phase) * 0.18);
  const gold = ctx.createRadialGradient(goldX, goldY, 0, goldX, goldY, size * 0.28);
  gold.addColorStop(0, 'rgba(255, 226, 132, 0.26)');
  gold.addColorStop(1, 'rgba(255, 226, 132, 0)');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, width, height);

  const silverX = width * (0.52 + Math.cos(t * 0.065 + palette.phase + 4.6) * 0.24);
  const silverY = height * (0.5 + Math.sin(t * 0.053 + palette.phase * 1.4) * 0.2);
  const silver = ctx.createRadialGradient(silverX, silverY, 0, silverX, silverY, size * 0.24);
  silver.addColorStop(0, 'rgba(222, 232, 245, 0.20)');
  silver.addColorStop(1, 'rgba(222, 232, 245, 0)');
  ctx.fillStyle = silver;
  ctx.fillRect(0, 0, width, height);

  if (palette.accentStrength > 0) {
    const pulse = 0.72 + 0.28 * Math.sin(t * (0.84 + palette.pulseStrength) + palette.phase);
    const accentX = width * (0.5 + Math.sin(t * 0.083 + palette.phase + 3.35) * 0.26);
    const accentY = height * (0.48 + Math.cos(t * 0.069 + palette.phase * 0.8) * 0.22);
    const accent = ctx.createRadialGradient(accentX, accentY, 0, accentX, accentY, size * 0.42);
    const [red, green, blue] = palette.accentColor.map((channel) => Math.round(channel * 255));
    const alpha = Math.min(0.42, palette.accentStrength * (0.2 + pulse * 0.28));
    accent.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
    accent.addColorStop(0.58, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.35})`);
    accent.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = 'source-over';
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.5, size * 0.7);
  vignette.addColorStop(0, 'rgba(2, 5, 21, 0)');
  vignette.addColorStop(0.72, 'rgba(2, 5, 21, 0.18)');
  vignette.addColorStop(1, 'rgba(2, 5, 21, 0.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function mountRuntimeExperience() {
  runtimeControls = createRuntimeControls({
    actions: {
      durationNeedsConfirmation,
      exitSession: stopSequence,
      resumeAudio: resumeRuntimeAudio,
      setAmplification,
      setAudioTrack,
      setAudioVolume,
      setDuration,
      setTargetSpeed,
      toggleAudioMute,
      toggleFilter: toggleRuntimeFilter,
      toggleFullscreen,
      togglePause,
    },
    audioTracks: AMRITA_AUDIO_TRACKS,
    container: dom.runtimeChromeRoot,
    durations: CONFIG.durations,
    filters: CONFIG.wellnessFilters,
    getState: getRuntimeControlsState,
    personalResonance: {
      renderPanel: (panel) => {
        renderPersonalResonanceRuntimePanel(panel, personalResonance, getPersonalResonanceHandlers());
        runtimeResonancePanelElements = {
          preview: panel.querySelector('.runtime-resonance-preview'),
          previewWrap: panel.querySelector('.runtime-resonance-preview-wrap'),
          removeButton: panel.querySelector('[data-runtime-resonance-remove]'),
          status: panel.querySelector('.runtime-resonance-status'),
          toggle: panel.querySelector('[data-runtime-resonance-toggle]'),
          uploadLabel: panel.querySelector('[data-runtime-resonance-upload-label]'),
        };
      },
    },
  });
  runtimeControls.mount();
  runtimeAudioLayer = createAmritaAudioLayer(dom.runtimeAudioRoot);
  applyRuntimeAudioOutput();
  bindRuntimeAudioUnlock();
  void syncRuntimeAudioTrack({ announceErrors: state.audioTrack !== 'none' });
  applyAmplification();
  mountPersonalResonanceOverlay({
    container: dom.personalResonanceRuntimeRoot,
    paused: false,
    resonance: personalResonance,
  });
}

function unmountRuntimeExperience() {
  runtimeControls?.unmount();
  runtimeControls = null;
  runtimeResonancePanelElements = null;
  runtimeAudioLayer?.destroy();
  runtimeAudioLayer = null;
  runtimeAudioUnlockCleanup?.();
  runtimeAudioUnlockCleanup = null;
  unmountPersonalResonanceOverlay();
  dom.runtime.removeAttribute('data-amplification');
}

function getRuntimeControlsState() {
  return {
    amplification: state.amplification,
    audioMuted: state.audioMuted,
    audioTrack: state.audioTrack,
    audioVolume: state.audioVolume,
    duration: state.duration,
    filters: state.filters,
    isFullscreen: document.fullscreenElement === dom.runtime,
    runtime: state.runtime,
    speed: state.speed,
    targetSpeed: state.targetSpeed,
    audioUnlockRequired: state.audioUnlockRequired,
  };
}

function setRuntimeStatus(text) {
  runtimeControls?.setStatus(text);
}

function setAudioNotice(message) {
  state.audioNotice = message;
  if (message) {
    setRuntimeStatus(message);
  }
}

function getSessionElapsedMs(now = performance.now()) {
  return Math.max(0, now - state.sessionStartedAt - state.pausedAccumulatedMs);
}

function durationNeedsConfirmation(durationKey) {
  const durationMs = CONFIG.durations[durationKey]?.durationMs;
  return state.runtime !== 'idle' && durationMs !== null && durationMs < getSessionElapsedMs();
}

function setDuration(durationKey) {
  if (!CONFIG.durations[durationKey]) return;
  state.duration = durationKey;
  persistState();
  renderControls();
  runtimeControls?.update();
}

function toggleRuntimeFilter(filterKey) {
  if (!CONFIG.wellnessFilters[filterKey]) return;
  if (state.filters.has(filterKey)) state.filters.delete(filterKey);
  else state.filters.add(filterKey);
  applyWellnessFilters();
  persistState();
  renderControls();
  runtimeControls?.update();
}

function setAmplification(level) {
  if (!['off', '5x', '10x', '20x'].includes(level)) return;
  state.amplification = level;
  applyAmplification();
  persistState();
  runtimeControls?.update();
}

function applyAmplification() {
  if (state.amplification === 'off') {
    dom.runtime.removeAttribute('data-amplification');
    return;
  }
  dom.runtime.dataset.amplification = state.amplification;
}

function applyRuntimeAudioOutput() {
  if (!runtimeAudioLayer) return;

  runtimeAudioLayer.setVolume(state.audioVolume);
  runtimeAudioLayer.setMuted(state.audioMuted);
}

function setAudioTrack(trackId) {
  const track = getAmritaAudioTrack(trackId);
  if (!track.available) return;
  state.audioTrack = track.id;
  setAudioNotice(null);
  state.audioUnlockRequired = false;
  if (track.id === 'none') {
    state.audioMuted = false;
  }
  persistState();
  runtimeControls?.update();
  void syncRuntimeAudioTrack();
}

function setAudioVolume(volume) {
  state.audioVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  if (state.audioVolume > 0) {
    state.audioMuted = false;
  }
  persistState();
  applyRuntimeAudioOutput();
}

function toggleAudioMute() {
  if (state.audioTrack === 'none') return;

  state.audioMuted = !state.audioMuted;
  if (!state.audioMuted && state.audioVolume === 0) {
    state.audioVolume = 0.8;
  }
  persistState();
  applyRuntimeAudioOutput();
  runtimeControls?.update();
}

async function syncRuntimeAudioTrack({ announceErrors = true } = {}) {
  if (!runtimeAudioLayer || state.runtime === 'idle') return;

  try {
    setAudioNotice(null);
    state.audioUnlockRequired = false;
    applyRuntimeAudioOutput();
    const started = await runtimeAudioLayer.setTrack(state.audioTrack);
    applyRuntimeAudioOutput();

    if (state.runtime === 'paused') {
      runtimeAudioLayer.pause();
      return;
    }

    if (!started && state.audioTrack !== 'none' && announceErrors) {
      state.audioUnlockRequired = true;
      setAudioNotice('Tap Start Audio to enable the selected track.');
      runtimeControls?.update();
      return;
    }

    if (!started && state.audioTrack !== 'none') {
      state.audioUnlockRequired = true;
      runtimeControls?.update();
      return;
    }

    state.audioUnlockRequired = false;
    setAudioNotice(null);
    runtimeControls?.update();
  } catch (error) {
    state.audioUnlockRequired = false;
    if (announceErrors) {
      setAudioNotice(error instanceof Error ? error.message : 'Unable to load audio track.');
      runtimeControls?.update();
    }
  }
}

async function resumeRuntimeAudio({ announceErrors = true } = {}) {
  if (!runtimeAudioLayer || state.runtime !== 'running' || state.audioTrack === 'none') return false;

  try {
    const started = await runtimeAudioLayer.resume();
    state.audioUnlockRequired = !started;
    if (!started && announceErrors) {
      setAudioNotice('Tap Start Audio to enable the selected track.');
    }
    if (started) {
      setAudioNotice(null);
    }
    runtimeControls?.update();
    return started;
  } catch (error) {
    state.audioUnlockRequired = false;
    if (announceErrors) {
      setAudioNotice(error instanceof Error ? error.message : 'Unable to resume audio.');
    }
    runtimeControls?.update();
    return false;
  }
}

function setTargetSpeed(speed) {
  const nextSpeed = Math.min(10, Math.max(1, Number(speed) || 4));
  state.targetSpeed = nextSpeed;
  state.speedTransitionFrom = state.speed;
  state.speedTransitionStartedAt = performance.now();
  state.automaticSpeed = false;
  persistState();
  renderControls();
  runtimeControls?.update();
}

function updateSpeedInterpolation(now) {
  if (Math.abs(state.speed - state.targetSpeed) < 0.01) {
    state.speed = state.targetSpeed;
    return;
  }

  const progress = Math.min(1, (now - state.speedTransitionStartedAt) / 420);
  const eased = 1 - Math.pow(1 - progress, 3);
  state.speed = state.speedTransitionFrom + (state.targetSpeed - state.speedTransitionFrom) * eased;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (dom.runtime.requestFullscreen) {
      await dom.runtime.requestFullscreen();
    }
  } catch {
    dom.runtime.classList.toggle('fullscreen-fallback');
  } finally {
    runtimeControls?.update();
  }
}

function startSequence() {
  persistState();
  preloadGlyphs().then(() => {
    debugAmritaRuntime('startSequence', {
      audioTrack: state.audioTrack,
      duration: state.duration,
      filters: [...state.filters],
    });
    dom.controlPanel.hidden = true;
    dom.runtime.hidden = false;
    state.runtime = 'running';
    state.sessionStartedAt = performance.now();
    state.pausedAccumulatedMs = 0;
    state.turnIndex = 0;
    state.currentTurn = null;
    state.lastFrameAt = performance.now();
    resizeCanvases();
    setupBackgroundRenderer();
    applyWellnessFilters();
    mountRuntimeExperience();
    state.frameId = requestAnimationFrame(renderFrame);
  });
}

function stopSequence() {
  debugAmritaRuntime('stopSequence', {
    previousRuntime: state.runtime,
    sessionElapsedMs: state.runtime === 'idle' ? 0 : getSessionElapsedMs(),
  });
  cancelAnimationFrame(state.frameId);
  state.runtime = 'idle';
  state.currentTurn = null;
  unmountRuntimeExperience();
  dom.runtime.hidden = true;
  dom.controlPanel.hidden = false;
}

function togglePause() {
  if (state.runtime === 'running') {
    debugAmritaRuntime('pause', {
      audioTrack: state.audioTrack,
      reason: document.hidden ? 'document_hidden' : 'manual_or_runtime_control',
      sessionElapsedMs: getSessionElapsedMs(),
    });
    state.runtime = 'paused';
    state.pauseStartedAt = performance.now();
    setPersonalResonancePaused(true);
    runtimeAudioLayer?.pause();
    setRuntimeStatus('Paused');
    runtimeControls?.update();
    return;
  }
  if (state.runtime === 'paused') {
    const pausedForMs = performance.now() - state.pauseStartedAt;
    debugAmritaRuntime('resume', {
      audioTrack: state.audioTrack,
      pausedForMs,
      reason: 'manual_or_runtime_control',
    });
    state.pausedAccumulatedMs += pausedForMs;
    if (state.currentTurn) {
      state.currentTurn.startsAt += pausedForMs;
      state.currentTurn.endsAt += pausedForMs;
    }
    state.runtime = 'running';
    state.lastFrameAt = performance.now();
    setPersonalResonancePaused(false);
    void runtimeAudioLayer?.resume();
    runtimeControls?.update();
  }
}

function preloadGlyphs() {
  const files = new Set([...state.selectedGlyphs]);
  GROUPS.forEach((group) => group.glyphs.forEach((file) => files.add(file)));
  if (files.size === 0) glyphCatalog.slice(0, 16).forEach((glyph) => files.add(glyph.file));
  return Promise.all([...files].map(loadGlyphImage));
}

function loadGlyphImage(file) {
  if (glyphImages.has(file)) return Promise.resolve(glyphImages.get(file));
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      glyphImages.set(file, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = `./glyphs/${encodeURIComponent(file)}`;
  });
}

function renderFrame(now) {
  const dt = Math.min(80, now - state.lastFrameAt || 16);
  state.lastFrameAt = now;
  resizeCanvases();
  if (state.runtime === 'running') {
    updateSpeedInterpolation(now);
    renderBackground(dt);
    advanceSession(now);
    renderGlyphs(now);
  }
  updatePerformance(now, dt);
  state.frameId = requestAnimationFrame(renderFrame);
}

function advanceSession(now) {
  const duration = CONFIG.durations[state.duration].durationMs;
  const elapsed = getSessionElapsedMs(now);
  if (duration !== null && elapsed >= duration) {
    stopSequence();
    return;
  }
  if (!state.currentTurn || now >= state.currentTurn.endsAt) {
    state.currentTurn = createTurn(now);
    state.turnIndex += 1;
  }
  const remaining = duration === null ? 'Continuous' : formatClock(Math.max(0, duration - elapsed));
  const turnLabel = state.currentTurn.label;
  setRuntimeStatus(state.audioNotice || `${turnLabel} • ${remaining}`);
}

function createTurn(now) {
  const concentration = resolveConcentration();
  const speed = resolveSpeed();
  const oneWayDurationMs = speedToDuration(speed);
  const durationMs = oneWayDurationMs * CONFIG.timing.bidirectionalTurnMultiplier;
  const plan = resolveTurnGlyphs();
  const width = dom.glyphCanvas.width;
  const height = dom.glyphCanvas.height;
  const count = resolveGlyphInstanceCount(plan, concentration);
  const instances = Array.from({ length: count }, (_, index) => createGlyphInstance({ index, count, files: plan.files, width, height, concentration }));
  return {
    label: plan.label,
    files: plan.files,
    startsAt: now,
    endsAt: now + durationMs,
    durationMs,
    speed,
    instances,
  };
}

function resolveConcentration() {
  if (state.concentration !== 'automatic') return CONFIG.concentration[state.concentration];
  const keys = ['gentle', 'balanced', 'strong'];
  return CONFIG.concentration[keys[state.turnIndex % keys.length]];
}

function resolveSpeed() {
  if (!state.automaticSpeed) return state.speed;
  return [3, 4, 5, 6][state.turnIndex % 4];
}

function speedToDuration(speed) {
  const ratio = (Number(speed) - 1) / 9;
  const eased = ratio * ratio;
  return CONFIG.timing.slowestTurnMs - (CONFIG.timing.slowestTurnMs - CONFIG.timing.fastestTurnMs) * eased;
}

function resolveTurnGlyphs() {
  if (state.selectionMode === 'group' && state.selectedGroup) {
    const group = GROUPS.find((item) => item.id === state.selectedGroup) || GROUPS[0];
    return {
      chargeScoped: Boolean(group.chargeScoped),
      label: group.label,
      files: group.glyphs.filter((file) => glyphByFile.has(file)),
    };
  }
  if (state.selectionMode === 'individual' && state.selectedGlyphs.size > 0) {
    const selected = [...state.selectedGlyphs];
    const file = selected[state.turnIndex % selected.length];
    return { label: glyphByFile.get(file)?.label || file, files: [file] };
  }
  const group = GROUPS[(state.turnIndex * 2 + 1) % GROUPS.length];
  const automaticFiles = state.turnIndex % 3 === 0
    ? group.glyphs.filter((file) => glyphByFile.has(file))
    : glyphCatalog
      .filter((glyph) => glyph.tags.some((tag) => group.keywords.some((keyword) => normalizeSearchValue(keyword).includes(normalizeSearchValue(tag)) || normalizeSearchValue(tag).includes(normalizeSearchValue(keyword)))))
      .map((glyph) => glyph.file)
      .slice(0, 1);
  return {
    chargeScoped: Boolean(group.chargeScoped),
    label: `Automatic • ${group.label}`,
    files: automaticFiles.length ? automaticFiles : group.glyphs.filter((file) => glyphByFile.has(file)),
  };
}

function resolveGlyphInstanceCount(plan, concentration) {
  const count = plan.chargeScoped
    ? concentration.count
    : concentration.count * Math.max(1, Math.ceil(plan.files.length / 2));
  return Math.min(CONFIG.renderProfile.maxGlyphs, count);
}

function createGlyphInstance({ index, count, files, width, height, concentration }) {
  const band = chooseDepthBand(index, concentration.depth);
  const depth = CONFIG.depthBands[band];
  const laneCount = Math.max(3, Math.ceil(Math.sqrt(count) * concentration.lanePressure));
  const lane = index % laneCount;
  const laneCenter = (lane + 0.5) / laneCount;
  const jitter = seeded(index * 17 + state.turnIndex * 131) * 0.08 - 0.04;
  const size = Math.min(width, height) * 0.075 * depth.scale;
  const stagger = Math.floor(index / laneCount) * size * 1.14;
  return {
    file: files[index % files.length],
    band,
    xBase: Math.min(0.96, Math.max(0.04, laneCenter + jitter)),
    yStagger: stagger,
    size,
    opacity: depth.opacity * (0.78 + seeded(index * 29) * 0.22),
    velocity: depth.velocity,
    phase: seeded(index * 43 + state.turnIndex) * Math.PI * 2,
  };
}

function chooseDepthBand(index, weights) {
  const value = seeded(index * 97 + state.turnIndex * 11);
  if (value < weights[0]) return 'background';
  if (value < weights[0] + weights[1]) return 'midground';
  return 'foreground';
}

function renderGlyphs(now) {
  const ctx = dom.glyphCanvas.getContext('2d');
  const width = dom.glyphCanvas.width;
  const height = dom.glyphCanvas.height;
  ctx.clearRect(0, 0, width, height);
  const turn = state.currentTurn;
  if (!turn) return;
  const progress = Math.min(1, (now - turn.startsAt) / turn.durationMs);
  const travelProgress = getBidirectionalTravelProgress(progress);
  const drift = CONFIG.driftProfiles[state.driftProfile];
  const top = height * CONFIG.boundaries.topOffset;
  const bottom = height * CONFIG.boundaries.bottomOffset;
  const travel = (bottom - top) + maxStagger(turn.instances) + height * 0.08;

  turn.instances
    .slice()
    .sort((a, b) => CONFIG.depthBands[a.band].scale - CONFIG.depthBands[b.band].scale)
    .forEach((instance, index) => {
      const image = glyphImages.get(instance.file);
      if (!image) return;
      const depth = CONFIG.depthBands[instance.band];
      const wave = Math.sin(travelProgress * Math.PI * 2 * drift.frequency + instance.phase);
      const x = width * (instance.xBase + wave * drift.amplitude * depth.softness);
      const y = top - instance.yStagger + travel * travelProgress * instance.velocity;
      if (y < -instance.size * 2 || y > height + instance.size * 2) return;
      drawWhiteOutlineGlyph(ctx, image, x, y, instance.size, instance.opacity, depth.bloom, index);
    });
}

function getBidirectionalTravelProgress(progress) {
  if (progress <= 0.5) {
    return progress * 2;
  }

  return 1 - (progress - 0.5) * 2;
}

function maxStagger(instances) {
  return instances.reduce((max, item) => Math.max(max, item.yStagger), 0);
}

function drawWhiteOutlineGlyph(ctx, image, x, y, size, opacity, bloom, seed) {
  const asset = getOutlinedGlyphAsset(image, size, bloom);
  const halfWidth = asset.width / 2;
  const halfHeight = asset.height / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, opacity + seeded(seed) * 0.035);
  ctx.drawImage(asset, x - halfWidth, y - halfHeight);
  ctx.restore();
}

function getOutlinedGlyphAsset(image, size, bloom) {
  const dpr = getDevicePixelRatioCap();
  const bucket = Math.max(24, Math.round(size / CONFIG.glyphCanon.sizeBucketPx) * CONFIG.glyphCanon.sizeBucketPx);
  const outline = Math.max(1, Math.round(CONFIG.glyphCanon.outlinePx * dpr));
  const bloomRadius = Math.max(0, Math.round(bloom * dpr));
  const cacheKey = `${image.src}:${bucket}:${outline}:${bloomRadius}`;
  const cached = outlineGlyphCache.get(cacheKey);
  if (cached) return cached;

  const padding = outline + bloomRadius + 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bucket + padding * 2);
  canvas.height = Math.ceil(bucket + padding * 2);
  const source = document.createElement('canvas');
  source.width = canvas.width;
  source.height = canvas.height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  sourceCtx.clearRect(0, 0, source.width, source.height);
  sourceCtx.drawImage(image, padding, padding, bucket, bucket);

  const sourceImage = sourceCtx.getImageData(0, 0, source.width, source.height);
  const originalAlpha = new Uint8ClampedArray(sourceImage.width * sourceImage.height);
  for (let i = 0, p = 3; p < sourceImage.data.length; i += 1, p += 4) {
    originalAlpha[i] = sourceImage.data[p];
  }
  const dilatedAlpha = dilateAlpha(originalAlpha, sourceImage.width, sourceImage.height, outline);
  const outlineImage = sourceCtx.createImageData(sourceImage.width, sourceImage.height);
  for (let i = 0, p = 0; i < dilatedAlpha.length; i += 1, p += 4) {
    const outerAlpha = Math.max(0, dilatedAlpha[i] - originalAlpha[i]);
    outlineImage.data[p] = 255;
    outlineImage.data[p + 1] = 255;
    outlineImage.data[p + 2] = 255;
    outlineImage.data[p + 3] = Math.round(outerAlpha * CONFIG.glyphCanon.outlineAlpha);
  }

  const outlineCanvas = document.createElement('canvas');
  outlineCanvas.width = canvas.width;
  outlineCanvas.height = canvas.height;
  outlineCanvas.getContext('2d').putImageData(outlineImage, 0, 0);

  const ctx = canvas.getContext('2d');
  if (bloomRadius > 0) {
    ctx.save();
    ctx.globalAlpha = CONFIG.glyphCanon.bloomAlpha;
    ctx.filter = `blur(${bloomRadius}px)`;
    ctx.drawImage(outlineCanvas, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(outlineCanvas, 0, 0);
  ctx.drawImage(source, 0, 0);

  outlineGlyphCache.set(cacheKey, canvas);
  if (outlineGlyphCache.size > CONFIG.glyphCanon.maxOutlineCacheEntries) {
    const oldestKey = outlineGlyphCache.keys().next().value;
    outlineGlyphCache.delete(oldestKey);
  }
  return canvas;
}

function dilateAlpha(alpha, width, height, radius) {
  const output = new Uint8ClampedArray(alpha.length);
  const radiusSquared = radius * radius;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x;
      const value = alpha[sourceIndex];
      if (value === 0) continue;
      const yMin = Math.max(0, y - radius);
      const yMax = Math.min(height - 1, y + radius);
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(width - 1, x + radius);
      for (let yy = yMin; yy <= yMax; yy += 1) {
        for (let xx = xMin; xx <= xMax; xx += 1) {
          const dx = xx - x;
          const dy = yy - y;
          if (dx * dx + dy * dy > radiusSquared) continue;
          const targetIndex = yy * width + xx;
          if (value > output[targetIndex]) output[targetIndex] = value;
        }
      }
    }
  }
  return output;
}

function seeded(value) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function applyWellnessFilters() {
  dom.wellnessOverlay.className = 'wellness-overlay';
  ['circadian', 'antiBlue', 'nightMode'].forEach((key) => {
    if (state.filters.has(key)) dom.wellnessOverlay.classList.add(CONFIG.wellnessFilters[key].className);
  });
}

function updatePerformance(now, dt) {
  state.frameSamples.push(1000 / Math.max(1, dt));
  if (state.frameSamples.length > 40) state.frameSamples.shift();
  if (now - lastHudAt < CONFIG.timing.hudRefreshMs) return;
  lastHudAt = now;
  state.fps = state.frameSamples.reduce((sum, fps) => sum + fps, 0) / Math.max(1, state.frameSamples.length);
  dom.performanceHud.innerHTML = [
    `Renderer: WebGL background + Canvas glyphs`,
    `FPS: ${state.fps.toFixed(0)} / ${CONFIG.renderProfile.targetFps}`,
    `DPR cap: ${getDevicePixelRatioCap().toFixed(2)}`,
    `Glyphs: ${state.currentTurn?.instances.length ?? 0}`,
    `Turn: ${state.turnIndex}`,
  ].join('<br />');
}

function formatClock(ms) {
  const seconds = Math.ceil(ms / 1000);
  const min = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = (seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function getGlobalTooltip() {
  if (globalTooltip) return globalTooltip;
  const tooltip = document.createElement('div');
  tooltip.id = 'amrita-global-tooltip';
  tooltip.className = 'global-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);
  globalTooltip = tooltip;
  return tooltip;
}

function bindGlobalTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach((trigger) => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('pointerenter', () => showTooltip(trigger));
    trigger.addEventListener('focus', () => showTooltip(trigger));
    trigger.addEventListener('pointerleave', () => hideTooltip(trigger));
    trigger.addEventListener('blur', () => hideTooltip(trigger));
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      showTooltip(trigger);
    });
  });
  window.addEventListener('scroll', repositionActiveTooltip, true);
  window.addEventListener('resize', repositionActiveTooltip);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltip(activeTooltipTrigger);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('[data-tooltip]')) hideTooltip(activeTooltipTrigger);
  });
}

function showTooltip(trigger) {
  const text = trigger?.dataset.tooltip;
  if (!text) return;
  if (activeTooltipTrigger && activeTooltipTrigger !== trigger) {
    activeTooltipTrigger.setAttribute('aria-expanded', 'false');
    activeTooltipTrigger.removeAttribute('aria-describedby');
  }
  const tooltip = getGlobalTooltip();
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  activeTooltipTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-describedby', tooltip.id);
  positionTooltip(trigger, tooltip);
}

function hideTooltip(trigger) {
  if (!trigger || trigger !== activeTooltipTrigger) return;
  const tooltip = getGlobalTooltip();
  tooltip.classList.remove('visible');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.removeAttribute('aria-describedby');
  activeTooltipTrigger = null;
}

function repositionActiveTooltip() {
  if (!activeTooltipTrigger || !globalTooltip?.classList.contains('visible')) return;
  positionTooltip(activeTooltipTrigger, globalTooltip);
}

function positionTooltip(trigger, tooltip) {
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = CONFIG.tooltip.gapPx;
  const margin = CONFIG.tooltip.viewportMarginPx;
  const placements = [
    { top: triggerRect.top - tooltipRect.height - gap, left: triggerRect.left },
    { top: triggerRect.top - tooltipRect.height - gap, left: triggerRect.right - tooltipRect.width },
    { top: triggerRect.bottom + gap, left: triggerRect.left },
    { top: triggerRect.bottom + gap, left: triggerRect.right - tooltipRect.width },
  ];
  const selected = placements.find((placement) => isTooltipPlacementVisible(placement, tooltipRect, margin))
    || clampTooltipPlacement(placements[0], tooltipRect, margin);
  tooltip.style.left = `${selected.left}px`;
  tooltip.style.top = `${selected.top}px`;
}

function isTooltipPlacementVisible(placement, tooltipRect, margin) {
  return placement.left >= margin
    && placement.top >= margin
    && placement.left + tooltipRect.width <= window.innerWidth - margin
    && placement.top + tooltipRect.height <= window.innerHeight - margin;
}

function clampTooltipPlacement(placement, tooltipRect, margin) {
  return {
    left: Math.min(Math.max(margin, placement.left), window.innerWidth - tooltipRect.width - margin),
    top: Math.min(Math.max(margin, placement.top), window.innerHeight - tooltipRect.height - margin),
  };
}

function bindEvents() {
  bindGlobalTooltips();
  dom.glyphSearch.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderGlyphResults();
  });
  dom.automaticSelection.addEventListener('click', () => {
    state.selectionMode = 'automatic';
    state.selectedGlyphs.clear();
    state.selectedGroup = null;
    persistState();
    renderControls();
  });
  dom.speedRange.addEventListener('input', (event) => {
    state.speed = Number(event.target.value);
    state.targetSpeed = state.speed;
    state.speedTransitionFrom = state.speed;
    state.automaticSpeed = false;
    persistState();
    renderControls();
  });
  dom.speedAuto.addEventListener('click', () => {
    state.automaticSpeed = !state.automaticSpeed;
    persistState();
    renderControls();
  });
  dom.startSequence.addEventListener('click', startSequence);
  bindPersonalResonanceControls(dom, getPersonalResonanceHandlers());
  window.addEventListener('resize', () => {
    debugAmritaRuntime('resize', {
      runtime: state.runtime,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
    resizeCanvases();
  });
  document.addEventListener('fullscreenchange', () => {
    debugAmritaRuntime('fullscreenchange', {
      fullscreen: document.fullscreenElement === dom.runtime,
      runtime: state.runtime,
    });
    runtimeControls?.update();
  });
  document.addEventListener('visibilitychange', () => {
    debugAmritaRuntime('visibilitychange', {
      runtime: state.runtime,
      willPause: document.hidden && state.runtime === 'running',
    });
    if (document.hidden && state.runtime === 'running') togglePause();
  });
}

restoreState();
bindEvents();
renderControls();
