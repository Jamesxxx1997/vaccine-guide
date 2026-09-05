#!/bin/bash
# 疾管署官方疫苗文件下載器
# CDC 的 /File/Get/<id> 是 HTML 殼層，真正的檔案在 /Uploads/files/<uuid>.pdf
# 用法：./fetch_sources.sh
set -u
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE="https://www.cdc.gov.tw"
ROOT="$HOME/vaccine-guide/sources"
LOG="$ROOT/_download_log.tsv"

[ -f "$LOG" ] || printf 'status\tdir\tfilename\tsize_bytes\tsource_url\tresolved_url\n' > "$LOG"

# 從 /File/Get/ 殼層解析出真實檔案路徑並下載
# $1=File/Get 網址或完整殼層網址  $2=目標目錄  $3=輸出檔名(不含副檔名)
grab() {
  local url="$1" dir="$2" name="$3"
  local shell_html real ext out
  mkdir -p "$ROOT/$dir"
  shell_html=$(curl -sSL -A "$UA" --max-time 60 "$url" 2>/dev/null)
  # 殼層裡的 iframe/href 指向真檔。注意兩種變體：
  #   /Uploads/files/<uuid>.pdf  與  /Uploads/<uuid>.pdf
  # 且檔名可能是中文（不能只用 A-Za-z0-9），故排除引號與空白即可
  real=$(printf '%s' "$shell_html" \
    | grep -oE 'href="/Uploads/[^"]+\.(pdf|PDF|doc|docx|xls|xlsx|odt|zip)"' \
    | head -1 | sed -E 's/^href="//; s/"$//')
  if [ -z "$real" ]; then
    # 也許本來就是直接檔案（非殼層）
    if printf '%s' "$shell_html" | head -c 5 | grep -q '%PDF'; then
      real="$url"
    else
      printf 'FAIL_NO_LINK\t%s\t%s\t0\t%s\t-\n' "$dir" "$name" "$url" >> "$LOG"
      echo "  ✗ $name — 殼層中找不到檔案連結"
      return 1
    fi
  fi
  case "$real" in
    http*) full="$real" ;;
    *)     full="$BASE$real" ;;
  esac
  ext="${real##*.}"
  out="$ROOT/$dir/${name}.${ext}"
  curl -sSL -A "$UA" --max-time 180 -o "$out" "$full"
  if [ -s "$out" ]; then
    sz=$(stat -f%z "$out")
    ftype=$(file -b "$out")
    case "$ftype" in
      *PDF*|*Microsoft*|*Composite*|*Zip*)
        printf 'OK\t%s\t%s\t%s\t%s\t%s\n' "$dir" "$(basename "$out")" "$sz" "$url" "$full" >> "$LOG"
        echo "  ✓ $name ($((sz/1024)) KB)" ;;
      *)
        printf 'FAIL_NOT_DOC\t%s\t%s\t%s\t%s\t%s\n' "$dir" "$(basename "$out")" "$sz" "$url" "$full" >> "$LOG"
        echo "  ✗ $name — 下載到的不是文件：$ftype" ;;
    esac
  else
    printf 'FAIL_EMPTY\t%s\t%s\t0\t%s\t%s\n' "$dir" "$name" "$url" "$full" >> "$LOG"
    echo "  ✗ $name — 空檔"
  fi
}

# 列出某個 CDC 分類頁裡所有 /File/Get/ 連結（供人工挑選用）
list_files_on_page() {
  curl -sSL -A "$UA" --max-time 60 "$1" 2>/dev/null \
    | grep -oE 'href="/File/Get/[A-Za-z0-9_-]+"[^>]*>[^<]*' \
    | sed -E 's/href="([^"]*)"[^>]*>(.*)/\1\t\2/'
}

case "${1:-}" in
  list) shift; list_files_on_page "$1" ;;
  grab) shift; grab "$1" "$2" "$3" ;;
  *)    echo "用法: $0 list <分類頁網址>  |  $0 grab <File/Get網址> <子目錄> <檔名>" ;;
esac
