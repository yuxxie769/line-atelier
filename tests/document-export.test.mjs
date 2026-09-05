import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument, validateDocument} from '../dist/model.js';
import {exportDocumentData} from '../dist/document-export.js';

test('paged compact exports reconstruct current geometry and preserved checkpoints without drift', () => {
  const raw = blankDocument();
  raw.commands = [
    {id:'curve', through:[[10,30,.2],[80,90,1],[160,40,.3]], corners:[1]},
    {id:'legacy', points:[[40,40],[80,20],[100,90]]}
  ];
  const doc = validateDocument(raw);
  doc.checkpoints = [{id:'before', name:'保留稿', revision:0, doc:structuredClone(doc)}];
  const before = structuredClone(doc);
  const recover = checkpointId => {
    const manifest = exportDocumentData(doc, {section:'manifest', checkpointId});
    const records = [];
    let offset = 0;
    do {
      const page = exportDocumentData(doc, {section:'commands', checkpointId, offset, limit:1, compact:true});
      assert.equal(page.revision, manifest.revision);
      records.push(...page.commands); offset = page.nextOffset;
    } while (offset !== null);
    assert.equal(records[0].points, undefined);
    assert.deepEqual(records[1].points, doc.commands[1].points);
    return {...manifest, commands:records, checkpoints:manifest.checkpoints.map(c=>({...c,doc:recover(c.id)}))};
  };
  assert.deepEqual(validateDocument(recover()), validateDocument(doc));
  assert.deepEqual(doc, before);
});

test('export rejects missing checkpoints and invalid pagination while empty drawings round-trip', () => {
  const doc = validateDocument(blankDocument());
  assert.throws(()=>exportDocumentData(doc, {checkpointId:'missing'}));
  assert.throws(()=>exportDocumentData(doc, {section:'commands',limit:1000}));
  assert.throws(()=>exportDocumentData(doc, {section:'commands',offset:-1}));
  assert.deepEqual(exportDocumentData(doc, {section:'commands'}).commands, []);
  assert.deepEqual(validateDocument(exportDocumentData(doc, {compact:true})), doc);
});
