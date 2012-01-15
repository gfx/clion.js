#!/usr/bin/env perl
require 'rake/clean';

CLEAN.include('dist');
CLEAN.include('blib');

node_modules = File.join( File.dirname(__FILE__), 'node_modules' );
if(ENV['NODE_PATH'])
    ENV['NODE_PATH'] = node_modules + ':' + ENV['NODE_PATH'];
else
    ENV['NODE_PATH'] = node_modules;
end
ENV['PATH'] = File.join( node_modules, 'mocha/bin' ) + ':' + ENV['PATH'];

SRC_FILES = Dir.glob("lib/**/*.js");

task :default => [ 'dist/clion.min.js' ];

desc 'generate clion/meta.js from mono source code tree';
task :gen     => [ 'lib/meta.js' ];

desc 'install prerequisite modules';
task :init => [ ] do
    sh 'npm', 'install';
    sh 'brew', 'install', 'closure-compiler';
end

desc 'runs the tests';
task :test => [ ] do
    sh 'mocha';
end
desc 'runs the tests in verbose';
task :vtest => [ ] do
    ENV['CLION_TEST_VERBOSE'] = '1';
    sh 'mocha', '--reporter', 'spec';
end

desc 'installs dependencies';
task :installdeps => [ ] do
    sh 'npm', 'install';
end

directory 'dist';

file 'lib/meta.js' => [ 'tool/meta.PL' ] do |t|
    sh 'tool/meta.PL > ' + t.name;
end

directory 'blib';
file 'dist/clion.js' => [ 'blib', *SRC_FILES ] do |t|
    src = [ *SRC_FILES ];
    
    src.each do |file|
        cp file, 'blib';
    end

    sh './node_modules/browserbuild/bin/browserbuild',
        '--global', 'Clion',
        '--filename', 'clion.js',
        '--main', 'clion.js',
        'blib'
    ;
end

file 'dist/clion.min.js' => [ 'dist/clion.js' ] do |t|
    opts = [ ];
    t.prerequisites.map do |file|
        opts.push('--js');
        opts.push(file);
    end

    sh 'closure',
        #'--compilation_level', 'ADVANCED_OPTIMIZATIONS',
        '--jscomp_off', 'internetExplorerChecks',
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
