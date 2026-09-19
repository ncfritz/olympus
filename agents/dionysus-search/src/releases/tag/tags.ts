// Audio channels
import type { SearchResultTagType } from "@ncfritz/olympus-sdk/dionysus";
import mono10 from "./spec/audio/channel/mono10.json" with { type: "json" };
import stereo20 from "./spec/audio/channel/stereo20.json" with { type: "json" };
import sound30 from "./spec/audio/channel/sound30.json" with { type: "json" };
import sound40 from "./spec/audio/channel/sound40.json" with { type: "json" };
import surround51 from "./spec/audio/channel/surround51.json" with { type: "json" };
import surround61 from "./spec/audio/channel/surround61.json" with { type: "json" };
import surround71 from "./spec/audio/channel/surround71.json" with { type: "json" };
// Audio formats
import aac from "./spec/audio/format/aac.json" with { type: "json" };
import atmos from "./spec/audio/format/atmos.json" with { type: "json" };
import atmosDdPlus from "./spec/audio/format/atmosDdPlus.json" with { type: "json" };
import atmosTrueHd from "./spec/audio/format/atmosTrueHd.json" with { type: "json" };
import dd from "./spec/audio/format/dd.json" with { type: "json" };
import ddPlus from "./spec/audio/format/ddPlus.json" with { type: "json" };
import dts from "./spec/audio/format/dts.json" with { type: "json" };
import dtsEs from "./spec/audio/format/dtsEs.json" with { type: "json" };
import dtsHdHra from "./spec/audio/format/dtsHdHra.json" with { type: "json" };
import dtsHdMa from "./spec/audio/format/dtsHdMa.json" with { type: "json" };
import dtsX from "./spec/audio/format/dtsX.json" with { type: "json" };
import flac from "./spec/audio/format/flac.json" with { type: "json" };
import mp3 from "./spec/audio/format/mp3.json" with { type: "json" };
import opus from "./spec/audio/format/opus.json" with { type: "json" };
import pcm from "./spec/audio/format/pcm.json" with { type: "json" };
import trueHd from "./spec/audio/format/trueHd.json" with { type: "json" };
// HDR
import dvBoost from "./spec/video/hdr/dvBoost.json" with { type: "json" };
import dvDisk from "./spec/video/hdr/dvDisk.json" with { type: "json" };
import dvNoHdrFallback from "./spec/video/hdr/dvNoHdrFallback.json" with { type: "json" };
import hdr from "./spec/video/hdr/hdr.json" with { type: "json" };
import hdr10PlusDvBoost from "./spec/video/hdr/hdr10PlusDvBoost.json" with { type: "json" };
import sdr from "./spec/video/hdr/sdr.json" with { type: "json" };
import sdrNoWebDl from "./spec/video/hdr/sdrNoWebDl.json" with { type: "json" };
// Movie versions
import remaster4K from "./spec/movie/version/remaster4K.json" with { type: "json" };
import criterionCollection from "./spec/movie/version/criterionCollection.json" with { type: "json" };
import hybrid from "./spec/movie/version/hybrid.json" with { type: "json" };
import imax from "./spec/movie/version/imax.json" with { type: "json" };
import imaxEnhanced from "./spec/movie/version/imaxEnhanced.json" with { type: "json" };
import mastersOfCinema from "./spec/movie/version/mastersOfCinema.json" with { type: "json" };
import openMatte from "./spec/movie/version/openMatte.json" with { type: "json" };
import remaster from "./spec/movie/version/remaster.json" with { type: "json" };
import specialEdition from "./spec/movie/version/specialEdition.json" with { type: "json" };
import theatricalCut from "./spec/movie/version/theatricalCut.json" with { type: "json" };
import vinegarSyndrome from "./spec/movie/version/vinegarSyndrome.json" with { type: "json" };
// Unwanted
import av1 from "./spec/unwanted/av1.json" with { type: "json" };
import brDisk from "./spec/unwanted/brDisk.json" with { type: "json" };
import extras from "./spec/unwanted/extras.json" with { type: "json" };
import generatedDynamicHdr from "./spec/unwanted/generatedDynamicHdr.json" with { type: "json" };
import lq from "./spec/unwanted/lq.json" with { type: "json" };
import lqReleaseTitle from "./spec/unwanted/lqReleaseTitle.json" with { type: "json" };
import singalong from "./spec/unwanted/singalong.json" with { type: "json" };
import threeD from "./spec/unwanted/threeD.json" with { type: "json" };
import upscaled from "./spec/unwanted/upscaled.json" with { type: "json" };
import x265hd from "./spec/unwanted/x265hd.json" with { type: "json" };
// Streaming services
import amzn from "./spec/streaming/amzn.json" with { type: "json" };
import atv from "./spec/streaming/atv.json" with { type: "json" };
import atvPlus from "./spec/streaming/atvPlus.json" with { type: "json" };
import bcore from "./spec/streaming/bcore.json" with { type: "json" };
import crit from "./spec/streaming/crit.json" with { type: "json" };
import dsnp from "./spec/streaming/dsnp.json" with { type: "json" };
import hbo from "./spec/streaming/hbo.json" with { type: "json" };
import hmax from "./spec/streaming/hmax.json" with { type: "json" };
import hulu from "./spec/streaming/hulu.json" with { type: "json" };
import it from "./spec/streaming/it.json" with { type: "json" };
import ma from "./spec/streaming/ma.json" with { type: "json" };
import max from "./spec/streaming/max.json" with { type: "json" };
import nf from "./spec/streaming/nf.json" with { type: "json" };
import pcok from "./spec/streaming/pcok.json" with { type: "json" };
import play from "./spec/streaming/play.json" with { type: "json" };
import pmtp from "./spec/streaming/pmtp.json" with { type: "json" };
import roku from "./spec/streaming/roku.json" with { type: "json" };
import stan from "./spec/streaming/stan.json" with { type: "json" };
// Release groups
import badDualGroups from "./spec/groups/badDualGroups.json" with { type: "json" };
import hdBlurayTier01 from "./spec/groups/hdBlurayTier01.json" with { type: "json" };
import hdBlurayTier02 from "./spec/groups/hdBlurayTier02.json" with { type: "json" };
import hdBlurayTier03 from "./spec/groups/hdBlurayTier03.json" with { type: "json" };
import noReleaseGroup from "./spec/groups/noReleaseGroup.json" with { type: "json" };
import remuxTier1 from "./spec/groups/remuxTier1.json" with { type: "json" };
import remuxTier2 from "./spec/groups/remuxTier2.json" with { type: "json" };
import remuxTier3 from "./spec/groups/remuxTier3.json" with { type: "json" };
import uhdBlurayTier01 from "./spec/groups/uhdBlurayTier01.json" with { type: "json" };
import uhdBlurayTier02 from "./spec/groups/uhdBlurayTier02.json" with { type: "json" };
import uhdBlurayTier03 from "./spec/groups/uhdBlurayTier03.json" with { type: "json" };
import webTier1 from "./spec/groups/webTier1.json" with { type: "json" };
import webTier2 from "./spec/groups/webTier2.json" with { type: "json" };
import webTier3 from "./spec/groups/webTier3.json" with { type: "json" };
// Misc
import blackAndWhite from "./spec/misc/blackAndWhite.json" with { type: "json" };
import hrf from "./spec/misc/hrf.json" with { type: "json" };
import internal from "./spec/misc/internal.json" with { type: "json" };
import lineMicDubbed from "./spec/misc/lineMicDubbed.json" with { type: "json" };
import multi from "./spec/misc/multi.json" with { type: "json" };
import obfuscated from "./spec/misc/obfuscated.json" with { type: "json" };
import repack2 from "./spec/misc/repack2.json" with { type: "json" };
import repack3 from "./spec/misc/repack3.json" with { type: "json" };
import repackProper from "./spec/misc/repackProper.json" with { type: "json" };
import retags from "./spec/misc/retags.json" with { type: "json" };
import scene from "./spec/misc/scene.json" with { type: "json" };
import withAd from "./spec/misc/withAd.json" with { type: "json" };
// Resolution
import resolution720p from "./spec/resolution/resolution720p.json" with { type: "json" };
import resolution1080p from "./spec/resolution/resolution1080p.json" with { type: "json" };
import resolution2160 from "./spec/resolution/resolution2160.json" with { type: "json" };
// Video codec
import mpeg2 from "./spec/video/codec/mpeg2.json" with { type: "json" };
import vc1 from "./spec/video/codec/vc1.json" with { type: "json" };
import vp9 from "./spec/video/codec/vp9.json" with { type: "json" };
import x264 from "./spec/video/codec/x264.json" with { type: "json" };
import x265 from "./spec/video/codec/x265.json" with { type: "json" };
import x265noHdrDv from "./spec/video/codec/x265noHdrDv.json" with { type: "json" };
import x266 from "./spec/video/codec/x266.json" with { type: "json" };

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
