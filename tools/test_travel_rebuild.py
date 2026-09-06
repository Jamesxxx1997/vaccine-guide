"""Regression tests for destination identity; no files or network are modified."""
import contextlib
import io
import json
import pathlib
import re
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import update_travel as travel


def alert(name, english, iso, date='2026-01-01', level='第一級:注意(Watch)'):
    return dict(areaDesc=name, areaDesc_EN=english, ISO3166=iso,
                alert_disease='test disease', areaDetail='', effective=date,
                severity_level=level)


def prescription(name, english, vaccine='test vaccine'):
    return {'國名(中)': name, '國名(英)': english, '疫苗': vaccine}


class TravelRebuildTest(unittest.TestCase):
    def build(self, alerts, prescriptions):
        with patch.object(travel, 'read_csv', side_effect=[alerts, prescriptions]), contextlib.redirect_stdout(io.StringIO()):
            return travel.build('2026-08-07')

    def test_shared_iso_does_not_merge_destinations(self):
        meta, data = self.build([alert('甲島', 'Island A', 'GP'),
                                 alert('乙島', 'Island B', 'GP', '2026-02-01')], [])
        self.assertEqual(meta['countries'], 2)
        self.assertEqual(data['GP::island a']['a'][0][2], '2026-01-01')
        self.assertEqual(data['GP::island b']['a'][0][2], '2026-02-01')

    def test_unique_english_alias_joins_but_different_destination_does_not(self):
        _, data = self.build([alert('甲島', 'Island A', 'AA')],
                             [prescription('甲島別名', 'Island A'), prescription('乙島', 'Island B')])
        self.assertEqual(len(data), 2)
        self.assertEqual(data['AA']['v'], ['test vaccine'])
        self.assertEqual(data['乙島']['en'], 'Island B')

    def test_prescription_only_aliases_use_unique_english_identity(self):
        _, data = self.build([], [prescription('甲', 'Island A'), prescription('甲別名', 'Island A', 'second')])
        self.assertEqual(len(data), 1)
        self.assertEqual(data['甲']['v'], ['test vaccine', 'second'])

    def test_ambiguous_english_identity_is_not_forced(self):
        _, data = self.build([alert('甲', 'Same English', 'AA'), alert('乙', 'Same English', 'BB')],
                             [prescription('丙', 'Same English')])
        self.assertEqual(len(data), 3)
        self.assertEqual(data['AA']['v'], [])
        self.assertEqual(data['BB']['v'], [])

    def test_latest_lifted_record_and_same_day_lifted_priority(self):
        for dates in [('2026-01-01', '2026-02-01'), ('2026-02-01', '2026-02-01')]:
            for reverse in [False, True]:
                records = [alert('甲', 'A', 'AA', dates[0]), alert('甲', 'A', 'AA', dates[1], '解除')]
                _, data = self.build(records[::-1] if reverse else records, [])
                self.assertEqual(data['AA']['a'], [])

    def test_committed_snapshot_is_reproducible_without_date_change(self):
        html = travel.HTML.read_text(encoding='utf-8')
        meta = json.loads(re.search(r'const TRAVEL_META=(.*?);', html).group(1))
        data = json.loads(re.search(r'const TRAVEL=(.*?);\n', html).group(1))
        with contextlib.redirect_stdout(io.StringIO()):
            actual_meta, actual_data = travel.build(meta['updated'])
        self.assertEqual(actual_meta, meta)
        self.assertEqual(actual_data, data)


if __name__ == '__main__':
    unittest.main()
