on run
    try
        set workingFolder to POSIX path of (choose folder with prompt "Выберите ТУ ЖЕ рабочую папку, что указана в Мастерской кнопкой «Папка label / model»")
        set userHome to POSIX path of (path to home folder)
        set destinationFolder to userHome & "Applications/"
        set targetApp to destinationFolder & "Workshop File Opener.app"
        set configFolder to userHome & "Library/Application Support/WorkshopFileOpener/"
        set builderSource to POSIX path of (path to resource "build-helper.sh")
        -- Compile locally with built-in tools; no administrator rights required.
        set temporaryFolder to do shell script "/usr/bin/mktemp -d /tmp/workshop-install.XXXXXXXX"
        set builtApp to temporaryFolder & "/Workshop File Opener.app"
        do shell script "/bin/sh " & quoted form of builderSource & " " & quoted form of builtApp
        do shell script "/bin/mkdir -p " & quoted form of destinationFolder & " " & quoted form of configFolder
        do shell script "/usr/bin/ditto " & quoted form of builtApp & " " & quoted form of targetApp
        do shell script "/usr/bin/printf %s " & quoted form of workingFolder & " > " & quoted form of (configFolder & "folder.txt")
        do shell script "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f " & quoted form of targetApp
        do shell script "/bin/rm -rf " & quoted form of temporaryFolder
        display dialog "Готово. Рабочая папка: " & workingFolder & return & "В Мастерской → Бэкап включите «Компонент установлен» и сохраните файл. Кнопка «Открыть на Mac» откроет его в программе по умолчанию." & return & "Для модели назначьте Bambu Studio, для PDF — удобную программу: Finder → Свойства файла → Открывать в программе → Настроить всё." buttons {"Готово"} default button 1
    on error messageText number errorNumber
        if errorNumber is not -128 then display dialog messageText buttons {"Понятно"} default button 1 with icon caution
    end try
end run
