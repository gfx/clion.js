#!/usr/bin/env perl
use strict;
use warnings;

my($name) = @ARGV or die;

system 'mcs', $name;

$name =~ s/\.cs$/.exe/;
system 'monodis', $name;
unlink $name;

