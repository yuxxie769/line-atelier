"""Analyze this bounded blank-to-rough run without counting preexisting artwork.

Usage: python analyze_log.py [session-log.json]
Uses only Python's standard library. Does not modify the input log.
"""
import base64
import collections
import csv
import hashlib
import json
from pathlib import Path
import struct
import sys
from datetime import datetime

ROOT = Path(__file__).resolve().parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'session-log.json'
raw = source.read_bytes()
log = json.loads(raw)
events = log['events']
start = next(i for i, e in enumerate(events) if e['tool'] == 'paint_new_document' and e['status'] == 'succeeded')
end = next(i for i, e in enumerate(events) if e['tool'] == 'paint_checkpoint' and '1B' in e.get('arguments', {}).get('name', ''))
run = events[start:end + 1]
success = [e for e in run if e['status'] == 'succeeded']
submits = [e for e in success if e['tool'] == 'paint_submit']
commands = [c for e in submits for c in e['arguments']['commands']]
assert len({c['id'] for c in commands}) == len(commands)
assert all([c['id'] for c in e['arguments']['commands']] == e['result']['commandIds'] for e in submits)
assert all(e['result']['accepted'] == len(e['arguments']['commands']) for e in submits)
inspections = [e for e in success if e['tool'] == 'paint_record_inspection']
rough_checks = [e for e in inspections if e['result']['phase'] == 'rough']
counts = collections.Counter(e['tool'] for e in run)
failures = [{'call': e['id'], 'tool': e['tool'], 'error': e.get('error')} for e in run if e['status'] != 'succeeded']
dt = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))
seconds = lambda a, b: round((dt(b) - dt(a)).total_seconds(), 3)
rough_start = next(e for e in success if e['tool'] == 'paint_set_phase' and e['arguments']['phase'] == 'rough')
durations = {
    'blank_to_first_accepted_batch': seconds(run[0]['startedAt'], submits[0]['finishedAt']),
    'first_batch_to_rough_phase': seconds(submits[0]['finishedAt'], rough_start['startedAt']),
    'rough_phase_to_last_batch': seconds(rough_start['startedAt'], submits[-1]['finishedAt']),
    'last_batch_to_endpoint_checkpoint': seconds(submits[-1]['finishedAt'], run[-1]['finishedAt']),
    'blank_to_endpoint_checkpoint': seconds(run[0]['startedAt'], run[-1]['finishedAt']),
}
repair_tools = ['paint_revise', 'paint_edit_geometry', 'paint_undo', 'paint_smooth_strokes', 'paint_edit_pressure']
metrics = {
    'session_id': log['id'], 'source_sha256': hashlib.sha256(raw).hexdigest(),
    'raw_event_count': len(events), 'excluded_preexisting_calls': start,
    'first_call': run[0]['id'], 'last_call': run[-1]['id'],
    'call_count': len(run), 'succeeded_calls': len(success), 'failed_calls': len(failures),
    'call_failure_rate': len(failures) / len(run), 'calls_by_tool': dict(counts),
    'accepted_batches': len(submits), 'accepted_strokes': len(commands),
    'strokes_by_phase': dict(collections.Counter(c['subphase'] for c in commands)),
    'strokes_by_part': dict(collections.Counter(c['part'] for c in commands)),
    'batches': [{'call': e['id'], 'group': e.get('groupId'), 'count': e['result']['accepted'], 'revision': e['after']['revision'], 'basis': e['arguments'].get('basis')} for e in submits],
    'context_observations': counts['paint_inspect_context'], 'review_observations': counts['paint_observe_review'],
    'retained_unique_pngs': len(log['images']),
    'reference_card_calls': counts['paint_get_reference_card'],
    'unique_reference_cards': sorted({e['arguments']['id'] for e in success if e['tool'] == 'paint_get_reference_card'}),
    'repair_calls_by_tool': {t: counts[t] for t in repair_tools},
    'rough_inspection_reports': len(rough_checks),
    'rough_comparisons': dict(collections.Counter(c['conclusion'] for e in rough_checks for c in e['arguments']['comparisons'])),
    'rough_issue_ids': sorted({i for e in rough_checks for i in e['result']['issueIds']}),
    'terminal_pending_targets': run[-1]['result']['localFeedback']['inspection'].get('pending'),
    'terminal_revision': run[-1]['after']['revision'],
    'duration_seconds': durations, 'failures': failures,
    'limitations': ['Single reference, single run; no baseline or external art rater.', 'Wall time includes tool interaction, reading, observation and orchestration; it is not pure inference time.', 'PNG presence and API success do not prove visual comprehension or artistic quality.', 'Log does not contain token usage or cost.', 'Part issue counts overlap whole-image issues; not independent defect counts.', 'Browser UI export attempts and setup failures are outside the WebMCP log.'],
}
(ROOT / 'metrics.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
with (ROOT / 'events.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['call','tool','status','started_at','duration_ms','revision_before','revision_after','accepted_strokes','image_count','error'])
    writer.writeheader()
    for e in run:
        writer.writerow(dict(call=e['id'], tool=e['tool'], status=e['status'], started_at=e['startedAt'], duration_ms=round(seconds(e['startedAt'], e['finishedAt']) * 1000), revision_before=e['before']['revision'], revision_after=e['after']['revision'], accepted_strokes=e.get('result', {}).get('accepted', 0), image_count=len(e['images']), error=e.get('error','')))
with (ROOT / 'inspections.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['call','phase','target','criterion','conclusion','reference','drawing'])
    writer.writeheader()
    for e in inspections:
        for c in e['arguments']['comparisons']:
            writer.writerow(dict(call=e['id'], phase=e['result']['phase'], target=e['arguments']['target'], **c))
images = {im['id']: im for im in log['images']}
for name, event_number, path in [('layout.png',13,'result.drawing'),('rough-final.png',53,'result.drawing'),('reference.png',53,'result.reference')]:
    ref = next(im for im in events[event_number-1]['images'] if im['path'] == path)
    blob = base64.b64decode(images[ref['id']]['dataUrl'].split(',',1)[1])
    assert hashlib.sha256(blob).hexdigest() == ref['sha256']
    assert struct.unpack('>II', blob[16:24]) == (600,849)
    (ROOT / name).write_bytes(blob)
payload = {'new_document': run[0]['arguments'], 'accepted_batches': [e['arguments'] for e in submits], 'layer_updates': [e['arguments'] for e in success if e['tool'] in ['paint_set_plan','paint_set_layers']], 'workflow': {'enabled':True,'phase':'rough'}}
(ROOT / 'replay-input.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: metrics[k] for k in ['call_count','succeeded_calls','failed_calls','accepted_batches','accepted_strokes','strokes_by_phase','strokes_by_part','rough_comparisons','duration_seconds']}, ensure_ascii=False, indent=2))
