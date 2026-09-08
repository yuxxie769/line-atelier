"""Preserve actual WebMCP evidence for the bounded independent-review experiment."""
import base64, collections, csv, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
source = ROOT.parent.parent / 'logs/sessions/7e05da61-4b8b-4695-8e12-dfad75cac499.json'
raw = source.read_bytes()
log = json.loads(raw)
(ROOT / 'session-log.json').write_bytes(raw)
run = [e for e in log['events'] if int(e['id'].rsplit('-',1)[1]) >= 58]
images = {i['id']:i for i in log['images']}
for name, number, role in [('before.png',61,'drawing'),('after.png',67,'drawing'),('reference.png',67,'reference')]:
    event = next(e for e in run if e['id'].endswith(f'-call-{number}'))
    image = next(i for i in event['images'] if i['path']==f'result.{role}')
    data = base64.b64decode(images[image['id']]['dataUrl'].split(',',1)[1])
    assert hashlib.sha256(data).hexdigest() == image['sha256']
    (ROOT/name).write_bytes(data)
with (ROOT/'events.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(['call','tool','status','startedAt','finishedAt','revisionBefore','revisionAfter','imageCount'])
    for e in run:w.writerow([e['id'],e['tool'],e['status'],e['startedAt'],e['finishedAt'],e['before']['revision'],e['after']['revision'],len(e['images'])])
with (ROOT/'inspections.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['call','revision','target','observationIds','criterion','reference','drawing','conclusion'])
    for e in run:
        if e['tool']=='paint_record_inspection' and e['status']=='succeeded':
            a=e['arguments']
            for c in a['comparisons']:w.writerow([e['id'],e['after']['revision'],a['target'],';'.join(a['observationIds']),c['criterion'],c['reference'],c['drawing'],c['conclusion']])
stats={'sessionId':log['id'],'sourceSha256':hashlib.sha256(raw).hexdigest(),'firstCall':run[0]['id'],'lastCall':run[-1]['id'],'callCount':len(run),'callsByTool':dict(collections.Counter(e['tool'] for e in run)),'failedCalls':[e['id'] for e in run if e['status']!='succeeded'],'drawingBefore':{'revision':2,'strokes':27},'drawingAfter':{'revision':3,'strokes':27},'geometryRevisions':[{'call':e['id'],'ids':[c['id'] for c in e['arguments'].get('replace',[])],'basis':e['arguments'].get('basis')} for e in run if e['tool']=='paint_revise' and e['status']=='succeeded'],'imageSha256':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in ['before.png','after.png','reference.png']},'reviewAgents':['/root/layout_review_before','/root/layout_review_after'],'limitations':['Single reference and one repair cycle; no population estimate or causal performance percentage.','Subagent reviews orchestrated in conversation, then transcribed by main agent; application does not authenticate reviewer identity.','UI baseline import and reference upload are preparation outside WebMCP log.','Token usage and cost unavailable; wall time includes orchestration and tools.','Overlapping criterion issues are not independent anatomical defects.','Original whole-image issue and review registration created duplicate issue records for the same ankle defect.']}
before_review=json.loads((ROOT/'review-before.json').read_text(encoding='utf-8'))
after_review=json.loads((ROOT/'review-after.json').read_text(encoding='utf-8'))
stats['independentReview']={'beforeDecision':before_review['decision'],'afterDecision':after_review['firstStageIndependent']['decision'],'comparison':after_review['secondStageComparison']['overall'],'independentDefectsBefore':len(before_review['issues']),'independentDefectsAfter':len(after_review['firstStageIndependent']['issues']),'note':'The before and after defects are different locations. Counts do not imply no improvement or an error-reduction rate.'}
stats['terminal']={'phase':run[-1]['result']['localFeedback']['phase'],'pending':run[-1]['result']['localFeedback']['inspection']['pending']}
stats['limitations'].append('Replacement API removed the original taper on the three replaced paths; width and color remained unchanged, but endpoint pressure is a minor rendering confound.')
(ROOT/'metrics.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'calls':len(run),'lastCall':stats['lastCall'],'geometryRevisions':len(stats['geometryRevisions']),'images':stats['imageSha256']},ensure_ascii=False))
