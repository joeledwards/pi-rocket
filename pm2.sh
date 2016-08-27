#!/bin/bash
APP_NAME="pi-rocket"
APP_DIR=`pwd`

DATA_DIR=~/.pi-rocket
LOG_DIR=$DATA_DIR/log

mkdir -p $LOG_DIR

INFO_LOG=$LOG_DIR/info.log
ERROR_LOG=$LOG_DIR/error.log
PID_FILE=$DATA_DIR/$APP_NAME.pid

pm2 delete $APP_NAME
pm2 start $APP_DIR/server.js --name $APP_NAME -o $INFO_LOG -e $ERROR_LOG -p $PID_FILE
