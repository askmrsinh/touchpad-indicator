#!/bin/sh
SEP=`printf '\t'`
OUTPUT=/dev/stderr
CWD=`pwd`
SRCDIR=`dirname $0`

run_lint() {
  eslint -f unix "$@" .
}

parse_opts() {
  tmp=`getopt -l output: o: "$@"`
  [ $? -ne 0 ] && exit 1

  eval set -- $tmp
  while true
  do
    case $1 in
      --output|-o)
        OUTPUT=`realpath $2`; shift 2; continue ;;
      --)
        shift; break ;;
    esac
  done
}

# delete lines that don't start with '/',
# replace the first space with tab, sort
process_for_join() {
  sed -E "/\//!d; s|(\S+)\s|\1$SEP|" | sort -k 1b,1
}

# re-replace tab with space
process_post_join() {
  sed -E "s|$SEP| |"
}

create_report() {
  tmp1=`mktemp --tmpdir lint-XXXX`
  run_lint | process_for_join > $tmp1

  tmp2=`mktemp --tmpdir lint-XXXX`
  run_lint -c lint/eslintrc-legacy.json | process_for_join > $tmp2

  join -t"$SEP" -o '0,1.2' $tmp1 $tmp2 | process_post_join
  rm $tmp1 $tmp2
}


parse_opts "$@"

cd $SRCDIR/..

create_report | tee $OUTPUT | grep -q .
rv=$(( $? == 0 ))

cd $CWD

[ $rv -eq 0 -a -f $OUTPUT ] && rm $OUTPUT

exit $rv
