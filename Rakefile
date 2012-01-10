#!/usr/bin/env perl
require 'rake/clean';


CLEAN.include('dist');

SRC_FILES = Dir.glob("lib/**/*.js");

task :default => [ 'dist/clion.min.js' ];
task :gen     => [ 'lib/clion/meta.js' ];


desc 'runs the tests';
task :test => [ ] do 
    sh 'mocha';
end
desc 'runs the tests in verbose';
task :vtest => [ ] do 
    sh 'mocha', '--reporter', 'spec';
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

directory 'ph';
task :h2ph => [ 'ph' ] do
    mono_dir = File.join( ENV["HOME"] + '/repo/mono/');
    dest_dir = File.expand_path("ph");
    cd(mono_dir) do
        sh 'h2ph', '-d', dest_dir, 'mono/metadata/metadata.c',*Dir.glob("mono/**/*.h");
    end
    sh 'patch < fixer/mono-metadata-blob.h.diff';
end

directory 'xs';
task :h2xs => [ 'xs' ] do
    # doesn't work, unfortunately :(
    mono_dir = File.join( ENV["HOME"] + '/repo/mono/');
    sh 'h2xs', '-F', '-I'+mono_dir, '-ABCOP', '-x', '-n', 'Mono', *Dir.glob( mono_dir + "mono/metadata/metadata.h");
end
