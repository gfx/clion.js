#!/usr/bin/env perl
use 5.14.0;
use strict;
use warnings FATAL => 'all';
use autodie;
use Data::Dumper;

=for comment

a TableSchema has: name, fields, typemap of fields

schema.name    :String
schema.fields  :Array
schema.type_of :HashMap

=cut

my $mono = <~/repo/mono>;
my $mono_metadata = "$mono/mono/metadata/metadata.c";
my $mono_tabledef = "$mono/mono/cil/tables.def";

# Table Definitions
my @table_defs;
{
    open my $fh, '<', $mono_tabledef;
    while(<$fh>) {
        if(/MONO_(\w+), \s+ "(\w+)"/xms) {
            push @table_defs, [ $1, $2 ];
        }
    }
}


# Schemas of Each Table
my @schemas;
my %schema_of;
{
    my $c;
    open my $fh, '<', $mono_metadata;
    while(<$fh>) {
        last if /TableSchemas \s* \[\]/xms;
    }

    while(<$fh>) {
        last if /\};/;

        if(/\#define \s+ (\w+_OFFSET) \s+ (?: (\w+) \s+ \+ \s+)? (\d+)/xms) {
            my($name, $pre, $pre_elems) = ($1, $2, $3);
            my $offset = $pre_elems;
            $offset += $schema_of{$pre}{offset} if $pre;

            push @schemas, $schema_of{$name} = $c = {
                name => $name,
                offset => $offset,
                fields => [],
                field_of => {},
            };
        }
        elsif(m{MONO_ (\w+), \s+ \/\* \s+ "(\w+)"}xms) {
            my($type, $name) = ($1, $2);
            push $c->{fields}, $name;
            $c->{field_of}{$name} = $type;
        }
    }
}
# Mapping to Schema and Definition
my %description;
{
    my $c;
    open my $fh, '<', $mono_metadata;
    while(<$fh>) {
        last if /table_description \s* \[\]/xms;
    }

    my $idx = 0;
    while(<$fh>) {
        last if /\};/;

        if(/(\w+_SCHEMA_OFFSET)/xms) {
            $description{$idx++} = $1;
        }
    }
}
say 'var TableSchema = [';
my $idx = 0;
foreach my $pair(@table_defs) {
    my($sym, $name) = @{$pair};
    my $schema_name = $description{$idx++} or die "no description entry for $sym";
    my $schema = $schema_of{$schema_name}  or die "no schema of $schema_name";
    say ' ' x 4, '{';
    {
        say ' ' x 8, sprintf 'name: "%s",', $name;

        say ' ' x 8, 'fields: [';
        foreach my $field(@{ $schema->{fields} }) {
            say ' ' x 12, sprintf '["%s", %s],',
                $field, $schema->{field_of}{$field};
        }
        say ' ' x 8., '],';
    }
    say ' ' x 4, '},';
}
say ']; // end of TableSchema';

