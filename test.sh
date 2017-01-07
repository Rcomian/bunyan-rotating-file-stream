#!/bin/bash

. ~/.nvm/nvm.sh
. ~/.bashrc

declare -a VERSIONS=("0.12.9" "0.12" "4" "6" "7")

if [ $# -eq 1 ]
then
    VERSIONS=($1)
    echo "Single version, no stress test"
fi

if [ $# -eq 2 ]
then
    VERSIONS=($1)
    APIKEY=$2
    echo "Single version, running stress"
fi

echo ${VERSIONS[@]}
for nodeversion in ${VERSIONS[@]}
do
    nvm install $nodeversion

    rm -Rf node_modules
    nvm exec $nodeversion npm install

    echo
    echo "Test functionality"
    time nvm exec $nodeversion node test/functionality

    if [ $? -eq 0 ]
    then
        echo "Passed"
    else
        echo "Aborting"
        exit 1
    fi

    echo
    echo "Test performance"
    time nvm exec $nodeversion node test/performance

    if [ $# -eq 2 ]
    then
        echo
        echo "Stress test starting"
        nvm exec $nodeversion node test/stress ${APIKEY}
    fi
done

