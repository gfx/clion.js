#!/usr/bin/env perl
use 5.10.0;
use strict;
use warnings;
use autodie;
use Daiku;
use File::Zglob qw(zglob);
use Data::Dumper;

my @SRC_FILES = zglob("lib/**/*.js");

sub sh {
    say "@_";
    system(@_) == 0 or die;
}
task clean => [ ] => sub {
    unlink 'clion.min.js';
};

file 'clion.min.js' => [@SRC_FILES] => sub {
    my($task) = @_;
    eval {
        sh 'closure', '--jscomp_off' => 'internetExplorerChecks',
            '--js_output_file' => $task->dst,
            map { ('--js' => $_) } @{$task->deps()};
        sh 'node', '-e', 'console.log("Clion versin: %j", require("./clion.min.js").Clion.version)';
    };
    if($@) {
        unlink $task->dst;
        die $@;
    }
};

build( shift(@ARGV) || 'clion.min.js' );

