export type CrestVariant = "centurion" | "gladii" | "laurel" | "sword";
export type CrestPalette = "gold" | "blood" | "emerald" | "stone";

export interface AvatarOption {
  id: string;
  name: string;
  archetype: string;
  variant: CrestVariant;
  palette: CrestPalette;
  /** Seed exposed to AvatarThumb so the existing crest renderer picks the
   *  correct variant deterministically when given this avatar. */
  seed: number;
}

const SEED: Record<CrestVariant, number> = {
  centurion: 0,
  gladii: 1,
  laurel: 2,
  sword: 3,
};

const PALETTE_OFFSET: Record<CrestPalette, number> = {
  gold: 0,
  blood: 1,
  emerald: 2,
  stone: 3,
};

function makeSeed(variant: CrestVariant, palette: CrestPalette): number {
  return SEED[variant] + PALETTE_OFFSET[palette] * 4;
}

export const AVATAR_GALLERY: AvatarOption[] = [
  {
    id: "centurion-gold",
    name: "Centurion",
    archetype: "the disciplined commander",
    variant: "centurion",
    palette: "gold",
    seed: makeSeed("centurion", "gold"),
  },
  {
    id: "gladii-blood",
    name: "Twin Blades",
    archetype: "the relentless duelist",
    variant: "gladii",
    palette: "blood",
    seed: makeSeed("gladii", "blood"),
  },
  {
    id: "laurel-emerald",
    name: "Laureate",
    archetype: "the patient strategist",
    variant: "laurel",
    palette: "emerald",
    seed: makeSeed("laurel", "emerald"),
  },
  {
    id: "sword-stone",
    name: "Veteran",
    archetype: "the seasoned hand",
    variant: "sword",
    palette: "stone",
    seed: makeSeed("sword", "stone"),
  },
  {
    id: "gladii-gold",
    name: "Aurelian",
    archetype: "the gilded contender",
    variant: "gladii",
    palette: "gold",
    seed: makeSeed("gladii", "gold"),
  },
  {
    id: "laurel-blood",
    name: "Crimson Wreath",
    archetype: "the bold tactician",
    variant: "laurel",
    palette: "blood",
    seed: makeSeed("laurel", "blood"),
  },
  {
    id: "sword-emerald",
    name: "Verdant Edge",
    archetype: "the deliberate striker",
    variant: "sword",
    palette: "emerald",
    seed: makeSeed("sword", "emerald"),
  },
  {
    id: "centurion-stone",
    name: "Stoic",
    archetype: "the unshaken",
    variant: "centurion",
    palette: "stone",
    seed: makeSeed("centurion", "stone"),
  },
];
