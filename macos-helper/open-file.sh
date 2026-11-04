#!/bin/sh
set -eu
resolve_workshop_file() {
    request=$1
    folder=$2
    case "$request" in
        workshop-files://open/label.pdf|workshop-files://open/model.3mf|workshop-files://open/model.stl|workshop-files://open/model.step|workshop-files://open/model.stp|workshop-files://open/model.obj|workshop-files://open/model.gcode) ;;
        *) printf '%s\n' 'Недопустимая ссылка на файл.' >&2; return 1 ;;
    esac
    case "$folder" in /*) ;; *) printf '%s\n' 'Рабочая папка должна иметь абсолютный путь.' >&2; return 1 ;; esac
    [ -d "$folder" ] || { printf '%s\n' 'Рабочая папка не найдена. Повторите установку компонента.' >&2; return 1; }
    name=${request##*/}
    file="$folder/$name"
    [ -f "$file" ] && [ ! -L "$file" ] || { printf '%s\n' 'Файл не найден. Сохраните его в выбранную рабочую папку.' >&2; return 1; }
    printf '%s\n' "$file"
}
import_workshop_file() {
    request=$1
    folder=$2
    downloads=$3
    receipts=$4
    attempts=$5
    interval=$6
    case "$request" in workshop-files://import/*) ;; *) printf '%s\n' 'Недопустимая ссылка импорта.' >&2; return 1 ;; esac
    rest=${request#workshop-files://import/}
    token=${rest%%/*}
    name=${rest#*/}
    [ "${#token}" -eq 32 ] || return 1
    case "$token" in *[!a-f0-9]*) return 1 ;; esac
    case "$name" in label.pdf|model.3mf|model.stl|model.step|model.stp|model.obj|model.gcode) ;; *) return 1 ;; esac
    case "$folder" in /*) ;; *) return 1 ;; esac
    case "$downloads" in /*) ;; *) return 1 ;; esac
    [ -d "$folder" ] && [ -d "$downloads" ] || { printf '%s\n' 'Папка не найдена. Повторите установку и выберите рабочую папку и папку загрузок Safari.' >&2; return 1; }
    receipt="$receipts/receipt-$name.txt"
    if [ -f "$receipt" ] && [ "$(cat "$receipt")" = "$(printf '%s\n%s' "$token" "$folder/$name")" ]; then
        resolve_workshop_file "workshop-files://open/$name" "$folder"
        return
    fi
    source="$downloads/workshop-transfer-$token-$name.workshop"
    previous_size=''
    ready=''
    while [ "$attempts" -gt 0 ]; do
        [ ! -L "$source" ] || return 1
        if [ -f "$source" ] && [ ! -e "$source.download" ]; then
            size=$(wc -c < "$source" | tr -d ' ')
            if [ "$size" -gt 0 ] && [ "$size" = "$previous_size" ]; then ready=yes; break; fi
            previous_size=$size
        fi
        attempts=$((attempts - 1))
        if [ "$attempts" -gt 0 ]; then sleep "$interval"; fi
    done
    [ "$ready" = yes ] || { printf '%s\n' 'Скачивание ещё не завершено или выбрана другая папка загрузок. Дождитесь загрузки и нажмите кнопку повторно. При необходимости повторите установку компонента и выберите папку загрузок Safari.' >&2; return 1; }
    target="$folder/$name"
    [ ! -L "$target" ] && [ ! -d "$target" ] || { printf '%s\n' 'Назначение должно быть обычным файлом.' >&2; return 1; }
    mkdir -p "$receipts"
    staged=$(mktemp "$folder/.workshop-transfer.XXXXXXXX")
    receipt_stage=''
    trap 'rm -f "$staged" "$receipt_stage"' 0
    # Commit the replacement before consuming the one uniquely identified Safari download.
    cp "$source" "$staged" || return 1
    mv -f "$staged" "$target" || return 1
    receipt_stage=$(mktemp "$receipts/.receipt.XXXXXXXX")
    printf '%s\n%s' "$token" "$target" > "$receipt_stage"
    mv -f "$receipt_stage" "$receipt" || return 1
    rm -f "$source"
    case "$name" in model.*)
        marker="$receipts/managed-model.txt"
        previous=''
        if [ -f "$marker" ]; then previous=$(cat "$marker"); fi
        if [ "$previous" != "$target" ]; then
            case "$previous" in "$folder"/model.3mf|"$folder"/model.stl|"$folder"/model.step|"$folder"/model.stp|"$folder"/model.obj|"$folder"/model.gcode) rm -f "$previous" || true ;; esac
        fi
        printf '%s' "$target" > "$marker"
    esac
    printf '%s\n' "$target"
}
if [ "${1:-}" = '--resolve-only' ]; then
    resolve_workshop_file "${2:-}" "${3:-}"
    exit
fi
if [ "${1:-}" = '--import-only' ]; then
    import_workshop_file "${2:-}" "${3:-}" "${4:-}" "${5:-}" 3 0
    exit
fi
config_dir="$HOME/Library/Application Support/WorkshopFileOpener"
config="$config_dir/folder.txt"
[ -f "$config" ] || { printf '%s\n' 'Рабочая папка не настроена. Запустите установку компонента.' >&2; exit 1; }
folder=$(cat "$config")
case "${1:-}" in
    workshop-files://import/*)
        downloads="$HOME/Downloads"
        if [ -f "$config_dir/downloads.txt" ]; then downloads=$(cat "$config_dir/downloads.txt"); fi
        file=$(import_workshop_file "$1" "$folder" "$downloads" "$config_dir" 30 1)
        ;;
    *) file=$(resolve_workshop_file "${1:-}" "$folder") ;;
esac
/usr/bin/open "$file"
