/** Where the people data comes from, and what this project changed in it (TIPNR's licence asks that changes be noted). */
export function PeopleSources() {
  return (
    <div className="sources"><ol>
      <li><span className="skind">Dataset</span>Who each word and verse names, and each person's kin, from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">TIPNR</a> (Translators Individualised Proper Names, Tyndale House and STEPBible.org, CC BY 4.0). Kin marked ≈ are TIPNR's links that no nearby verse states; ? marks its reading of an ambiguous passage. Changed here: a tribe or nation named for its ancestor (Judah, Israel) is not counted as the man outside his own story and the genealogies, and Cleopas is kept apart from Alphaeus and Clopas, whom TIPNR takes him to be.</li>
      <li><span className="skind">Dataset</span>Easton's Bible Dictionary entries (1897, public domain) as matched to people by <a href="https://github.com/robertrouse/theographic-bible-metadata" target="_blank" rel="noreferrer">Theographic Bible Metadata</a> (Robert Rouse, CC BY-SA 4.0), paired with TIPNR's people by the verses naming them.</li>
    </ol></div>
  );
}
