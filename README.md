# human-verified（人工覆核記錄分支）

此分支只放 `human-verified.json`：網站上每個最小單位（表格列／疫苗列／警示框／臨床條目）被人工對照原件確認過的記錄。
由網頁透過 GitHub Contents API 讀寫（使用者自己的 fine-grained token，只授權本 repo Contents 讀寫），不觸發 Pages 部署（workflow 只看 main）。
記錄格式：`units[<unitId>] = {checked, at, fp, claims[], srcVer{}, note}`；`fp` 是該單位證據（claim 的來源／頁碼／逐字句／來源 SHA）的指紋，證據變了勾保留但頁面標「舊證據」。
