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
if [ "${1:-}" = '--resolve-only' ]; then
    resolve_workshop_file "${2:-}" "${3:-}"
    exit
fi
config="$HOME/Library/Application Support/WorkshopFileOpener/folder.txt"
[ -f "$config" ] || { printf '%s\n' 'Рабочая папка не настроена. Запустите установку компонента.' >&2; exit 1; }
folder=$(cat "$config")
file=$(resolve_workshop_file "${1:-}" "$folder")
/usr/bin/open "$file"
