import { DIONYSUS_MODULES } from "../dionysus/DionysusModule";
import { MINERVA_MODULES } from "../minerva/MinervaModule";
import { OLYMPUS_MODULES } from "../olympus/OlympusModule";
import { Routes } from "../utils/routes";
import { OpenApiDocumentConfig } from "./documentBuilder";

export const OlympusApiConfig: OpenApiDocumentConfig = {
  name: "Olympus",
  route: Routes.OLYMPUS,
  modules: OLYMPUS_MODULES,
};

export const DionysusApiConfig: OpenApiDocumentConfig = {
  name: "Dionysus",
  route: Routes.DIONYSUS,
  modules: DIONYSUS_MODULES,
};

export const MinervaApiConfig: OpenApiDocumentConfig = {
  name: "Minerva",
  route: Routes.MINERVA,
  modules: MINERVA_MODULES,
};
