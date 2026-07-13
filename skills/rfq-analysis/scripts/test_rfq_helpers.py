#!/usr/bin/env python3
"""Focused tests for rfq_helpers.py."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import rfq_helpers as helpers


class RfqHelpersTest(unittest.TestCase):
    def test_normalize_subject_removes_reply_prefixes(self) -> None:
        self.assertEqual(helpers.normalize_subject("RE: FW: RFQ 123"), "RFQ 123")

    def test_safe_slug_removes_path_characters(self) -> None:
        self.assertEqual(helpers.safe_slug("../RFQ: 123/ABC"), "RFQ-123-ABC")

    def test_unique_path_avoids_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            first = helpers.unique_path(directory, "RFQ.pdf")
            first.write_text("one")
            second = helpers.unique_path(directory, "RFQ.pdf")
            self.assertEqual(second.name, "RFQ-2.pdf")

    def test_validate_rfq_analysis_accepts_contract(self) -> None:
        helpers.validate_rfq_analysis(
            {
                "rfq_analysis": {
                    "subject": "RFQ Analysis - Pumps",
                    "analysis_content": "Summary",
                    "analysis_status": "completed",
                },
                "customer_partial": {"company_name": "", "customer_address": ""},
            }
        )

    def test_validate_item_summary_requires_same_ids(self) -> None:
        helpers.validate_item_summary(
            [1, 2],
            {
                "items": [
                    {
                        "item_id": 1,
                        "identification": [],
                        "classification": [],
                        "application": [],
                        "purpose": [],
                        "features": [],
                    },
                    {
                        "item_id": 2,
                        "identification": [],
                        "classification": [],
                        "application": [],
                        "purpose": [],
                        "features": [],
                    },
                ]
            },
        )

    def test_validate_item_summary_rejects_missing_id(self) -> None:
        with self.assertRaises(ValueError):
            helpers.validate_item_summary(
                [1, 2],
                {
                    "items": [
                        {
                            "item_id": 1,
                            "identification": [],
                            "classification": [],
                            "application": [],
                            "purpose": [],
                            "features": [],
                        }
                    ]
                },
            )


if __name__ == "__main__":
    unittest.main()
