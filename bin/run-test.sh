#!/bin/bash

export COUCH_HOST='http://127.0.0.1:5984'

if [ ! -z $TRAVIS ]; then
  source ./bin/run-couchdb-on-travis.sh
fi

printf 'Waiting for host to start .'
WAITING=0
until $(curl --output /dev/null --silent --head --fail --max-time 2 $COUCH_HOST); do
    if [ $WAITING -eq 4 ]; then
        printf '\nHost failed to start\n'
        exit 1
    fi
    let WAITING=WAITING+1
    printf '.'
    sleep 5
done
printf '\nHost started :)'

: ${CLIENT:="node"}

if [ "$CLIENT" == "node" ]; then
    npm run test-node
else
    npm run test-browser
fi
