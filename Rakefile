#!/usr/bin/env perl
require 'rake/clean';

CLEAN.include('clion.min.js');

SRC_FILES = Dir.glob("lib/**/*.js");

task :default => ['clion.min.js'];

desc 'runs the tests';
task :test => [ :default ] do 
    sh 'mocha';
end

desc 'installs dependencies';
task :installdeps => [ ] do 
    sh 'npm', 'install';
end

file 'clion.min.js' => [*SRC_FILES] do |t|
    opts = [ ];
    t.prerequisites.map do |file|
        opts.push('--js');
        opts.push(file);
    end

    sh 'closure', '--jscomp_off', 'internetExplorerChecks',
        '--js_output_file', t.name,
        *opts;
    sh 'node', '-e', 'console.log("Clion versin: %j", require("./clion.min.js").Clion.version)';
end

