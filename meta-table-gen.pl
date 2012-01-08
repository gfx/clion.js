#!/usr/bin/env perl
use 5.14.0;
use strict;
use warnings FATAL => 'all';
use autodie;

my $mono_metadata = <~/repo/mono/mono/metadata/metadata.c>;

open my $fh, '<', $mono_metadata;
while(<$fh>) {
    last if /const static unsigned char TableSchemas/;
}

my @schemas;
my %schema_of;
my $c;
while(<$fh>) {
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

# to refer as TableSchema.TABLE_NAME.FieldName
say 'var TableSchema = {';
foreach my $schema(@schemas) {
    my $name = $schema->{name};
    $name =~ s/_SCHEMA_OFFSET$//;
    say ' ' x 4, $name, ': {';

    foreach my $field(@{ $schema->{fields} }) {
        say ' ' x 8, $field, ': ', $schema->{field_of}{$field}, ',';
    }

    say ' ' x 4, '},';
}
say '}; // end of TableSchema';

