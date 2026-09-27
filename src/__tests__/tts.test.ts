import { describe, expect, it } from 'vitest';
import { speechChunks } from '@/lib/tts';

describe('speechChunks', () => {
  it('splits a verse at the ends of its sentences', () => {
    expect(speechChunks('In the beginning God created the heavens and the earth. Now the earth was formless and void, and darkness was over the surface of the deep.'))
      .toEqual(['In the beginning God created the heavens and the earth.', 'Now the earth was formless and void, and darkness was over the surface of the deep.']);
  });
  it('never splits where the text runs on', () => {
    expect(speechChunks('The grass withers and the flowers fall; but the word of our God stands forever, and ever, and ever.')).toHaveLength(1);
  });
  it('keeps a short sentence or a trailing “he said” with its neighbour', () => {
    expect(speechChunks('Jesus wept.')).toEqual(['Jesus wept.']);
    expect(speechChunks('“Who touched My garments?” He asked the crowd, looking all around them.')).toHaveLength(1);
    expect(speechChunks('And they went out to meet the man at the gate of the city. “Who are you?” he asked.'))
      .toEqual(['And they went out to meet the man at the gate of the city. “Who are you?” he asked.']);
  });
  it('splits after a closing quote', () => {
    expect(speechChunks('He answered them, “I have told you already, and you did not listen.” Then they reviled Him and said so to everyone.'))
      .toEqual(['He answered them, “I have told you already, and you did not listen.”', 'Then they reviled Him and said so to everyone.']);
  });
  it('gives nothing for an empty verse', () => {
    expect(speechChunks('')).toEqual([]);
  });
});
