// Audio channels
import { SearchResultTagType } from "@ncfritz/olympus-sdk/dionysus";
import * as mono10 from "./spec/audio/channel/mono10.json";
import * as stereo20 from "./spec/audio/channel/stereo20.json";
import * as sound30 from "./spec/audio/channel/sound30.json";
import * as sound40 from "./spec/audio/channel/sound40.json";
import * as surround51 from "./spec/audio/channel/surround51.json";
import * as surround61 from "./spec/audio/channel/surround61.json";
import * as surround71 from "./spec/audio/channel/surround71.json";
// Audio formats
import * as aac from "./spec/audio/format/aac.json";
import * as atmos from "./spec/audio/format/atmos.json";
import * as atmosDdPlus from "./spec/audio/format/atmosDdPlus.json";
import * as atmosTrueHd from "./spec/audio/format/atmosTrueHd.json";
import * as dd from "./spec/audio/format/dd.json";
import * as ddPlus from "./spec/audio/format/ddPlus.json";
import * as dts from "./spec/audio/format/dts.json";
import * as dtsEs from "./spec/audio/format/dtsEs.json";
import * as dtsHdHra from "./spec/audio/format/dtsHdHra.json";
import * as dtsHdMa from "./spec/audio/format/dtsHdMa.json";
import * as dtsX from "./spec/audio/format/dtsX.json";
import * as flac from "./spec/audio/format/flac.json";
import * as mp3 from "./spec/audio/format/mp3.json";
import * as opus from "./spec/audio/format/opus.json";
import * as pcm from "./spec/audio/format/pcm.json";
import * as trueHd from "./spec/audio/format/trueHd.json";
// HDR
import * as dvBoost from "./spec/video/hdr/dvBoost.json";
import * as dvDisk from "./spec/video/hdr/dvDisk.json";
import * as dvNoHdrFallback from "./spec/video/hdr/dvNoHdrFallback.json";
import * as hdr from "./spec/video/hdr/hdr.json";
import * as hdr10PlusDvBoost from "./spec/video/hdr/hdr10PlusDvBoost.json";
import * as sdr from "./spec/video/hdr/sdr.json";
import * as sdrNoWebDl from "./spec/video/hdr/sdrNoWebDl.json";
// Movie versions
import * as remaster4K from "./spec/movie/version/remaster4K.json";
import * as criterionCollection from "./spec/movie/version/criterionCollection.json";
import * as hybrid from "./spec/movie/version/hybrid.json";
import * as imax from "./spec/movie/version/imax.json";
import * as imaxEnhanced from "./spec/movie/version/imaxEnhanced.json";
import * as mastersOfCinema from "./spec/movie/version/mastersOfCinema.json";
import * as openMatte from "./spec/movie/version/openMatte.json";
import * as remaster from "./spec/movie/version/remaster.json";
import * as specialEdition from "./spec/movie/version/specialEdition.json";
import * as theatricalCut from "./spec/movie/version/theatricalCut.json";
import * as vinegarSyndrome from "./spec/movie/version/vinegarSyndrome.json";
// Unwanted
import * as av1 from "./spec/unwanted/av1.json";
import * as brDisk from "./spec/unwanted/brDisk.json";
import * as extras from "./spec/unwanted/extras.json";
import * as generatedDynamicHdr from "./spec/unwanted/generatedDynamicHdr.json";
import * as lq from "./spec/unwanted/lq.json";
import * as lqReleaseTitle from "./spec/unwanted/lqReleaseTitle.json";
import * as singalong from "./spec/unwanted/singalong.json";
import * as threeD from "./spec/unwanted/threeD.json";
import * as upscaled from "./spec/unwanted/upscaled.json";
import * as x265hd from "./spec/unwanted/x265hd.json";
// Streaming services
import * as amzn from "./spec/streaming/amzn.json";
import * as atv from "./spec/streaming/atv.json";
import * as atvPlus from "./spec/streaming/atvPlus.json";
import * as bcore from "./spec/streaming/bcore.json";
import * as crit from "./spec/streaming/crit.json";
import * as dsnp from "./spec/streaming/dsnp.json";
import * as hbo from "./spec/streaming/hbo.json";
import * as hmax from "./spec/streaming/hmax.json";
import * as hulu from "./spec/streaming/hulu.json";
import * as it from "./spec/streaming/it.json";
import * as ma from "./spec/streaming/ma.json";
import * as max from "./spec/streaming/max.json";
import * as nf from "./spec/streaming/nf.json";
import * as pcok from "./spec/streaming/pcok.json";
import * as play from "./spec/streaming/play.json";
import * as pmtp from "./spec/streaming/pmtp.json";
import * as roku from "./spec/streaming/roku.json";
import * as stan from "./spec/streaming/stan.json";
// Release groups
import * as badDualGroups from "./spec/groups/badDualGroups.json";
import * as hdBlurayTier01 from "./spec/groups/hdBlurayTier01.json";
import * as hdBlurayTier02 from "./spec/groups/hdBlurayTier02.json";
import * as hdBlurayTier03 from "./spec/groups/hdBlurayTier03.json";
import * as noReleaseGroup from "./spec/groups/noReleaseGroup.json";
import * as remuxTier1 from "./spec/groups/remuxTier1.json";
import * as remuxTier2 from "./spec/groups/remuxTier2.json";
import * as remuxTier3 from "./spec/groups/remuxTier3.json";
import * as uhdBlurayTier01 from "./spec/groups/uhdBlurayTier01.json";
import * as uhdBlurayTier02 from "./spec/groups/uhdBlurayTier02.json";
import * as uhdBlurayTier03 from "./spec/groups/uhdBlurayTier03.json";
import * as webTier1 from "./spec/groups/webTier1.json";
import * as webTier2 from "./spec/groups/webTier2.json";
import * as webTier3 from "./spec/groups/webTier3.json";
// Misc
import * as blackAndWhite from "./spec/misc/blackAndWhite.json";
import * as hrf from "./spec/misc/hrf.json";
import * as internal from "./spec/misc/internal.json";
import * as lineMicDubbed from "./spec/misc/lineMicDubbed.json";
import * as multi from "./spec/misc/multi.json";
import * as obfuscated from "./spec/misc/obfuscated.json";
import * as repack2 from "./spec/misc/repack2.json";
import * as repack3 from "./spec/misc/repack3.json";
import * as repackProper from "./spec/misc/repackProper.json";
import * as retags from "./spec/misc/retags.json";
import * as scene from "./spec/misc/scene.json";
import * as withAd from "./spec/misc/withAd.json";
// Resolution
import * as resolution720p from "./spec/resolution/resolution720p.json";
import * as resolution1080p from "./spec/resolution/resolution1080p.json";
import * as resolution2160 from "./spec/resolution/resolution2160.json";
// Video codec
import * as mpeg2 from "./spec/video/codec/mpeg2.json";
import * as vc1 from "./spec/video/codec/vc1.json";
import * as vp9 from "./spec/video/codec/vp9.json";
import * as x264 from "./spec/video/codec/x264.json";
import * as x265 from "./spec/video/codec/x265.json";
import * as x265noHdrDv from "./spec/video/codec/x265noHdrDv.json";
import * as x266 from "./spec/video/codec/x266.json";

import { TagDefinition } from "./types";

export const TAGS: Record<SearchResultTagType, TagDefinition[]> = {
  audioChannel: [
    mono10 as unknown as TagDefinition,
    stereo20 as unknown as TagDefinition,
    sound30 as unknown as TagDefinition,
    sound40 as unknown as TagDefinition,
    surround51 as unknown as TagDefinition,
    surround61 as unknown as TagDefinition,
    surround71 as unknown as TagDefinition,
  ],
  audioFormat: [
    aac as unknown as TagDefinition,
    atmos as unknown as TagDefinition,
    atmosDdPlus as unknown as TagDefinition,
    atmosTrueHd as unknown as TagDefinition,
    dd as unknown as TagDefinition,
    ddPlus as unknown as TagDefinition,
    dts as unknown as TagDefinition,
    dtsEs as unknown as TagDefinition,
    dtsHdHra as unknown as TagDefinition,
    dtsHdMa as unknown as TagDefinition,
    dtsX as unknown as TagDefinition,
    flac as unknown as TagDefinition,
    mp3 as unknown as TagDefinition,
    opus as unknown as TagDefinition,
    pcm as unknown as TagDefinition,
    trueHd as unknown as TagDefinition,
  ],
  hdr: [
    dvBoost as unknown as TagDefinition,
    dvDisk as unknown as TagDefinition,
    dvNoHdrFallback as unknown as TagDefinition,
    hdr as unknown as TagDefinition,
    hdr10PlusDvBoost as unknown as TagDefinition,
    sdr as unknown as TagDefinition,
    sdrNoWebDl as unknown as TagDefinition,
  ],
  movieVersion: [
    remaster4K as unknown as TagDefinition,
    criterionCollection as unknown as TagDefinition,
    hybrid as unknown as TagDefinition,
    imax as unknown as TagDefinition,
    imaxEnhanced as unknown as TagDefinition,
    mastersOfCinema as unknown as TagDefinition,
    openMatte as unknown as TagDefinition,
    remaster as unknown as TagDefinition,
    specialEdition as unknown as TagDefinition,
    theatricalCut as unknown as TagDefinition,
    vinegarSyndrome as unknown as TagDefinition,
  ],
  unwanted: [
    av1 as unknown as TagDefinition,
    brDisk as unknown as TagDefinition,
    extras as unknown as TagDefinition,
    generatedDynamicHdr as unknown as TagDefinition,
    lq as unknown as TagDefinition,
    lqReleaseTitle as unknown as TagDefinition,
    singalong as unknown as TagDefinition,
    threeD as unknown as TagDefinition,
    upscaled as unknown as TagDefinition,
    x265hd as unknown as TagDefinition,
  ],
  streamingServices: [
    amzn as unknown as TagDefinition,
    atv as unknown as TagDefinition,
    atvPlus as unknown as TagDefinition,
    bcore as unknown as TagDefinition,
    crit as unknown as TagDefinition,
    dsnp as unknown as TagDefinition,
    hbo as unknown as TagDefinition,
    hmax as unknown as TagDefinition,
    hulu as unknown as TagDefinition,
    it as unknown as TagDefinition,
    ma as unknown as TagDefinition,
    max as unknown as TagDefinition,
    nf as unknown as TagDefinition,
    pcok as unknown as TagDefinition,
    play as unknown as TagDefinition,
    pmtp as unknown as TagDefinition,
    roku as unknown as TagDefinition,
    stan as unknown as TagDefinition,
  ],
  releaseGroups: [
    badDualGroups as unknown as TagDefinition,
    hdBlurayTier01 as unknown as TagDefinition,
    hdBlurayTier02 as unknown as TagDefinition,
    hdBlurayTier03 as unknown as TagDefinition,
    noReleaseGroup as unknown as TagDefinition,
    remuxTier1 as unknown as TagDefinition,
    remuxTier2 as unknown as TagDefinition,
    remuxTier3 as unknown as TagDefinition,
    uhdBlurayTier01 as unknown as TagDefinition,
    uhdBlurayTier02 as unknown as TagDefinition,
    uhdBlurayTier03 as unknown as TagDefinition,
    webTier1 as unknown as TagDefinition,
    webTier2 as unknown as TagDefinition,
    webTier3 as unknown as TagDefinition,
  ],
  misc: [
    blackAndWhite as unknown as TagDefinition,
    hrf as unknown as TagDefinition,
    internal as unknown as TagDefinition,
    lineMicDubbed as unknown as TagDefinition,
    multi as unknown as TagDefinition,
    obfuscated as unknown as TagDefinition,
    repack2 as unknown as TagDefinition,
    repack3 as unknown as TagDefinition,
    repackProper as unknown as TagDefinition,
    retags as unknown as TagDefinition,
    scene as unknown as TagDefinition,
    withAd as unknown as TagDefinition,
  ],
  resolution: [
    resolution720p as unknown as TagDefinition,
    resolution1080p as unknown as TagDefinition,
    resolution2160 as unknown as TagDefinition,
  ],
  videoCodec: [
    mpeg2 as unknown as TagDefinition,
    vc1 as unknown as TagDefinition,
    vp9 as unknown as TagDefinition,
    x264 as unknown as TagDefinition,
    x265 as unknown as TagDefinition,
    x265noHdrDv as unknown as TagDefinition,
    x266 as unknown as TagDefinition,
  ],
};
