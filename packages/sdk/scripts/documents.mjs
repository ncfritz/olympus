// The API documents the SDK generates a client from, by the client's name
// (@ncfritz/olympus-sdk/<api>), relative to this package. Each document's
// package is a devDependency, so Turbo writes it (`openapi`) first.
export const API_DOCUMENTS = {
  olympus: "../../apps/api/openapi/olympus.json",
  dionysus: "../../apps/api/openapi/dionysus.json",
  minerva: "../../apps/api/openapi/minerva.json",
  harpocrates: "../../apps/harpocrates/service/openapi/harpocrates.json",
};
