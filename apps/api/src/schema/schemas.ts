import { AuthModule } from "../auth/AuthModule";
import { DIONYSUS_MODULES } from "../dionysus/DionysusModule";
import { MINERVA_MODULES } from "../minerva/MinervaModule";
import { OLYMPUS_MODULES } from "../olympus/OlympusModule";
import { Routes } from "../utils/routes";
import { OpenApiDocumentConfig } from "./documentBuilder";

export const OlympusApiConfig: OpenApiDocumentConfig = {
  name: "Olympus",
  route: Routes.OLYMPUS,
  // AuthModule is in the document but deliberately not among
  // OLYMPUS_MODULES: signing in is platform-wide rather than a feature
  // served under /olympus, and the module is global, so OlympusModule has no
  // business importing it. The document is where it belongs, because the
  // site, the iOS app and the auth tester all generate their clients from
  // it — an endpoint absent from the document is an endpoint nobody can
  // call without reading the source.
  modules: [AuthModule, ...OLYMPUS_MODULES],
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

/** Every document the API serves. */
export const API_DOCUMENTS: OpenApiDocumentConfig[] = [
  OlympusApiConfig,
  DionysusApiConfig,
  MinervaApiConfig,
];
