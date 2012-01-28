using System;
using System.IO;

class LineCount {
    public static int lc(string file) {
        var reader = File.OpenText(file);
        var count  = 0;
        while(reader.ReadLine() != null) {
            count++;
        }
        return count; 
    }
    public static void Main(string[] files) {
        var total = 0;
        foreach(string file in files) {
            var count = lc(file);
            Console.WriteLine("{0,4} {1}", count, file);
            total += count;
        }
        if(files.Length > 1) {
            Console.WriteLine("{0,4} total", total);
        }
    }
}
