on open location requestURL
    try
        if requestURL is "workshop-files://extract/card-design" then
            set archiveFile to choose file with prompt "Выберите скачанный ZIP материалов карточки" of type {"public.zip-archive"}
            set destinationFolder to choose folder with prompt "Куда распаковать материалы карточки?"
            set resourceFolder to POSIX path of (path to resource "open-file.sh")
            do shell script "/bin/sh " & quoted form of resourceFolder & " --extract " & quoted form of POSIX path of archiveFile & " " & quoted form of POSIX path of destinationFolder
            return
        end if
        set resourceFolder to POSIX path of (path to resource "open-file.sh")
        do shell script "/bin/sh " & quoted form of resourceFolder & " " & quoted form of requestURL
    on error messageText number errorNumber
        if errorNumber is -128 then return
        display dialog "Не удалось открыть сохранённый файл." & return & messageText & return & "Для Safari дождитесь скачивания, затем повторите открытие. При установке компонента выберите рабочую папку и папку загрузок Safari. Приложение по умолчанию меняется в Finder → Свойства → Открывать в программе → Настроить всё." buttons {"Понятно"} default button 1 with icon caution
    end try
end open location

on run
    display dialog "Компонент Мастерской установлен. Сохраните модель или этикетку в приложении и нажмите «Открыть на Mac». Для смены папки повторите установку компонента." buttons {"Понятно"} default button 1
end run
