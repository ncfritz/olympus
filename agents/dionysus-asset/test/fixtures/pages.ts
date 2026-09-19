/** Trimmed-down pages and playlists of the sites the extractors read. */

export const MASTER_PLAYLIST = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080
1080p.m3u8
`;

export const MEDIA_PLAYLIST = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10,
seg-1.ts
#EXTINF:10,
seg-2.ts
#EXT-X-ENDLIST
`;

export const FMP4_MEDIA_PLAYLIST = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-MAP:URI="init.mp4"
#EXTINF:10,
seg-1.m4s
#EXTINF:10,
seg-2.m4s
#EXT-X-ENDLIST
`;

export const XV_PAGE = `<html><head><title>x</title></head><body>
<div id="video-player-bg">
<script>
  html5player.setVideoTitle('A sample title');
  html5player.setVideoHLS('https://cdn.example.com/xv/abc/hls.m3u8');
</script>
</div>
</body></html>`;

export const XV_PAGE_WITHOUT_HLS = `<html><head>
<script>
{
  "contentUrl": "https://cdn.example.com/xv/abc/video.mp4",
}
</script>
</head><body><div id="video-player-bg"></div></body></html>`;

export const PH_PAGE = `<html><body>
<h1><span class="inlineFree">A sample title</span></h1>
<div id="player">
<script>
  var flashvars_1 = {"mediaDefinitions":[{"quality":"480","videoUrl":"https://cdn.example.com/ph/480/master.m3u8"},{"quality":"720","videoUrl":"https://cdn.example.com/ph/720/master.m3u8"},{"quality":"1080","videoUrl":"https://cdn.example.com/ph/1080/master.m3u8"}]};
</script>
</div>
</body></html>`;

export const XH_PAGE = `<html><head>
<meta property="og:title" content="A sample title">
<link rel="preload" href="https://cdn.example.com/style.css">
<link rel="preload" href="https://cdn.example.com/xh/abc/master.m3u8">
</head><body></body></html>`;

export const DPV_PAGE = `<html><body>
<div class="headline"><h1>A sample title</h1></div>
</body></html>`;
