// Procedural models, built in code so the Models tab works with zero downloaded assets. Each is
// built to real-world proportions; see content/models.json for the measurements and their sources.
// A new model is one entry here: `ProceduralKind` and the content tests both read this table.
import type * as THREE from 'three';
import { alabastron } from './alabastron';
import { galileeBoat } from './boat';
import { coin } from './coins';
import { ezekielsTemple } from './ezekiel';
import { ark } from './furniture';
import { garments } from './garments';
import { noahsArk } from './noah';
import { tabernacle } from './tabernacle';
import { temple } from './temple';

const BUILDERS = {
  denarius: () => coin(19, 1.5, 0xd6d3c9, 'TI CAESAR DIVI AVG F AVGVSTVS', 'PONTIF MAXIM'),
  tetradrachm: () => coin(26, 3, 0xd6d3c9, 'TYPOY IEPAΣ', 'KAI AΣYΛOY'),
  alabastron: () => alabastron(18),
  ark: () => ark(),
  tabernacle,
  'noahs-ark': noahsArk,
  temple,
  'ezekiels-temple': ezekielsTemple,
  'priestly-garments': garments,
  'galilee-boat': galileeBoat,
} satisfies Record<string, () => THREE.Object3D>;

export type ProceduralKind = keyof typeof BUILDERS;
export const isProceduralKind = (k: string): k is ProceduralKind => Object.hasOwn(BUILDERS, k);
export const buildProcedural = (kind: ProceduralKind): THREE.Object3D => BUILDERS[kind]();
