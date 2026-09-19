/** A two-file NZB: the media file (2 segments) and a par2 (1 segment). */
export const NZB_XML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <head>
    <meta type="title">Some.Movie.2019.1080p</meta>
    <meta type="password">secret</meta>
    <meta type="tag"> HD </meta>
    <meta type="category">Movies</meta>
  </head>
  <file poster="poster@example.com" date="1571500000" subject="[1/2] - &quot;Some.Movie.2019.1080p.mkv&quot; yEnc (1/2)">
    <groups>
      <group>alt.binaries.movies</group>
      <group>alt.binaries.hdtv</group>
    </groups>
    <segments>
      <segment bytes="700" number="2">part2@example.com</segment>
      <segment bytes="1000" number="1">part1@example.com</segment>
    </segments>
  </file>
  <file poster="poster@example.com" date="1571500000" subject="[2/2] - &quot;Some.Movie.2019.1080p.par2&quot; yEnc (1/1)">
    <groups>
      <group>alt.binaries.movies</group>
    </groups>
    <segments>
      <segment bytes="100" number="1">par@example.com</segment>
    </segments>
  </file>
</nzb>
`;
