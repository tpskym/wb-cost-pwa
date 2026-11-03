on open location requestURL
    try
        set resourceFolder to POSIX path of (path to resource "open-file.sh")
        do shell script "/bin/sh " & quoted form of resourceFolder & " " & quoted form of requestURL
    on error messageText
        display dialog "Не удалось открыть сохранённый файл." & return & messageText & return & "Выберите ту же папку в Мастерской и при установке компонента. Приложение по умолчанию меняется в Finder → Свойства → Открывать в программе → Настроить всё." buttons {"Понятно"} default button 1 with icon caution
    end try
end open location

on run
    display dialog "Компонент Мастерской установлен. Сохраните модель или этикетку в приложении и нажмите «Открыть на Mac». Для смены папки повторите установку компонента." buttons {"Понятно"} default button 1
end run
