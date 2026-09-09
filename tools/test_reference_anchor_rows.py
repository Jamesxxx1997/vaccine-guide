"""Regression: malformed font metrics must not turn an exact quote into tall boxes."""
import unittest
from build_reference_pages import anchor_quote, word_positions


class GlyphRows(unittest.TestCase):
    def setUp(self):
        self.word = [10, 0, 30, 31.2, '甲乙', 0]
        self.page = {'words': [self.word], 'lines': [[10, 0, 30, 31.2, '甲乙', 0]],
                     'chars': [[10, 2, 20, 14, '丙'], [20, 2, 30, 14, '丁'],
                               [10, 20, 20, 32, '甲'], [20, 20, 30, 32, '乙']]}

    def test_exact_row_recovers_true_glyphs(self):
        self.assertEqual(anchor_quote(self.page, '甲乙', glyph_rows=True),
                         [[10, 20, 20, 32], [20, 20, 30, 32]])

    def test_partial_word_highlights_only_matched_glyph(self):
        self.assertEqual(anchor_quote(self.page, '乙', glyph_rows=True), [[20, 20, 30, 32]])

    def test_legacy_fallback_not_silently_changed(self):
        self.assertEqual(anchor_quote(self.page, '甲乙'), [[10, 0, 30, 31.2]])

    def test_duplicate_identical_rows_are_ambiguous(self):
        self.page['chars'][0][4] = '甲'
        self.page['chars'][1][4] = '乙'
        with self.assertRaises(ValueError):
            word_positions(self.page, self.word, True)

    def test_missing_or_wrong_glyphs_fail_closed(self):
        for chars in [[], self.page['chars'][:2]]:
            with self.subTest(chars=chars), self.assertRaises(ValueError):
                word_positions({**self.page, 'chars': chars}, self.word, True)

    def test_cross_row_concatenation_is_not_a_real_row(self):
        chars = [[10, 2, 20, 14, '甲'], [20, 20, 30, 32, '乙']]
        with self.assertRaises(ValueError):
            word_positions({**self.page, 'chars': chars}, self.word, True)

    def test_unselected_words_need_no_geometry(self):
        self.page['words'].append([40, 0, 80, 31.2, '未選字', 0])
        self.assertEqual(len(anchor_quote(self.page, '甲乙', glyph_rows=True)), 2)

    def test_nonmatching_quote_still_fails(self):
        with self.assertRaises(ValueError):
            anchor_quote(self.page, '甲丁', glyph_rows=True)


if __name__ == '__main__':
    unittest.main()
