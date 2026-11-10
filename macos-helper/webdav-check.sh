#!/bin/sh
# Read-only check. The password goes to curl on stdin, never in its arguments.
set -eu
host=webdav.cloud.mail.ru
account=$(/usr/bin/security find-internet-password -s "$host" |
  /usr/bin/sed -n 's/.*"acct"<blob>="\([^"]*\)".*/\1/p')
if [ -z "$account" ]; then
  echo 'Подключите Облако Mail в Finder и сохраните пароль внешнего приложения в Связке ключей.' >&2
  exit 1
fi
password=$(/usr/bin/security find-internet-password -s "$host" -a "$account" -w)
case "$account$password" in
  *'
'*) echo 'Некорректные данные подключения' >&2; exit 1 ;;
esac
escaped=$(printf '%s' "$account:$password" | /usr/bin/sed 's/[\\"]/\\&/g')
status=$(printf 'user = "%s"\n' "$escaped" |
  /usr/bin/curl -q --config - --silent --show-error --max-time 20 \
    --request PROPFIND --header 'Depth: 0' --output /dev/null \
    --write-out '%{http_code}' "https://$host/")
unset password escaped
if [ "$status" != 207 ]; then
  printf 'Ошибка подключения к Облаку Mail (HTTP %s).\n' "$status" >&2
  exit 1
fi
echo 'Облако Mail доступно. Пароль получен из Связки ключей.'
