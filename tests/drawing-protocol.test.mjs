import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {drawingProtocol} from '../app/drawing-protocol.js';
import {syncDrawingProtocol} from '../scripts/sync-drawing-protocol.mjs';

test('browser payload and document are the complete canonical protocol with a matching version',async()=>{
  const source=(await readFile(new URL('../docs/WORKFLOW_PRINCIPLES.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const copy=(await readFile(new URL('../app/docs/workflow-principles.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const protocol=drawingProtocol();
  assert.equal(protocol.text,source);
  assert.equal(copy,source);
  assert.equal(protocol.sha256,createHash('sha256').update(source).digest('hex'));
  assert.equal(protocol.source,'docs/WORKFLOW_PRINCIPLES.md');
  await syncDrawingProtocol({check:true});
});

test('omitting text is per call; another caller always receives full text by default',()=>{
  const full=drawingProtocol();
  assert.deepEqual(drawingProtocol({includeProtocol:false}),{source:full.source,sha256:full.sha256});
  const modified=drawingProtocol();modified.text='caller edit';modified.sha256='caller version';
  assert.deepEqual(drawingProtocol(),full);
  assert.deepEqual(drawingProtocol({includeProtocol:true}),full);
  for(const includeProtocol of ['false',0,null])assert.throws(()=>drawingProtocol({includeProtocol}),/boolean/);
});
