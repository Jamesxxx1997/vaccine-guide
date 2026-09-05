"""以隔離副本注入摘錄錯誤，確認驗證器會攔下（不改正式資料）。"""

import argparse
import contextlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import verify_excerpts as verifier


class VerifyExcerptsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="vaccine-verifier-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "review").mkdir()
        (self.root / "tools").mkdir()
        for rel in ("index.html", "tools/export_rules.mjs", "review/excerpts.js", "review/match_report.md"):
            shutil.copy2(verifier.ROOT / rel, self.root / rel)
        for rel in ("sources", "review/img"):
            (self.root / rel).symlink_to(verifier.ROOT / rel, target_is_directory=True)
        self.excerpts = json.loads((self.root / "review/excerpts.js").read_text().split("const EXCERPTS=")[1].strip().rstrip(";"))

    def run_check(self):
        (self.root / "review/excerpts.js").write_text("const EXCERPTS=" + json.dumps(self.excerpts) + ";\n")
        output = io.StringIO()
        with patch.object(verifier, "ROOT", self.root), contextlib.redirect_stdout(output):
            failed = verifier.verify(argparse.Namespace(annotate=None, report=self.root / "report.md"))
        return failed, output.getvalue()

    def test_current_artifacts_pass(self):
        failed, output = self.run_check()
        self.assertFalse(failed, output)

    def test_missing_key_fails(self):
        del self.excerpts["e0afcde53"]
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("規則鍵不一致", output)

    def test_gist_with_highlight_fails(self):
        self.excerpts["ee51e0fd7"]["rects"] = [[10, 10, 20, 20]]
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("整理句不應高亮", output)

    def test_identical_sentence_wrong_vaccine_row_fails(self):
        # 文字、尺寸、圖片、覆蓋率都合法，但 PPV 的連結偷換成 HPV 原句。
        self.excerpts["e9ac5ab5b"] = dict(self.excerpts["e57203ae2"])
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("超出人工覆核的來源段落／疫苗列", output)
        self.assertNotIn("框內覆蓋率", output)

    def test_rectangle_outside_image_fails(self):
        entry = self.excerpts["e0afcde53"]
        entry["rects"][0] = [entry["iw"] + 1, 0, 10, 10]
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("越界或無效", output)

    def test_gist_wrong_context_fails(self):
        self.excerpts["e4af4cb04"] = dict(self.excerpts["e8d6af783"])
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("整理句裁圖未涵蓋人工覆核的主要出處", output)

    def test_stale_statistics_fail(self):
        report = self.root / "review/match_report.md"
        report.write_text(verifier.re.sub(r"狀態統計：\{[^\n]+\}", "狀態統計：{}", report.read_text()))
        failed, output = self.run_check()
        self.assertTrue(failed)
        self.assertIn("建置報告統計與實際資料不同", output)

    def test_live28_respects_bcg_exception(self):
        script = r"""
const fs = require('fs');
const html = fs.readFileSync(process.argv[1], 'utf8');
const marker = 'VAX.push(...VAX_SELFPAY);';
const data = html.slice(html.indexOf('const FEVER'), html.indexOf(marker) + marker.length);
const evaluate = html.match(/function evalVax\([^]*?\n\}/)[0];
const check = new Function(data + evaluate + '; return VAX.map(v => ({id:v.id,...evalVax(v,arguments[0])}));');
console.log(JSON.stringify([check({on:{live28:true},years:null,months:null,weeks:null,days:null}),
  check({on:{live28:true,fever:true},years:null,months:null,weeks:null,days:null})]));
"""
        results, with_fever = json.loads(subprocess.check_output(
            ["node", "-e", script, str(self.root / "index.html")], text=True))
        by_id = {r["id"]: r for r in results}
        self.assertEqual(by_id["bcg"]["lv"], "go")
        self.assertEqual(by_id["bcg"]["hits"][0]["lv"], "info")
        self.assertIn("間隔任何時間", by_id["bcg"]["hits"][0]["t"])
        for vid in ("mmr", "var", "jelive"):
            self.assertEqual(by_id[vid]["lv"], "warn")
        self.assertEqual(next(r for r in with_fever if r["id"] == "bcg")["lv"], "warn")


if __name__ == "__main__":
    unittest.main()
