using System;

class Foreach {
    public static void Main(string[] args) {
        foreach(var s in args) {
            Console.WriteLine(s);
        }
    }
}

