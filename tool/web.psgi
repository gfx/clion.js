#!perl
use 5.14.0;
use warnings;
use utf8;
use Plack::App::Directory;
use Router::Simple;

my $router = Router::Simple->new;
$router->connect('/example/:name.exe', { action => 'compile' });
$router->connect('/example/:name.cil', { action => 'disassemble' });

my $provider = Plack::App::Directory->new->to_app;

sub main {
    my($env) = @_;

    if(my $p = $router->match($env)) {
        if($p->{action} eq 'disassemble') {
            my $exe = "example/$p->{name}.exe";
            if(-f $exe) {
                my $content = `monodis $exe`;
                return [
                    200,
                    [
                        'Content-Type' => 'text/plain; charset=utf-8',
                        'Content-Length' => length($content),
                    ],
                    [ $content ],
                ];
            }
        }
    }

    return $provider->($env); # fallback to PAD
}

return \&main;

