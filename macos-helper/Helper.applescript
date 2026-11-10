on open location requestURL
    if requestURL is "workshop-files://check/webdav" then
        my checkWebDav()
        return
    end if
    try
        set resourceFolder to POSIX path of (path to resource "open-file.sh")
        do shell script "/bin/sh " & quoted form of resourceFolder & " " & quoted form of requestURL
    on error messageText number errorNumber
        if errorNumber is -128 then return
        display dialog "Не удалось открыть сохранённый файл." & return & messageText & return & "Для Safari дождитесь скачивания, затем повторите открытие. При установке компонента выберите рабочую папку и папку загрузок Safari. Приложение по умолчанию меняется в Finder → Свойства → Открывать в программе → Настроить всё." buttons {"Понятно"} default button 1 with icon caution
    end try
end open location

on run
    set choice to button returned of (display dialog "Компонент Мастерской установлен. Сохраните модель или этикетку в приложении и нажмите «Открыть на Mac». Для смены папки повторите установку компонента." buttons {"Понятно", "Проверить WebDAV"} default button 1)
    if choice is "Проверить WebDAV" then my checkWebDav()
end run

on checkWebDav()
    try
        set checker to POSIX path of (path to resource "webdav-check.sh")
        set resultText to do shell script "/bin/sh " & quoted form of checker
        display dialog resultText buttons {"Понятно"} default button 1
    on error messageText
        display dialog messageText buttons {"Понятно"} default button 1 with icon caution
    end try
end checkWebDav
