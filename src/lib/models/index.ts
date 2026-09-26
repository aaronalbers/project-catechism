// Procedural models, built in code so the Models tab works with zero downloaded assets. Each is
// built to real-world proportions; see content/models.json for the measurements and their sources.
// A new model is one entry here: `ProceduralKind` and the content tests both read this table.
import type * as THREE from 'three';
import { alabastron } from './alabastron';
import { galileeBoat } from './boat';
import { israelsCamp } from './camp';
import { coin, lepta } from './coins';
import { ezekielsTemple } from './ezekiel';
import { forestOfLebanon } from './forest';
import { ark } from './furniture';
import { garments } from './garments';
import { goliath } from './goliath';
import { newJerusalem } from './newjerusalem';
import { noahsArk } from './noah';
import { ogsBed } from './og';
import { sealedScroll } from './scroll';
import { statue } from './statue';
import { tabernacle } from './tabernacle';
import { temple } from './temple';

const BUILDERS = {
  denarius: () => coin(19, 1.5, 0xd6d3c9, 'TI CAESAR DIVI AVG F AVGVSTVS', 'PONTIF MAXIM'),
  tetradrachm: () => coin(26, 3, 0xd6d3c9, 'TYPOY IEPAΣ', 'KAI AΣYΛOY'),
  lepta,
  alabastron: () => alabastron(18),
  ark: () => ark(),
  tabernacle,
  'israels-camp': israelsCamp,
  'noahs-ark': noahsArk,
  temple,
  'ezekiels-temple': ezekielsTemple,
  'priestly-garments': garments,
  'galilee-boat': galileeBoat,
  goliath,
  'nebuchadnezzars-statue': statue,
  'ogs-bed': ogsBed,
  'forest-of-lebanon': forestOfLebanon,
  'sealed-scroll': sealedScroll,
  'new-jerusalem': newJerusalem,
} satisfies Record<string, (reading?: string) => THREE.Object3D>;

export type ProceduralKind = keyof typeof BUILDERS;
export const isProceduralKind = (k: string): k is ProceduralKind => Object.hasOwn(BUILDERS, k);
/** Builds a model, drawn as `reading` (one of its `readings`' ids) when it has more than one. */
export const buildProcedural = (kind: ProceduralKind, reading?: string): THREE.Object3D => (BUILDERS[kind] as (reading?: string) => THREE.Object3D)(reading);
