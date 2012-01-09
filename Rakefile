#!/usr/bin/env perl
require 'rake/clean';

CLEAN.include('dist');

SRC_FILES = Dir.glob("lib/**/*.js");

task :default => [ 'dist/clion.min.js' ];
task :gen     => [ 'lib/clion/meta.js' ];


desc 'runs the tests';
task :test => [ :default ] do 
    sh 'mocha';
end

desc 'installs dependencies';
task :installdeps => [ ] do 
    sh 'npm', 'install';
end

directory 'dist';

file 'lib/clion/meta.js' => [ 'tool/meta.PL' ] do |t|
    sh 'tool/meta.PL > ' + t.name;
end

file 'dist/clion.js' => [ *SRC_FILES ] do |t|
    sh './node_modules/browserbuild/bin/browserbuild',
        '--global', 'Clion',
        '--filename', 'clion.js',
        '--main', 'clion.js',
        #*t.prerequisites
        'lib'
    ;
end

file 'dist/clion.min.js' => [ 'dist/clion.js' ] do |t|
    opts = [ ];
    t.prerequisites.map do |file|
        opts.push('--js');
        opts.push(file);
    end

    sh 'closure', '--jscomp_off', 'internetExplorerChecks',
        '--js_output_file', t.name,
        *opts;
    sh 'node', '-e', 'require("./dist/clion.min.js"); console.log("Clion versin: %j", Clion.version)';
end

