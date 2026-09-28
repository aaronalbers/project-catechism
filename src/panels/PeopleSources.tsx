/** Where the people data comes from, and what this project changed in it (TIPNR's licence asks that changes be noted). */
export function PeopleSources() {
  return (
    <div className="sources"><ol>
      <li><span className="skind">Dataset</span>Who each word and verse names, and each person's kin, from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">TIPNR</a> (Translators Individualised Proper Names, Tyndale House and STEPBible.org, CC BY 4.0). Its kin are its own reading of the text, and ? marks where it reads an ambiguous passage one way. Changed here: a tribe or nation named for its ancestor (Judah, Israel) is not counted as the man outside his own story and the genealogies; Cleopas is kept apart from Alphaeus and Clopas, whom TIPNR takes him to be; and links the text does not make are taken out: Nahash as Jesse's wife and mother of his sons (2 Samuel 17:25 names only Abigail her daughter), Heli and his wife as Mary's parents (Luke 3:23 makes Joseph "son of Heli"), and Artaxerxes as son of Ahasuerus and Vashti and brother of Darius the Mede.</li>
      <li><span className="skind">Dataset</span>Easton's Bible Dictionary entries (1897, public domain) as matched to people by <a href="https://github.com/robertrouse/theographic-bible-metadata" target="_blank" rel="noreferrer">Theographic Bible Metadata</a> (Robert Rouse, CC BY-SA 4.0), paired with TIPNR's people by the verses naming them.</li>
    </ol></div>
  );
}
