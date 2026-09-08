import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const logPath=path.resolve(root,'../../logs/sessions/0364457c-6dfc-49bf-b994-9615847b56fe.json');
const log=JSON.parse(fs.readFileSync(logPath,'utf8'));
const start=log.events.findIndex(e=>e.tool==='paint_new_document'&&e.after?.title?.includes('白发少女'));
if(start<0)throw Error('Latest drawing start not found');
const events=log.events.slice(start);
const callNumber=e=>Number(e.id.match(/-call-(\d+)$/)?.[1]);
let phase='layout';
for(const e of events){
  if(e.tool==='paint_set_phase'&&e.status==='succeeded')phase=e.arguments.phase;
  e.analysisPhase=phase;
}
const successful=events.filter(e=>e.status==='succeeded');
const failed=events.filter(e=>e.status!=='succeeded');
const tools=list=>Object.fromEntries([...list.reduce((m,e)=>m.set(e.tool,(m.get(e.tool)||0)+1),new Map())].sort());
const phases=['layout','rough','structure_review','refine','clean','lineart_review'];
const phaseNames={layout:'1A 整体定位',rough:'1B 完整粗稿',structure_review:'1C 结构修稿',refine:'1D 细化草稿',clean:'1E 独立清线',lineart_review:'1F 两轮审核'};
const repairTools=new Set(['paint_revise','paint_edit_geometry','paint_edit_pressure','paint_smooth_strokes','paint_undo']);
const inspectionTools=new Set(['paint_inspect_context','paint_observe_review','paint_prepare_review','paint_record_inspection','paint_record_review','paint_scan_gaps','paint_preview_leak']);
const acceptedSubmits=successful.filter(e=>e.tool==='paint_submit');
const revisions=successful.filter(e=>e.after?.revision!==e.before?.revision&&e.tool!=='paint_new_document');
const modifications=successful.filter(e=>repairTools.has(e.tool)).map(e=>({
  call:callNumber(e),phase:e.analysisPhase,tool:e.tool,revisionBefore:e.before.revision,revisionAfter:e.after.revision,
  changedIds:e.arguments.replace?.map(x=>x.id)||e.arguments.ids||[e.arguments.id||e.arguments.anchorId].filter(Boolean),
  insertedIds:e.arguments.insert?.map(x=>x.id).filter(Boolean)||[],
  removedIds:(e.arguments.remove||[]).map(x=>typeof x==='string'?x:x.id).filter(Boolean),note:e.arguments.note||'',basis:e.arguments.basis?.note||''
}));
const reports=successful.filter(e=>e.tool==='paint_record_inspection');
const comparisons=reports.flatMap(e=>(e.arguments.comparisons||[]).map(c=>({...c,call:callNumber(e),phase:e.analysisPhase,target:e.arguments.target})));
const issueCreates=new Set(reports.flatMap(e=>e.result?.issueIds||[]));
const issueUpdates=successful.filter(e=>e.tool==='paint_update_issue');
const manualOpens=issueUpdates.filter(e=>e.arguments.action==='open');
const resolveCalls=issueUpdates.filter(e=>e.arguments.action==='resolve');
const resolvedIds=new Set(resolveCalls.map(e=>e.arguments.id));
const reviewRecords=successful.filter(e=>e.tool==='paint_record_review').map(e=>({call:callNumber(e),phase:e.analysisPhase,kind:e.arguments.kind||'observation',status:e.arguments.status||null,revision:e.after.revision,note:e.arguments.note}));
const imageRefs=events.flatMap(e=>e.images||[]).map(i=>typeof i==='string'?i:i.id).filter(Boolean);
const finalCommandEvent=[...events].reverse().find(e=>Number.isInteger(e.result?.commands));
const byPhase={};
for(const p of phases){
  const all=events.filter(e=>e.analysisPhase===p),ok=all.filter(e=>e.status==='succeeded');
  const phaseReports=ok.filter(e=>e.tool==='paint_record_inspection');
  const phaseComparisons=phaseReports.flatMap(e=>e.arguments.comparisons||[]);
  const submits=ok.filter(e=>e.tool==='paint_submit');
  const phaseMods=modifications.filter(e=>e.phase===p);
  byPhase[p]={name:phaseNames[p],callRange:all.length?[callNumber(all[0]),callNumber(all.at(-1))]:null,calls:all.length,failedCalls:all.filter(e=>e.status!=='succeeded').length,
    acceptedSubmitBatches:submits.length,acceptedNewStrokes:submits.reduce((n,e)=>n+(e.result?.accepted||0),0),repairCalls:phaseMods.length,repairedStrokeIds:[...new Set(phaseMods.flatMap(x=>[...x.changedIds,...x.insertedIds,...x.removedIds]))],
    contextViews:ok.filter(e=>e.tool==='paint_inspect_context').length,pairedReviewViews:ok.filter(e=>e.tool==='paint_observe_review').length,preparedReviewPackages:ok.filter(e=>e.tool==='paint_prepare_review').length,
    inspectionReports:phaseReports.length,inspectionTargets:Object.fromEntries([...phaseReports.reduce((m,e)=>m.set(e.arguments.target,(m.get(e.arguments.target)||0)+1),new Map())].sort()),
    comparisonOutcomes:Object.fromEntries([...phaseComparisons.reduce((m,c)=>m.set(c.conclusion,(m.get(c.conclusion)||0)+1),new Map())].sort()),
    reviewRecords:reviewRecords.filter(r=>r.phase===p).length,issueUpdateCalls:ok.filter(e=>e.tool==='paint_update_issue').length,
    diagnosticCalls:ok.filter(e=>['paint_scan_gaps','paint_preview_leak','paint_clear_diagnostics'].includes(e.tool)).length
  };
}
const started=new Date(events[0].startedAt),finished=new Date(events.at(-1).finishedAt);
const metrics={
  sessionId:log.id,source:logPath,startCall:callNumber(events[0]),endCall:callNumber(events.at(-1)),startedAt:events[0].startedAt,finishedAt:events.at(-1).finishedAt,elapsedSeconds:(finished-started)/1000,
  final:{revision:events.at(-1).after.revision,commands:finalCommandEvent?.result.commands??null,width:events.at(-1).after.width,height:events.at(-1).after.height,phase:events.at(-1).result?.localFeedback?.phase},
  calls:{total:events.length,succeeded:successful.length,failed:failed.length,byTool:tools(events),successfulByTool:tools(successful),failedByTool:tools(failed)},
  drawing:{acceptedSubmitBatches:acceptedSubmits.length,acceptedNewStrokes:acceptedSubmits.reduce((n,e)=>n+(e.result?.accepted||0),0),repairCalls:modifications.length,repairEvents:modifications,revisionIncreasingCalls:revisions.length,revisionIncreasingByTool:tools(revisions)},
  inspection:{allInspectionRelatedSuccessfulCalls:successful.filter(e=>inspectionTools.has(e.tool)).length,contextViews:successful.filter(e=>e.tool==='paint_inspect_context').length,pairedReviewViews:successful.filter(e=>e.tool==='paint_observe_review').length,preparedReviewPackages:successful.filter(e=>e.tool==='paint_prepare_review').length,inspectionReports:reports.length,comparisonStatements:comparisons.length,comparisonOutcomes:Object.fromEntries([...comparisons.reduce((m,c)=>m.set(c.conclusion,(m.get(c.conclusion)||0)+1),new Map())].sort()),reviewRecords:reviewRecords.length,diagnosticGapScans:successful.filter(e=>e.tool==='paint_scan_gaps').length,diagnosticLeakPreviews:successful.filter(e=>e.tool==='paint_preview_leak').length,imageReferences:imageRefs.length,uniqueReferencedImages:new Set(imageRefs).size},
  issues:{autoIssueIdsFromInspections:[...issueCreates],manualOpenCalls:manualOpens.length,manualOpenIds:manualOpens.map(e=>e.arguments.id),resolveCalls:resolveCalls.length,distinctResolvedIds:[...resolvedIds],note:'Resolve calls include repeated checks of the same historical issue after unrelated batches.'},
  reviews:reviewRecords,phases:byPhase,
  failures:failed.map(e=>({call:callNumber(e),phase:e.analysisPhase,tool:e.tool,error:e.error||e.result?.error||null}))
};
fs.writeFileSync(path.join(root,'latest-session-analysis.json'),JSON.stringify(metrics,null,2));
const csv=['call,phase,tool,status,revision_before,revision_after,target,action,accepted,changed_ids,note'];
const quote=v=>'"'+String(v??'').replaceAll('"','""').replaceAll(/\r?\n/g,' ')+'"';
for(const e of events)csv.push([callNumber(e),e.analysisPhase,e.tool,e.status,e.before?.revision,e.after?.revision,e.arguments?.target,e.arguments?.action,e.result?.accepted,(e.arguments?.replace?.map(x=>x.id)||e.arguments?.ids||[]).join(';'),e.arguments?.note||e.arguments?.basis?.note||''].map(quote).join(','));
fs.writeFileSync(path.join(root,'latest-session-events.csv'),'\ufeff'+csv.join('\n'));
console.log(JSON.stringify({calls:metrics.calls,final:metrics.final,drawing:{acceptedSubmitBatches:metrics.drawing.acceptedSubmitBatches,acceptedNewStrokes:metrics.drawing.acceptedNewStrokes,repairCalls:metrics.drawing.repairCalls,revisionIncreasingCalls:metrics.drawing.revisionIncreasingCalls,revisionIncreasingByTool:metrics.drawing.revisionIncreasingByTool},inspection:metrics.inspection,issues:metrics.issues,phases:metrics.phases},null,2));
