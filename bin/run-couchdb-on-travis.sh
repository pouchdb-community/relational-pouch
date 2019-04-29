#!/usr/bin/env bash

COUCH_PORT=5984
if [ "$SERVER" = "couchdb-master" ]; then
  # Install CouchDB 2.X (clustered)
  docker run -d -p 5984:5984 apache/couchdb:latest --with-haproxy --with-admin-party-please -n 1
else
  # Install CouchDB 1.X
  docker run -d -p 5984:5984 apache/couchdb:1
fi

# wait for couchdb to start, add cors
npm install add-cors-to-couchdb
while [ '200' != $(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:${COUCH_PORT}) ]; do
  echo waiting for couch to load... ;
  sleep 1;
done
./node_modules/.bin/add-cors-to-couchdb http://127.0.0.1:${COUCH_PORT}