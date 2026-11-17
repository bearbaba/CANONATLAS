"""CANONATLAS V1.1 deterministic tests with independent validator simulation.

These shim tests do not establish live GenLayer consensus or a new deployment.
"""
import importlib.util
import json
import unittest
from pathlib import Path

import test_canon_atlas as old

gl = old.gl
OWNER, AUTHOR = old.OWNER, old.AUTHOR
Address, TreeMap = old.Address, old.TreeMap
RULES, SCENE = old.RULES, old.SCENE

spec = importlib.util.spec_from_file_location(
    "canon_v11", Path(__file__).resolve().parents[1] / "contracts/canon_atlas_v11.py"
)
v11 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v11)


class ProposedReturn:
    def __init__(self, calldata):
        self.calldata = calldata


class V11ConsensusTests(unittest.TestCase):
    def setUp(self):
        self.contract = v11.CanonAtlas()
        self.contract.worlds = TreeMap()
        self.contract.entries = TreeMap()
        gl.message.sender_address = Address(OWNER)
        self.world_id = self.contract.create_world(
            "The Glass Archipelago",
            "A sea-bound world of light-bearing guardians, memory mirrors and irreversible tides.",
            json.dumps(RULES)
        )
        gl.vm.Return = ProposedReturn
        self.calls = []
        self.replies = []
        def assess(prompt, response_format=None):
            self.assertEqual(response_format, "json")
            self.assertIn("FROZEN CANON", prompt)
            self.assertIn("INPUTS=", prompt)
            self.calls.append(prompt)
            if not self.replies:
                self.fail("V1.1 called LLM more times than expected")
            return self.replies.pop(0)
        gl.nondet.exec_prompt = assess
        def validator_consensus(leader_fn, validator_fn):
            leader = leader_fn()
            if not validator_fn(ProposedReturn(leader)):
                raise RuntimeError("simulated validator rejected leader")
            return leader
        gl.vm.run_nondet_unsafe = validator_consensus

    def author_propose(self, scene=SCENE):
        gl.message.sender_address = Address(AUTHOR)
        return self.contract.propose_entry(
            self.world_id, "The memory across the mist", scene, v11.digest(scene)
        )

    def labels(self, continuity="PASS", chronology="PASS", world_rules="PASS"):
        return {
            "continuity": continuity,
            "chronology": chronology,
            "world_rules": world_rules
        }

    def entry(self, entry_id):
        return json.loads(self.contract.get_entry(entry_id))

    def world(self):
        return json.loads(self.contract.get_world(self.world_id))

    def test_v11_all_pass_accepted_then_steward_can_ratify(self):
        entry_id = self.author_propose()
        self.replies = [self.labels(), self.labels()]
        self.assertEqual(self.contract.assess_entry(entry_id), "CONSISTENT")
        self.assertEqual(len(self.calls), 2, "Validator must independently rerun the task")
        result = self.entry(entry_id)["assessment"]
        self.assertEqual([x["result"] for x in result["checks"]], ["PASS"] * 3)
        bank = json.loads(self.contract.get_reference_bank(entry_id))
        for check in result["checks"]:
            self.assertEqual([r["ref_id"] for r in check["references"]],
                             ["scene:1", check["references"][1]["ref_id"]])
            for ref in check["references"]:
                self.assertEqual(bank[ref["ref_id"]]["quote"], ref["quote"])
                self.assertEqual(bank[ref["ref_id"]]["field"], ref["field"])
        gl.message.sender_address = Address(OWNER)
        self.assertEqual(self.contract.ratify_entry(entry_id), "RATIFIED")
        self.assertEqual(self.world()["canon_version"], 2)

    def test_validator_disagreement_blocks_all_pass_and_keeps_entry_submitted(self):
        entry_id = self.author_propose()
        self.replies = [self.labels(), self.labels(continuity="REVIEW")]
        with self.assertRaisesRegex(RuntimeError, "validator rejected"):
            self.contract.assess_entry(entry_id)
        self.assertEqual(self.entry(entry_id)["status"], "SUBMITTED")
        self.assertEqual(self.entry(entry_id)["assessment_runs"], 0)
        self.assertEqual(self.world()["pending_entry"], entry_id)

    def test_conservative_review_can_be_accepted_without_false_pass(self):
        entry_id = self.author_propose()
        self.replies = [self.labels(continuity="REVIEW"), self.labels()]
        self.assertEqual(self.contract.assess_entry(entry_id), "REVIEW")
        gl.message.sender_address = Address(OWNER)
        with self.assertRaisesRegex(old.UserError, "accepted AI consensus"):
            self.contract.ratify_entry(entry_id)
        self.assertEqual(self.contract.decline_entry(
            entry_id, "Ambiguous story detail; revised author submission required."
        ), "DECLINED")
        self.assertEqual(self.world()["pending_entry"], 0)

    def test_bad_format_falls_back_to_review_not_consistent(self):
        entry_id = self.author_propose()
        self.replies = [{"wrong": "PASS"}, self.labels()]
        self.assertEqual(self.contract.assess_entry(entry_id), "REVIEW")
        self.assertEqual(len(self.entry(entry_id)["assessment"]["checks"]), 3)
        self.assertTrue(all(x["result"] == "REVIEW"
                            for x in self.entry(entry_id)["assessment"]["checks"]))
        self.assertEqual(self.world()["canon_version"], 1)

    def test_false_canon_conflict_is_conservative_not_ratifiable(self):
        entry_id = self.author_propose()
        self.replies = [self.labels(world_rules="CONFLICT"), self.labels()]
        self.assertEqual(self.contract.assess_entry(entry_id), "CONFLICT")
        gl.message.sender_address = Address(OWNER)
        with self.assertRaisesRegex(old.UserError, "accepted AI consensus"):
            self.contract.ratify_entry(entry_id)

    def test_injected_extra_fields_cannot_become_consistent(self):
        entry_id = self.author_propose()
        bad = dict(self.labels(), approve_without_steward=True)
        self.replies = [bad, self.labels()]
        self.assertEqual(self.contract.assess_entry(entry_id), "REVIEW")
        self.assertEqual(self.world()["canon_version"], 1)

    def test_stat_metadata_bumped_and_old_contract_untouched(self):
        self.assertEqual(json.loads(self.contract.stats())["version"], "1.1.0")
        with open(Path(__file__).resolve().parents[1] / "contracts/canon_atlas.py") as f:
            self.assertIn('"version": "1.0.0"', f.read())


if __name__ == "__main__":
    unittest.main()
