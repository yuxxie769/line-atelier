// Keep large, editable drawings transferable through bounded WebMCP replies.
export function exportDocumentData(document, options = {}) {
  const {section = 'document', checkpointId, offset = 0, limit = 100,
    compact = false, includeCheckpoints = true} = options;
  if (!['document', 'manifest', 'commands'].includes(section)) throw Error('导出 section 不存在');
  const doc = checkpointId ? document.checkpoints.find(c => c.id === checkpointId)?.doc : document;
  if (!doc) throw Error('检查点不存在');
  const copyStroke = c => {
    const result = structuredClone(c);
    // Geometry is authoritative. Old strokes without source geometry retain every point.
    if (compact && result.geometry) delete result.points;
    return result;
  };
  if (section === 'commands') {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('导出分页范围错误');
    const end = Math.min(doc.commands.length, offset + limit);
    return {revision: doc.revision, offset, total: doc.commands.length,
      nextOffset: end < doc.commands.length ? end : null,
      commands: doc.commands.slice(offset, end).map(copyStroke)};
  }
  const {commands, checkpoints, ...metadata} = doc;
  const result = structuredClone(metadata);
  if (section === 'manifest') {
    result.commandCount = commands.length;
    result.checkpoints = checkpoints.map(({doc, ...item}) => structuredClone(item));
  } else {
    result.commands = commands.map(copyStroke);
    result.checkpoints = includeCheckpoints ? checkpoints.map(c => ({...structuredClone(c),
      doc: exportDocumentData(c.doc, {compact, includeCheckpoints: false})})) : [];
  }
  return result;
}
