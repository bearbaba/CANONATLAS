"""Contract shim tests: deterministic behavior only; NOT GenLayer live consensus."""
import importlib.util
import json
import sys
import types
import unittest
from copy import deepcopy
from pathlib import Path

class UserError(Exception): pass
class Address:
    def __init__(self, value): self.as_hex = value
class TreeMap(dict):
    @classmethod
    def __class_getitem__(cls, _): return cls

identity = lambda fn: fn
gl = types.SimpleNamespace(
    Contract=object, vm=types.SimpleNamespace(UserError=UserError),
    public=types.SimpleNamespace(write=identity, view=identity),
    message=types.SimpleNamespace(sender_address=Address('0x'+'a'*40)),
    nondet=types.SimpleNamespace(), eq_principle=types.SimpleNamespace())
sys.modules['genlayer'] = types.SimpleNamespace(gl=gl, Address=Address, TreeMap=TreeMap, u256=int)
spec=importlib.util.spec_from_file_location('canon',Path(__file__).resolve().parents[1]/'contracts/canon_atlas.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

RULES = [
    {'id':'CHAR1','kind':'continuity','text':'The Lumen Keepers preserve the solar lantern and none has crossed the Quiet Sea.'},
    {'id':'TIME1','kind':'chronology','text':'The port of Ilyra was founded in year 140 and the Great Tide happened in year 162.'},
    {'id':'LAW1','kind':'world_rules','text':'Mirrors store memories but cannot transport living bodies across water.'},
]
SCENE=('In year 166, apprentice Mira uncovered a mirror memory describing the Quiet Sea. '
       'She kept the original lantern in the citadel, sent an encoded message toward the distant Keepers, '
       'and refused the forbidden crossing, respecting the ancient law of mirrors.')
OWNER='0x'+'a'*40
AUTHOR='0x'+'b'*40
ATTACKER='0x'+'c'*40

class CanonAtlasTests(unittest.TestCase):
    def setUp(self):
        self.g=m.CanonAtlas()
        self.g.worlds,self.g.entries=TreeMap(),TreeMap()
        self.sign(OWNER)
        self.world=self.g.create_world('The Glass Archipelago',
            'A sea-bound world of light-bearing guardians, memory mirrors and irreversible tides.',json.dumps(RULES))
        self.valid()
        gl.eq_principle.prompt_comparative=lambda fn,principle:fn()
        def reply(prompt,response_format=None):
            self.assertEqual(response_format,'json')
            self.assertIn('REFERENCES=',prompt)
            return deepcopy(self.answer)
        gl.nondet.exec_prompt=reply
    def sign(self,wallet): gl.message.sender_address=Address(wallet)
    def valid(self, verdict='PASS'):
        self.answer={'checks':[
            {'criterion':key,'result':verdict,'reason':'The supplied story is checked against this frozen canon dimension.',
             'ref_ids':['scene:1',ref]} for key,ref in
            [('continuity','CHAR1:1'),('chronology','TIME1:1'),('world_rules','LAW1:1')]]}
    def submit(self,scene=SCENE):
        self.sign(AUTHOR)
        return self.g.propose_entry(self.world,'A lantern without a voyage',scene,m.digest(scene))
    def world_state(self):return json.loads(self.g.get_world(self.world))
    def entry_state(self,i):return json.loads(self.g.get_entry(i))

    def test_full_flow_requires_steward_ratification(self):
        i=self.submit()
        self.assertEqual(self.g.assess_entry(i),'CONSISTENT')
        self.assertEqual(self.entry_state(i)['assessment']['verdict'],'CONSISTENT')
        self.sign(OWNER)
        self.assertEqual(self.g.ratify_entry(i),'RATIFIED')
        w=self.world_state()
        self.assertEqual(w['canon_version'],2)
        self.assertEqual(w['ratified_entries'],[i])
        self.assertEqual(w['canon'][-1]['text'],SCENE)
        self.assertEqual(w['canon_sha256'],m.digest(m.canonical(w['canon'])))
        self.assertEqual(w['pending_entry'],0)
    def test_creator_cannot_submit_self_review(self):
        self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'independent author'):self.g.propose_entry(self.world,'A new scene!',SCENE,m.digest(SCENE))
    def test_unsigned_fake_hash_refused(self):
        self.sign(AUTHOR)
        with self.assertRaisesRegex(UserError,'scene hash mismatch'):self.g.propose_entry(self.world,'A valid title',SCENE,'0'*64)
    def test_duplicate_open_proposal_blocked(self):
        self.submit()
        with self.assertRaisesRegex(UserError,'already awaiting'):self.submit()
    def test_only_original_author_can_assess(self):
        i=self.submit();self.sign(ATTACKER)
        with self.assertRaisesRegex(UserError,'original author'):self.g.assess_entry(i)
    def test_only_owner_can_ratify(self):
        i=self.submit();self.g.assess_entry(i)
        self.sign(AUTHOR)
        with self.assertRaisesRegex(UserError,'steward'):self.g.ratify_entry(i)
    def test_unassessed_entry_cannot_be_ratified(self):
        i=self.submit();self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'accepted AI consensus'):self.g.ratify_entry(i)
    def test_conflict_does_not_ratify(self):
        i=self.submit();self.answer['checks'][0]['result']='CONFLICT'
        self.assertEqual(self.g.assess_entry(i),'CONFLICT')
        self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'accepted AI consensus'):self.g.ratify_entry(i)
    def test_review_is_conservative_and_can_be_declined(self):
        i=self.submit();self.answer['checks'][0]['result']='REVIEW'
        self.assertEqual(self.g.assess_entry(i),'REVIEW')
        self.sign(OWNER)
        self.assertEqual(self.g.decline_entry(i,'Evidence is ambiguous and must not alter canon.'),'DECLINED')
        self.assertEqual(self.world_state()['canon_version'],1)
    def test_cannot_reassess(self):
        i=self.submit();self.g.assess_entry(i)
        with self.assertRaisesRegex(UserError,'pending'):self.g.assess_entry(i)
    def test_cannot_decline_before_assessment(self):
        i=self.submit();self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'assessment required'):self.g.decline_entry(i,'This entry is not yet assessed.')
    def test_fake_reference_never_becomes_pass(self):
        i=self.submit();self.answer['checks'][1]['ref_ids'][1]='BADLAW:1'
        self.assertEqual(self.g.assess_entry(i),'REVIEW')
        self.assertEqual(self.entry_state(i)['assessment']['checks'],[])
    def test_wrong_reference_category_is_review(self):
        i=self.submit();self.answer['checks'][1]['ref_ids']=['scene:1','LAW1:1']
        self.assertEqual(self.g.assess_entry(i),'REVIEW')
    def test_duplicate_dimension_is_review(self):
        i=self.submit();self.answer['checks'][1]['criterion']='continuity'
        self.assertEqual(self.g.assess_entry(i),'REVIEW')
    def test_citation_tampering_is_review(self):
        bank=m.reference_bank(SCENE,RULES)
        clean=m.checked_assessment(self.answer,bank)
        self.assertEqual(clean['verdict'],'CONSISTENT')
        clean['checks'][0]['references'][0]['quote']='fabricated reference'
        self.assertEqual(m.checked_assessment(clean,bank)['verdict'],'REVIEW')
    def test_snapshot_guard_detects_rule_change(self):
        i=self.submit()
        w=self.world_state();w['canon_version']+=1
        self.g.worlds[self.world]=m.canonical(w)
        with self.assertRaisesRegex(UserError,'stale world'):self.g.assess_entry(i)
    def test_bad_rule_ids_or_dimensions_rejected(self):
        self.sign(OWNER)
        broken=deepcopy(RULES);broken[1]['id']='CHAR1'
        with self.assertRaises(UserError):self.g.create_world('Second World','A very detailed premise for an invented world and its eras.',json.dumps(broken))
        broken=deepcopy(RULES);broken[1]['kind']='continuity'
        with self.assertRaises(UserError):self.g.create_world('Second World','A very detailed premise for an invented world and its eras.',json.dumps(broken))
    def test_sequential_proposal_uses_new_canon_version(self):
        i=self.submit();self.g.assess_entry(i);self.sign(OWNER);self.g.ratify_entry(i)
        j=self.submit();entry=self.entry_state(j)
        self.assertEqual(entry['canon_version'],2)
        self.assertIn('ENTRY_1:1',json.loads(self.g.get_reference_bank(j)))
    def test_stats_and_original_authority(self):
        st=json.loads(self.g.stats())
        self.assertEqual(st['version'],'1.0.0')
        self.assertEqual(st['citation_mode'],'DETERMINISTIC_REFERENCE_IDS')
        self.assertEqual(self.world_state()['owner'],OWNER)

if __name__=='__main__':unittest.main()
