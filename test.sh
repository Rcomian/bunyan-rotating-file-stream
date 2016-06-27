#!/bin/bash

. ~/.nvm/nvm.sh
. ~/.bashrc

declare -a VERSIONS=("0.12.9" "0.12" "4" "6")

if [ $# -eq 2 ]
then
    VERSIONS=($1)
    APIKEY=$2
    echo "Single version, running stress"
fi

echo ${VERSIONS[@]}
for arg in ${VERSIONS[@]}
do
    nvm install $arg

    rm -Rf node_modules
    nvm exec $arg npm install

    echo
    echo "Test functionality"
    time nvm exec $arg node test/functionality

    echo
    echo "Test performance"
    time nvm exec $arg node test/performance

    if [ $# -eq 2 ]
    then
        echo
        echo "Stress test starting"
        nvm exec $arg node test/stress ${APIKEY}
    fi
done

