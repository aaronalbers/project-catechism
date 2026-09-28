// Types for families.mjs, the family tree's build step, for its tests.
import type { FamilyEdge, Person } from '../src/lib/types';

interface Kinsman { id?: string; name: string; uncertain?: true }
interface TipnrPerson { id: string; name: string; sex: 'male' | 'female'; father?: Kinsman[]; mother?: Kinsman[]; spouses?: Kinsman[] }
interface FamilyNode { id: string; name: string; sex: 'male' | 'female'; curated?: string }
interface Graph { nodes: Map<string, FamilyNode>; edges: FamilyEdge[] }

export function familyGraph(curated: Person[], people: TipnrPerson[]): Graph;
export function families(graph: Graph): { nodes: FamilyNode[]; edges: FamilyEdge[] }[];
export function layout(family: { nodes: FamilyNode[]; edges: FamilyEdge[] }): (FamilyNode & { x: number; y: number })[];
